import {
  Action,
  ActionPanel,
  Detail,
  List,
  showToast,
  Toast,
  openExtensionPreferences,
} from "@raycast/api";
import { useEffect, useState } from "react";
import {
  getDailyNoteMarkdown,
  recentDates,
  dateLabel,
  formatDate,
} from "./api/craft-tasks";
import { getConnectionInfo } from "./api/craft-docs";

interface DailyNoteEntry {
  date: string;
  label: string;
}

function buildCraftDeepLink(spaceId: string, date: string): string {
  // Craft deep link format for daily notes: craftdocs://dailynote?spaceId=...&date=YYYY-MM-DD
  return `craftdocs://dailynote?spaceId=${encodeURIComponent(spaceId)}&date=${encodeURIComponent(date)}`;
}

// ─── Detail view for a single daily note ─────────────────────────────────────

function DailyNoteDetail({ date, label }: { date: string; label: string }) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getDailyNoteMarkdown(date),
      getConnectionInfo().catch(() => null),
    ])
      .then(([md, info]) => {
        setMarkdown(md || "*This daily note is empty.*");
        if (info?.spaceId) setSpaceId(info.spaceId);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        setMarkdown(`> Error loading daily note: ${msg}`);
        showToast({ style: Toast.Style.Failure, title: "Failed to load", message: msg });
      })
      .finally(() => setIsLoading(false));
  }, [date]);

  return (
    <Detail
      isLoading={isLoading}
      markdown={`# ${label} — ${date}\n\n${markdown ?? ""}`}
      navigationTitle={`Daily Note: ${label}`}
      actions={
        <ActionPanel>
          {spaceId && (
            <Action.OpenInBrowser
              title="Open in Craft"
              url={buildCraftDeepLink(spaceId, date)}
              shortcut={{ modifiers: ["cmd"], key: "o" }}
            />
          )}
          <Action.CopyToClipboard
            title="Copy Markdown"
            content={markdown ?? ""}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
          <Action title="Open Preferences" onAction={openExtensionPreferences} />
        </ActionPanel>
      }
    />
  );
}

// ─── List of recent dates ─────────────────────────────────────────────────────

export default function OpenDailyNote() {
  const dates = recentDates(14);
  const today = formatDate(new Date());

  const entries: DailyNoteEntry[] = dates.map((d) => ({
    date: d,
    label: dateLabel(d),
  }));

  return (
    <List navigationTitle="Daily Notes" searchBarPlaceholder="Filter by date (YYYY-MM-DD)…">
      <List.Section title="Recent Daily Notes">
        {entries.map(({ date, label }) => (
          <List.Item
            key={date}
            title={label}
            subtitle={date !== label ? date : undefined}
            accessories={date === today ? [{ tag: "Today" }] : []}
            actions={
              <ActionPanel>
                <Action.Push
                  title="View Note"
                  target={<DailyNoteDetail date={date} label={label} />}
                  shortcut={{ modifiers: [], key: "return" }}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}
