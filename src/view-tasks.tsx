import {
  Action,
  ActionPanel,
  Color,
  Icon,
  List,
  showToast,
  Toast,
  openExtensionPreferences,
  confirmAlert,
  Alert,
} from "@raycast/api";
import { useEffect, useState, useCallback } from "react";
import { getTasks, updateTask, deleteTasks, stripTaskPrefix } from "./api/craft-tasks";
import type { CraftTask, TaskScope } from "./api/types";

const SCOPES: { value: TaskScope; label: string }[] = [
  { value: "inbox", label: "Inbox" },
  { value: "active", label: "Active" },
  { value: "upcoming", label: "Upcoming" },
  { value: "logbook", label: "Logbook" },
];

function taskIcon(task: CraftTask): { source: Icon; tintColor: Color } {
  const state = task.taskInfo?.state;
  if (state === "done") return { source: Icon.CheckCircle, tintColor: Color.Green };
  if (state === "canceled") return { source: Icon.XMarkCircle, tintColor: Color.SecondaryText };
  return { source: Icon.Circle, tintColor: Color.PrimaryText };
}

function formatDeadline(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Due today";
  if (diff === -1) return "Due yesterday";
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 1) return "Due tomorrow";
  return `Due ${dateStr}`;
}

export default function ViewTasks() {
  const [scope, setScope] = useState<TaskScope>("inbox");
  const [tasks, setTasks] = useState<CraftTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTasks = useCallback(async (s: TaskScope) => {
    setIsLoading(true);
    try {
      const data = await getTasks(s);
      setTasks(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showToast({ style: Toast.Style.Failure, title: "Failed to load tasks", message });
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks(scope);
  }, [scope, loadTasks]);

  async function handleMarkDone(task: CraftTask) {
    const toast = await showToast({ style: Toast.Style.Animated, title: "Marking as done…" });
    try {
      await updateTask({ id: task.id, state: "done" });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, taskInfo: { ...t.taskInfo, state: "done" } } : t
        )
      );
      toast.style = Toast.Style.Success;
      toast.title = "Task completed";
    } catch (err) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed";
      toast.message = err instanceof Error ? err.message : String(err);
    }
  }

  async function handleMarkOpen(task: CraftTask) {
    const toast = await showToast({ style: Toast.Style.Animated, title: "Reopening task…" });
    try {
      await updateTask({ id: task.id, state: "todo" });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, taskInfo: { ...t.taskInfo, state: "todo" } } : t
        )
      );
      toast.style = Toast.Style.Success;
      toast.title = "Task reopened";
    } catch (err) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed";
      toast.message = err instanceof Error ? err.message : String(err);
    }
  }

  async function handleDelete(task: CraftTask) {
    const title = stripTaskPrefix(task.markdown);
    const confirmed = await confirmAlert({
      title: "Delete Task?",
      message: `"${title}" will be permanently deleted.`,
      primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;

    const toast = await showToast({ style: Toast.Style.Animated, title: "Deleting…" });
    try {
      await deleteTasks([task.id]);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      toast.style = Toast.Style.Success;
      toast.title = "Task deleted";
    } catch (err) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed";
      toast.message = err instanceof Error ? err.message : String(err);
    }
  }

  return (
    <List
      isLoading={isLoading}
      navigationTitle="Tasks"
      searchBarPlaceholder="Filter tasks…"
      searchBarAccessory={
        <List.Dropdown
          tooltip="Scope"
          value={scope}
          onChange={(val) => setScope(val as TaskScope)}
        >
          {SCOPES.map((s) => (
            <List.Dropdown.Item key={s.value} value={s.value} title={s.label} />
          ))}
        </List.Dropdown>
      }
    >
      {tasks.length === 0 && !isLoading && (
        <List.EmptyView
          icon={Icon.CheckCircle}
          title={`No ${scope} tasks`}
          description="All clear!"
        />
      )}
      {tasks.map((task) => {
        const title = stripTaskPrefix(task.markdown);
        const deadline = task.taskInfo?.deadlineDate;
        const deadlineLabel = formatDeadline(deadline);
        const scheduleDate = task.taskInfo?.scheduleDate;
        const state = task.taskInfo?.state;

        const accessories: List.Item.Accessory[] = [];
        if (deadlineLabel) {
          const overdue = deadlineLabel.includes("overdue");
          accessories.push({
            tag: { value: deadlineLabel, color: overdue ? Color.Red : Color.Orange },
          });
        }
        if (state === "done") {
          accessories.push({ tag: { value: "Done", color: Color.Green } });
        }

        return (
          <List.Item
            key={task.id}
            icon={taskIcon(task)}
            title={title || task.markdown}
            subtitle={scheduleDate ? `Scheduled: ${scheduleDate}` : undefined}
            accessories={accessories}
            actions={
              <ActionPanel>
                {state !== "done" ? (
                  <Action
                    title="Mark as Done"
                    icon={Icon.CheckCircle}
                    shortcut={{ modifiers: ["cmd"], key: "d" }}
                    onAction={() => handleMarkDone(task)}
                  />
                ) : (
                  <Action
                    title="Reopen Task"
                    icon={Icon.Circle}
                    shortcut={{ modifiers: ["cmd"], key: "d" }}
                    onAction={() => handleMarkOpen(task)}
                  />
                )}
                <Action
                  title="Delete Task"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  shortcut={{ modifiers: ["cmd"], key: "backspace" }}
                  onAction={() => handleDelete(task)}
                />
                <Action
                  title="Refresh"
                  icon={Icon.ArrowClockwise}
                  shortcut={{ modifiers: ["cmd"], key: "r" }}
                  onAction={() => loadTasks(scope)}
                />
                <Action title="Open Preferences" onAction={openExtensionPreferences} />
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}
