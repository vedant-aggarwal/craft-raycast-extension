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
import { getDailyNoteMarkdown, recentDates, dateLabel, formatDate } from "./api/craft-tasks";
import { getConnectionInfo, buildDeepLink } from "./api/craft-docs";

interface DailyNoteDetailProps {
  date: string;
  label: string;
}

function DailyNoteDetail({ date, label }: DailyNoteDetailProps) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [craftLink, setCraftLink] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEmpty, setIsEmpty] = useState(false);

  useEffect(() => {
    Promise.all([
      getDailyNoteMarkdown(date),
      getConnectionInfo().catch(() => null),
    ])
      .then(([md, info]) => {
        if (!md || !md.trim()) {
          setIsEmpty(true);
          setMarkdown("*This daily note is empty.*");
        } else {
          setMarkdown(md);
        }
        if (info?.spaceId) {
          // Use date as blockId for daily note deep link (Craft resolves it)
          setCraftLink(buildDeepLink(info.spaceId, date));
        }
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("does not exist") || msg.includes("NOT_FOUND")) {
          setIsEmpty(true);
          setMarkdown(
            `*No daily note found for ${label} (${date}).*\n\nOpen Craft and navigate to this date to create one.`
          );
        } else {
          setMarkdown(`> ⚠️ Error loading note: ${msg}`);
          showToast({ style: Toast.Style.Failure, title: "Failed to load", message: msg });
        }
      })
      .finally(() => setIsLoading(false));
  }, [date, label]);

  return (
    <Detail
      isLoading={isLoading}
      markdown={`# ${label} — ${date}\n\n${markdown ?? ""}`}
      navigationTitle={`Daily Note: ${label}`}
      actions={
        <ActionPanel>
          {craftLink && !isEmpty && (
            <Action.OpenInBrowser
              title="Open in Craft"
              url={craftLink}
              shortcut={{ modifiers: ["cmd"], key: "o" }}
            />
          )}
          {markdown && !isEmpty && (
            <Action.CopyToClipboard
              title="Copy Markdown"
              content={markdown}
              shortcut={{ modifiers: ["cmd"], key: "c" }}
            />
          )}
          <Action title="Open Preferences" onAction={openExtensionPreferences} />
        </ActionPanel>
      }
    />
  );
}

export default function OpenDailyNote() {
  const dates = recentDates(14);
  const today = formatDate(new Date());

  return (
    <List navigationTitle="Daily Notes" searchBarPlaceholder="Filter by date…">
      <List.Section title="Recent Daily Notes">
        {dates.map((date) => {
          const label = dateLabel(date);
          return (
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
                  />
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
    </List>
  );
}
