using Microsoft.Extensions.Options;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Api.Management.OpenApi;
using Umbraco.Community.SmartRedirectSuggester.Services;

namespace Umbraco.Community.SmartRedirectSuggester.Composers
{
    public class SmartRedirectSuggesterApiComposer : IComposer
    {
        public void Compose(IUmbracoBuilder builder)
        {
            builder.Services.AddSingleton<ISmartRedirectSuggesterService, SmartRedirectSuggesterService>();
            builder.Services.ConfigureOptions<SmartRedirectSuggesterApiSwaggerGenOptions>();
        }
    }

    public class SmartRedirectSuggesterApiSwaggerGenOptions : IConfigureOptions<SwaggerGenOptions>
    {
        public void Configure(SwaggerGenOptions options)
        {
            options.SwaggerDoc(
                Constants.ApiName,
                new OpenApiInfo
                {
                    Title = "Smart Redirect Suggester Backoffice API",
                    Version = "1.0",
                });

            options.OperationFilter<SmartRedirectSuggesterOperationSecurityFilter>();
        }
    }

    public class SmartRedirectSuggesterOperationSecurityFilter : BackOfficeSecurityRequirementsOperationFilterBase
    {
        protected override string ApiName => Constants.ApiName;
    }
}
