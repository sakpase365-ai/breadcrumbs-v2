# Family memory UX preview

This preview builds on the existing capture, archive, and Hear routes. It retains the existing auth, family access, data model, and legacy entry bridge.

- Capture starts with Write or Record Audio. Select a recipient explicitly, review an uploaded voice transcript, choose Message/Memory/Lesson, and save.
- Draft text is stored under a versioned key associated with the authenticated viewer. Legacy unscoped drafts are not automatically restored.
- Save failures retain the writing/recording for retry. A synchronous in-flight guard prevents duplicate clicks; this is not server-side idempotency.
- Library supports person, type, and topic filters alongside search. `/archive?entry=<id>` expands the corresponding authorized library item.
- Hear labels generated responses, displays warnings, and links every returned breadcrumb excerpt to the original library item. These are context sources, not independently verified per-sentence citations.
- Optional setup shortcuts allow biography and additional family relationships to be completed later.
- Fonts are bundled locally so they load under the existing CSP. Browser zoom is enabled.
- `/preview` is a public interactive demonstration using fictional family entries. Writes last only in page memory; no demo data is sent to Supabase or AI. Recording links to the authenticated capture flow. Its example answer is explicitly labeled as a sample.

The native rewrite, offline audio persistence, relationship graph, semantic retrieval, and asynchronous metadata indexing remain future work. No schema migrations or production promotion are included.

Validation: repository tests, lint, non-incremental TypeScript, production build, and browser review of the public preview. Actual authenticated family capture, transcription-provider behavior, and native-shell recording still need account/device verification.
