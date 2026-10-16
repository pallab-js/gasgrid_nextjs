import "server-only";
import crypto from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { scryptVerify } from "./password";
import { sessions, users, type Role, type User } from "./schema";

export const SESSION_COOKIE = "gasnext_session";
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Secure cookies require HTTPS. Default on in production; allow an explicit
 * override (GASNEXT_COOKIE_SECURE=1/0) for TLS-terminated LAN deployments or
 * plain-HTTP localhost dev.
 */
const COOKIE_SECURE =
  process.env.GASNEXT_COOKIE_SECURE === "1"
    ? true
    : process.env.GASNEXT_COOKIE_SECURE === "0"
      ? false
      : process.env.NODE_ENV === "production";

const ROLE_RANK: Record<Role, number> = { viewer: 0, operator: 1, admin: 2 };

export type AuthResult =
  | { ok: true }
  | { ok: false; error: string };

/* ── login throttle (in-process; appropriate for the single-process,
   offline deployment model) ── */

const MAX_FREE_ATTEMPTS = 5; // failures before lockout kicks in
const LOCKOUT_BASE_MS = 15_000; // first lockout after the free attempts
const LOCKOUT_MAX_MS = 15 * 60_000; // cap at 15 minutes
const ATTEMPT_WINDOW_MS = 30 * 60_000; // forget stale failures after 30 min

type Attempt = { fails: number; lockedUntil: number; last: number };

const throttle = globalThis as typeof globalThis & {
  __gasnextLoginAttempts?: Map<string, Attempt>;
};
function attempts(): Map<string, Attempt> {
  throttle.__gasnextLoginAttempts ??= new Map();
  return throttle.__gasnextLoginAttempts;
}

/** Returns remaining lockout ms (0 when the caller may attempt a login). */
function lockoutRemaining(key: string, now: number): number {
  const a = attempts().get(key);
  if (!a) return 0;
  if (now - a.last > ATTEMPT_WINDOW_MS) {
    attempts().delete(key);
    return 0;
  }
  return a.lockedUntil > now ? a.lockedUntil - now : 0;
}

function recordFailure(key: string, now: number): void {
  const a = attempts().get(key) ?? { fails: 0, lockedUntil: 0, last: now };
  a.fails += 1;
  a.last = now;
  if (a.fails > MAX_FREE_ATTEMPTS) {
    const over = a.fails - MAX_FREE_ATTEMPTS; // 1, 2, 3, ...
    const backoff = Math.min(
      LOCKOUT_BASE_MS * 2 ** (over - 1),
      LOCKOUT_MAX_MS
    );
    a.lockedUntil = now + backoff;
  }
  attempts().set(key, a);
}

function clearFailures(key: string): void {
  attempts().delete(key);
}

export async function login(
  username: string,
  password: string,
  userAgent?: string
): Promise<AuthResult> {
  const db = getDb();
  const key = username.trim().toLowerCase();
  const now = Date.now();

  const wait = lockoutRemaining(key, now);
  if (wait > 0) {
    const secs = Math.ceil(wait / 1000);
    return {
      ok: false,
      error: `Too many failed attempts. Try again in ${secs}s.`,
    };
  }

  const user = db
    .select()
    .from(users)
    .where(eq(users.username, key))
    .get();
  if (!user || !user.active || !scryptVerify(password, user.passwordHash)) {
    recordFailure(key, now);
    return { ok: false, error: "Invalid username or password." };
  }
  clearFailures(key);
  const token = randomSessionToken();
  db.insert(sessions)
    .values({
      token,
      userId: user.id,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
      userAgent: userAgent?.slice(0, 250) ?? null,
    })
    .run();
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return { ok: true };
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    getDb().delete(sessions).where(eq(sessions.token, token)).run();
  }
  jar.delete(SESSION_COOKIE);
}

function randomSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = getDb()
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, Date.now())))
    .get();
  if (!row || !row.user.active) return null;
  return row.user;
}

/** Redirects to /login when unauthenticated (for layouts/pages). */
export async function requireSession(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Server-side role gate: admin passes every gate, then operator, then viewer. */
export async function requireRole(min: Role): Promise<User> {
  const user = await requireSession();
  if (ROLE_RANK[user.role] < ROLE_RANK[min]) {
    throw new Error(`FORBIDDEN: requires ${min} role`);
  }
  return user;
}

export function hasRole(user: User, min: Role): boolean {
  return ROLE_RANK[user.role] >= ROLE_RANK[min];
}
