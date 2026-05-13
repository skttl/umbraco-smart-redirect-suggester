import { UmbTrashEntityBulkAction as n } from "@umbraco-cms/backoffice/recycle-bin";
import { umbOpenModal as c } from "@umbraco-cms/backoffice/modal";
import { UMB_NOTIFICATION_CONTEXT as r } from "@umbraco-cms/backoffice/notification";
import { S as s } from "./suggest-redirect-modal.token-DjBd7IGR.js";
import { c as o } from "./smart-trash-api-CiDs1JuP.js";
class f extends n {
  #t = [];
  async execute() {
    if (this.#t = [], await super.execute(), this.#t.length === 0)
      return;
    const i = this.#t;
    this.#t = [];
    try {
      const t = await o({ redirects: i }), e = await this.getContext(r);
      t.createdRedirectCount > 0 && e?.peek("positive", {
        data: {
          headline: "Redirect created",
          message: t.createdRedirectCount === 1 ? "1 redirect added to the URL tracker." : `${t.createdRedirectCount} redirects added to the URL tracker.`
        }
      });
    } catch (t) {
      console.error("[SmartRedirectSuggester] commit failed", t), (await this.getContext(r))?.peek("warning", {
        data: {
          headline: "Redirect not created",
          message: "The document was trashed, but the redirect could not be registered. You can add it manually in Redirect URL Management."
        }
      });
    }
  }
  async _confirmTrash(i) {
    if (!this.selection || this.selection.length === 0)
      return super._confirmTrash(i);
    const t = await c(this, s, {
      data: { documentKeys: this.selection }
    });
    this.#t = Object.entries(t.redirects).map(
      ([e, a]) => ({
        trashedDocumentKey: e,
        targetDocumentKey: a
      })
    );
  }
}
export {
  f as SmartBulkTrashEntityAction,
  f as api,
  f as default
};
//# sourceMappingURL=smart-bulk-trash.action-B56UEM0v.js.map
