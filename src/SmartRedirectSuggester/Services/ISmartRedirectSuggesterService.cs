using SmartRedirectSuggester.Models;

namespace SmartRedirectSuggester.Services;

/// <summary>
/// Captures the about-to-be-trashed documents' URLs and proposes redirect targets via Umbraco.AI.Search,
/// then persists confirmed redirects to Umbraco's URL tracker.
/// </summary>
public interface ISmartRedirectSuggesterService
{
    /// <summary>
    /// Inspect the given documents (and their descendants) while they are still published, capture their URLs,
    /// and propose redirect targets using semantic search.
    /// </summary>
    public Task<PrepareRedirectResponse> PrepareAsync(IEnumerable<Guid> documentKeys, int? candidateCount = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Persist redirects for the trashed documents using Umbraco's built-in URL tracker. Should be called
    /// after the documents have actually been moved to the recycle bin (Umbraco's automatic redirect creation
    /// only fires on move/rename — trashing removes URLs without producing redirects).
    /// </summary>
    public Task<CommitRedirectResponse> CommitAsync(IReadOnlyList<CommitRedirectEntry> redirects, CancellationToken cancellationToken = default);
}
