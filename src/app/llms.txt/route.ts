import { loadLlmsText } from "@/lib/contracts";

export async function GET() {
  return new Response(await loadLlmsText(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
