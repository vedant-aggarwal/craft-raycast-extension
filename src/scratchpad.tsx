import {
  Action,
  ActionPanel,
  Form,
  showToast,
  Toast,
  openExtensionPreferences,
  popToRoot,
} from "@raycast/api";
import { useState } from "react";
import { createDocument, insertBlocks } from "./api/craft-docs";

interface FormValues {
  title: string;
  content: string;
}

function timestampTitle(): string {
  return new Date().toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Scratchpad() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(values: FormValues) {
    const content = values.content.trim();
    const title = values.title.trim() || timestampTitle();

    if (!content && !values.title.trim()) {
      showToast({ style: Toast.Style.Failure, title: "Scratchpad is empty" });
      return;
    }

    setIsSubmitting(true);
    const toast = await showToast({ style: Toast.Style.Animated, title: "Saving to Craft…" });

    try {
      const doc = await createDocument({ title });

      if (content && doc.id) {
        await insertBlocks({
          blocks: [{ type: "text", markdown: content }],
          position: { pageId: doc.id, position: "end" },
        });
      }

      toast.style = Toast.Style.Success;
      toast.title = "Saved to Craft";
      toast.message = title;

      if (doc.clickableLink) {
        toast.primaryAction = {
          title: "Open in Craft",
          onAction: () => open(doc.clickableLink!),
        };
      }

      await popToRoot();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to save";
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
      navigationTitle="Craft Scratchpad"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save to Craft"
            shortcut={{ modifiers: ["cmd"], key: "return" }}
            onSubmit={handleSubmit}
          />
          <Action title="Open Preferences" onAction={openExtensionPreferences} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="title"
        title="Title"
        placeholder={`Scratchpad — ${timestampTitle()}`}
      />
      <Form.TextArea
        id="content"
        title="Content"
        placeholder="Start typing… your draft is saved automatically until you submit."
        autoFocus
        enableMarkdown
      />
    </Form>
  );
}
