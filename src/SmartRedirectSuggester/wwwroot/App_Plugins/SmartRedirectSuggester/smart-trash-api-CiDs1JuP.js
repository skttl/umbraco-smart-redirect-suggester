import { umbHttpClient as o } from "@umbraco-cms/backoffice/http-client";
const s = "/umbraco/smartredirectsuggester/api/v1", i = [{ scheme: "bearer", type: "http" }];
async function c(e) {
  const { data: r, error: t } = await o.post({
    url: `${s}/prepare`,
    body: e,
    security: i
  });
  if (t || !r)
    throw t ?? new Error("Failed to prepare redirect suggestions");
  return r;
}
async function n(e) {
  const { data: r, error: t } = await o.post({
    url: `${s}/commit`,
    body: e,
    security: i
  });
  if (t || !r)
    throw t ?? new Error("Failed to commit redirects");
  return r;
}
export {
  n as c,
  c as p
};
//# sourceMappingURL=smart-trash-api-CiDs1JuP.js.map
