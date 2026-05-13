import {
  css,
  html,
  customElement,
  state,
  property,
  nothing,
  repeat,
} from "@umbraco-cms/backoffice/external/lit";
import { UmbModalBaseElement, umbOpenModal } from "@umbraco-cms/backoffice/modal";
import { UMB_DOCUMENT_PICKER_MODAL, UMB_DOCUMENT_ITEM_REPOSITORY_ALIAS } from "@umbraco-cms/backoffice/document";
import { createExtensionApiByAlias } from "@umbraco-cms/backoffice/extension-registry";
import { prepareSuggestions } from "../entity-actions/smart-trash-api.js";
import type {
  SmartRedirectSuggesterModalData,
  SmartRedirectSuggesterModalItem,
  SmartRedirectSuggesterModalValue,
} from "./suggest-redirect-modal.token.js";

/** Sentinel value used by the radio group when the user picks "no redirect" for an item. */
const NO_REDIRECT = "__none__";
const INITIAL_BULK_CANDIDATE_COUNT = 1;
const EXPANDED_CANDIDATE_COUNT = 3;

@customElement("smart-redirect-suggester-modal")
export class SmartRedirectSuggesterModalElement extends UmbModalBaseElement<
  SmartRedirectSuggesterModalData,
  SmartRedirectSuggesterModalValue
> {
  /**
   * Working state, keyed by trashed document key. The value is either a target document key,
   * or null which means "do not create a redirect for this document". Initialised in
   * connectedCallback() from the highest-scoring candidate per item (or null if none).
   */
  @state()
  private _selections: Record<string, string | null> = {};

  /**
   * Per-item manual overrides resolved via the document picker, stored separately so we can render them
   * even though they aren't present in the original candidate list. Maps target key → display info.
   */
  @state()
  private _manualPicks: Record<
    string,
    { documentKey: string; name: string; url: string }
  > = {};

  @state()
  private _items: SmartRedirectSuggesterModalItem[] = [];

  @state()
  private _isLoading = true;

  @state()
  private _loadFailed = false;

  @state()
  private _currentPage = 1;

  @state()
  private _editingItem: SmartRedirectSuggesterModalItem | null = null;

  @property({ attribute: false })
  accessor data!: SmartRedirectSuggesterModalData;

  private static readonly _pageSize = 10;

  override connectedCallback(): void {
    super.connectedCallback();
    void this.#loadSuggestions();
  }

  private get _isBulk(): boolean {
    return this._items.length > 1;
  }

  #onCancel = () => {
    // _rejectModal rejects the umbOpenModal promise — callers treat this as "abort the trash".
    this._rejectModal();
  };

  #onSubmit = (proceed: boolean, withRedirects: boolean) => {
    this.value = {
      proceed,
      redirects: withRedirects ? this._selections : {},
    };
    this._submitModal();
  };

  #onSelectionChange = (documentKey: string, value: string) => {
    if (value === NO_REDIRECT) {
      this._selections = { ...this._selections, [documentKey]: null };
      this._editingItem = null;
      return;
    }
    this._selections = { ...this._selections, [documentKey]: value };
    this._editingItem = null;
  };

  async #loadSuggestions() {
    this._isLoading = true;
    this._loadFailed = false;

    try {
      const documentKeys = this.data?.documentKeys ?? [];
      const result = await prepareSuggestions({
        documentKeys,
        candidateCount: documentKeys.length > 1 ? INITIAL_BULK_CANDIDATE_COUNT : EXPANDED_CANDIDATE_COUNT,
      });
      this._items = result.items;

      const initial: Record<string, string | null> = {};
      for (const item of result.items) {
        initial[item.documentKey] = item.candidates[0]?.documentKey ?? null;
      }
      this._selections = initial;
      this._currentPage = 1;
    } catch (err) {
      console.warn("[SmartRedirectSuggester] prepare failed", err);
      this._items = [];
      this._selections = {};
      this._loadFailed = true;
    } finally {
      this._isLoading = false;
    }
  }

  #onPickManual = async (item: SmartRedirectSuggesterModalItem) => {
    // Exclude every trashed document (and any manual pick already chosen for another item) from being a target.
    const excludedKeys = new Set<string>(this._items.map((i) => i.documentKey));

    try {
      const result = await umbOpenModal(this, UMB_DOCUMENT_PICKER_MODAL, {
        data: {
          multiple: false,
          // Hide the in-flight trash targets from the tree to avoid obvious bad picks.
          pickableFilter: (doc) => !excludedKeys.has(doc.unique),
        },
      });

      const picked = result.selection?.[0];
      if (!picked) return;

      // Look up display data via the document item repository so we can render the choice nicely.
      const display = await this.#resolveDocumentDisplay(picked);
      if (display) {
        this._manualPicks = { ...this._manualPicks, [picked]: display };
      }

      this._selections = { ...this._selections, [item.documentKey]: picked };
      this._editingItem = null;
    } catch {
      // Picker closed/cancelled — keep existing selection.
    }
  };

  /**
   * Resolve a document's display name + URL by calling the standard Umbraco document item repository.
   * Falls back to a stub if the repository can't be loaded (offline / extension missing).
   */
  async #resolveDocumentDisplay(
    unique: string,
  ): Promise<{ documentKey: string; name: string; url: string } | undefined> {
    try {
      // Loose typing here \u2014 the Umbraco item repository contract is more complex than we need,
      // and we only care about the requestItems() shape for display purposes.
      const repo = (await createExtensionApiByAlias(this, UMB_DOCUMENT_ITEM_REPOSITORY_ALIAS)) as unknown as {
        requestItems: (uniques: string[]) => Promise<{
          data?: Array<{
            name?: string;
            variants?: Array<{ name?: string; culture?: string | null }>;
          }>;
        }>;
      };
      const { data } = await repo.requestItems([unique]);
      const first = data?.[0];
      const name = first?.variants?.[0]?.name ?? first?.name ?? unique;
      // URL isn't trivially available from the item repository — leave blank and let the UI render the key.
      return { documentKey: unique, name, url: "" };
    } catch {
      return { documentKey: unique, name: unique, url: "" };
    }
  }

  /**
   * Resolve a target key into a renderable name + URL. Tries the item's own candidate list first
   * (covers the common case), then the manual-pick cache.
   */
  #resolveTargetDisplay(
    item: SmartRedirectSuggesterModalItem,
    targetKey: string | null,
  ): { name: string; url: string } | undefined {
    if (!targetKey) return undefined;
    const fromCandidates = item.candidates.find((c) => c.documentKey === targetKey);
    if (fromCandidates) return { name: fromCandidates.name, url: fromCandidates.url };
    const manual = this._manualPicks[targetKey];
    if (manual) return { name: manual.name, url: manual.url };
    return { name: targetKey, url: "" };
  }

  override render() {
    return html`
      <uui-dialog-layout headline=${this._isBulk
        ? this.localize.term("smartRedirectSuggester_modal_bulkHeadline", this._items.length)
        : this.localize.term("smartRedirectSuggester_modal_singleHeadline")}>
        ${this.#renderBody()}

        <uui-button
          slot="actions"
          label=${this.localize.term("general_cancel")}
          look="secondary"
          @click=${this.#onCancel}
        ></uui-button>

        <uui-button
          slot="actions"
          label=${this.localize.term("smartRedirectSuggester_modal_trashWithoutRedirect")}
          look="secondary"
          @click=${() => this.#onSubmit(true, false)}
        ></uui-button>

        <uui-button
          slot="actions"
          label=${this.#submitLabel()}
          look="primary"
          color="positive"
          ?disabled=${this._isLoading || this._loadFailed}
          @click=${() => this.#onSubmit(true, true)}
        ></uui-button>
      </uui-dialog-layout>
    `;
  }

  #submitLabel(): string {
    if (this._isLoading) return this.localize.term("general_loading");
    const count = Object.values(this._selections).filter((v) => v !== null).length;
    if (count === 0) return this.localize.term("actions_trash");
    if (count === 1) return this.localize.term("smartRedirectSuggester_modal_submitSingleRedirect");
    return this.localize.term("smartRedirectSuggester_modal_submitMultipleRedirects", count);
  }

  #renderBody() {
    if (this._isLoading) {
      return html`
        <div class="loading-state">
          <uui-loader-bar></uui-loader-bar>
          <p class="muted">${this.localize.term("general_loading")}</p>
        </div>
      `;
    }

    if (this._loadFailed) {
      return html`<p class="muted">${this.localize.term("smartRedirectSuggester_modal_loadFailed")}</p>`;
    }

    if (this._items.length === 0) {
      return html`<p class="muted">${this.localize.term("smartRedirectSuggester_modal_noSuggestions")}</p>`;
    }

    return html`
      ${this._isBulk ? this.#renderBulk() : this.#renderSingle(this._items[0])}
      ${this._editingItem ? this.#renderChangeDialog(this._editingItem) : nothing}
    `;
  }

  #renderSingle(item: SmartRedirectSuggesterModalItem) {
    const current = this._selections[item.documentKey];
    const isManualSelection =
      current !== null && !item.candidates.some((c) => c.documentKey === current);
    const manualDisplay = isManualSelection ? this.#resolveTargetDisplay(item, current) : undefined;

    return html`
      <p>
        ${this.localize.term("smartRedirectSuggester_modal_singleDescription", item.name)}
      </p>

      ${item.candidates.length > 0
        ? html`
            <div class="suggestions" role="list">
              ${repeat(
                item.candidates,
                (c) => c.documentKey,
                (c) => html`
                  <button
                    type="button"
                    class="suggestion ${current === c.documentKey ? "suggestion--selected" : ""}"
                    @click=${() => this.#onSelectionChange(item.documentKey, c.documentKey)}
                  >
                    <uui-ref-node
                      name=${c.name}
                      detail=${c.url}
                      readonly
                      ?standalone=${current === c.documentKey}
                    >
                      <umb-icon slot="icon" name="icon-document"></umb-icon>
                    </uui-ref-node>
                  </button>
                `,
              )}
            </div>
          `
        : html`<p class="muted">${this.localize.term("smartRedirectSuggester_modal_noAutomaticSuggestions")}</p>`}

      <div class="picker-actions">
        <uui-button
          label=${isManualSelection
            ? this.localize.term("general_change")
            : this.localize.term("general_choose")}
          look="secondary"
          @click=${() => this.#onPickManual(item)}
        ></uui-button>
      </div>

      ${isManualSelection
        ? html`
            <div class="manual-selection">
              <span class="muted">${this.localize.term("smartRedirectSuggester_modal_pickedContent")}</span>
              <uui-ref-node name=${manualDisplay?.name ?? current ?? ""} detail=${manualDisplay?.url || this.localize.term("smartRedirectSuggester_modal_manuallyPicked")} readonly>
                <umb-icon slot="icon" name="icon-document"></umb-icon>
              </uui-ref-node>
            </div>
          `
        : nothing}
    `;
  }

  #renderBulk() {
    const start = (this._currentPage - 1) * SmartRedirectSuggesterModalElement._pageSize;
    const pagedItems = this._items.slice(start, start + SmartRedirectSuggesterModalElement._pageSize);
    const totalPages = Math.max(1, Math.ceil(this._items.length / SmartRedirectSuggesterModalElement._pageSize));

    return html`
      <p>
        ${this.localize.term("smartRedirectSuggester_modal_bulkDescription", this._items.length)}
      </p>
      <uui-table>
        <uui-table-head>
          <uui-table-head-cell>${this.localize.term("smartRedirectSuggester_modal_tablePage")}</uui-table-head-cell>
          <uui-table-head-cell>${this.localize.term("smartRedirectSuggester_modal_tableRedirectTo")}</uui-table-head-cell>
          <uui-table-head-cell></uui-table-head-cell>
        </uui-table-head>
        ${repeat(
          pagedItems,
          (i) => i.documentKey,
          (i) => this.#renderBulkRow(i),
        )}
      </uui-table>
      ${totalPages > 1
        ? html`
            <div class="pagination">
              <uui-button
                compact
                label=${this.localize.term("general_previous")}
                look="secondary"
                ?disabled=${this._currentPage === 1}
                @click=${() => this.#changePage(this._currentPage - 1)}
              ></uui-button>
              <span class="muted">${this.localize.term("smartRedirectSuggester_modal_pageOf", this._currentPage, totalPages)}</span>
              <uui-button
                compact
                label=${this.localize.term("general_next")}
                look="secondary"
                ?disabled=${this._currentPage === totalPages}
                @click=${() => this.#changePage(this._currentPage + 1)}
              ></uui-button>
            </div>
          `
        : nothing}
    `;
  }

  #renderBulkRow(item: SmartRedirectSuggesterModalItem) {
    const current = this._selections[item.documentKey];
    const display = this.#resolveTargetDisplay(item, current);
    return html`
      <uui-table-row>
        <uui-table-cell>
          <uui-ref-node name=${item.name} detail=${item.oldUrls[0]?.url || this.localize.term("smartRedirectSuggester_modal_trashedContent")} readonly>
            <umb-icon slot="icon" name="icon-document"></umb-icon>
          </uui-ref-node>
        </uui-table-cell>
        <uui-table-cell>
          ${current === null
            ? html`<span class="muted">${this.localize.term("smartRedirectSuggester_modal_noRedirect")}</span>`
            : html`<uui-ref-node name=${display?.name ?? current ?? ""} detail=${display?.url || this.localize.term("smartRedirectSuggester_modal_selectedContent")} readonly>
                <umb-icon slot="icon" name="icon-document"></umb-icon>
              </uui-ref-node>`}
        </uui-table-cell>
        <uui-table-cell>
          <uui-button
            compact
            label=${this.localize.term("general_change")}
            look="secondary"
            @click=${() => this.#openRowEditor(item)}
          ></uui-button>
        </uui-table-cell>
      </uui-table-row>
    `;
  }

  /**
   * Cycle through the row's available options for bulk mode: each candidate → manual pick → no redirect → first candidate.
   * Keeps the bulk UI dense without requiring a nested modal per row.
   */
  #openRowEditor(item: SmartRedirectSuggesterModalItem) {
    void this.#ensureExpandedCandidatesAndOpen(item);
  }

  #changePage(page: number) {
    const totalPages = Math.max(1, Math.ceil(this._items.length / SmartRedirectSuggesterModalElement._pageSize));
    this._currentPage = Math.min(totalPages, Math.max(1, page));
  }

  async #ensureExpandedCandidatesAndOpen(item: SmartRedirectSuggesterModalItem) {
    if (item.candidates.length >= EXPANDED_CANDIDATE_COUNT) {
      this._editingItem = item;
      return;
    }

    try {
      const result = await prepareSuggestions({
        documentKeys: [item.documentKey],
        candidateCount: EXPANDED_CANDIDATE_COUNT,
      });
      const expandedItem = result.items[0];
      if (expandedItem) {
        this._items = this._items.map((existingItem) =>
          existingItem.documentKey === item.documentKey ? expandedItem : existingItem,
        );
        this._editingItem = expandedItem;
        return;
      }
    } catch (err) {
      console.warn("[SmartRedirectSuggester] prepare failed", err);
    }

    this._editingItem = item;
  }

  #renderChangeDialog(item: SmartRedirectSuggesterModalItem) {
    const current = this._selections[item.documentKey];
    const manualDisplay = current !== null ? this._manualPicks[current] : undefined;

    return html`
      <div class="dialog-backdrop" @click=${() => (this._editingItem = null)}>
        <div class="change-dialog" @click=${(event: Event) => event.stopPropagation()}>
          <div class="change-dialog__header">
            <strong>${this.localize.term("smartRedirectSuggester_modal_chooseRedirectTarget")}</strong>
            <div class="muted">${item.name}</div>
          </div>

          <div class="suggestions" role="list">
            ${repeat(
              item.candidates.slice(0, 3),
              (c) => c.documentKey,
              (c) => html`
                <button
                  type="button"
                  class="suggestion ${current === c.documentKey ? "suggestion--selected" : ""}"
                  @click=${() => this.#onSelectionChange(item.documentKey, c.documentKey)}
                >
                  <uui-ref-node
                    name=${c.name}
                    detail=${c.url}
                    readonly
                    ?standalone=${current === c.documentKey}
                  >
                    <umb-icon slot="icon" name="icon-document"></umb-icon>
                  </uui-ref-node>
                </button>
              `,
            )}
          </div>

          ${manualDisplay
            ? html`
                <div class="manual-selection">
                  <span class="muted">${this.localize.term("smartRedirectSuggester_modal_currentManualSelection")}</span>
                  <uui-ref-node name=${manualDisplay.name} detail=${manualDisplay.url || this.localize.term("smartRedirectSuggester_modal_manuallyPicked")} readonly>
                    <umb-icon slot="icon" name="icon-document"></umb-icon>
                  </uui-ref-node>
                </div>
              `
            : nothing}

          <div class="change-dialog__actions">
            <uui-button
              label=${this.localize.term("smartRedirectSuggester_modal_noRedirect")}
              look="secondary"
              @click=${() => this.#onSelectionChange(item.documentKey, NO_REDIRECT)}
            ></uui-button>
            <uui-button
              label=${this.localize.term("general_choose")}
              look="secondary"
              @click=${() => this.#onPickManual(item)}
            ></uui-button>
            <uui-button
              label=${this.localize.term("general_close")}
              look="primary"
              @click=${() => (this._editingItem = null)}
            ></uui-button>
          </div>
        </div>
      </div>
    `;
  }

  static styles = [
    css`
      :host {
        display: block;
        min-width: 560px;
        position: relative;
      }
      .loading-state {
        display: flex;
        flex-direction: column;
        gap: var(--uui-size-space-4);
      }
      .muted {
        color: var(--uui-color-text-alt);
        font-size: var(--uui-type-small-size);
      }
      code {
        font-family: var(--uui-font-monospace, monospace);
      }
      ul.urls {
        list-style: none;
        padding: 0;
        margin: 0 0 var(--uui-size-space-3) 0;
      }
      ul.urls li {
        margin: var(--uui-size-space-1) 0;
      }
      .suggestions {
        display: flex;
        flex-direction: column;
        gap: var(--uui-size-space-2);
      }
      .suggestion {
        border: 1px solid var(--uui-color-border);
        border-radius: var(--uui-border-radius);
        background: transparent;
        padding: 0;
        text-align: left;
        cursor: pointer;
        font: inherit;
        color: inherit;
      }
      .suggestion:hover {
        border-color: var(--uui-color-interactive-emphasis);
      }
      .suggestion:focus-visible {
        outline: 2px solid var(--uui-color-focus);
        outline-offset: 2px;
      }
      .suggestion--selected {
        border-color: var(--uui-color-selected);
        box-shadow: 0 0 0 1px var(--uui-color-selected);
      }
      .suggestion uui-ref-node {
        width: 100%;
      }
      .picker-actions {
        margin-top: var(--uui-size-space-4);
      }
      .manual-selection {
        margin-top: var(--uui-size-space-3);
        display: flex;
        flex-direction: column;
        gap: var(--uui-size-space-2);
      }
      .pagination {
        margin-top: var(--uui-size-space-4);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--uui-size-space-3);
      }
      .dialog-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--uui-size-space-5);
        z-index: 1000;
      }
      .change-dialog {
        background: var(--uui-color-surface);
        border-radius: var(--uui-border-radius);
        padding: var(--uui-size-space-5);
        width: min(100%, 520px);
        box-shadow: var(--uui-shadow-depth-3);
        display: flex;
        flex-direction: column;
        gap: var(--uui-size-space-4);
        position: relative;
        z-index: 1001;
      }
      .change-dialog__header {
        display: flex;
        flex-direction: column;
        gap: var(--uui-size-space-1);
      }
      .change-dialog__actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--uui-size-space-2);
      }
    `,
  ];
}

export default SmartRedirectSuggesterModalElement;

declare global {
  interface HTMLElementTagNameMap {
    "smart-redirect-suggester-modal": SmartRedirectSuggesterModalElement;
  }
}
