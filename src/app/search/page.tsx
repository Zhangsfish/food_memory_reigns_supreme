import type { Metadata } from "next";
import Link from "next/link";
import { SearchInputError, searchPublic } from "@/lib/public-search";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search | Food Memory", alternates: { canonical: "/search" } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const inputs = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(inputs)) {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value)) value.forEach((part) => query.append(key, part));
  }
  let page;
  let error: string | null = null;
  try { page = await searchPublic(query); }
  catch (caught) {
    if (!(caught instanceof SearchInputError)) throw caught;
    error = caught.message;
  }
  const next = new URLSearchParams(query);
  if (page?.next_cursor) next.set("cursor", page.next_cursor);
  return (
    <main>
      <p><Link href="/">← Food Memory</Link></p>
      <h1>Search published experiences</h1>
      <p className="notice">Current records are synthetic tests, not real visits. Text search is literal in S01; read original accounts before drawing conclusions.</p>
      <form action="/search" method="get">
        <label htmlFor="q">Words in the account</label> <input id="q" name="q" defaultValue={query.get("q") ?? ""} />
        <button type="submit">Search</button>
      </form>
      {error && <p role="alert">Invalid search: {error}</p>}
      {page && <>
        <p>Showing {page.results.length} bounded results. <a href={`/api/v1/search?${query.toString()}`}>Read this page as JSON</a>.</p>
        <ul>{page.results.map((record) => <li key={record.id}>
          <h2><a href={`/e/${record.id}`}>{record.place.name}</a></h2>
          <p>{record.occurred_on ?? "Date unknown"} · <a href={`/u/${encodeURIComponent(record.contributor.handle)}`}>{record.contributor.handle}</a> · {record.place.locality}</p>
          <p>{record.excerpt}</p>
          {record.synthetic && <small>Synthetic test record</small>}
        </li>)}</ul>
        {page.next_cursor && <p><a href={`/search?${next.toString()}`}>Next page</a></p>}
      </>}
    </main>
  );
}
