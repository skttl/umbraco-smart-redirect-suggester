import { UmbTrashEntityBulkAction } from "@umbraco-cms/backoffice/recycle-bin";
import { umbOpenModal } from "@umbraco-cms/backoffice/modal";
import { UMB_NOTIFICATION_CONTEXT } from "@umbraco-cms/backoffice/notification";
import { SMART_REDIRECT_SUGGESTER_MODAL } from "../modals/suggest-redirect-modal.token.js";
import {
  commitRedirects,
  type CommitEntryDto,
} from "./smart-trash-api.js";

export class SmartBulkTrashEntityAction extends UmbTrashEntityBulkAction {
  #pendingRedirects: CommitEntryDto[] = [];

  override async execute(): Promise<void> {
    this.#pendingRedirects = [];

    await super.execute();

    if (this.#pendingRedirects.length === 0) {
      return;
    }

    const redirectEntries = this.#pendingRedirects;
    this.#pendingRedirects = [];

    try {
      const result = await commitRedirects({ redirects: redirectEntries });
      const notificationContext = await this.getContext(UMB_NOTIFICATION_CONTEXT);
      if (result.createdRedirectCount > 0) {
        notificationContext?.peek("positive", {
          data: {
            headline: "Redirect created",
            message:
              result.createdRedirectCount === 1
                ? "1 redirect added to the URL tracker."
                : `${result.createdRedirectCount} redirects added to the URL tracker.`,
          },
        });
      }
    } catch (err) {
      console.error("[SmartRedirectSuggester] commit failed", err);
      const notificationContext = await this.getContext(UMB_NOTIFICATION_CONTEXT);
      notificationContext?.peek("warning", {
        data: {
          headline: "Redirect not created",
          message:
            "The document was trashed, but the redirect could not be registered. " +
            "You can add it manually in Redirect URL Management.",
        },
      });
    }
  }

  protected override async _confirmTrash(items: Array<unknown>): Promise<void> {
    if (!this.selection || this.selection.length === 0) {
      return super._confirmTrash(items);
    }

    const value = await umbOpenModal(this, SMART_REDIRECT_SUGGESTER_MODAL, {
      data: { documentKeys: this.selection },
    });

    this.#pendingRedirects = Object.entries(value.redirects).map(
      ([trashedDocumentKey, targetDocumentKey]) => ({
        trashedDocumentKey,
        targetDocumentKey,
      }),
    );
  }
}

export { SmartBulkTrashEntityAction as api };
export default SmartBulkTrashEntityAction;
