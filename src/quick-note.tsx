import {
  Action,
  ActionPanel,
  Form,
  getPreferenceValues,
  showToast,
  Toast,
  openExtensionPreferences,
  useNavigation,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { createDocument, listFolders, buildDocumentDeepLink, getConnectionInfo } from "./api/craft-docs";
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
    if (!values.title.trim()) {
      showToast({ style: Toast.Style.Failure, title: "Title is required" });
      return;
    }

    setIsSubmitting(true);
    const toast = await showToast({ style: Toast.Style.Animated, title: "Creating note…" });

    try {
      const destination =
        values.folderId
          ? { type: "folder" as const, folderId: values.folderId }
          : { type: "unsorted" as const };

      const doc = await createDocument({ title: values.title.trim(), destination });

      // If content was provided, open the document in Craft via deep link so the
      // user can paste / view — full block insertion is available but the title
      // alone already creates a usable document.
      // (Block insertion after creation is handled by insertBlocks in craft-docs.ts
      //  if you need to pre-fill body content programmatically.)

      const info = await getConnectionInfo().catch(() => null);

      toast.style = Toast.Style.Success;
      toast.title = "Note created";
      toast.message = values.title.trim();

      if (info?.spaceId && doc.id) {
        toast.primaryAction = {
          title: "Open in Craft",
          onAction: () => {
            const url = buildDocumentDeepLink(info.spaceId, doc.id);
            open(url);
          },
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to create note";
      toast.message = message;

      if (message.includes("401") || message.includes("403")) {
        toast.primaryAction = {
          title: "Open Preferences",
          onAction: openExtensionPreferences,
        };
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
        placeholder="Write in markdown — this will be the first block…"
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
          <Form.Dropdown.Item key={f.id} value={f.id} title={f.title} />
        ))}
      </Form.Dropdown>
    </Form>
  );
}
