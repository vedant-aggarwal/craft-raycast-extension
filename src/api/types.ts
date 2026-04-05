// ─── Shared API types (aligned with actual Craft API responses) ───────────────

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

export type TextStyle = "h1" | "h2" | "h3" | "h4" | "body" | "caption" | "card" | "page";
export type ListStyle = "none" | "bullet" | "numbered" | "task";

/** Block as returned by the API */
export interface CraftBlock {
  id: string;
  type: BlockType;
  markdown?: string;
  textStyle?: TextStyle;
  listStyle?: ListStyle | string;
  content?: CraftBlock[]; // child blocks
  metadata?: {
    lastModifiedAt?: string;
    createdAt?: string;
    lastModifiedBy?: string;
    createdBy?: string;
    comments?: unknown[];
  };
}

/** Block when inserting (no id yet) */
export interface NewBlock {
  type: BlockType;
  markdown?: string;
  textStyle?: TextStyle;
  listStyle?: ListStyle | string;
}

// ─── Position for block insertion ────────────────────────────────────────────

export interface DocsBlockPosition {
  pageId: string;
  position: "start" | "end";
}

export interface DailyNoteBlockPosition {
  date: "today" | "yesterday" | "tomorrow" | string; // YYYY-MM-DD
  position: "start" | "end";
}

// ─── Documents ────────────────────────────────────────────────────────────────

export interface CraftDocument {
  id: string;
  title?: string;
  location?: string;
  lastModifiedAt?: string;
  createdAt?: string;
  clickableLink?: string;
}

/** Returned by GET /documents/search */
export interface CraftDocumentSearchResult {
  documentId: string;
  title?: string;
  snippet?: string;
  matchCount?: number;
  metadata?: {
    lastModifiedAt?: string;
    createdAt?: string;
  };
}

// ─── Folders ─────────────────────────────────────────────────────────────────

export interface CraftFolder {
  id: string;
  name: string; // API uses "name", not "title"
  parentFolderId?: string;
  documentCount?: number;
  folders?: CraftFolder[]; // nested subfolders (API field name is "folders")
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export type TaskState = "todo" | "done" | "canceled";
export type TaskScope = "active" | "upcoming" | "inbox" | "logbook";

export interface TaskInfo {
  state: TaskState;
  scheduleDate?: string;   // YYYY-MM-DD
  deadlineDate?: string;   // YYYY-MM-DD (NOT "dueDate")
  completedAt?: string;
  canceledAt?: string;
}

/** Task as returned by the Daily Notes & Tasks API */
export interface CraftTask {
  id: string;
  markdown: string; // the task text
  listStyle?: string;
  taskInfo: TaskInfo;
}

// ─── Daily Notes ─────────────────────────────────────────────────────────────

/** Root block returned by GET /blocks?date=... */
export interface DailyNoteBlock {
  type: "page";
  id: string;
  title?: { value: string; attributes?: unknown[] };
  markdown?: string;
  content?: CraftBlock[];
}

// ─── Connection info ──────────────────────────────────────────────────────────

export interface ConnectionInfo {
  spaceId: string;
  timezone?: string;
  urlTemplates?: Record<string, string>;
}
