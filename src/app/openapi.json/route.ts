import { loadOpenApi } from "@/lib/contracts";

export async function GET() {
  const document = await loadOpenApi();
  return Response.json(document);
}
