/**
 * Add to List — append content to a pinned Craft document.
 *
 * "Pinned" documents are stored in Raycast's LocalStorage as a JSON array.
 * Users can pin any document (by ID + title) and quickly append text to it.
 *
 * Two modes:
 *  - Append mode (default): pick a pinned list, type content, submit.
 *  - Manage mode: add new pins by pasting a document ID, or remove existing ones.
 */

import {
  Action,
  ActionPanel,
  Alert,
  Color,
  Form,
  Icon,
  List,
  LocalStorage,
  showToast,
  Toast,
  openExtensionPreferences,
  confirmAlert,
  useNavigation,
} from "@raycast/api";
import { useEffect, useState, useCallback } from "react";
import { insertBlocks, listDocuments, getConnectionInfo, buildDocumentDeepLink } from "./api/craft-docs";
import type { NewBlock } from "./api/types";

const STORAGE_KEY = "pinned-lists";

interface PinnedList {
  id: string; // Craft document ID (= root block ID)
  title: string;
  emoji?: string;
}

async function loadPinnedLists(): Promise<PinnedList[]> {
  const raw = await LocalStorage.getItem<string>(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PinnedList[];
  } catch {
    return [];
  }
}

async function savePinnedLists(lists: PinnedList[]): Promise<void> {
  await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
}

// ─── Append form ──────────────────────────────────────────────────────────────

interface AppendFormValues {
  content: string;
  listId: string;
  blockStyle: string;
  placement: "end" | "start";
}

function AppendForm({ pinnedLists }: { pinnedLists: PinnedList[] }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(values: AppendFormValues) {
    const text = values.content.trim();
    if (!text) {
      showToast({ style: Toast.Style.Failure, title: "Content cannot be empty" });
      return;
    }
    if (!values.listId) {
      showToast({ style: Toast.Style.Failure, title: "Please select a list" });
      return;
    }

    setIsSubmitting(true);
    const toast = await showToast({ style: Toast.Style.Animated, title: "Appending to list…" });

    try {
      const styleMap: Record<string, NewBlock["listStyle"]> = {
        text: undefined,
        bullet: { type: "bullet" },
        numbered: { type: "numbered" },
        todo: { type: "todo", state: "unchecked" },
      };

      const block: NewBlock = {
        type: "text",
        content: text,
        listStyle: styleMap[values.blockStyle],
      };

      await insertBlocks({
        blocks: [block],
        position: {
          pageId: values.listId,
          placement: values.placement,
        },
      });

      const list = pinnedLists.find((l) => l.id === values.listId);
      toast.style = Toast.Style.Success;
      toast.title = "Added to list";
      toast.message = list?.title ?? values.listId;
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
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Add to List" onSubmit={handleSubmit} />
          <Action title="Open Preferences" onAction={openExtensionPreferences} />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="listId" title="List" defaultValue={pinnedLists[0]?.id ?? ""}>
        {pinnedLists.map((l) => (
          <Form.Dropdown.Item
            key={l.id}
            value={l.id}
            title={`${l.emoji ?? "📋"} ${l.title}`}
          />
        ))}
      </Form.Dropdown>
      <Form.TextArea
        id="content"
        title="Item"
        placeholder="What do you want to add?"
        autoFocus
      />
      <Form.Separator />
      <Form.Dropdown id="blockStyle" title="Style" defaultValue="bullet">
        <Form.Dropdown.Item value="text" title="Plain Text" />
        <Form.Dropdown.Item value="bullet" title="• Bullet" />
        <Form.Dropdown.Item value="numbered" title="1. Numbered" />
        <Form.Dropdown.Item value="todo" title="☐ To-Do" />
      </Form.Dropdown>
      <Form.Dropdown id="placement" title="Position" defaultValue="end">
        <Form.Dropdown.Item value="end" title="Bottom of document" />
        <Form.Dropdown.Item value="start" title="Top of document" />
      </Form.Dropdown>
    </Form>
  );
}

// ─── Pin new document form ────────────────────────────────────────────────────

interface PinFormValues {
  documentId: string;
  title: string;
  emoji: string;
}

function PinDocumentForm({
  onPin,
}: {
  onPin: (list: PinnedList) => void;
}) {
  const { pop } = useNavigation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(values: PinFormValues) {
    const id = values.documentId.trim();
    const title = values.title.trim() || "Untitled List";
    if (!id) {
      showToast({ style: Toast.Style.Failure, title: "Document ID is required" });
      return;
    }

    setIsSubmitting(true);
    try {
      onPin({ id, title, emoji: values.emoji.trim() || undefined });
      showToast({ style: Toast.Style.Success, title: "List pinned", message: title });
      pop();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form
      isLoading={isSubmitting}
      navigationTitle="Pin a List Document"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Pin Document" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text="Paste the Craft document ID below. Find it via Search Documents → Copy Document ID." />
      <Form.TextField
        id="documentId"
        title="Document ID"
        placeholder="e.g. A1B2C3D4-…"
        autoFocus
      />
      <Form.TextField
        id="title"
        title="List Name"
        placeholder="e.g. Grocery List"
      />
      <Form.TextField
        id="emoji"
        title="Emoji"
        placeholder="🛒"
      />
    </Form>
  );
}

// ─── Main command ─────────────────────────────────────────────────────────────

export default function AddToList() {
  const { push } = useNavigation();
  const [pinnedLists, setPinnedLists] = useState<PinnedList[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    const lists = await loadPinnedLists();
    setPinnedLists(lists);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handlePin(list: PinnedList) {
    const updated = [...pinnedLists.filter((l) => l.id !== list.id), list];
    await savePinnedLists(updated);
    setPinnedLists(updated);
  }

  async function handleUnpin(id: string) {
    const confirmed = await confirmAlert({
      title: "Unpin List?",
      message: "This only removes it from your Raycast pins. The document in Craft is untouched.",
      primaryAction: { title: "Unpin", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;
    const updated = pinnedLists.filter((l) => l.id !== id);
    await savePinnedLists(updated);
    setPinnedLists(updated);
    showToast({ style: Toast.Style.Success, title: "List unpinned" });
  }

  if (!isLoading && pinnedLists.length === 0) {
    return (
      <List isLoading={isLoading}>
        <List.EmptyView
          icon={Icon.Pin}
          title="No Lists Pinned"
          description="Pin a Craft document to start quickly appending to it."
          actions={
            <ActionPanel>
              <Action.Push
                title="Pin a Document"
                icon={Icon.Plus}
                target={<PinDocumentForm onPin={handlePin} />}
              />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  if (!isLoading && pinnedLists.length > 0) {
    // If lists are pinned, go directly to the append form
    return <AppendForm pinnedLists={pinnedLists} />;
  }

  // Show management list when explicitly managing
  return (
    <List
      isLoading={isLoading}
      navigationTitle="Pinned Lists"
      actions={
        <ActionPanel>
          <Action.Push
            title="Pin a Document"
            icon={Icon.Plus}
            target={<PinDocumentForm onPin={handlePin} />}
          />
        </ActionPanel>
      }
    >
      {pinnedLists.map((list) => (
        <List.Item
          key={list.id}
          icon={list.emoji ?? "📋"}
          title={list.title}
          subtitle={list.id}
          actions={
            <ActionPanel>
              <Action.Push
                title="Add to This List"
                target={<AppendForm pinnedLists={[list]} />}
              />
              <Action
                title="Unpin"
                style={Action.Style.Destructive}
                icon={Icon.PinDisabled}
                onAction={() => handleUnpin(list.id)}
              />
              <Action.Push
                title="Pin New Document"
                icon={Icon.Plus}
                target={<PinDocumentForm onPin={handlePin} />}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
