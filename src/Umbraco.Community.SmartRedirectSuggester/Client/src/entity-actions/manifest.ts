import {
  UMB_DOCUMENT_ENTITY_TYPE,
  UMB_DOCUMENT_COLLECTION_ALIAS,
  UMB_DOCUMENT_ITEM_REPOSITORY_ALIAS,
  UMB_USER_PERMISSION_DOCUMENT_DELETE,
} from "@umbraco-cms/backoffice/document";
import {
  UMB_DOCUMENT_RECYCLE_BIN_REPOSITORY_ALIAS,
} from "@umbraco-cms/backoffice/document";
import { UMB_DOCUMENT_REFERENCE_REPOSITORY_ALIAS } from "@umbraco-cms/backoffice/document";
import { UMB_COLLECTION_ALIAS_CONDITION } from "@umbraco-cms/backoffice/collection";
import { UMB_ENTITY_IS_NOT_TRASHED_CONDITION_ALIAS } from "@umbraco-cms/backoffice/recycle-bin";

/**
 * Registers a Smart Trash entity action that REPLACES the default Umbraco document trash action.
 *
 * The `overwrites` array points at the original alias used in the core backoffice package:
 *   `Umb.EntityAction.Document.RecycleBin.Trash`
 * which makes the extension registry suppress that one and use ours instead.
 *
 * The `meta` block must mirror the original so the inherited `UmbTrashEntityAction.execute()` finds
 * the same document item/recycle-bin repositories — we import the constants from the core packages
 * to stay in lockstep with Umbraco renames.
 */
export const manifests: Array<UmbExtensionManifest> = [
  {
    type: "entityAction",
    kind: "trashWithRelation",
    alias: "SmartRedirectSuggester.EntityAction.Document.SmartTrash",
    name: "#smartRedirectSuggester_manifest_entityActionName",
    overwrites: ["Umb.EntityAction.Document.RecycleBin.Trash"],
    api: () => import("./smart-trash.action.js"),
    forEntityTypes: [UMB_DOCUMENT_ENTITY_TYPE],
    meta: {
      itemRepositoryAlias: UMB_DOCUMENT_ITEM_REPOSITORY_ALIAS,
      recycleBinRepositoryAlias: UMB_DOCUMENT_RECYCLE_BIN_REPOSITORY_ALIAS,
      referenceRepositoryAlias: UMB_DOCUMENT_REFERENCE_REPOSITORY_ALIAS,
    },
    conditions: [
      {
        alias: "Umb.Condition.UserPermission.Document",
        // Use the same delete permission the default action requires — we only replace UX, not authorisation.
        allOf: [UMB_USER_PERMISSION_DOCUMENT_DELETE],
      },
      {
        alias: UMB_ENTITY_IS_NOT_TRASHED_CONDITION_ALIAS,
      },
    ],
  },
  {
    type: "entityBulkAction",
    kind: "trashWithRelation",
    alias: "SmartRedirectSuggester.EntityBulkAction.Document.SmartTrash",
    name: "#smartRedirectSuggester_manifest_entityBulkActionName",
    overwrites: ["Umb.EntityBulkAction.Document.Trash"],
    api: () => import("./smart-bulk-trash.action.js"),
    weight: 10,
    forEntityTypes: [UMB_DOCUMENT_ENTITY_TYPE],
    meta: {
      itemRepositoryAlias: UMB_DOCUMENT_ITEM_REPOSITORY_ALIAS,
      recycleBinRepositoryAlias: UMB_DOCUMENT_RECYCLE_BIN_REPOSITORY_ALIAS,
      referenceRepositoryAlias: UMB_DOCUMENT_REFERENCE_REPOSITORY_ALIAS,
    },
    conditions: [
      {
        alias: UMB_COLLECTION_ALIAS_CONDITION,
        match: UMB_DOCUMENT_COLLECTION_ALIAS,
      },
      {
        alias: "Umb.Condition.UserPermission.Document",
        allOf: [UMB_USER_PERMISSION_DOCUMENT_DELETE],
      },
      {
        alias: UMB_ENTITY_IS_NOT_TRASHED_CONDITION_ALIAS,
      },
    ],
  },
];
