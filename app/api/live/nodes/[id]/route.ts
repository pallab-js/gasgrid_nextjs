import { getCurrentUser } from "@/lib/auth";
import { getNodeDetail } from "@/lib/repo/node-detail";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const detail = getNodeDetail(numericId);
  if (!detail) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json(detail);
}
