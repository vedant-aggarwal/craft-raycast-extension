import {
  Action,
  ActionPanel,
  Form,
  showToast,
  Toast,
  openExtensionPreferences,
} from "@raycast/api";
import { useState } from "react";
import { appendToDailyNote } from "./api/craft-tasks";
import type { NewBlock } from "./api/types";

interface FormValues {
  content: string;
  placement: "end" | "start";
  blockStyle: "text" | "bullet" | "numbered" | "todo";
}

export default function DailyNote() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(values: FormValues) {
    const text = values.content.trim();
    if (!text) {
      showToast({ style: Toast.Style.Failure, title: "Content cannot be empty" });
      return;
    }

    setIsSubmitting(true);
    const toast = await showToast({ style: Toast.Style.Animated, title: "Appending to daily note…" });

    try {
      const listStyleMap: Record<string, NewBlock["listStyle"]> = {
        text: undefined,
        bullet: { type: "bullet" },
        numbered: { type: "numbered" },
        todo: { type: "todo", state: "unchecked" },
      };

      const block: NewBlock = {
        type: "text",
        content: text,
        listStyle: listStyleMap[values.blockStyle],
      };

      await appendToDailyNote({
        blocks: [block],
        date: "today",
        placement: values.placement,
      });

      toast.style = Toast.Style.Success;
      toast.title = "Added to daily note";
      toast.message = text.length > 60 ? text.slice(0, 60) + "…" : text;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to append";
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
          <Action.SubmitForm title="Append to Daily Note" onSubmit={handleSubmit} />
          <Action title="Open Preferences" onAction={openExtensionPreferences} />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="content"
        title="Content"
        placeholder="What do you want to add to today's note?"
        autoFocus
        enableMarkdown
      />
      <Form.Separator />
      <Form.Dropdown id="blockStyle" title="Block Style" defaultValue="bullet">
        <Form.Dropdown.Item value="text" title="Plain Text" />
        <Form.Dropdown.Item value="bullet" title="• Bullet" />
        <Form.Dropdown.Item value="numbered" title="1. Numbered" />
        <Form.Dropdown.Item value="todo" title="☐ To-Do" />
      </Form.Dropdown>
      <Form.Dropdown id="placement" title="Insert At" defaultValue="end">
        <Form.Dropdown.Item value="end" title="Bottom of note" />
        <Form.Dropdown.Item value="start" title="Top of note" />
      </Form.Dropdown>
    </Form>
  );
}
