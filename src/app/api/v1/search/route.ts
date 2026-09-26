import { SearchInputError, searchPublic } from "@/lib/public-search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return Response.json(await searchPublic(new URL(request.url).searchParams));
  } catch (error) {
    if (error instanceof SearchInputError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
