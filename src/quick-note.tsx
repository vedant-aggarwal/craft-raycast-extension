import {
  Action,
  ActionPanel,
  Form,
  getPreferenceValues,
  showToast,
  Toast,
  openExtensionPreferences,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { createDocument, listFolders, insertBlocks } from "./api/craft-docs";
import type { CraftFolder } from "./api/types";

interface CommandPreferences {
  defaultFolderId: string;
}

interface FormValues {
  title: string;
  content: string;
  folderId: string;
}

export default function QuickNote() {
  const cmdPrefs = getPreferenceValues<CommandPreferences>();
  const [folders, setFolders] = useState<CraftFolder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    listFolders()
      .then(setFolders)
      .catch(() => setFolders([]))
      .finally(() => setLoadingFolders(false));
  }, []);

  async function handleSubmit(values: FormValues) {
    const title = values.title.trim();
    if (!title) {
      showToast({ style: Toast.Style.Failure, title: "Title is required" });
      return;
    }

    setIsSubmitting(true);
    const toast = await showToast({ style: Toast.Style.Animated, title: "Creating note…" });

    try {
      const doc = await createDocument({
        title,
        folderId: values.folderId || undefined,
      });

      // If content was provided, insert it as a block
      if (values.content.trim() && doc.id) {
        await insertBlocks({
          blocks: [{ type: "text", markdown: values.content.trim() }],
          position: { pageId: doc.id, position: "end" },
        });
      }

      toast.style = Toast.Style.Success;
      toast.title = "Note created";
      toast.message = title;

      // Use the clickableLink returned by the API directly
      if (doc.clickableLink) {
        toast.primaryAction = {
          title: "Open in Craft",
          onAction: () => open(doc.clickableLink!),
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to create note";
      toast.message = message;
      if (message.includes("Invalid API key")) {
        toast.primaryAction = { title: "Open Preferences", onAction: openExtensionPreferences };
      }
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
          <Action.SubmitForm title="Create Note" onSubmit={handleSubmit} />
          <Action title="Open Preferences" onAction={openExtensionPreferences} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="title"
        title="Title"
        placeholder="My quick note…"
        autoFocus
      />
      <Form.TextArea
        id="content"
        title="Content"
        placeholder="Optional — write in markdown…"
        enableMarkdown
      />
      <Form.Separator />
      <Form.Dropdown
        id="folderId"
        title="Save to Folder"
        defaultValue={cmdPrefs.defaultFolderId}
        isLoading={loadingFolders}
      >
        <Form.Dropdown.Item value="" title="Unsorted" />
        {folders.map((f) => (
          <Form.Dropdown.Item key={f.id} value={f.id} title={f.name} />
        ))}
      </Form.Dropdown>
    </Form>
  );
}
