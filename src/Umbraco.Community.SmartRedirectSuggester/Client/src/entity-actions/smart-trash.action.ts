import { UmbTrashEntityAction } from "@umbraco-cms/backoffice/recycle-bin";
import { umbOpenModal } from "@umbraco-cms/backoffice/modal";
import { UMB_NOTIFICATION_CONTEXT } from "@umbraco-cms/backoffice/notification";
import { UmbLocalizationController } from "@umbraco-cms/backoffice/localization-api";
import { SMART_REDIRECT_SUGGESTER_MODAL } from "../modals/suggest-redirect-modal.token.js";
import {
  commitRedirects,
  type CommitEntryDto,
} from "./smart-trash-api.js";

/**
 * Replacement for the default document Trash entity action.
 *
 * Sequence:
 *  1. Base `UmbTrashEntityAction.execute()` calls `_confirmTrash(item)`. We override that to call our
 *     prepare endpoint, show the suggestion modal, and stash the chosen redirects on the instance.
 *     If prepare returns no items, we fall back to the default confirm dialog from the relations
 *     trash kind so multi-variant docs still get a proper "Are you sure?" prompt.
 *  2. After `_confirmTrash` resolves, the base class performs the actual trash + dispatches events.
 *  3. We override `execute()` only to call the original via super, then post-trash commit any
 *     redirects via the management API and emit a notification.
 *
 * Cancelling the modal rejects, which propagates through `_confirmTrash` and aborts the trash.
 */
export class SmartTrashEntityAction extends UmbTrashEntityAction {
  // Stashed during _confirmTrash() and read in execute() once the trash has succeeded.
  // We can't pass values between the two methods cleanly, so we lean on instance state.
  #pendingRedirects: CommitEntryDto[] = [];
  #localize = new UmbLocalizationController(this);

  override async execute(): Promise<void> {
    // Reset between invocations in case the same action instance is reused.
    this.#pendingRedirects = [];

    // Defer to the base class — which will call our overridden _confirmTrash, then trash if it resolved.
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
            headline: this.#localize.term("smartRedirectSuggester_notification_redirectCreatedHeadline"),
            message:
              result.createdRedirectCount === 1
                ? this.#localize.term("smartRedirectSuggester_notification_redirectCreatedSingle")
                : this.#localize.term(
                    "smartRedirectSuggester_notification_redirectCreatedMultiple",
                    result.createdRedirectCount,
                  ),
          },
        });
      }
    } catch (err) {
      console.error("[SmartRedirectSuggester] commit failed", err);
      const notificationContext = await this.getContext(UMB_NOTIFICATION_CONTEXT);
      notificationContext?.peek("warning", {
        data: {
          headline: this.#localize.term("smartRedirectSuggester_notification_redirectNotCreatedHeadline"),
          message: this.#localize.term("smartRedirectSuggester_notification_redirectNotCreatedMessage"),
        },
      });
    }
  }

  protected override async _confirmTrash(item: unknown): Promise<void> {
    if (!this.args.unique) {
      return super._confirmTrash(item);
    }

    // Open our suggestion modal. If it rejects (Cancel button), let the rejection propagate so the
    // base class aborts the trash. If it resolves, capture the chosen redirects for execute() to commit.
    const value = await umbOpenModal(this, SMART_REDIRECT_SUGGESTER_MODAL, {
      data: { documentKeys: [this.args.unique] },
    });

    this.#pendingRedirects = Object.entries(value.redirects).map(
      ([trashedDocumentKey, targetDocumentKey]) => ({
        trashedDocumentKey,
        targetDocumentKey,
      }),
    );
  }
}

export { SmartTrashEntityAction as api };
export default SmartTrashEntityAction;
