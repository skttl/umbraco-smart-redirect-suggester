using Asp.Versioning;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Umbraco.Community.SmartRedirectSuggester;
using Umbraco.Community.SmartRedirectSuggester.Models;
using Umbraco.Community.SmartRedirectSuggester.Services;

namespace Umbraco.Community.SmartRedirectSuggester.Controllers;

[ApiVersion("1.0")]
[ApiExplorerSettings(GroupName = Constants.ApiName)]
public class CommitController : SmartRedirectSuggesterApiControllerBase
{
    private readonly ISmartRedirectSuggesterService _service;

    public CommitController(ISmartRedirectSuggesterService service)
    {
        _service = service;
    }

    /// <summary>
    /// Persist the redirects chosen by the editor. Should be called after the documents have been trashed.
    /// </summary>
    [HttpPost("commit")]
    [ProducesResponseType<CommitRedirectResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CommitRedirectResponse>> Commit(
        [FromBody] CommitRedirectRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Redirects is null)
        {
            return BadRequest("Redirects collection is required.");
        }

        CommitRedirectResponse result = await _service.CommitAsync(request.Redirects, cancellationToken);
        return Ok(result);
    }
}
