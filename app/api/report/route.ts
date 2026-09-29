import { getCurrentUser } from "@/lib/auth";
import { availablePeriods, getReport } from "@/lib/repo/reports";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const period = new URL(req.url).searchParams.get("period");
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return Response.json({ error: "period required (YYYY-MM)" }, { status: 400 });
  }
  if (!availablePeriods().includes(period)) {
    return Response.json({ error: "unknown period" }, { status: 404 });
  }

  return Response.json(getReport(period));
}
