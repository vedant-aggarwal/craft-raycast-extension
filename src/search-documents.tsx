import {
  Action,
  ActionPanel,
  Color,
  Icon,
  List,
  showToast,
  Toast,
  openExtensionPreferences,
} from "@raycast/api";
import { useEffect, useState, useCallback, useRef } from "react";
import { searchDocuments, listFolders, getConnectionInfo, buildDocumentDeepLink } from "./api/craft-docs";
import type { CraftDocument, CraftFolder } from "./api/types";

function formatDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SearchDocuments() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CraftDocument[]>([]);
  const [folders, setFolders] = useState<CraftFolder[]>([]);
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [spaceId, setSpaceId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load folders and space ID once on mount
  useEffect(() => {
    listFolders()
      .then(setFolders)
      .catch(() => {});
    getConnectionInfo()
      .then((info) => setSpaceId(info.spaceId))
      .catch(() => {});
  }, []);

  const runSearch = useCallback(
    async (q: string, folder: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const docs = await searchDocuments({
          include: q.trim(),
          fetchMetadata: true,
        });

        const filtered =
          folder === "all"
            ? docs
            : docs.filter((d) => (d as unknown as { folderId?: string }).folderId === folder);

        setResults(filtered);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        showToast({ style: Toast.Style.Failure, title: "Search failed", message });
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query, folderFilter), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, folderFilter, runSearch]);

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={setQuery}
      searchBarPlaceholder="Search Craft documents…"
      throttle
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter by Folder"
          value={folderFilter}
          onChange={setFolderFilter}
        >
          <List.Dropdown.Item value="all" title="All Folders" />
          {folders.map((f) => (
            <List.Dropdown.Item key={f.id} value={f.id} title={f.title} />
          ))}
        </List.Dropdown>
      }
    >
      {results.length === 0 && !isLoading && query.trim() && (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="No documents found"
          description={`No results for "${query}"`}
        />
      )}
      {results.length === 0 && !isLoading && !query.trim() && (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="Search Craft Documents"
          description="Type to search across your entire Craft space"
        />
      )}
      {results.map((doc) => {
        const modifiedAt = (doc as unknown as { meta?: { modifiedAt?: string } }).meta?.modifiedAt;
        const createdAt = (doc as unknown as { meta?: { createdAt?: string } }).meta?.createdAt;
        const dateStr = formatDate(modifiedAt ?? createdAt);

        return (
          <List.Item
            key={doc.id}
            icon={Icon.Document}
            title={doc.title ?? "(Untitled)"}
            accessories={
              dateStr ? [{ text: dateStr, tooltip: "Last modified" }] : []
            }
            actions={
              <ActionPanel>
                {spaceId && (
                  <Action.OpenInBrowser
                    title="Open in Craft"
                    url={buildDocumentDeepLink(spaceId, doc.id)}
                    shortcut={{ modifiers: ["cmd"], key: "o" }}
                  />
                )}
                <Action.CopyToClipboard
                  title="Copy Document ID"
                  content={doc.id}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                />
                <Action.CopyToClipboard
                  title="Copy Title"
                  content={doc.title ?? ""}
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
