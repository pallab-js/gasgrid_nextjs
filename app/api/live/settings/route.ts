import { getCurrentUser } from "@/lib/auth";
import { getSettingsPage } from "@/lib/repo/settings";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  return Response.json(getSettingsPage());
}
