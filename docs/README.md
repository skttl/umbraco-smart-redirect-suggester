# Smart Redirect Suggester

Smart Redirect Suggester adds a smarter trash flow to the Umbraco backoffice.

When an editor trashes one or more published documents, the package can:

- inspect the document being removed and all published descendants
- capture the current published URLs before they disappear
- suggest likely redirect targets using the best available published-content searcher
- let the editor confirm, change, or skip each redirect in a modal
- register the chosen redirects in Umbraco's built-in URL tracker after the trash action completes

## Screenshots

### Suggested redirect for a single trashed document

![Single trash suggested redirects](./screenshots/single-trash-suggested-redirects.png)

### Suggested redirects for a bulk trash action

![Bulk trash suggested redirects](./screenshots/multiple-trashes-suggested-redirects.png)

### Changing one redirect target during a bulk trash action

![Change redirect target in bulk action](./screenshots/change-redirect-for-individual-in-multiple.png)

### Resulting redirects in Umbraco management

![Redirect management](./screenshots/redirect-management.png)

## What problem it solves

Umbraco can automatically create redirects for some content moves and renames, but trashing content removes URLs without creating replacement redirects.

This package closes that gap by prompting editors at trash time and helping them preserve inbound links.

## How it works

The package replaces the standard backoffice trash action for documents.

Before the document is trashed, the client calls a `prepare` API endpoint that:

- expands the selected documents to include published descendants
- collects the current published URLs for each affected document
- caches the legacy route data temporarily so it can still be used after the content has been moved to the recycle bin
- first queries the `UmbAI_Search` searcher when `Umbraco.AI.Search` is installed
- falls back to the `Umb_Content` searcher when the AI searcher is unavailable

`UmbAI_Search` usually gives better redirect suggestions, but may add cost depending on your AI provider. The `Umb_Content` fallback is typically faster and avoids AI-provider cost, but usually produces lower-quality suggestions.

After the trash succeeds, the client calls a `commit` API endpoint that:

- reads the editor's selected redirect targets
- reuses the cached legacy route information gathered during prepare
- registers redirects in Umbraco's redirect URL tracker

If neither `UmbAI_Search` nor `Umb_Content` is available, the package still works, but the suggestion lists will be empty and editors can choose a target manually or skip redirect creation.

## Main components

- `SmartRedirectSuggesterService`
  - prepares candidate redirects and commits confirmed redirects
- `PrepareController`
  - returns old URLs and suggested targets before trashing
- `CommitController`
  - persists redirects after trashing
- `smart-trash.action.ts` and `smart-bulk-trash.action.ts`
  - hook into the backoffice trash flow
- `suggest-redirect-modal.element.ts`
  - renders the modal UI and lets editors choose targets

## Documentation

- [Installation and configuration](./installation.md)
- [Development](./development.md)
- [NuGet package readme](./README_nuget.md)
