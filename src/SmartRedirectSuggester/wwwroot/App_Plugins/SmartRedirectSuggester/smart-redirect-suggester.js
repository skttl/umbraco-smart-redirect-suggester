import { UMB_USER_PERMISSION_DOCUMENT_DELETE as t, UMB_DOCUMENT_REFERENCE_REPOSITORY_ALIAS as e, UMB_DOCUMENT_RECYCLE_BIN_REPOSITORY_ALIAS as i, UMB_DOCUMENT_ITEM_REPOSITORY_ALIAS as o, UMB_DOCUMENT_ENTITY_TYPE as r, UMB_DOCUMENT_COLLECTION_ALIAS as n } from "@umbraco-cms/backoffice/document";
import { UMB_COLLECTION_ALIAS_CONDITION as s } from "@umbraco-cms/backoffice/collection";
import { UMB_ENTITY_IS_NOT_TRASHED_CONDITION_ALIAS as a } from "@umbraco-cms/backoffice/recycle-bin";
const m = [
  {
    type: "modal",
    alias: "SmartRedirectSuggester.Modal.SuggestRedirect",
    name: "Smart Redirect Suggester - Suggest Redirect Modal",
    element: () => import("./suggest-redirect-modal.element-42J2d6UR.js")
  }
], c = [
  {
    type: "entityAction",
    kind: "trashWithRelation",
    alias: "SmartRedirectSuggester.EntityAction.Document.SmartTrash",
    name: "Smart Trash Document Entity Action",
    overwrites: ["Umb.EntityAction.Document.RecycleBin.Trash"],
    api: () => import("./smart-trash.action-ByxoCX_1.js"),
    forEntityTypes: [r],
    meta: {
      itemRepositoryAlias: o,
      recycleBinRepositoryAlias: i,
      referenceRepositoryAlias: e
    },
    conditions: [
      {
        alias: "Umb.Condition.UserPermission.Document",
        // Use the same delete permission the default action requires — we only replace UX, not authorisation.
        allOf: [t]
      },
      {
        alias: a
      }
    ]
  },
  {
    type: "entityBulkAction",
    kind: "trashWithRelation",
    alias: "SmartRedirectSuggester.EntityBulkAction.Document.SmartTrash",
    name: "Smart Trash Document Entity Bulk Action",
    overwrites: ["Umb.EntityBulkAction.Document.Trash"],
    api: () => import("./smart-bulk-trash.action-B56UEM0v.js"),
    weight: 10,
    forEntityTypes: [r],
    meta: {
      itemRepositoryAlias: o,
      recycleBinRepositoryAlias: i,
      referenceRepositoryAlias: e
    },
    conditions: [
      {
        alias: s,
        match: n
      },
      {
        alias: "Umb.Condition.UserPermission.Document",
        allOf: [t]
      },
      {
        alias: a
      }
    ]
  }
], T = [
  ...m,
  ...c
];
export {
  T as manifests
};
//# sourceMappingURL=smart-redirect-suggester.js.map
