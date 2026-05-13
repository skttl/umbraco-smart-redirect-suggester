export const manifests: Array<UmbExtensionManifest> = [
  {
    type: "modal",
    alias: "SmartRedirectSuggester.Modal.SuggestRedirect",
    name: "Smart Redirect Suggester - Suggest Redirect Modal",
    element: () => import("./suggest-redirect-modal.element.js"),
  },
];
