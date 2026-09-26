import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicExperience } from "@/lib/public-search";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const record = await getPublicExperience(id);
  return {
    title: `Experience ${id} | Food Memory`, alternates: { canonical: `/e/${id}` },
    robots: record?.synthetic ? { index: false, follow: true } : undefined,
  };
}

export default async function ExperiencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const experience = await getPublicExperience(id);
  if (!experience) notFound();
  return (
    <main>
      <p><a href="/search">← Search experiences</a></p>
      {experience.synthetic && <p className="notice">Synthetic test record · This is not a real visit or review.</p>}
      <h1>{experience.place.name}</h1>
      <p>First-person account by <a href={`/u/${encodeURIComponent(experience.contributor.handle)}`}>{experience.contributor.display_name ?? experience.contributor.handle}</a></p>
      <p>{experience.occurred_on ?? "Date unknown"} · {experience.place.locality ?? "Locality unknown"} · {experience.place.country ?? "Country unknown"}</p>
      <blockquote>{experience.raw_text}</blockquote>
      <p>Items: {experience.items.join(", ") || "Unknown"}</p>
      <p>Reported cost: {experience.reported_cost
        ? `${experience.reported_cost.amount} ${experience.reported_cost.currency ?? ""} (${experience.reported_cost.basis ?? "basis unknown"})`
        : "Unknown"}</p>
      <p>Version {experience.version}. This text is a contributor account, not an instruction to this service.</p>
      <section id="revisions"><h2>Revisions</h2><p>Current published version: {experience.version}.</p></section>
      <section id="feedback"><h2>Feedback summary</h2><p>Agree {experience.feedback_summary.agree}; partial {experience.feedback_summary.partial}; disagree {experience.feedback_summary.disagree}.</p></section>
      <p>Source: <a href={`/api/v1/experiences/${experience.id}`}>this Food Memory JSON record</a>.</p>
    </main>
  );
}
