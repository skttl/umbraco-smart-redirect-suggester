# Development

## Project structure

- `src/SmartRedirectSuggester`
  - Razor Class Library package
  - C# services, controllers, models, composer, and backoffice client source
- `src/SmartRedirectSuggester/Client`
  - TypeScript/Lit backoffice extension source
- `src/SmartRedirectSuggester.TestSite`
  - local Umbraco site for testing the package
- `docs`
  - package documentation and NuGet readme content

## Build the client

From `src/SmartRedirectSuggester/Client`:

```bash
npm install
npm run build
```

The built client asset is copied to:

```text
wwwroot/App_Plugins/SmartRedirectSuggester/smart-redirect-suggester.js
```

## Watch mode

For local development:

1. Add the Razor Class Library as a project reference to an Umbraco site.
2. Start the Umbraco site.
3. In `src/SmartRedirectSuggester/Client`, run:

```bash
npm run watch
```

This rebuilds the client when TypeScript files change.

## Run the test site

The test site references the package project directly.

Typical flow:

1. Restore and build the solution.
2. Run `src/SmartRedirectSuggester.TestSite`.
3. Open the backoffice.
4. Create and publish test content.
5. Trash one or more documents to verify the redirect suggestion flow.

## API surface

The package exposes management API endpoints under:

```text
/umbraco/smartredirectsuggester/api/v1
```

Current endpoints:

- `POST /prepare`
- `POST /commit`

These are consumed by the backoffice client in `smart-trash-api.ts`.

## Implementation notes

## Prepare step

The prepare step must run before trashing, while published URLs are still resolvable.

It:

- expands selected documents with descendants
- gathers current URLs per culture/domain
- caches legacy route information temporarily
- resolves the best available searcher for target candidates
- prefers `UmbAI_Search` and falls back to `Umb_Content`

## Commit step

The commit step runs after the trash action succeeds.

It:

- receives chosen redirect targets from the modal
- reads cached legacy routes collected during prepare
- registers redirects with `IRedirectUrlService`

## Manual fallback behavior

The package is designed to degrade gracefully.

If neither supported searcher is available, the service still returns URL data and the modal can still be used to pick targets manually.

## Notes for maintainers

- The package currently tries `UmbAI_Search` first and then falls back to `Umb_Content`.
- The route cache uses an in-memory cache with a short sliding TTL.
- The hand-written TypeScript DTOs mirror the server-side C# models.
- The package Swagger document is configured in `SmartRedirectSuggesterApiComposer`.
