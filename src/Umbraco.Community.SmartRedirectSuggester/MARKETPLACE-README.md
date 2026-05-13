# Smart Redirect Suggester

Smart Redirect Suggester improves the Umbraco backoffice trash flow by helping editors create redirects when published content is moved to the recycle bin.

Before trashing, the package captures the current URLs for the selected document and its published descendants. It then suggests likely replacement pages using the best available supported searcher, preferring `UmbAI_Search` and falling back to `Umb_Content`. After the trash succeeds, the selected redirects are written to Umbraco's built-in URL tracker.

## Screenshots

### Single item trash flow

![Single item trash flow](https://raw.githubusercontent.com/skttl/umbraco-smart-redirect-suggester/main/docs/screenshots/single-trash-suggested-redirects.png)

### Bulk trash with suggested redirects

![Bulk trash with suggested redirects](https://raw.githubusercontent.com/skttl/umbraco-smart-redirect-suggester/main/docs/screenshots/multiple-trashes-suggested-redirects.png)

### Change a redirect target inside a bulk action

![Change redirect target](https://raw.githubusercontent.com/skttl/umbraco-smart-redirect-suggester/main/docs/screenshots/change-redirect-for-individual-in-multiple.png)

### Review redirects in Umbraco redirect management

![Redirect management](https://raw.githubusercontent.com/skttl/umbraco-smart-redirect-suggester/main/docs/screenshots/redirect-management.png)

## Features

- captures current URLs before they are lost during trashing
- supports single and bulk trash actions
- includes published descendants automatically
- suggests redirect targets via `UmbAI_Search` or, when needed, `Umb_Content`
- allows manual target selection when no suggestion is suitable
- persists confirmed redirects through Umbraco's redirect URL service

## Installation

Install the package into an Umbraco 17+ site:

```bash
dotnet add package Umbraco.Community.SmartRedirectSuggester
```

The package composer is discovered automatically by Umbraco.

### Required search packages

Install `Umbraco.Cms.Search` in the host site to enable published-content search used for redirect suggestions:

```bash
dotnet add package Umbraco.Cms.Search
```

Optionally install `Umbraco.AI.Search` if you want AI-powered suggestions:

```bash
dotnet add package Umbraco.AI.Search
```

`Umbraco.Cms.Search` is the required search foundation. `Umbraco.AI.Search` is optional and enables the preferred `UmbAI_Search` searcher when installed and configured.

## AI suggestions

A compatible search provider is required for automatic suggestions.

The service tries `UmbAI_Search` first and falls back to `Umb_Content`. If neither searcher is available, the package still works, but the suggestion lists will be empty and editors can pick a redirect target manually.

`UmbAI_Search` usually produces better suggestions, but may add cost depending on the configured AI provider. `Umb_Content` is typically faster and avoids AI-provider cost, but usually gives lower-quality suggestions.

## Notes

- redirects are created only for content that has published URLs
- the prepare step must happen before the content is trashed
- route data is cached briefly between the prepare and commit steps

For more information, see:

- Repository overview: https://github.com/skttl/umbraco-smartredirectsuggester
- Installation guide: https://github.com/skttl/umbraco-smart-redirect-suggester/blob/main/docs/installation.md
