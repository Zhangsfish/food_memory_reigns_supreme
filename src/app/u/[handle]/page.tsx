import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicContributor, searchPublic } from "@/lib/public-search";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const page = await searchPublic(new URLSearchParams({ contributor: handle, limit: "1" }));
  return {
    title: `${handle} | Food Memory`, alternates: { canonical: `/u/${encodeURIComponent(handle)}` },
    robots: page.results[0]?.synthetic ? { index: false, follow: true } : undefined,
  };
}

export default async function ContributorPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const contributor = await getPublicContributor(handle);
  if (!contributor) notFound();
  const query = new URLSearchParams({ contributor: contributor.handle });
  const page = await searchPublic(query);
  return (
    <main>
      <p><a href="/search">← Search experiences</a></p>
      <h1>{contributor.display_name ?? contributor.handle}</h1>
      <p>{contributor.bio}</p>
      <p className="notice">The current published records are synthetic test data.</p>
      {contributor.profile_declarations.map((profile, index) => <p key={index}>Public declaration: {profile.raw_text}</p>)}
      <h2>Published accounts</h2>
      <ul>{page.results.map((experience) => <li key={experience.id}>
        <a href={`/e/${experience.id}`}>{experience.place.name}</a> · {experience.occurred_on}: {experience.excerpt}
      </li>)}</ul>
      {page.next_cursor && <p><a href={`/search?contributor=${encodeURIComponent(contributor.handle)}&cursor=${encodeURIComponent(page.next_cursor)}`}>More experiences</a></p>}
      <p>Source: <a href={`/api/v1/contributors/${encodeURIComponent(contributor.handle)}`}>this Food Memory contributor JSON record</a>.</p>
    </main>
  );
}
