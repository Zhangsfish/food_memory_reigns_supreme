# MVP Acceptance Gates

The MVP is not complete until these demonstrations pass.

## Gate A — public AI read

- [ ] Published experience opens without login.
- [ ] Initial HTML contains meaningful experience text.
- [ ] Public contributor page opens without login.
- [ ] `/api/v1/search` works without login.
- [ ] Search is bounded/paginated.
- [ ] `/llms.txt` exists.
- [ ] `/openapi.json` exists.
- [ ] Two target networked AI clients can read a supplied public URL without installing a plugin.
- [ ] No private evidence/email/auth ID is exposed.

## Gate B — real external signup/submission

Using at least 3 non-maintainer test accounts:

- [ ] email sign-in succeeds
- [ ] mobile screenshot upload succeeds
- [ ] natural-language text submission succeeds
- [ ] submission survives page close/reopen
- [ ] AI processing produces a draft
- [ ] unknown values remain unknown
- [ ] user can correct the draft
- [ ] user confirmation is required before publication
- [ ] stable public experience URL is generated

## Gate C — concurrency/idempotency

- [ ] concurrent users do not overwrite each other
- [ ] double-click/retry does not duplicate a submission
- [ ] repeated confirm does not publish twice
- [ ] stale update does not silently overwrite newer draft state
- [ ] failed extraction can be retried

## Gate D — retrieval correctness

Seed enough test records to demonstrate:

- [ ] contributor filter
- [ ] locality filter
- [ ] place filter
- [ ] dish/item filter
- [ ] date filter
- [ ] amount/currency/basis filter
- [ ] literal text retrieval
- [ ] semantic retrieval

Adversarial examples:

- [ ] “完全不油” is not conflated with “太油了”
- [ ] “我不喜欢甜，但这家很甜” retains polarity/context
- [ ] “素粉” is not silently asserted to be vegetarian if broth/ingredients are unknown
- [ ] four-person bill total is not treated as per-person cost

## Gate E — contributor audit/feedback

- [ ] contributor has stable internal ID independent of handle/email changes
- [ ] contributor public page lists published history
- [ ] edit creates revision trail
- [ ] feedback targets an exact experience version
- [ ] self-feedback cannot count as independent feedback
- [ ] repeated feedback from one account does not count as multiple people
- [ ] “description agreed, taste differed” is representable
- [ ] no global truth/KOL score is generated

## Gate F — permissions/privacy

- [ ] user A cannot read user B’s draft
- [ ] user A cannot mutate user B’s draft/profile
- [ ] user cannot publish as another contributor by forging contributor_id
- [ ] private screenshot cannot be opened anonymously
- [ ] service-role key is not shipped to browser bundle
- [ ] public APIs do not expose emails/auth subjects
- [ ] RLS/grant tests pass

## Gate G — migration

- [ ] existing real Food Memory records can be imported without changing first-person meaning
- [ ] old IDs/source references are retained in migration metadata
- [ ] existing repo remains unchanged until migration is accepted

## Performance evidence

Report measured numbers rather than promises:
- public search latency on synthetic 10k / 100k rows
- semantic search latency and recall spot-check
- concurrent submission test
- AI extraction latency separately from normal API latency

Passing a synthetic benchmark does not prove real-world recommendation quality.
