using Asp.Versioning;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SmartRedirectSuggester.Models;
using SmartRedirectSuggester.Services;

namespace SmartRedirectSuggester.Controllers;

[ApiVersion("1.0")]
[ApiExplorerSettings(GroupName = "SmartRedirectSuggester")]
public class PrepareController : SmartRedirectSuggesterApiControllerBase
{
    private readonly ISmartRedirectSuggesterService _service;

    public PrepareController(ISmartRedirectSuggesterService service)
    {
        _service = service;
    }

    /// <summary>
    /// Inspect the documents about to be trashed and return their current URLs plus redirect suggestions.
    /// Must be called *before* the documents are actually trashed, while their URLs are still resolvable.
    /// </summary>
    [HttpPost("prepare")]
    [ProducesResponseType<PrepareRedirectResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PrepareRedirectResponse>> Prepare(
        [FromBody] PrepareRedirectRequest request,
        CancellationToken cancellationToken)
    {
        if (request.DocumentKeys is null || request.DocumentKeys.Length == 0)
        {
            return BadRequest("At least one document key is required.");
        }

        PrepareRedirectResponse result = await _service.PrepareAsync(request.DocumentKeys, request.CandidateCount, cancellationToken);
        return Ok(result);
    }
}
