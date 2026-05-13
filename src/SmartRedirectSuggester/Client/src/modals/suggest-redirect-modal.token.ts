import { UmbModalToken } from "@umbraco-cms/backoffice/modal";

/** One trashed document, with its captured URLs and ranked redirect candidates. */
export interface SmartRedirectSuggesterModalItem {
  documentKey: string;
  name: string;
  oldUrls: Array<{ culture: string | null; url: string }>;
  candidates: Array<{
    documentKey: string;
    name: string;
    url: string;
  }>;
}

export interface SmartRedirectSuggesterModalData {
  /** Trashed root documents used to lazily prepare redirect suggestions after the modal opens. */
  documentKeys: string[];
}

export interface SmartRedirectSuggesterModalValue {
  /** Whether the user confirmed the trash. If false, the trash should be aborted. */
  proceed: boolean;
  /**
   * Map of trashed document key → chosen redirect target document key (or null for "no redirect").
   * Only present when proceed === true.
   */
  redirects: Record<string, string | null>;
}

export const SMART_REDIRECT_SUGGESTER_MODAL = new UmbModalToken<
  SmartRedirectSuggesterModalData,
  SmartRedirectSuggesterModalValue
>("SmartRedirectSuggester.Modal.SuggestRedirect", {
  modal: {
    type: "dialog",
    size: "medium",
  },
});
