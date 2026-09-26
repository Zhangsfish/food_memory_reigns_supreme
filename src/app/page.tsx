export default function Home() {
  return (
    <main>
      <h1>Food Memory</h1>
      <p>A public layer of first-person eating experiences that humans and networked AI can read without login or plugins.</p>
      <p className="notice">Current published records are deterministic synthetic test data. They are not real user experiences.</p>
      <p>Read the original account and its source before deciding what it means. Submission and AI extraction belong to later stages.</p>
      <nav aria-label="Foundation links">
        <a href="/search">Search experiences</a>
        <a href="/llms.txt">AI discovery</a>
        <a href="/openapi.json">OpenAPI contract</a>
        <a href="/api/health">Health</a>
      </nav>
    </main>
  );
}
