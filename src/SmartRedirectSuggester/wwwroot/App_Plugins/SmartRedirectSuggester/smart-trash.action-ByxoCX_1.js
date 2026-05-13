import { UmbTrashEntityAction as n } from "@umbraco-cms/backoffice/recycle-bin";
import { umbOpenModal as s } from "@umbraco-cms/backoffice/modal";
import { UMB_NOTIFICATION_CONTEXT as i } from "@umbraco-cms/backoffice/notification";
import { S as c } from "./suggest-redirect-modal.token-DjBd7IGR.js";
import { c as o } from "./smart-trash-api-CiDs1JuP.js";
class p extends n {
  // Stashed during _confirmTrash() and read in execute() once the trash has succeeded.
  // We can't pass values between the two methods cleanly, so we lean on instance state.
  #t = [];
  async execute() {
    if (this.#t = [], await super.execute(), this.#t.length === 0)
      return;
    const r = this.#t;
    this.#t = [];
    try {
      const t = await o({ redirects: r }), e = await this.getContext(i);
      t.createdRedirectCount > 0 && e?.peek("positive", {
        data: {
          headline: "Redirect created",
          message: t.createdRedirectCount === 1 ? "1 redirect added to the URL tracker." : `${t.createdRedirectCount} redirects added to the URL tracker.`
        }
      });
    } catch (t) {
      console.error("[SmartRedirectSuggester] commit failed", t), (await this.getContext(i))?.peek("warning", {
        data: {
          headline: "Redirect not created",
          message: "The document was trashed, but the redirect could not be registered. You can add it manually in Redirect URL Management."
        }
      });
    }
  }
  async _confirmTrash(r) {
    if (!this.args.unique)
      return super._confirmTrash(r);
    const t = await s(this, c, {
      data: { documentKeys: [this.args.unique] }
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
  p as SmartTrashEntityAction,
  p as api,
  p as default
};
//# sourceMappingURL=smart-trash.action-ByxoCX_1.js.map
