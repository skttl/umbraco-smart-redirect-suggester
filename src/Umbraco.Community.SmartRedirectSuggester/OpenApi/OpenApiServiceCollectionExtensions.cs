using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Swashbuckle.AspNetCore.SwaggerUI;

namespace Umbraco.Community.SmartRedirectSuggester.OpenApi;

internal static class OpenApiServiceCollectionExtensions
{
    public static IServiceCollection AddOpenApiDocumentToUi(
        this IServiceCollection services,
        string documentName,
        string? documentTitle = null)
    {
        services.AddOptions<SwaggerUIOptions>()
            .Configure(swaggerUiOptions =>
            {
                var openApiRoute = $"/umbraco/openapi/{documentName}.json";
                swaggerUiOptions.SwaggerEndpoint(openApiRoute, documentTitle ?? documentName);
                swaggerUiOptions.ConfigObject.Urls = swaggerUiOptions.ConfigObject.Urls.OrderBy(x => x.Name);
            });

        return services;
    }
}
