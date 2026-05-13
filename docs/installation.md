# Installation and configuration

## Requirements

- Umbraco 17+

## Install the package

Add the package to your Umbraco site:

```bash
dotnet add package Umbraco.Community.SmartRedirectSuggester
```

## Register the package

In a normal Umbraco site, adding the NuGet package is enough for the package to be discovered automatically.

## Enable AI-powered suggestions

For automatic redirect suggestions, the host site needs a compatible search provider.

The service currently:

- tries the `UmbAI_Search` searcher first
- falls back to the `Umb_Content` searcher if the AI searcher is unavailable

Using `UmbAI_Search` usually gives better suggestions because it can use AI-powered search, but it can also introduce usage costs depending on your AI provider and configuration. The `Umb_Content` fallback is typically faster and avoids AI-provider costs, but suggestion quality is usually lower.

Without either supported searcher:

- the package still loads
- the trash modal still opens
- editors can still choose a redirect target manually
- no automatic suggestions are returned

## Backoffice behavior

After installation, the package intercepts document trash actions in the backoffice.

When an editor trashes content:

- the package gathers the current URLs before the content is removed
- it suggests likely replacement pages from the best available supported searcher
- the editor can confirm a suggested target, pick another document manually, or skip redirect creation
- once trashing succeeds, the selected redirects are added to Umbraco's URL tracker

## Important behavior notes

- redirects are only created for documents that currently have published URLs
- published descendants are included automatically when a parent is trashed
- route information is cached temporarily between the prepare and commit steps
- if the confirmation dialog is left open too long, cached route data can expire and redirect creation may be skipped for those items

## Troubleshooting

## No AI suggestions appear

Check that the host site has a compatible search provider installed and configured so either `UmbAI_Search` or `Umb_Content` is registered.

## The document is trashed but no redirect is created

This can happen if:

- the editor chose no redirect target
- the document had no published URLs
- cached legacy routes expired before the commit step
- redirect registration failed and was skipped

In that case, redirects can still be added manually through Umbraco's redirect URL management tools.
