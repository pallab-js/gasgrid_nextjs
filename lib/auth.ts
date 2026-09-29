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

const ROLE_RANK: Record<Role, number> = { viewer: 0, operator: 1, admin: 2 };

export type AuthResult =
  | { ok: true }
  | { ok: false; error: string };

export async function login(
  username: string,
  password: string,
  userAgent?: string
): Promise<AuthResult> {
  const db = getDb();
  const user = db
    .select()
    .from(users)
    .where(eq(users.username, username.trim().toLowerCase()))
    .get();
  if (!user || !user.active || !scryptVerify(password, user.passwordHash)) {
    return { ok: false, error: "Invalid username or password." };
  }
  const token = randomSessionToken();
  const now = Date.now();
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
    secure: false,
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
