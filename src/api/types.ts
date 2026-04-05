// ─── Shared API types ─────────────────────────────────────────────────────────

export interface CraftPreferences {
  docsSecretLinkId: string;
  tasksSecretLinkId: string;
}

// ─── Block types ──────────────────────────────────────────────────────────────

export type BlockType =
  | "text"
  | "page"
  | "image"
  | "video"
  | "file"
  | "drawing"
  | "table"
  | "collection"
  | "code"
  | "richUrl"
  | "line"
  | "collectionItem";

export type TaskState = "open" | "done" | "canceled";
export type TaskScope = "active" | "upcoming" | "inbox" | "logbook";
export type BlockPlacement = "start" | "end" | "before" | "after";

export interface BlockListStyle {
  type: "none" | "bullet" | "numbered" | "todo" | "toggle";
  state?: "checked" | "unchecked";
}

export interface CraftBlock {
  id: string;
  type: BlockType;
  content?: string;
  listStyle?: BlockListStyle;
  children?: CraftBlock[];
  createdAt?: string;
  modifiedAt?: string;
  authorIds?: string[];
}

// Used when inserting new blocks (id is not required yet)
export interface NewBlock {
  type: BlockType;
  content?: string;
  listStyle?: BlockListStyle;
  children?: NewBlock[];
}

// ─── Position for block insertion ────────────────────────────────────────────

export interface DocsBlockPosition {
  pageId: string; // root block ID of the target document
  placement: BlockPlacement;
  siblingId?: string;
}

export interface DailyNoteBlockPosition {
  date: "today" | "yesterday" | "tomorrow" | string; // YYYY-MM-DD
  placement: BlockPlacement;
  siblingId?: string;
}

// ─── Documents ────────────────────────────────────────────────────────────────

export interface CraftDocumentMeta {
  createdAt?: string;
  modifiedAt?: string;
  authorIds?: string[];
  version?: number;
}

export interface CraftDocument {
  id: string;
  title?: string;
  meta?: CraftDocumentMeta;
}

// ─── Folders ─────────────────────────────────────────────────────────────────

export interface CraftFolder {
  id: string;
  title: string;
  parentId?: string;
  documentCount?: number;
  subfolderCount?: number;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export interface CraftTask {
  id: string;
  title: string;
  state: TaskState;
  scheduleDate?: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
  location?: string;
}

// ─── Daily Notes ─────────────────────────────────────────────────────────────

export interface DailyNoteSearchResult {
  date: string; // YYYY-MM-DD
  blocks: CraftBlock[];
  meta?: CraftDocumentMeta;
}

// ─── Collections ─────────────────────────────────────────────────────────────

export interface CraftCollection {
  id: string;
  title?: string;
  documentId: string;
}

export interface CollectionItem {
  id: string;
  properties?: Record<string, unknown>;
  content?: CraftBlock[];
}

// ─── Connection info ──────────────────────────────────────────────────────────

export interface ConnectionInfo {
  spaceId: string;
  timezone?: string;
  urlTemplates?: {
    document?: string;
    block?: string;
    dailyNote?: string;
  };
}

// ─── API response wrappers ────────────────────────────────────────────────────

export interface ApiError {
  status: number;
  message: string;
}
