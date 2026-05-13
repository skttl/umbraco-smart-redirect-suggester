using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Umbraco.Community.SmartRedirectSuggester.Models;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Core.PublishedCache;
using Umbraco.Cms.Core.Routing;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Search.Core.Services;
using Umbraco.Extensions;

namespace Umbraco.Community.SmartRedirectSuggester.Services;

/// <summary>
/// Default implementation of <see cref="ISmartRedirectSuggesterService"/>.
/// </summary>
public sealed class SmartRedirectSuggesterService : ISmartRedirectSuggesterService
{
    private static readonly Regex _whitespaceRegex = new("\\s+", RegexOptions.Compiled);
    private static readonly Regex _nonWordRegex = new("[^\\p{L}\\p{N}\\s-]", RegexOptions.Compiled);

    // Hardcoded to match Umbraco.AI.Search's published index alias (AISearchConstants.IndexAliases.Search).
    // Kept as a literal so this package doesn't take a runtime dependency on Umbraco.AI.Search itself ÔÇö
    // users install that package separately to make the searcher available.
    private const string AiSearchIndexAlias = "UmbAI_Search";

    // Default published content index used by the Umbraco Search package.
    private const string ContentSearchIndexAlias = "Umb_Content";

    // How many results to fetch from the AI searcher before filtering out the trashed set.
    private const int CandidateFetchTopK = 25;

    // How many candidates to return to the UI per trashed document.
    private const int CandidatesPerDocument = 3;

    // Maximum characters of aggregated text content to send to the AI searcher as a semantic query.
    // The vector embedding step has its own chunking ÔÇö we just need enough text to convey the page's gist.
    private const int MaxQueryTextLength = 4000;
    private const int MaxKeywordTerms = 8;
    private const int MinKeywordLength = 3;
    private const int MaxCandidatesPerDocument = 3;

    private readonly IContentService _contentService;
    private readonly ILanguageService _languageService;
    private readonly IPublishedContentCache _publishedContentCache;
    private readonly IPublishedUrlProvider _publishedUrlProvider;
    private readonly IDocumentUrlService _documentUrlService;
    private readonly IRedirectUrlService _redirectUrlService;
    private readonly IMemoryCache _memoryCache;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<SmartRedirectSuggesterService> _logger;

    // Cache key prefix used to stash legacy route info captured during Prepare so we can replay it
    // during Commit (after the document has been trashed and IDocumentUrlService no longer returns it).
    // 10 minute sliding TTL is plenty for a confirm-modal round-trip without leaking memory.
    private const string RouteCacheKeyPrefix = "SmartRedirectSuggester.Routes:";
    private static readonly TimeSpan _routeCacheTtl = TimeSpan.FromMinutes(10);

    // ISearcherResolver lives in Umbraco.Cms.Search.Core, but no implementation is registered
    // unless the host also installs a search provider package (Umbraco.AI.Search, Umbraco.Cms.Search.Examine, etc.).
    // We resolve it lazily via IServiceProvider so this service constructs even on hosts without one,
    // and we degrade gracefully to "no AI suggestions" instead of crashing app startup.
    public SmartRedirectSuggesterService(
        IContentService contentService,
        ILanguageService languageService,
        IPublishedContentCache publishedContentCache,
        IPublishedUrlProvider publishedUrlProvider,
        IDocumentUrlService documentUrlService,
        IRedirectUrlService redirectUrlService,
        IMemoryCache memoryCache,
        IServiceProvider serviceProvider,
        ILogger<SmartRedirectSuggesterService> logger)
    {
        _contentService = contentService;
        _languageService = languageService;
        _publishedContentCache = publishedContentCache;
        _publishedUrlProvider = publishedUrlProvider;
        _documentUrlService = documentUrlService;
        _redirectUrlService = redirectUrlService;
        _memoryCache = memoryCache;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task<PrepareRedirectResponse> PrepareAsync(IEnumerable<Guid> documentKeys, int? candidateCount = null, CancellationToken cancellationToken = default)
    {
        int requestedCandidateCount = candidateCount is > 0
            ? Math.Min(candidateCount.Value, MaxCandidatesPerDocument)
            : CandidatesPerDocument;

        // Expand the input keys with all of their published descendants so a single trash of a parent
        // produces suggestions for every affected page.
        IReadOnlyList<IContent> affected = ExpandWithDescendants(documentKeys);

        // We'll exclude all trashed-set documents from candidate results, regardless of which trashed node we're proposing for.
        HashSet<Guid> trashedSet = affected.Select(c => c.Key).ToHashSet();

        IReadOnlyList<string> isoCodes = (await _languageService.GetAllAsync()).Select(l => l.IsoCode).ToList();
        var items = new List<TrashedDocumentSuggestions>();

        ISearcherResolver? searcherResolver = _serviceProvider.GetService<ISearcherResolver>();
        (ISearcher? searcher, string? indexAlias) = ResolveSearcher(searcherResolver);

        foreach (IContent content in affected)
        {
            cancellationToken.ThrowIfCancellationRequested();

            IPublishedContent? publishedContent = await _publishedContentCache.GetByIdAsync(content.Key);
            if (publishedContent is null)
            {
                // Not currently published in any culture ÔÇö skip silently.
                continue;
            }

            IReadOnlyList<OldUrlInfo> oldUrls = CollectOldUrls(publishedContent, isoCodes);
            if (oldUrls.Count == 0)
            {
                continue;
            }

            // Capture legacy routes NOW (while still published) so Commit can register them
            // verbatim after the document has moved into the recycle bin.
            CacheLegacyRoutes(content.Key, isoCodes);

            IReadOnlyList<RedirectCandidate> candidates = searcher is null || string.IsNullOrWhiteSpace(indexAlias)
                ? Array.Empty<RedirectCandidate>()
                : await FindCandidatesAsync(searcher, indexAlias, publishedContent, trashedSet, requestedCandidateCount, cancellationToken);

            items.Add(new TrashedDocumentSuggestions
            {
                DocumentKey = content.Key,
                Name = publishedContent.Name ?? content.Name ?? string.Empty,
                OldUrls = oldUrls,
                Candidates = candidates,
            });
        }

        return new PrepareRedirectResponse { Items = items };
    }

    private (ISearcher? Searcher, string? IndexAlias) ResolveSearcher(ISearcherResolver? searcherResolver)
    {
        ISearcher? aiSearcher = searcherResolver?.GetSearcher(AiSearchIndexAlias);
        if (aiSearcher is not null)
        {
            return (aiSearcher, AiSearchIndexAlias);
        }

        ISearcher? contentSearcher = searcherResolver?.GetSearcher(ContentSearchIndexAlias);
        if (contentSearcher is not null)
        {
            _logger.LogInformation(
                "AI search index '{AiIndexAlias}' is unavailable. Falling back to search index '{FallbackIndexAlias}'.",
                AiSearchIndexAlias,
                ContentSearchIndexAlias);

            return (contentSearcher, ContentSearchIndexAlias);
        }

        _logger.LogWarning(
            "No registered searcher found for '{AiIndexAlias}' or '{ContentIndexAlias}'. Redirect suggestions will be empty.",
            AiSearchIndexAlias,
            ContentSearchIndexAlias);

        return (null, null);
    }

    public Task<CommitRedirectResponse> CommitAsync(IReadOnlyList<CommitRedirectEntry> redirects, CancellationToken cancellationToken = default)
    {
        var created = 0;
        var skipped = 0;

        foreach (CommitRedirectEntry entry in redirects)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (entry.TargetDocumentKey is null)
            {
                skipped++;
                continue;
            }

            // Pull the (culture, route) pairs that Prepare cached for us. Once a document is trashed,
            // IDocumentUrlService.GetLegacyRouteFormat returns nothing, which is why we can't recompute here.
            IReadOnlyList<(string? Culture, string Route)> cachedRoutes = GetCachedLegacyRoutes(entry.TrashedDocumentKey);
            if (cachedRoutes.Count == 0)
            {
                _logger.LogWarning(
                    "No cached legacy routes for trashed document {Key}; redirect not registered. " +
                    "This usually means the prepare modal sat open longer than the cache TTL ({Ttl}).",
                    entry.TrashedDocumentKey, _routeCacheTtl);
                skipped++;
                continue;
            }

            foreach ((string? culture, string route) in cachedRoutes)
            {
                try
                {
                    _redirectUrlService.Register(route, entry.TargetDocumentKey.Value, culture);
                    created++;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(
                        ex,
                        "Failed to register redirect from {Route} (culture {Culture}) to {TargetKey}",
                        route,
                        culture,
                        entry.TargetDocumentKey.Value);
                }
            }

            // Once committed, evict from cache so a re-trashed key (e.g. restore + re-trash) doesn't reuse stale routes.
            _memoryCache.Remove(RouteCacheKeyPrefix + entry.TrashedDocumentKey);
        }

        return Task.FromResult(new CommitRedirectResponse
        {
            CreatedRedirectCount = created,
            SkippedDocumentCount = skipped,
        });
    }

    /// <summary>
    /// Captures the legacy route format for every culture of the given document and stashes it in the
    /// in-process cache, keyed by document key. Called from <see cref="PrepareAsync"/> while the document
    /// is still published; the cached entries are consumed by <see cref="CommitAsync"/>.
    /// </summary>
    private void CacheLegacyRoutes(Guid documentKey, IReadOnlyList<string> isoCodes)
    {
        var routes = new List<(string? Culture, string Route)>();

        // Variant content: capture per culture.
        foreach (string isoCode in isoCodes)
        {
            string? route = TryGetLegacyRoute(documentKey, isoCode);
            if (!string.IsNullOrEmpty(route))
            {
                routes.Add((isoCode, route));
            }
        }

        // Invariant content: also capture with null culture so the redirect matches invariant requests.
        // GetLegacyRouteFormat with null returns the route under the default culture for invariant docs.
        string? invariantRoute = TryGetLegacyRoute(documentKey, culture: null);
        if (!string.IsNullOrEmpty(invariantRoute) &&
            !routes.Any(r => string.Equals(r.Route, invariantRoute, StringComparison.OrdinalIgnoreCase)))
        {
            routes.Add((null, invariantRoute));
        }

        if (routes.Count == 0)
        {
            return;
        }

        _memoryCache.Set(RouteCacheKeyPrefix + documentKey, (IReadOnlyList<(string? Culture, string Route)>)routes, _routeCacheTtl);
    }

    private string? TryGetLegacyRoute(Guid documentKey, string? culture)
    {
        try
        {
            string route = _documentUrlService.GetLegacyRouteFormat(documentKey, culture, isDraft: false);
            // GetLegacyRouteFormat returns "#" when it can't resolve ÔÇö treat that the same as empty.
            return string.IsNullOrEmpty(route) || route == "#" ? null : route;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Could not capture legacy route for document {Key} culture {Culture}", documentKey, culture);
            return null;
        }
    }

    private IReadOnlyList<(string? Culture, string Route)> GetCachedLegacyRoutes(Guid documentKey)
    {
        if (_memoryCache.TryGetValue(RouteCacheKeyPrefix + documentKey,
            out IReadOnlyList<(string? Culture, string Route)>? cached) && cached is not null)
        {
            return cached;
        }

        return Array.Empty<(string? Culture, string Route)>();
    }

    private IReadOnlyList<IContent> ExpandWithDescendants(IEnumerable<Guid> documentKeys)
    {
        var result = new List<IContent>();
        var seen = new HashSet<Guid>();

        foreach (Guid key in documentKeys)
        {
            IContent? root = _contentService.GetById(key);
            if (root is null || !seen.Add(root.Key))
            {
                continue;
            }

            result.Add(root);

            // Paged enumeration to bound memory on large trees.
            const int pageSize = 200;
            long pageIndex = 0;
            long total;
            do
            {
                IEnumerable<IContent> page = _contentService.GetPagedDescendants(root.Id, pageIndex, pageSize, out total);
                foreach (IContent child in page)
                {
                    if (seen.Add(child.Key))
                    {
                        result.Add(child);
                    }
                }

                pageIndex++;
            } while (pageIndex * pageSize < total);
        }

        return result;
    }

    private IReadOnlyList<OldUrlInfo> CollectOldUrls(IPublishedContent publishedContent, IReadOnlyList<string> isoCodes)
    {
        var urls = new List<OldUrlInfo>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        IReadOnlyList<string?> cultures = publishedContent.ContentType.VariesByCulture()
            ? publishedContent.Cultures.Keys.Select<string, string?>(c => c).ToList()
            : new List<string?> { null };

        foreach (string? culture in cultures)
        {
            string url;
            try
            {
                url = _publishedUrlProvider.GetUrl(publishedContent, UrlMode.Default, culture);
            }
            catch (Exception)
            {
                continue;
            }

            if (string.IsNullOrEmpty(url) || url == "#")
            {
                continue;
            }

            if (seen.Add($"{culture}|{url}"))
            {
                urls.Add(new OldUrlInfo { Culture = culture, Url = url });
            }

            // GetOtherUrls covers alias/domain variants ÔÇö surface them too so the bulk count is realistic.
            foreach (UrlInfo otherUrl in _publishedUrlProvider.GetOtherUrls(publishedContent.Id))
            {
                string? otherUrlText = otherUrl.Url?.ToString();
                if (string.IsNullOrEmpty(otherUrlText))
                {
                    continue;
                }

                if (seen.Add($"{culture}|{otherUrlText}"))
                {
                    urls.Add(new OldUrlInfo { Culture = culture, Url = otherUrlText });
                }
            }
        }

        // For invariant content the cultures list is [null]; ensure a fallback if no iso codes exist either.
        if (urls.Count == 0 && isoCodes.Count > 0)
        {
            // Try once with null culture as last resort.
            try
            {
                string url = _publishedUrlProvider.GetUrl(publishedContent, UrlMode.Default, culture: null);
                if (!string.IsNullOrEmpty(url) && url != "#")
                {
                    urls.Add(new OldUrlInfo { Culture = null, Url = url });
                }
            }
            catch
            {
                // Swallow ÔÇö no URL to add.
            }
        }

        return urls;
    }

    private async Task<IReadOnlyList<RedirectCandidate>> FindCandidatesAsync(
        ISearcher searcher,
        string indexAlias,
        IPublishedContent publishedContent,
        HashSet<Guid> excludedKeys,
        int candidateCount,
        CancellationToken cancellationToken)
    {
        string? culture = publishedContent.ContentType.VariesByCulture()
            ? publishedContent.Cultures.Keys.FirstOrDefault()
            : null;
        var candidates = new List<RedirectCandidate>();
        var seenCandidateKeys = new HashSet<Guid>();

        IEnumerable<string> queries = BuildQueries(publishedContent, indexAlias);
        foreach (string query in queries)
        {
            cancellationToken.ThrowIfCancellationRequested();

            Umbraco.Cms.Search.Core.Models.Searching.SearchResult searchResult;
            try
            {
                searchResult = await searcher.SearchAsync(
                    indexAlias: indexAlias,
                    query: query,
                    culture: culture,
                    skip: 0,
                    take: CandidateFetchTopK);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Search query failed against index '{IndexAlias}' for document {Key}", indexAlias, publishedContent.Key);
                return Array.Empty<RedirectCandidate>();
            }

            foreach (Umbraco.Cms.Search.Core.Models.Searching.Document doc in searchResult.Documents)
            {
                if (doc.ObjectType != UmbracoObjectTypes.Document)
                {
                    continue;
                }

                if (excludedKeys.Contains(doc.Id))
                {
                    continue;
                }

                if (!seenCandidateKeys.Add(doc.Id))
                {
                    continue;
                }

                IPublishedContent? candidateContent = await _publishedContentCache.GetByIdAsync(doc.Id);
                if (candidateContent is null)
                {
                    continue;
                }

                string url;
                try
                {
                    url = _publishedUrlProvider.GetUrl(candidateContent, UrlMode.Default, culture);
                }
                catch
                {
                    continue;
                }

                if (string.IsNullOrEmpty(url) || url == "#")
                {
                    continue;
                }

                candidates.Add(new RedirectCandidate
                {
                    DocumentKey = candidateContent.Key,
                    Name = candidateContent.Name ?? string.Empty,
                    Url = url,
                });

                if (candidates.Count >= candidateCount)
                {
                    return candidates;
                }
            }
        }

        return candidates;
    }

    private static IEnumerable<string> BuildQueries(IPublishedContent publishedContent, string indexAlias)
    {
        if (string.Equals(indexAlias, AiSearchIndexAlias, StringComparison.Ordinal))
        {
            string semanticQuery = BuildSemanticQuery(publishedContent);
            return string.IsNullOrWhiteSpace(semanticQuery)
                ? []
                : [semanticQuery];
        }

        IReadOnlyList<string> terms = BuildKeywordTerms(publishedContent);
        if (terms.Count == 0)
        {
            return [];
        }

        var queries = new List<string>();
        var seenQueries = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void AddQuery(IEnumerable<string> queryTerms)
        {
            string query = string.Join(' ', queryTerms);
            if (!string.IsNullOrWhiteSpace(query) && seenQueries.Add(query))
            {
                queries.Add(query);
            }
        }

        AddQuery(terms);

        for (int count = terms.Count - 1; count >= 2; count--)
        {
            AddQuery(terms.Take(count));
        }

        foreach (string term in terms)
        {
            AddQuery([term]);
        }

        return queries;
    }

    /// <summary>
    /// Builds the text payload that gets embedded by Umbraco.AI.Search and matched against the vector index.
    /// We aggregate the name plus every textual property value, capped to <see cref="MaxQueryTextLength"/>.
    /// </summary>
    private static string BuildSemanticQuery(IPublishedContent publishedContent)
    {
        var sb = new StringBuilder();
        sb.Append(publishedContent.Name ?? string.Empty);

        foreach (IPublishedProperty property in publishedContent.Properties)
        {
            object? value;
            try
            {
                value = property.GetValue();
            }
            catch
            {
                continue;
            }

            if (value is null)
            {
                continue;
            }

            string text = value switch
            {
                string s => s,
                _ => Convert.ToString(value, CultureInfo.InvariantCulture) ?? string.Empty,
            };

            if (string.IsNullOrWhiteSpace(text))
            {
                continue;
            }

            sb.Append(' ');
            sb.Append(StripHtml(text));

            if (sb.Length >= MaxQueryTextLength)
            {
                break;
            }
        }

        string result = sb.ToString();
        return result.Length > MaxQueryTextLength
            ? result[..MaxQueryTextLength]
            : result;
    }

    private static IReadOnlyList<string> BuildKeywordTerms(IPublishedContent publishedContent)
    {
        var terms = new List<string>();
        var seenTerms = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void AddTerms(string? text)
        {
            if (string.IsNullOrWhiteSpace(text) || terms.Count >= MaxKeywordTerms)
            {
                return;
            }

            string normalized = NormalizeSearchText(text);
            foreach (string part in normalized.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (part.Length < MinKeywordLength)
                {
                    continue;
                }

                if (!seenTerms.Add(part))
                {
                    continue;
                }

                terms.Add(part);
                if (terms.Count >= MaxKeywordTerms)
                {
                    return;
                }
            }
        }

        AddTerms(publishedContent.Name);

        foreach (IPublishedProperty property in publishedContent.Properties)
        {
            if (terms.Count >= MaxKeywordTerms)
            {
                break;
            }

            object? value;
            try
            {
                value = property.GetValue();
            }
            catch
            {
                continue;
            }

            if (value is null)
            {
                continue;
            }

            string text = value switch
            {
                string s => s,
                _ => Convert.ToString(value, CultureInfo.InvariantCulture) ?? string.Empty,
            };

            if (string.IsNullOrWhiteSpace(text))
            {
                continue;
            }

            AddTerms(StripHtml(text));
        }

        return terms;
    }

    private static string NormalizeSearchText(string input)
    {
        string withoutMarkup = StripHtml(input);
        string withoutSymbols = _nonWordRegex.Replace(withoutMarkup, " ");
        return _whitespaceRegex.Replace(withoutSymbols, " ").Trim();
    }

    private static string StripHtml(string input)
    {
        if (input.IndexOf('<') < 0)
        {
            return input;
        }

        var sb = new StringBuilder(input.Length);
        bool inTag = false;
        foreach (char c in input)
        {
            if (c == '<')
            {
                inTag = true;
                continue;
            }

            if (c == '>')
            {
                inTag = false;
                sb.Append(' ');
                continue;
            }

            if (!inTag)
            {
                sb.Append(c);
            }
        }

        return sb.ToString();
    }
}
