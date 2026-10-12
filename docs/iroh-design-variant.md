# Separate Breadcrumbs design version

Branch: codex/iroh-design-variant. Base: b0904b7 on codex/iroh-family-memory-ux. This branch does not alter or promote the existing production/current-preview branches.

The supplied capture-screen image is the current visual target: charcoal canvas, pale-blue microphone control, centered brand/headline, explicit recipient pill, voice card, Write a letter / Answer a question / Continue draft rows, and Capture / Legacy / Family / Ask navigation.

The version also adapts Iroh's compact dashboard, topic ring, conversation composer, and source cards. Counts and rings reflect real scoped entries in the authenticated app. The original family-auth and content APIs and database schema are retained. A new protected /home dashboard and /family overview use existing scoped APIs.

The public /preview uses fictional sample entries and page-local state. Writing and classification work; supported browsers can record local audio and replay it. Sample Ask performs labeled lexical retrieval, not an AI provider request. Automatic transcription and generated family answers use the existing authenticated routes after sign-in. Initials are used for recipient avatars because recipient photos have not been supplied. Waveforms show actual microphone activity; idle dots do not imply a recording.

The author explicitly chooses a recipient (including Everyone) before recording, and Message / Memory / Lesson before saving. Draft continuation never fabricates a saved draft.

Verification: tests, lint, non-incremental TypeScript, production build, desktop/mobile browser checks for recipient selection, writing, classification, sample save, navigation, library search, and original-source access. Live microphone permission, transcription, native-shell recording, and signed-in database writes require account/device verification.
