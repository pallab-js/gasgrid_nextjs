import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(60% 50% at 20% 10%, rgba(88,101,242,0.35), transparent 60%)," +
            "radial-gradient(50% 45% at 85% 25%, rgba(236,72,189,0.18), transparent 65%)," +
            "radial-gradient(55% 60% at 70% 95%, rgba(53,237,126,0.10), transparent 60%)",
          filter: "blur(20px)",
        }}
      />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_3px_68px_rgba(69,42,124,0.45)]">
            <svg viewBox="0 0 24 24" fill="none" className="size-7" aria-hidden>
              <path
                d="M12 2.5c3.6 3.2 6 6.4 6 10a6 6 0 1 1-12 0c0-3.6 2.4-6.8 6-10Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path d="M12 17.5a2.6 2.6 0 0 0 2.6-2.6c0-1.6-1.3-3-2.6-4.7-1.3 1.7-2.6 3.1-2.6 4.7A2.6 2.6 0 0 0 12 17.5Z" fill="currentColor" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">GasNext</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gas grid operations console
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-[0_3px_68px_rgba(69,42,124,0.35)]">
          <LoginForm />
        </div>

        <div className="mt-5 rounded-lg border border-border/70 bg-card/50 p-3 text-center text-xs text-muted-foreground">
          <p className="font-medium text-foreground/80">Demo accounts</p>
          <p className="mt-1 font-mono">
            admin/admin123 · operator/ops123 · viewer/view123
          </p>
        </div>
      </div>
    </div>
  );
}
