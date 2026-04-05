import {
  Action,
  ActionPanel,
  Icon,
  List,
  showToast,
  Toast,
  openExtensionPreferences,
} from "@raycast/api";
import { useEffect, useState, useCallback, useRef } from "react";
import { searchDocuments, listFolders, getConnectionInfo, buildDeepLink } from "./api/craft-docs";
import type { CraftDocumentSearchResult, CraftFolder } from "./api/types";

function formatDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function cleanMarkdown(md: string): string {
  return md.replace(/\*\*/g, "").replace(/\*/g, "").replace(/\n/g, " ").trim();
}

export default function SearchDocuments() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CraftDocumentSearchResult[]>([]);
  const [folders, setFolders] = useState<CraftFolder[]>([]);
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [spaceId, setSpaceId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listFolders().then(setFolders).catch(() => {});
    getConnectionInfo().then((info) => setSpaceId(info.spaceId)).catch(() => {});
  }, []);

  const runSearch = useCallback(async (q: string, folder: string) => {
    if (!q.trim()) { setResults([]); return; }
    setIsLoading(true);
    try {
      const items = await searchDocuments({
        include: q.trim(),
        folderId: folder !== "all" ? folder : undefined,
      });
      setResults(items);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showToast({ style: Toast.Style.Failure, title: "Search failed", message });
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query, folderFilter), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, folderFilter, runSearch]);

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={setQuery}
      searchBarPlaceholder="Search Craft documents…"
      throttle
      searchBarAccessory={
        <List.Dropdown tooltip="Filter by Folder" value={folderFilter} onChange={setFolderFilter}>
          <List.Dropdown.Item value="all" title="All Folders" />
          {folders.map((f) => (
            <List.Dropdown.Item key={f.id} value={f.id} title={f.name} />
          ))}
        </List.Dropdown>
      }
    >
      {results.length === 0 && !isLoading && query.trim() && (
        <List.EmptyView icon={Icon.MagnifyingGlass} title="No results" description={`Nothing found for "${query}"`} />
      )}
      {results.length === 0 && !isLoading && !query.trim() && (
        <List.EmptyView icon={Icon.MagnifyingGlass} title="Search Craft" description="Type to search across your entire Craft space" />
      )}
      {results.map((result, idx) => {
        const snippet = cleanMarkdown(result.markdown ?? "");
        const dateStr = formatDate(result.lastModifiedAt ?? result.createdAt);
        const deepLink = spaceId ? buildDeepLink(spaceId, result.documentId) : null;

        return (
          <List.Item
            key={result.documentId ?? idx}
            icon={Icon.Document}
            title={snippet || result.documentId}
            accessories={dateStr ? [{ text: dateStr, tooltip: "Last modified" }] : []}
            actions={
              <ActionPanel>
                {deepLink && (
                  <Action.OpenInBrowser
                    title="Open in Craft"
                    url={deepLink}
                    shortcut={{ modifiers: ["cmd"], key: "o" }}
                  />
                )}
                <Action.CopyToClipboard
                  title="Copy Document ID"
                  content={result.documentId}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                />
                <Action.CopyToClipboard
                  title="Copy Snippet"
                  content={snippet}
                  shortcut={{ modifiers: ["cmd"], key: "c" }}
                />
                <Action title="Open Preferences" onAction={openExtensionPreferences} />
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}
