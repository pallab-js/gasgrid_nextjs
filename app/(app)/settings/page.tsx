import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { SettingsView } from "@/components/settings/settings-view";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { getSettingsPage } from "@/lib/repo/settings";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user || !hasRole(user, "admin")) {
    return (
      <PageContainer>
        <PageHeader title="Settings" description="Admin only" />
        <Card>
          <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
            <ShieldAlert className="size-5 text-destructive" />
            Admin role required to view system settings.
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  const data = getSettingsPage();
  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Users, alarm thresholds, telemetry simulator and system"
      />
      <SettingsView initial={data} />
    </PageContainer>
  );
}
