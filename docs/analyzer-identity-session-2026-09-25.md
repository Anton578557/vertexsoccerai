# Analyzer: names, sessions and concise instructions — 25 September 2026

## Reported failures and evidence

- Production cache `analysis-core:v18:operario:ceara` selected BSD 8324 (CD Operário, Portugal) for bare Operário. BSD's directory also contains Operário-PR (828), Operário-MS (827) and Operário-MT (851). A unique exact short-name hit was therefore not a unique club identity.
- The Novorizontino/São Bernardo screenshot shows AUTH_REQUIRED, before analysis. It does not demonstrate a missing-history failure.
- Browser auth previously stopped waiting for session restoration after 1.2 seconds, cached the bearer indefinitely without a 401 refresh, and ran UI auth effects inside the SDK auth callback. Server auth also misreported timeouts and 5xx as expired sessions.

## Changes

- One RU/EN/ES analyzer helper replaces both repeated instruction blocks. No requirement to pick every team from suggestions. My Strategy uses PERSONAL PLAN rather than FREE, including guest and setup views.
- Wait for restored session, refresh near expiry, single-flight refresh and one authenticated-401 retry. Preserve POST bodies, headers, cancellation and explicit caller credentials. Never replay under another user after sign-out/account switch. No retries for 403 or provider quota responses.
- Defer UI effects outside Supabase's auth callback. Transient auth failures use 503/AUTH_UNAVAILABLE; invalid sessions retain 401 and a sign-in action beside the preserved match input. Server validation remains mandatory.
- Exact RU/Latin aliases for Operario-PR/Ferroviario, Ceará, Novorizontino and São Bernardo. Verified TheSportsDB IDs 136829, 134744, 141182, 145389; Operario-MS 147149. EC São Bernardo and U20 remain distinct.
- Ambiguous bare Operário/Операрио returns a club choice with countries instead of silently choosing Portugal. The same ambiguity is rejected by provider identity matching and the analysis core. Unambiguous full names still work directly. This explicit collision catalogue supplements existing provider lookup; it is not a guarantee that every worldwide name is mapped.
- New core cache version v19, TSB metadata v8. Daily fixed health probes include the two reported Brazilian pairs and retain Tomayapo/Nacional Potosí and Betis/Mallorca. Probes never record forecasts for performance measurement.

## Verification before publication

121 tests pass, including slow auth restoration, concurrent refresh, exact POST replay, invalid/transient auth, logout/account-switch races, cancellation, provider club distinctions and endpoint ambiguity. Syntax and whitespace checks pass. Live signed-in expiry recovery cannot be reproduced in the current signed-out browser; the SDK flow is covered with deterministic tests.

## Sources

- Supabase refreshSession: https://supabase.com/docs/reference/javascript/auth-refreshsession
- Supabase callback deadlock guidance: https://supabase.com/docs/guides/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0
- Club metadata: https://www.thesportsdb.com/team/136829, /team/134744, /team/141182, /team/145389, /team/147149; connected BSD directory results.
- Flashscore account FAQ: https://www.flashscore.com/faq/account/ — live scores/statistics do not require registration. Registration personalizes and syncs favorites; it does not fix Vertex integration or provide an API connection to Vertex.

No new accounts, paid sources, plan changes or model-accuracy claims.
