import { getPublicExperience } from "@/lib/public-search";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getPublicExperience(id);
  return record ? Response.json(record) : Response.json({ error: "Not found" }, { status: 404 });
}
