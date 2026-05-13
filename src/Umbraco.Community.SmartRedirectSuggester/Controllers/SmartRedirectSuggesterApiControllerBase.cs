using Microsoft.AspNetCore.Authorization;
using Umbraco.Community.SmartRedirectSuggester;
using Umbraco.Cms.Api.Common.Attributes;
using Umbraco.Cms.Api.Management.Controllers;
using Umbraco.Cms.Api.Management.Routing;
using Umbraco.Cms.Web.Common.Authorization;

namespace Umbraco.Community.SmartRedirectSuggester.Controllers
{
    [VersionedApiBackOfficeRoute(Constants.ApiName)]
    [Authorize(Policy = AuthorizationPolicies.SectionAccessContent)]
    [MapToApi(Constants.ApiName)]
    public class SmartRedirectSuggesterApiControllerBase : ManagementApiControllerBase
    {
    }
}
