export const manifests: Array<UmbExtensionManifest> = [
  {
    type: "modal",
    alias: "SmartRedirectSuggester.Modal.SuggestRedirect",
    name: "#smartRedirectSuggester_manifest_modalName",
    element: () => import("./suggest-redirect-modal.element.js"),
  },
];
