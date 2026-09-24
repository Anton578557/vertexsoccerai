# EN / RU / ES localization audit — 2026-09-24

Scope: eight public sections, language switching, forms, account dialogs,
onboarding/legal content, reports and personal strategy states.

Confirmed production gaps included English contact placeholders in RU/ES,
English leaderboard entries, stale form validation after switching languages,
untranslated accessibility labels and raw provider diagnostics.

## Changes

- Central supplemental copy and diagnostic catalogue in `locale-content.js`.
- The translator tracks the last applied text and notices asynchronous changes.
  Bound messages retain their original key and interpolation values.
- Placeholder, title, image alternative text and accessible labels switch language.
- Self-localizing components declare ownership; user reviews and original source
  quotations are excluded from UI dictionary translation.
- Form, authentication and report failures use localized messages rather than raw
  server errors. Contact status survives a language change, including in-flight
  submission and its completion.
- Leaderboard, open legal dialogs, account pages, report numbers/dates, provider
  status messages, strategy notices and errors use the active locale.
- Country labels are localized separately from canonical club, league, provider
  and market identifiers. Source article titles remain accessible as clearly
  labelled quotations in their original language.

## Validation

- All 100 Node tests pass, including locale round trips, asynchronous replacement,
  bound messages, attributes, ownership, diagnostics and multilingual reports.
- All repository quality workflow checks pass locally.
- No database, authentication policy, provider configuration or model probability
  calculation changes are included.
- All 24 public route/language combinations are browser-checked, with no horizontal overflow at the tested desktop width. Contact validation and loaded leaderboard entries switch language immediately. The final signup button omission was also corrected. Signed-in
  account and strategy renderers are reviewed in code; no test account is created.

When adding UI copy, keep canonical keys for asynchronous messages. Components
that render all three locales themselves should use `data-i18n-owned` and respond
to `vertex:languagechange`. Never translate database identifiers in place.
