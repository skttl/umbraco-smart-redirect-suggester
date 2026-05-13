using System.ComponentModel.DataAnnotations;

namespace Umbraco.Community.SmartRedirectSuggester.Models;

/// <summary>
/// Request body for the prepare endpoint.
/// </summary>
public class PrepareRedirectRequest
{
    /// <summary>
    /// The key(s) of the document(s) about to be trashed. For a single trash, send one key.
    /// The server will expand each key with its published descendants automatically.
    /// </summary>
    [Required]
    public required Guid[] DocumentKeys { get; init; }

    public int? CandidateCount { get; init; }
}

/// <summary>
/// Result of preparing redirect suggestions for one or more documents about to be trashed.
/// </summary>
public class PrepareRedirectResponse
{
    /// <summary>
    /// One entry per document that has at least one published URL. Documents without published URLs are omitted.
    /// </summary>
    public required IReadOnlyList<TrashedDocumentSuggestions> Items { get; init; }
}

/// <summary>
/// All redirect-relevant data for a single document about to be trashed.
/// </summary>
public class TrashedDocumentSuggestions
{
    public required Guid DocumentKey { get; init; }
    public required string Name { get; init; }

    /// <summary>
    /// One entry per published (culture, domain) URL. May contain multiple entries for variant content
    /// or for invariant content reachable through multiple hostnames.
    /// </summary>
    public required IReadOnlyList<OldUrlInfo> OldUrls { get; init; }

    /// <summary>
    /// Top redirect candidates, ranked by semantic similarity. Up to 3 entries. May be empty if the
    /// AI search index is not configured or no relevant content was found.
    /// </summary>
    public required IReadOnlyList<RedirectCandidate> Candidates { get; init; }
}

public class OldUrlInfo
{
    /// <summary>
    /// The culture of this URL, or null for invariant content.
    /// </summary>
    public string? Culture { get; init; }

    /// <summary>
    /// The human-readable URL shown in the UI (e.g. https://site.example/path or /path).
    /// </summary>
    public required string Url { get; init; }
}

public class RedirectCandidate
{
    public required Guid DocumentKey { get; init; }
    public required string Name { get; init; }
    public required string Url { get; init; }
}

/// <summary>
/// Request body for the commit endpoint.
/// </summary>
public class CommitRedirectRequest
{
    /// <summary>
    /// Map of trashed document key ÔåÆ chosen redirect target document key. Entries with a null target are skipped
    /// (no redirect created for that document).
    /// </summary>
    [Required]
    public required IReadOnlyList<CommitRedirectEntry> Redirects { get; init; }
}

public class CommitRedirectEntry
{
    public required Guid TrashedDocumentKey { get; init; }
    public Guid? TargetDocumentKey { get; init; }
}

public class CommitRedirectResponse
{
    public required int CreatedRedirectCount { get; init; }
    public required int SkippedDocumentCount { get; init; }
}
