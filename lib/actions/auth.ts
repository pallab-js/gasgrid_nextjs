"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { audit } from "../audit";
import { getCurrentUser, login as performLogin, logout as performLogout } from "../auth";

export type AuthFormState = { error?: string } | undefined;

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) {
    return { error: "Enter username and password." };
  }
  const ua = (await headers()).get("user-agent");
  const result = await performLogin(username, password, ua ?? undefined);
  if (!result.ok) return { error: result.error };
  const user = await getCurrentUser();
  audit(user?.id ?? null, "login", "session", null, { username });
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  audit(user?.id ?? null, "logout", "session");
  await performLogout();
  revalidatePath("/", "layout");
  redirect("/login");
}
