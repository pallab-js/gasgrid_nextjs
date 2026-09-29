import { getCurrentUser } from "@/lib/auth";
import { getLiveNodes } from "@/lib/repo/network";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json(getLiveNodes());
}
