import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { settings } from "@/lib/schema";
import { ensureSimulator } from "@/lib/simulator";
import { Shell } from "@/components/shell/shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSession();
  ensureSimulator();
  const company =
    (getDb().select({ value: settings.value }).from(settings).where(eq(settings.key, "company_name")).get()
      ?.value as string | undefined) ?? "GasNext";

  return (
    <Shell
      company={company}
      user={{
        id: user.id,
        name: user.fullName,
        username: user.username,
        role: user.role,
      }}
    >
      {children}
    </Shell>
  );
}
