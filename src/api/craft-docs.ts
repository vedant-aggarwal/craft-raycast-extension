/**
 * Craft Documents API client
 * Base URL: https://connect.craft.do/links/{secretLinkId}/api/v1
 * Auth: secret link ID embedded in URL path (no additional headers needed)
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

  // Already a full URL — return as-is (strip trailing slash, ensure /api/v1)
  if (trimmed.startsWith("http")) {
    // If it already ends with /api/v1 (or /api/v1/), use directly
    if (/\/api\/v1\/?$/.test(trimmed)) {
      return trimmed.replace(/\/$/, "");
    }
    // Full URL without /api/v1 — extract the ID and rebuild
    const idMatch = trimmed.match(/\/links\/([^/?#]+)/);
    if (idMatch) {
      return `https://connect.craft.do/links/${idMatch[1]}/api/v1`;
    }
    // Fallback: append /api/v1
    return `${trimmed.replace(/\/$/, "")}/api/v1`;
  }

  // Plain secret link ID
  return `https://connect.craft.do/links/${trimmed}/api/v1`;
}

function getBaseUrl(): string {
  const prefs = getPreferenceValues<CraftPreferences>();
  return resolveBaseUrl(prefs.docsSecretLinkId);
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
    // Provide a more actionable error for auth failures
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Invalid API key. Open Preferences and paste only the Secret Link ID (the alphanumeric string from your Craft API URL, not the full URL)."
      );
    }
    if (response.status === 404 && body.includes("DOCTYPE")) {
      throw new Error(
        "API endpoint not found (404). Check that your Secret Link ID is correct — paste only the ID from the URL, not the full URL."
      );
    }
    throw new Error(`Craft API ${response.status}: ${body || response.statusText}`);
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

// ─── Documents ────────────────────────────────────────────────────────────────

export interface ListDocumentsParams {
  fetchMetadata?: boolean;
}

export async function listDocuments(params: ListDocumentsParams = {}): Promise<CraftDocument[]> {
  const query = new URLSearchParams();
  if (params.fetchMetadata) query.set("fetchMetadata", "true");
  const qs = query.toString() ? `?${query.toString()}` : "";
  const result = await request<{ documents: CraftDocument[] }>(`/documents${qs}`);
  return result.documents ?? [];
}

export interface SearchDocumentsParams {
  include: string;
  regexps?: string[];
  documentIds?: string[];
  documentFilterMode?: "include" | "exclude";
  fetchMetadata?: boolean;
}

export async function searchDocuments(params: SearchDocumentsParams): Promise<CraftDocument[]> {
  const query = new URLSearchParams({ include: params.include });
  if (params.fetchMetadata) query.set("fetchMetadata", "true");
  if (params.documentFilterMode) query.set("documentFilterMode", params.documentFilterMode);
  if (params.documentIds?.length) query.set("documentIds", params.documentIds.join(","));
  if (params.regexps?.length) {
    params.regexps.forEach((r) => query.append("regexps", r));
  }
  const result = await request<{ documents: CraftDocument[] }>(
    `/documents/search?${query.toString()}`
  );
  return result.documents ?? [];
}

export interface CreateDocumentParams {
  title: string;
  destination?: {
    type: "unsorted" | "folder" | "templates";
    folderId?: string;
  };
}

export async function createDocument(params: CreateDocumentParams): Promise<CraftDocument> {
  const body: Record<string, unknown> = { title: params.title };
  if (params.destination) body.destination = params.destination;

  const result = await request<{ document: CraftDocument }>("/documents", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return result.document;
}

export async function deleteDocument(documentId: string): Promise<void> {
  await request("/documents", {
    method: "DELETE",
    body: JSON.stringify({ documentIds: [documentId] }),
  });
}

// ─── Folders ─────────────────────────────────────────────────────────────────

export async function listFolders(): Promise<CraftFolder[]> {
  const result = await request<{ folders: CraftFolder[] }>("/folders");
  return result.folders ?? [];
}

export interface CreateFolderParams {
  title: string;
  parentFolderId?: string;
}

export async function createFolder(params: CreateFolderParams): Promise<CraftFolder> {
  const result = await request<{ folder: CraftFolder }>("/folders", {
    method: "POST",
    body: JSON.stringify(params),
  });
  return result.folder;
}

// ─── Blocks ───────────────────────────────────────────────────────────────────

export interface GetBlocksParams {
  id: string; // document root block ID
  maxDepth?: number;
  fetchMetadata?: boolean;
}

export async function getBlocks(params: GetBlocksParams): Promise<CraftBlock> {
  const query = new URLSearchParams({ id: params.id });
  if (params.maxDepth !== undefined) query.set("maxDepth", String(params.maxDepth));
  if (params.fetchMetadata) query.set("fetchMetadata", "true");
  const result = await request<{ block: CraftBlock }>(`/blocks?${query.toString()}`);
  return result.block;
}

export async function getBlocksAsMarkdown(documentId: string): Promise<string> {
  const query = new URLSearchParams({ id: documentId });
  return request<string>(`/blocks?${query.toString()}`, {}, "markdown");
}

export interface InsertBlocksParams {
  blocks: NewBlock[];
  position: DocsBlockPosition;
}

export async function insertBlocks(params: InsertBlocksParams): Promise<CraftBlock[]> {
  const result = await request<{ blocks: CraftBlock[] }>("/blocks", {
    method: "POST",
    body: JSON.stringify({
      blocks: params.blocks,
      position: params.position,
    }),
  });
  return result.blocks ?? [];
}

export async function deleteBlocks(blockIds: string[]): Promise<void> {
  await request("/blocks", {
    method: "DELETE",
    body: JSON.stringify({ blockIds }),
  });
}

export interface SearchBlocksParams {
  documentId: string;
  pattern: string;
  caseSensitive?: boolean;
  beforeBlockCount?: number;
  afterBlockCount?: number;
}

export async function searchBlocks(params: SearchBlocksParams): Promise<CraftBlock[]> {
  const query = new URLSearchParams({
    documentId: params.documentId,
    pattern: params.pattern,
  });
  if (params.caseSensitive) query.set("caseSensitive", "true");
  if (params.beforeBlockCount !== undefined)
    query.set("beforeBlockCount", String(params.beforeBlockCount));
  if (params.afterBlockCount !== undefined)
    query.set("afterBlockCount", String(params.afterBlockCount));

  const result = await request<{ matches: Array<{ block: CraftBlock; context: CraftBlock[] }> }>(
    `/blocks/search?${query.toString()}`
  );
  return result.matches?.map((m) => m.block) ?? [];
}

// ─── Deep link builder ────────────────────────────────────────────────────────

export function buildDocumentDeepLink(spaceId: string, documentId: string): string {
  return `craftdocs://open?spaceId=${encodeURIComponent(spaceId)}&id=${encodeURIComponent(documentId)}`;
}
