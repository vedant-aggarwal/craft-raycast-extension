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
import { createTask, formatDate } from "./api/craft-tasks";

interface FormValues {
  title: string;
  scheduleDate: Date | null;
  deadlineDate: Date | null;
}

export default function CreateTask() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(values: FormValues) {
    const title = values.title.trim();
    if (!title) {
      showToast({ style: Toast.Style.Failure, title: "Task title is required" });
      return;
    }

    setIsSubmitting(true);
    const toast = await showToast({ style: Toast.Style.Animated, title: "Creating task…" });

    try {
      await createTask({
        markdown: title,
        scheduleDate: values.scheduleDate ? formatDate(values.scheduleDate) : undefined,
        deadlineDate: values.deadlineDate ? formatDate(values.deadlineDate) : undefined,
        location: "inbox",
      });

      toast.style = Toast.Style.Success;
      toast.title = "Task created";
      toast.message = title;

      await popToRoot();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to create task";
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
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create Task" onSubmit={handleSubmit} />
          <Action title="Open Preferences" onAction={openExtensionPreferences} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="title"
        title="Task"
        placeholder="What needs to be done?"
        autoFocus
      />
      <Form.Separator />
      <Form.DatePicker
        id="scheduleDate"
        title="Schedule Date"
        type={Form.DatePicker.Type.Date}
      />
      <Form.DatePicker
        id="deadlineDate"
        title="Deadline"
        type={Form.DatePicker.Type.Date}
      />
    </Form>
  );
}
