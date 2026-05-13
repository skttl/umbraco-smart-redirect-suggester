import { html as n, nothing as f, repeat as x, css as R, state as d, property as B, customElement as U } from "@umbraco-cms/backoffice/external/lit";
import { UmbModalBaseElement as F, umbOpenModal as W } from "@umbraco-cms/backoffice/modal";
import { UMB_DOCUMENT_PICKER_MODAL as j, UMB_DOCUMENT_ITEM_REPOSITORY_ALIAS as Y } from "@umbraco-cms/backoffice/document";
import { createExtensionApiByAlias as G } from "@umbraco-cms/backoffice/extension-registry";
import { p as C } from "./smart-trash-api-CiDs1JuP.js";
var X = Object.defineProperty, H = Object.getOwnPropertyDescriptor, M = (e) => {
  throw TypeError(e);
}, r = (e, t, i, a) => {
  for (var s = a > 1 ? void 0 : a ? H(t, i) : t, p = e.length - 1, y; p >= 0; p--)
    (y = e[p]) && (s = (a ? y(t, i, s) : y(s)) || s);
  return a && s && X(t, i, s), s;
}, w = (e, t, i) => t.has(e) || M("Cannot " + i), c = (e, t, i) => (w(e, t, "read from private field"), i ? i.call(e) : t.get(e)), h = (e, t, i) => t.has(e) ? M("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, i), J = (e, t, i, a) => (w(e, t, "write to private field"), t.set(e, i), i), u = (e, t, i) => (w(e, t, "access private method"), i), g, v, _, m, l, S, b, K, P, I, z, E, D, T, O, k, N, A;
const L = "__none__", Q = 1, $ = 3;
let o = class extends F {
  constructor() {
    super(...arguments), h(this, l), this._selections = {}, this._manualPicks = {}, this._items = [], this._isLoading = !0, this._loadFailed = !1, this._currentPage = 1, this._editingItem = null, h(this, g), h(this, v, () => {
      this._rejectModal();
    }), h(this, _, (e, t) => {
      this.value = {
        proceed: e,
        redirects: t ? this._selections : {}
      }, this._submitModal();
    }), h(this, m, (e, t) => {
      if (t === L) {
        this._selections = { ...this._selections, [e]: null }, this._editingItem = null;
        return;
      }
      this._selections = { ...this._selections, [e]: t }, this._editingItem = null;
    }), h(this, b, async (e) => {
      const t = new Set(this._items.map((i) => i.documentKey));
      try {
        const a = (await W(this, j, {
          data: {
            multiple: !1,
            // Hide the in-flight trash targets from the tree to avoid obvious bad picks.
            pickableFilter: (p) => !t.has(p.unique)
          }
        })).selection?.[0];
        if (!a) return;
        const s = await u(this, l, K).call(this, a);
        s && (this._manualPicks = { ...this._manualPicks, [a]: s }), this._selections = { ...this._selections, [e.documentKey]: a }, this._editingItem = null;
      } catch {
      }
    });
  }
  get data() {
    return c(this, g);
  }
  set data(e) {
    J(this, g, e);
  }
  connectedCallback() {
    super.connectedCallback(), u(this, l, S).call(this);
  }
  get _isBulk() {
    return this._items.length > 1;
  }
  render() {
    return n`
      <uui-dialog-layout headline=${this._isBulk ? `Create redirects for ${this._items.length} pages?` : "Create a redirect for this page?"}>
        ${u(this, l, z).call(this)}

        <uui-button
          slot="actions"
          label="Cancel"
          look="secondary"
          @click=${c(this, v)}
        ></uui-button>

        <uui-button
          slot="actions"
          label="Trash without redirect"
          look="secondary"
          @click=${() => c(this, _).call(this, !0, !1)}
        ></uui-button>

        <uui-button
          slot="actions"
          label=${u(this, l, I).call(this)}
          look="primary"
          color="positive"
          ?disabled=${this._isLoading || this._loadFailed}
          @click=${() => c(this, _).call(this, !0, !0)}
        ></uui-button>
      </uui-dialog-layout>
    `;
  }
};
g = /* @__PURE__ */ new WeakMap();
v = /* @__PURE__ */ new WeakMap();
_ = /* @__PURE__ */ new WeakMap();
m = /* @__PURE__ */ new WeakMap();
l = /* @__PURE__ */ new WeakSet();
S = async function() {
  this._isLoading = !0, this._loadFailed = !1;
  try {
    const e = this.data?.documentKeys ?? [], t = await C({
      documentKeys: e,
      candidateCount: e.length > 1 ? Q : $
    });
    this._items = t.items;
    const i = {};
    for (const a of t.items)
      i[a.documentKey] = a.candidates[0]?.documentKey ?? null;
    this._selections = i, this._currentPage = 1;
  } catch (e) {
    console.warn("[SmartRedirectSuggester] prepare failed", e), this._items = [], this._selections = {}, this._loadFailed = !0;
  } finally {
    this._isLoading = !1;
  }
};
b = /* @__PURE__ */ new WeakMap();
K = async function(e) {
  try {
    const t = await G(this, Y), { data: i } = await t.requestItems([e]), a = i?.[0], s = a?.variants?.[0]?.name ?? a?.name ?? e;
    return { documentKey: e, name: s, url: "" };
  } catch {
    return { documentKey: e, name: e, url: "" };
  }
};
P = function(e, t) {
  if (!t) return;
  const i = e.candidates.find((s) => s.documentKey === t);
  if (i) return { name: i.name, url: i.url };
  const a = this._manualPicks[t];
  return a ? { name: a.name, url: a.url } : { name: t, url: "" };
};
I = function() {
  if (this._isLoading) return "Loading suggestions…";
  const e = Object.values(this._selections).filter((t) => t !== null).length;
  return e === 0 ? "Trash" : e === 1 ? "Trash and create redirect" : `Trash and create ${e} redirects`;
};
z = function() {
  return this._isLoading ? n`
        <div class="loading-state">
          <uui-loader-bar></uui-loader-bar>
          <p class="muted">Finding redirect suggestions…</p>
        </div>
      ` : this._loadFailed ? n`<p class="muted">Suggestions could not be loaded. You can still trash without creating redirects.</p>` : this._items.length === 0 ? n`<p class="muted">No redirect suggestions were found for the selected content.</p>` : n`
      ${this._isBulk ? u(this, l, D).call(this) : u(this, l, E).call(this, this._items[0])}
      ${this._editingItem ? u(this, l, A).call(this, this._editingItem) : f}
    `;
};
E = function(e) {
  const t = this._selections[e.documentKey], i = t !== null && !e.candidates.some((s) => s.documentKey === t), a = i ? u(this, l, P).call(this, e, t) : void 0;
  return n`
      <p>
        <strong>${e.name}</strong> will be moved to the recycle bin.
        Pick where visitors should be redirected.
      </p>

      ${e.candidates.length > 0 ? n`
            <div class="suggestions" role="list">
              ${x(
    e.candidates,
    (s) => s.documentKey,
    (s) => n`
                  <button
                    type="button"
                    class="suggestion ${t === s.documentKey ? "suggestion--selected" : ""}"
                    @click=${() => c(this, m).call(this, e.documentKey, s.documentKey)}
                  >
                    <uui-ref-node
                      name=${s.name}
                      detail=${s.url}
                      readonly
                      ?standalone=${t === s.documentKey}
                    >
                      <umb-icon slot="icon" name="icon-document"></umb-icon>
                    </uui-ref-node>
                  </button>
                `
  )}
            </div>
          ` : n`<p class="muted">No automatic suggestions found.</p>`}

      <div class="picker-actions">
        <uui-button
          label=${i ? "Change picked content" : "Pick content"}
          look="secondary"
          @click=${() => c(this, b).call(this, e)}
        ></uui-button>
      </div>

      ${i ? n`
            <div class="manual-selection">
              <span class="muted">Picked content</span>
              <uui-ref-node name=${a?.name ?? t ?? ""} detail=${a?.url || "Manually picked"} readonly>
                <umb-icon slot="icon" name="icon-document"></umb-icon>
              </uui-ref-node>
            </div>
          ` : f}
    `;
};
D = function() {
  const e = (this._currentPage - 1) * o._pageSize, t = this._items.slice(e, e + o._pageSize), i = Math.max(1, Math.ceil(this._items.length / o._pageSize));
  return n`
      <p>
        ${this._items.length} pages are about to be moved to the recycle bin.
        Confirm or change the suggested redirect target for each one.
      </p>
      <uui-table>
        <uui-table-head>
          <uui-table-head-cell>Page</uui-table-head-cell>
          <uui-table-head-cell>Redirect to</uui-table-head-cell>
          <uui-table-head-cell></uui-table-head-cell>
        </uui-table-head>
        ${x(
    t,
    (a) => a.documentKey,
    (a) => u(this, l, T).call(this, a)
  )}
      </uui-table>
      ${i > 1 ? n`
            <div class="pagination">
              <uui-button
                compact
                label="Previous page"
                look="secondary"
                ?disabled=${this._currentPage === 1}
                @click=${() => u(this, l, k).call(this, this._currentPage - 1)}
              ></uui-button>
              <span class="muted">Page ${this._currentPage} of ${i}</span>
              <uui-button
                compact
                label="Next page"
                look="secondary"
                ?disabled=${this._currentPage === i}
                @click=${() => u(this, l, k).call(this, this._currentPage + 1)}
              ></uui-button>
            </div>
          ` : f}
    `;
};
T = function(e) {
  const t = this._selections[e.documentKey], i = u(this, l, P).call(this, e, t);
  return n`
      <uui-table-row>
        <uui-table-cell>
          <uui-ref-node name=${e.name} detail=${e.oldUrls[0]?.url || "Trashed content"} readonly>
            <umb-icon slot="icon" name="icon-document"></umb-icon>
          </uui-ref-node>
        </uui-table-cell>
        <uui-table-cell>
          ${t === null ? n`<span class="muted">No redirect</span>` : n`<uui-ref-node name=${i?.name ?? t ?? ""} detail=${i?.url || "Selected content"} readonly>
                <umb-icon slot="icon" name="icon-document"></umb-icon>
              </uui-ref-node>`}
        </uui-table-cell>
        <uui-table-cell>
          <uui-button
            compact
            label="Change"
            look="secondary"
            @click=${() => u(this, l, O).call(this, e)}
          ></uui-button>
        </uui-table-cell>
      </uui-table-row>
    `;
};
O = function(e) {
  u(this, l, N).call(this, e);
};
k = function(e) {
  const t = Math.max(1, Math.ceil(this._items.length / o._pageSize));
  this._currentPage = Math.min(t, Math.max(1, e));
};
N = async function(e) {
  if (e.candidates.length >= $) {
    this._editingItem = e;
    return;
  }
  try {
    const i = (await C({
      documentKeys: [e.documentKey],
      candidateCount: $
    })).items[0];
    if (i) {
      this._items = this._items.map(
        (a) => a.documentKey === e.documentKey ? i : a
      ), this._editingItem = i;
      return;
    }
  } catch (t) {
    console.warn("[SmartRedirectSuggester] prepare failed", t);
  }
  this._editingItem = e;
};
A = function(e) {
  const t = this._selections[e.documentKey], i = t !== null ? this._manualPicks[t] : void 0;
  return n`
      <div class="dialog-backdrop" @click=${() => this._editingItem = null}>
        <div class="change-dialog" @click=${(a) => a.stopPropagation()}>
          <div class="change-dialog__header">
            <strong>Choose redirect target</strong>
            <div class="muted">${e.name}</div>
          </div>

          <div class="suggestions" role="list">
            ${x(
    e.candidates.slice(0, 3),
    (a) => a.documentKey,
    (a) => n`
                <button
                  type="button"
                  class="suggestion ${t === a.documentKey ? "suggestion--selected" : ""}"
                  @click=${() => c(this, m).call(this, e.documentKey, a.documentKey)}
                >
                  <uui-ref-node
                    name=${a.name}
                    detail=${a.url}
                    readonly
                    ?standalone=${t === a.documentKey}
                  >
                    <umb-icon slot="icon" name="icon-document"></umb-icon>
                  </uui-ref-node>
                </button>
              `
  )}
          </div>

          ${i ? n`
                <div class="manual-selection">
                  <span class="muted">Current manual selection</span>
                  <uui-ref-node name=${i.name} detail=${i.url || "Manually picked"} readonly>
                    <umb-icon slot="icon" name="icon-document"></umb-icon>
                  </uui-ref-node>
                </div>
              ` : f}

          <div class="change-dialog__actions">
            <uui-button
              label="No redirect"
              look="secondary"
              @click=${() => c(this, m).call(this, e.documentKey, L)}
            ></uui-button>
            <uui-button
              label="Pick content"
              look="secondary"
              @click=${() => c(this, b).call(this, e)}
            ></uui-button>
            <uui-button
              label="Close"
              look="primary"
              @click=${() => this._editingItem = null}
            ></uui-button>
          </div>
        </div>
      </div>
    `;
};
o._pageSize = 10;
o.styles = [
  R`
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
    `
];
r([
  d()
], o.prototype, "_selections", 2);
r([
  d()
], o.prototype, "_manualPicks", 2);
r([
  d()
], o.prototype, "_items", 2);
r([
  d()
], o.prototype, "_isLoading", 2);
r([
  d()
], o.prototype, "_loadFailed", 2);
r([
  d()
], o.prototype, "_currentPage", 2);
r([
  d()
], o.prototype, "_editingItem", 2);
r([
  B({ attribute: !1 })
], o.prototype, "data", 1);
o = r([
  U("smart-redirect-suggester-modal")
], o);
const ie = o;
export {
  o as SmartRedirectSuggesterModalElement,
  ie as default
};
//# sourceMappingURL=suggest-redirect-modal.element-42J2d6UR.js.map
