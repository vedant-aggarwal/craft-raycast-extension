import {
  Action,
  ActionPanel,
  Alert,
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
import { insertBlocks } from "./api/craft-docs";
import type { NewBlock } from "./api/types";

const STORAGE_KEY = "pinned-lists";

interface PinnedList {
  id: string;
  title: string;
  emoji?: string;
}

async function loadPinnedLists(): Promise<PinnedList[]> {
  const raw = await LocalStorage.getItem<string>(STORAGE_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as PinnedList[]; } catch { return []; }
}

async function savePinnedLists(lists: PinnedList[]): Promise<void> {
  await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
}

// ─── Append form ──────────────────────────────────────────────────────────────

function AppendForm({ pinnedLists }: { pinnedLists: PinnedList[] }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(values: { content: string; listId: string; blockStyle: string; placement: "end" | "start" }) {
    const text = values.content.trim();
    if (!text) { showToast({ style: Toast.Style.Failure, title: "Content cannot be empty" }); return; }
    if (!values.listId) { showToast({ style: Toast.Style.Failure, title: "Please select a list" }); return; }

    setIsSubmitting(true);
    const toast = await showToast({ style: Toast.Style.Animated, title: "Appending to list…" });

    try {
      const styleMap: Record<string, NewBlock["listStyle"]> = {
        text: "none",
        bullet: "bullet",
        numbered: "numbered",
        task: "task",
      };

      const block: NewBlock = {
        type: "text",
        markdown: text,
        listStyle: styleMap[values.blockStyle],
      };

      await insertBlocks({
        blocks: [block],
        position: { pageId: values.listId, position: values.placement },
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
          <Form.Dropdown.Item key={l.id} value={l.id} title={`${l.emoji ?? "📋"} ${l.title}`} />
        ))}
      </Form.Dropdown>
      <Form.TextArea id="content" title="Item" placeholder="What do you want to add?" autoFocus />
      <Form.Separator />
      <Form.Dropdown id="blockStyle" title="Style" defaultValue="bullet">
        <Form.Dropdown.Item value="text" title="Plain Text" />
        <Form.Dropdown.Item value="bullet" title="• Bullet" />
        <Form.Dropdown.Item value="numbered" title="1. Numbered" />
        <Form.Dropdown.Item value="task" title="☐ Task" />
      </Form.Dropdown>
      <Form.Dropdown id="placement" title="Position" defaultValue="end">
        <Form.Dropdown.Item value="end" title="Bottom of document" />
        <Form.Dropdown.Item value="start" title="Top of document" />
      </Form.Dropdown>
    </Form>
  );
}

// ─── Pin new document form ────────────────────────────────────────────────────

function PinDocumentForm({ onPin }: { onPin: (list: PinnedList) => void }) {
  const { pop } = useNavigation();

  async function handleSubmit(values: { documentId: string; title: string; emoji: string }) {
    const id = values.documentId.trim();
    if (!id) { showToast({ style: Toast.Style.Failure, title: "Document ID is required" }); return; }
    onPin({ id, title: values.title.trim() || "Untitled List", emoji: values.emoji.trim() || undefined });
    showToast({ style: Toast.Style.Success, title: "List pinned" });
    pop();
  }

  return (
    <Form
      navigationTitle="Pin a List Document"
      actions={<ActionPanel><Action.SubmitForm title="Pin Document" onSubmit={handleSubmit} /></ActionPanel>}
    >
      <Form.Description text="Paste the Craft document ID. Find it via Search Documents → Copy Document ID (⌘⇧C)." />
      <Form.TextField id="documentId" title="Document ID" placeholder="C9F2192F-…" autoFocus />
      <Form.TextField id="title" title="List Name" placeholder="e.g. Grocery List" />
      <Form.TextField id="emoji" title="Emoji" placeholder="🛒" />
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

  useEffect(() => { reload(); }, [reload]);

  async function handlePin(list: PinnedList) {
    const updated = [...pinnedLists.filter((l) => l.id !== list.id), list];
    await savePinnedLists(updated);
    setPinnedLists(updated);
  }

  async function handleUnpin(id: string) {
    const confirmed = await confirmAlert({
      title: "Unpin List?",
      message: "Removes it from Raycast only. The Craft document is untouched.",
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
              <Action.Push title="Pin a Document" icon={Icon.Plus} target={<PinDocumentForm onPin={handlePin} />} />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  if (!isLoading && pinnedLists.length > 0) {
    return <AppendForm pinnedLists={pinnedLists} />;
  }

  return (
    <List isLoading={isLoading} navigationTitle="Pinned Lists">
      {pinnedLists.map((list) => (
        <List.Item
          key={list.id}
          icon={list.emoji ?? "📋"}
          title={list.title}
          subtitle={list.id}
          actions={
            <ActionPanel>
              <Action.Push title="Add to This List" target={<AppendForm pinnedLists={[list]} />} />
              <Action title="Unpin" style={Action.Style.Destructive} icon={Icon.PinDisabled} onAction={() => handleUnpin(list.id)} />
              <Action.Push title="Pin New Document" icon={Icon.Plus} target={<PinDocumentForm onPin={handlePin} />} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
