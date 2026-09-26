import { getPublicContributor } from "@/lib/public-search";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ idOrHandle: string }> }) {
  const { idOrHandle } = await params;
  const record = await getPublicContributor(idOrHandle);
  return record ? Response.json(record) : Response.json({ error: "Not found" }, { status: 404 });
}
