import {
  Action,
  ActionPanel,
  Detail,
  Form,
  Icon,
  List,
  showToast,
  Toast,
  openExtensionPreferences,
  useNavigation,
} from "@raycast/api";
import { useEffect, useState } from "react";
import {
  getDailyNoteMarkdown,
  appendToDailyNote,
  recentDates,
  dateLabel,
  formatDate,
} from "./api/craft-tasks";
import { getConnectionInfo, buildDeepLink } from "./api/craft-docs";
import type { NewBlock } from "./api/types";

// ─── Edit / Create form ───────────────────────────────────────────────────────

interface EditFormProps {
  date: string;
  label: string;
  isCreate?: boolean;
  onSaved?: () => void;
}

function EditForm({ date, label, isCreate, onSaved }: EditFormProps) {
  const { pop } = useNavigation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(values: {
    content: string;
    blockStyle: string;
    placement: "end" | "start";
  }) {
    const text = values.content.trim();
    if (!text) {
      showToast({ style: Toast.Style.Failure, title: "Content cannot be empty" });
      return;
    }

    setIsSubmitting(true);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: isCreate ? "Creating daily note…" : "Appending to note…",
    });

    try {
      const block: NewBlock = {
        type: "text",
        markdown: text,
        listStyle: values.blockStyle === "text" ? "none" : values.blockStyle,
      };

      await appendToDailyNote({
        blocks: [block],
        date,
        placement: values.placement,
      });

      toast.style = Toast.Style.Success;
      toast.title = isCreate ? "Daily note created" : "Block added";
      toast.message = label;

      onSaved?.();
      pop();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.style = Toast.Style.Failure;
      toast.title = "Failed";
      toast.message = message;
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form
      isLoading={isSubmitting}
      enableDrafts
      navigationTitle={isCreate ? `Create Note — ${label}` : `Edit Note — ${label}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isCreate ? "Create Daily Note" : "Add to Note"}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      {isCreate && (
        <Form.Description text={`No daily note exists for ${label} (${date}). Write your first entry below to create it.`} />
      )}
      <Form.TextArea
        id="content"
        title="Content"
        placeholder="What's on your mind?"
        autoFocus
        enableMarkdown
      />
      <Form.Separator />
      <Form.Dropdown id="blockStyle" title="Style" defaultValue="bullet">
        <Form.Dropdown.Item value="text" title="Plain Text" />
        <Form.Dropdown.Item value="bullet" title="• Bullet" />
        <Form.Dropdown.Item value="numbered" title="1. Numbered" />
        <Form.Dropdown.Item value="task" title="☐ Task" />
      </Form.Dropdown>
      {!isCreate && (
        <Form.Dropdown id="placement" title="Insert At" defaultValue="end">
          <Form.Dropdown.Item value="end" title="Bottom of note" />
          <Form.Dropdown.Item value="start" title="Top of note" />
        </Form.Dropdown>
      )}
    </Form>
  );
}

// ─── Detail view for an existing note ────────────────────────────────────────

function DailyNoteDetail({ date, label }: { date: string; label: string }) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [craftLink, setCraftLink] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    setNotFound(false);

    Promise.all([
      getDailyNoteMarkdown(date),
      getConnectionInfo().catch(() => null),
    ])
      .then(([md, info]) => {
        setMarkdown(md?.trim() ? md : "*This daily note is empty.*");
        if (info?.spaceId) setCraftLink(buildDeepLink(info.spaceId, date));
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("does not exist") || msg.includes("NOT_FOUND")) {
          setNotFound(true);
          setMarkdown(null);
        } else {
          setMarkdown(`> ⚠️ Error: ${msg}`);
          showToast({ style: Toast.Style.Failure, title: "Failed to load", message: msg });
        }
      })
      .finally(() => setIsLoading(false));
  }, [date, refreshKey]);

  // ── Note not found ──
  if (!isLoading && notFound) {
    return (
      <Detail
        markdown={`# ${label} — ${date}\n\n*No daily note found for this date.*\n\nCreate one by writing your first entry below.`}
        navigationTitle={`Daily Note: ${label}`}
        actions={
          <ActionPanel>
            <Action.Push
              title="Create Daily Note"
              icon={Icon.Plus}
              shortcut={{ modifiers: ["cmd"], key: "n" }}
              target={
                <EditForm
                  date={date}
                  label={label}
                  isCreate
                  onSaved={() => setRefreshKey((k) => k + 1)}
                />
              }
            />
            {craftLink && (
              <Action.OpenInBrowser
                title="Open Craft"
                url={craftLink}
                shortcut={{ modifiers: ["cmd"], key: "o" }}
              />
            )}
            <Action title="Open Preferences" onAction={openExtensionPreferences} />
          </ActionPanel>
        }
      />
    );
  }

  // ── Note exists ──
  return (
    <Detail
      isLoading={isLoading}
      markdown={`# ${label} — ${date}\n\n${markdown ?? ""}`}
      navigationTitle={`Daily Note: ${label}`}
      actions={
        <ActionPanel>
          <Action.Push
            title="Add to This Note"
            icon={Icon.Pencil}
            shortcut={{ modifiers: ["cmd"], key: "e" }}
            target={
              <EditForm
                date={date}
                label={label}
                onSaved={() => setRefreshKey((k) => k + 1)}
              />
            }
          />
          {craftLink && (
            <Action.OpenInBrowser
              title="Open in Craft"
              url={craftLink}
              shortcut={{ modifiers: ["cmd"], key: "o" }}
            />
          )}
          {markdown && (
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

// ─── List of recent dates ─────────────────────────────────────────────────────

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
