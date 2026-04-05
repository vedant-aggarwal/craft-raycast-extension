/**
 * Craft Daily Notes & Tasks API client
 * Base URL: https://connect.craft.do/links/{secretLinkId}/api/v1
 * This uses the SEPARATE "Daily Notes and Tasks" secret link ID.
 */

import { getPreferenceValues } from "@raycast/api";
import type {
  CraftPreferences,
  CraftBlock,
  CraftTask,
  NewBlock,
  DailyNoteBlockPosition,
  ConnectionInfo,
  DailyNoteSearchResult,
  TaskScope,
  TaskState,
} from "./types";

// ─── Base URL ─────────────────────────────────────────────────────────────────

/**
 * Accepts either:
 *   - A full API URL like "https://connect.craft.do/links/ABC123/api/v1"
 *   - A full connection URL like "https://connect.craft.do/links/ABC123"
 *   - Just the secret link ID like "ABC123"
 *
 * Returns the clean base URL ending with /api/v1.
 */
function resolveBaseUrl(raw: string): string {
  const trimmed = raw.trim();

  if (trimmed.startsWith("http")) {
    if (/\/api\/v1\/?$/.test(trimmed)) {
      return trimmed.replace(/\/$/, "");
    }
    const idMatch = trimmed.match(/\/links\/([^/?#]+)/);
    if (idMatch) {
      return `https://connect.craft.do/links/${idMatch[1]}/api/v1`;
    }
    return `${trimmed.replace(/\/$/, "")}/api/v1`;
  }

  return `https://connect.craft.do/links/${trimmed}/api/v1`;
}

function getBaseUrl(): string {
  const prefs = getPreferenceValues<CraftPreferences>();
  return resolveBaseUrl(prefs.tasksSecretLinkId);
}

// ─── Core request helper ──────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  accept: "json" | "markdown" = "json"
): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Accept: accept === "markdown" ? "text/markdown" : "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Invalid API key. Open Preferences and paste only the Secret Link ID (the alphanumeric string from your Craft API URL, not the full URL)."
      );
    }
    if (response.status === 404 && body.includes("DOCTYPE")) {
      throw new Error(
        "API endpoint not found (404). Check that your Daily Notes & Tasks Secret Link ID is correct — paste only the ID, not the full URL."
      );
    }
    throw new Error(`Craft Tasks API ${response.status}: ${body || response.statusText}`);
  }

  if (accept === "markdown") {
    return (await response.text()) as unknown as T;
  }

  const text = await response.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

// ─── Connection ───────────────────────────────────────────────────────────────

export async function getConnectionInfo(): Promise<ConnectionInfo> {
  return request<ConnectionInfo>("/connection");
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export interface GetTasksParams {
  scope: TaskScope;
}

export async function getTasks(params: GetTasksParams): Promise<CraftTask[]> {
  const result = await request<{ tasks: CraftTask[] }>(`/tasks?scope=${params.scope}`);
  return result.tasks ?? [];
}

export interface CreateTaskParams {
  title: string;
  scheduleDate?: string; // YYYY-MM-DD or "today"
  dueDate?: string; // YYYY-MM-DD
}

export async function createTask(params: CreateTaskParams): Promise<CraftTask> {
  const task: Record<string, unknown> = { title: params.title };
  if (params.scheduleDate) task.scheduleDate = params.scheduleDate;
  if (params.dueDate) task.dueDate = params.dueDate;

  // API expects: { tasks: [ { title, scheduleDate?, dueDate? } ] }
  const result = await request<{ tasks?: CraftTask[]; task?: CraftTask }>("/tasks", {
    method: "POST",
    body: JSON.stringify({ tasks: [task] }),
  });
  return result.tasks?.[0] ?? result.task!;
}

export interface UpdateTaskParams {
  taskIds: string[];
  state?: TaskState;
  title?: string;
  scheduleDate?: string;
  dueDate?: string;
}

export async function updateTasks(params: UpdateTaskParams): Promise<CraftTask[]> {
  // Build per-task update objects matching the shape the API accepts
  const tasks = params.taskIds.map((id) => {
    const t: Record<string, unknown> = { id };
    if (params.state !== undefined) t.state = params.state;
    if (params.title !== undefined) t.title = params.title;
    if (params.scheduleDate !== undefined) t.scheduleDate = params.scheduleDate;
    if (params.dueDate !== undefined) t.dueDate = params.dueDate;
    return t;
  });

  const result = await request<{ tasks: CraftTask[] }>("/tasks", {
    method: "PUT",
    body: JSON.stringify({ tasks }),
  });
  return result.tasks ?? [];
}

export async function deleteTasks(taskIds: string[]): Promise<void> {
  await request("/tasks", {
    method: "DELETE",
    body: JSON.stringify({ tasks: taskIds.map((id) => ({ id })) }),
  });
}

// ─── Daily Note Blocks ────────────────────────────────────────────────────────

export type DailyNoteDate = "today" | "yesterday" | "tomorrow" | string; // YYYY-MM-DD

export interface GetDailyNoteBlocksParams {
  date: DailyNoteDate;
  maxDepth?: number;
  fetchMetadata?: boolean;
}

export async function getDailyNoteBlocks(params: GetDailyNoteBlocksParams): Promise<CraftBlock[]> {
  const query = new URLSearchParams({ date: params.date });
  if (params.maxDepth !== undefined) query.set("maxDepth", String(params.maxDepth));
  if (params.fetchMetadata) query.set("fetchMetadata", "true");
  const result = await request<{ blocks: CraftBlock[] }>(`/blocks?${query.toString()}`);
  return result.blocks ?? [];
}

export async function getDailyNoteMarkdown(date: DailyNoteDate): Promise<string> {
  const query = new URLSearchParams({ date });
  return request<string>(`/blocks?${query.toString()}`, {}, "markdown");
}

export interface AppendToDailyNoteParams {
  blocks: NewBlock[];
  date?: DailyNoteDate;
  placement?: "start" | "end";
}

export async function appendToDailyNote(params: AppendToDailyNoteParams): Promise<CraftBlock[]> {
  const position: DailyNoteBlockPosition = {
    date: params.date ?? "today",
    placement: params.placement ?? "end",
  };

  const result = await request<{ blocks: CraftBlock[] }>("/blocks", {
    method: "POST",
    body: JSON.stringify({
      blocks: params.blocks,
      position,
    }),
  });
  return result.blocks ?? [];
}

// ─── Daily Note Search ────────────────────────────────────────────────────────

export interface SearchDailyNotesParams {
  include?: string;
  regexps?: string[];
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  fetchMetadata?: boolean;
}

export async function searchDailyNotes(
  params: SearchDailyNotesParams
): Promise<DailyNoteSearchResult[]> {
  const query = new URLSearchParams();
  if (params.include) query.set("include", params.include);
  if (params.startDate) query.set("startDate", params.startDate);
  if (params.endDate) query.set("endDate", params.endDate);
  if (params.fetchMetadata) query.set("fetchMetadata", "true");
  if (params.regexps?.length) {
    params.regexps.forEach((r) => query.append("regexps", r));
  }

  const result = await request<{ results: DailyNoteSearchResult[] }>(
    `/daily-notes/search?${query.toString()}`
  );
  return result.results ?? [];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formats a date as YYYY-MM-DD for the API.
 */
export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Returns the last N daily note dates (including today).
 */
export function recentDates(count = 7): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(formatDate(d));
  }
  return dates;
}

/**
 * Labels for common date values.
 */
export function dateLabel(dateStr: string): string {
  const today = formatDate(new Date());
  const yesterday = formatDate(new Date(Date.now() - 86400000));
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return dateStr;
}

/**
 * Converts a CraftBlock tree into plain markdown text.
 */
export function blocksToMarkdown(blocks: CraftBlock[]): string {
  return blocks.map((b) => blockToMarkdown(b, 0)).join("\n");
}

function blockToMarkdown(block: CraftBlock, depth: number): string {
  const indent = "  ".repeat(depth);
  const listStyle = block.listStyle?.type;

  let line = "";
  if (listStyle === "bullet") {
    line = `${indent}- ${block.content ?? ""}`;
  } else if (listStyle === "numbered") {
    line = `${indent}1. ${block.content ?? ""}`;
  } else if (listStyle === "todo") {
    const checked = block.listStyle?.state === "checked";
    line = `${indent}- [${checked ? "x" : " "}] ${block.content ?? ""}`;
  } else {
    line = `${indent}${block.content ?? ""}`;
  }

  const childLines = (block.children ?? []).map((c) => blockToMarkdown(c, depth + 1)).join("\n");
  return childLines ? `${line}\n${childLines}` : line;
}
