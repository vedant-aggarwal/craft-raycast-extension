/**
 * Craft Daily Notes & Tasks API client — verified against live API 2026-04-06
 * Uses the SEPARATE "Daily Notes and Tasks" secret link ID.
 */

import { getPreferenceValues } from "@raycast/api";
import type {
  CraftPreferences,
  CraftBlock,
  CraftTask,
  NewBlock,
  ConnectionInfo,
  TaskScope,
  TaskState,
} from "./types";

// ─── Base URL ─────────────────────────────────────────────────────────────────

function resolveBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("http")) {
    if (/\/api\/v1\/?$/.test(trimmed)) return trimmed.replace(/\/$/, "");
    const idMatch = trimmed.match(/\/links\/([^/?#]+)/);
    if (idMatch) return `https://connect.craft.do/links/${idMatch[1]}/api/v1`;
    return `${trimmed.replace(/\/$/, "")}/api/v1`;
  }
  return `https://connect.craft.do/links/${trimmed}/api/v1`;
}

function getBaseUrl(): string {
  const prefs = getPreferenceValues<CraftPreferences>();
  return resolveBaseUrl(prefs.tasksSecretLinkId);
}

// ─── Core request helper ──────────────────────────────────────────────────────

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
    ...options,
  });

  const text = await response.text();

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Invalid API key. Open Preferences and paste your Daily Notes & Tasks Secret Link ID."
      );
    }
    let msg = text;
    try {
      const json = JSON.parse(text);
      msg = json.error ?? json.message ?? text;
    } catch {}
    throw new Error(`Craft Tasks API ${response.status}: ${msg}`);
  }

  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

async function requestMarkdown(path: string): Promise<string> {
  const url = `${getBaseUrl()}${path}`;
  const response = await fetch(url, {
    headers: { Accept: "text/markdown" },
  });

  const text = await response.text();

  if (!response.ok) {
    let msg = text;
    try {
      const json = JSON.parse(text);
      msg = json.error ?? json.message ?? text;
    } catch {}
    throw new Error(`Craft Tasks API ${response.status}: ${msg}`);
  }

  return text;
}

// ─── Connection ───────────────────────────────────────────────────────────────

export async function getConnectionInfo(): Promise<ConnectionInfo> {
  const result = await request<{ space: { id: string; timezone: string } }>(
    "/connection"
  );
  return { spaceId: result.space.id, timezone: result.space.timezone };
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function getTasks(scope: TaskScope): Promise<CraftTask[]> {
  const result = await request<{ items: CraftTask[] }>(`/tasks?scope=${scope}`);
  return result.items ?? [];
}

export interface CreateTaskParams {
  markdown: string;       // task text (without - [ ] prefix)
  scheduleDate?: string;  // YYYY-MM-DD
  deadlineDate?: string;  // YYYY-MM-DD  (NOT "dueDate")
  location?: "inbox" | "dailyNote";
  date?: string;          // YYYY-MM-DD or "today" — used when location is dailyNote
}

export async function createTask(params: CreateTaskParams): Promise<CraftTask> {
  const location =
    params.location === "dailyNote"
      ? { type: "dailyNote", date: params.date ?? "today" }
      : { type: "inbox" };

  const taskObj: Record<string, unknown> = {
    markdown: params.markdown,
    location,
    taskInfo: {
      state: "todo",
      ...(params.scheduleDate && { scheduleDate: params.scheduleDate }),
      ...(params.deadlineDate && { deadlineDate: params.deadlineDate }),
    },
  };

  const result = await request<{ items: CraftTask[] }>("/tasks", {
    method: "POST",
    body: JSON.stringify({ tasks: [taskObj] }),
  });

  const task = result.items?.[0];
  if (!task) throw new Error("Craft API returned no task after creation");
  return task;
}

export interface UpdateTaskParams {
  id: string;
  state?: TaskState;
  markdown?: string;
  scheduleDate?: string;
  deadlineDate?: string;
}

export async function updateTask(params: UpdateTaskParams): Promise<CraftTask> {
  const update: Record<string, unknown> = { id: params.id };
  if (params.markdown !== undefined) update.markdown = params.markdown;

  const taskInfo: Record<string, unknown> = {};
  if (params.state !== undefined) taskInfo.state = params.state;
  if (params.scheduleDate !== undefined) taskInfo.scheduleDate = params.scheduleDate;
  if (params.deadlineDate !== undefined) taskInfo.deadlineDate = params.deadlineDate;
  if (Object.keys(taskInfo).length) update.taskInfo = taskInfo;

  const result = await request<{ items: CraftTask[] }>("/tasks", {
    method: "PUT",
    body: JSON.stringify({ tasksToUpdate: [update] }),
  });

  return result.items?.[0] ?? ({ id: params.id } as CraftTask);
}

export async function deleteTasks(taskIds: string[]): Promise<void> {
  await request("/tasks", {
    method: "DELETE",
    body: JSON.stringify({ idsToDelete: taskIds }),
  });
}

// ─── Daily Note Blocks ────────────────────────────────────────────────────────

export type DailyNoteDate = "today" | "yesterday" | "tomorrow" | string;

export async function getDailyNoteMarkdown(date: DailyNoteDate): Promise<string> {
  return requestMarkdown(`/blocks?date=${date}`);
}

export interface AppendToDailyNoteParams {
  blocks: NewBlock[];
  date?: DailyNoteDate;
  placement?: "start" | "end";
}

export async function appendToDailyNote(params: AppendToDailyNoteParams): Promise<CraftBlock[]> {
  const result = await request<{ items: CraftBlock[] }>("/blocks", {
    method: "POST",
    body: JSON.stringify({
      blocks: params.blocks,
      position: {
        date: params.date ?? "today",
        position: params.placement ?? "end",
      },
    }),
  });
  return result.items ?? [];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

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

export function dateLabel(dateStr: string): string {
  const today = formatDate(new Date());
  const yesterday = formatDate(new Date(Date.now() - 86400000));
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return dateStr;
}

/** Strip markdown task checkbox prefix: "- [ ] foo" → "foo", "- [x] bar" → "bar" */
export function stripTaskPrefix(markdown: string): string {
  return markdown.replace(/^-\s*\[[x ]\]\s*/i, "").trim();
}
