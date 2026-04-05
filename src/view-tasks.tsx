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
import { getTasks, updateTasks, deleteTasks } from "./api/craft-tasks";
import type { CraftTask, TaskScope } from "./api/types";

const SCOPES: { value: TaskScope; label: string }[] = [
  { value: "inbox", label: "Inbox" },
  { value: "active", label: "Active" },
  { value: "upcoming", label: "Upcoming" },
  { value: "logbook", label: "Logbook" },
];

function taskStateIcon(task: CraftTask): { source: Icon; tintColor: Color } {
  if (task.state === "done") return { source: Icon.CheckCircle, tintColor: Color.Green };
  if (task.state === "canceled") return { source: Icon.XMarkCircle, tintColor: Color.SecondaryText };
  return { source: Icon.Circle, tintColor: Color.PrimaryText };
}

function formatDueDate(dateStr?: string): string | undefined {
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
      const data = await getTasks({ scope: s });
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
      await updateTasks({ taskIds: [task.id], state: "done" });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, state: "done" } : t)));
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
      await updateTasks({ taskIds: [task.id], state: "open" });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, state: "open" } : t)));
      toast.style = Toast.Style.Success;
      toast.title = "Task reopened";
    } catch (err) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed";
      toast.message = err instanceof Error ? err.message : String(err);
    }
  }

  async function handleDelete(task: CraftTask) {
    const confirmed = await confirmAlert({
      title: "Delete Task?",
      message: `"${task.title}" will be permanently deleted.`,
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
        const dueLabel = formatDueDate(task.dueDate);
        const accessories: List.Item.Accessory[] = [];
        if (dueLabel) {
          const overdue = dueLabel.includes("overdue");
          accessories.push({
            tag: { value: dueLabel, color: overdue ? Color.Red : Color.SecondaryText },
          });
        }
        if (task.state === "done") {
          accessories.push({ tag: { value: "Done", color: Color.Green } });
        }

        return (
          <List.Item
            key={task.id}
            icon={taskStateIcon(task)}
            title={task.title}
            subtitle={task.scheduleDate ? `Scheduled: ${task.scheduleDate}` : undefined}
            accessories={accessories}
            actions={
              <ActionPanel>
                {task.state !== "done" ? (
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
