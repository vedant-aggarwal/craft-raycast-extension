/**
 * Craft Documents API client — verified against live API 2026-04-06
 * Base URL: https://connect.craft.do/links/{secretLinkId}/api/v1
 * Auth: secret link ID in URL path (no headers needed)
 */

import { getPreferenceValues } from "@raycast/api";
import type {
  CraftPreferences,
  CraftDocument,
  CraftFolder,
  CraftBlock,
  NewBlock,
  DocsBlockPosition,
  ConnectionInfo,
  CraftDocumentSearchResult,
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
  return resolveBaseUrl(prefs.docsSecretLinkId);
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
      throw new Error("Invalid API key. Open Preferences and paste your Documents Secret Link ID.");
    }
    let msg = text;
    try {
      const json = JSON.parse(text);
      msg = json.error ?? json.message ?? text;
    } catch {}
    throw new Error(`Craft API ${response.status}: ${msg}`);
  }

  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

async function requestMarkdown(path: string): Promise<string> {
  const url = `${getBaseUrl()}${path}`;
  const response = await fetch(url, {
    headers: {
      Accept: "text/markdown",
    },
  });

  const text = await response.text();

  if (!response.ok) {
    let msg = text;
    try {
      const json = JSON.parse(text);
      msg = json.error ?? json.message ?? text;
    } catch {}
    throw new Error(`Craft API ${response.status}: ${msg}`);
  }

  return text;
}

// ─── Connection ───────────────────────────────────────────────────────────────

export async function getConnectionInfo(): Promise<ConnectionInfo> {
  const result = await request<{ space: { id: string; name: string; timezone: string }; urlTemplates?: Record<string, string> }>(
    "/connection"
  );
  return {
    spaceId: result.space.id,
    timezone: result.space.timezone,
    urlTemplates: result.urlTemplates,
  };
}

// Build a deep link from the URL template
export function buildDeepLink(spaceId: string, blockId: string): string {
  return `craftdocs://open?spaceId=${encodeURIComponent(spaceId)}&blockId=${encodeURIComponent(blockId)}`;
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function listDocuments(): Promise<CraftDocument[]> {
  const result = await request<{ items: CraftDocument[] }>("/documents");
  return result.items ?? [];
}

export interface CreateDocumentParams {
  title: string;
  folderId?: string; // if omitted, goes to Unsorted
}

export async function createDocument(params: CreateDocumentParams): Promise<CraftDocument> {
  const destination = params.folderId
    ? { folderId: params.folderId }
    : { destination: "unsorted" };

  const result = await request<{ items: CraftDocument[] }>("/documents", {
    method: "POST",
    body: JSON.stringify({
      documents: [{ title: params.title }],
      destination,
    }),
  });

  const doc = result.items?.[0];
  if (!doc) throw new Error("Craft API returned no document after creation");
  return doc;
}

export async function deleteDocument(documentId: string): Promise<void> {
  await request("/documents", {
    method: "DELETE",
    body: JSON.stringify({ documentIds: [documentId] }),
  });
}

export interface SearchDocumentsParams {
  include: string;
  folderId?: string;
}

export async function searchDocuments(
  params: SearchDocumentsParams
): Promise<CraftDocumentSearchResult[]> {
  const query = new URLSearchParams({ include: params.include });
  if (params.folderId) query.set("folderIds", params.folderId);
  const result = await request<{ items: CraftDocumentSearchResult[] }>(
    `/documents/search?${query.toString()}`
  );
  return result.items ?? [];
}

// ─── Folders ─────────────────────────────────────────────────────────────────

const SYSTEM_FOLDER_IDS = new Set(["unsorted", "daily_notes", "trash", "templates"]);

export async function listFolders(): Promise<CraftFolder[]> {
  const result = await request<{ items: CraftFolder[] }>("/folders");
  // Flatten nested folders, exclude system ones
  return flattenFolders(result.items ?? []).filter((f) => !SYSTEM_FOLDER_IDS.has(f.id));
}

function flattenFolders(folders: CraftFolder[], prefix = ""): CraftFolder[] {
  const out: CraftFolder[] = [];
  for (const f of folders) {
    const displayName = prefix ? `${prefix} / ${f.name}` : f.name;
    out.push({ ...f, name: displayName });
    if (f.folders?.length) {
      out.push(...flattenFolders(f.folders, displayName));
    }
  }
  return out;
}

// ─── Blocks ───────────────────────────────────────────────────────────────────

export async function getBlocksAsMarkdown(documentId: string): Promise<string> {
  return requestMarkdown(`/blocks?id=${documentId}`);
}

export interface InsertBlocksParams {
  blocks: NewBlock[];
  position: DocsBlockPosition;
}

export async function insertBlocks(params: InsertBlocksParams): Promise<CraftBlock[]> {
  const result = await request<{ items: CraftBlock[] }>("/blocks", {
    method: "POST",
    body: JSON.stringify({
      blocks: params.blocks,
      position: {
        pageId: params.position.pageId,
        position: params.position.position,
      },
    }),
  });
  return result.items ?? [];
}

export async function deleteBlocks(blockIds: string[]): Promise<void> {
  await request("/blocks", {
    method: "DELETE",
    body: JSON.stringify({ blockIds }),
  });
}
