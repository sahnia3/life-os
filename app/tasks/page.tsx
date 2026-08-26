"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckSquare,
  Plus,
  X,
  GripVertical,
  Clock,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Status = "todo" | "in_progress" | "done";
type Priority = 1 | 2 | 3 | 4;

interface Task {
  id: string;
  title: string;
  description?: string;
  status: Status;
  priority: Priority;
  due_date?: string;
  course?: string;
}

const COURSES = [
  { value: "COMPSCI 4EN3", label: "COMPSCI 4EN3", cls: "bg-primary/10 text-primary" },
  { value: "INSPIRE 1PL3", label: "INSPIRE 1PL3", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  { value: "COMPSCI 3TB3", label: "COMPSCI 3TB3", cls: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  { value: "Other", label: "Other", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
];

const PRIORITY_CONFIG: Record<Priority, { label: string; cls: string }> = {
  1: { label: "P1", cls: "bg-destructive/10 text-destructive" },
  2: { label: "P2", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  3: { label: "P3", cls: "bg-muted text-muted-foreground" },
  4: { label: "P4", cls: "bg-muted text-muted-foreground" },
};

const COLUMNS: { id: Status; label: string; accentCls: string }[] = [
  { id: "todo", label: "Todo", accentCls: "text-muted-foreground" },
  { id: "in_progress", label: "In Progress", accentCls: "text-amber-500" },
  { id: "done", label: "Done", accentCls: "text-emerald-500" },
];

const SEED: Task[] = [
  {
    id: "seed-1",
    title: "INSPIRE 1PL3 Final Assignment",
    description: "Final assignment submission — due tonight at 11:59 PM",
    status: "todo",
    priority: 1,
    due_date: "2026-04-13T23:59:00",
    course: "INSPIRE 1PL3",
  },
  {
    id: "seed-2",
    title: "COMPSCI 4EN3 Final Project",
    description: "Final project submission for COMPSCI 4EN3",
    status: "todo",
    priority: 1,
    due_date: "2026-04-15T23:59:00",
    course: "COMPSCI 4EN3",
  },
];

function getDueInfo(due?: string) {
  if (!due) return null;
  const now = new Date();
  const due_dt = new Date(due);
  const diffMs = due_dt.getTime() - now.getTime();
  const isToday = due_dt.toDateString() === now.toDateString();
  if (diffMs < 0) return { label: "Overdue", cls: "text-destructive" };
  if (isToday) {
    const t = due_dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return { label: `Due today at ${t}`, cls: "text-destructive" };
  }
  const days = Math.floor(diffMs / 86400000);
  if (days <= 3) return { label: `Due in ${days}d`, cls: "text-amber-500" };
  return {
    label: due_dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    cls: "text-muted-foreground",
  };
}

function getCourseConfig(course?: string) {
  return COURSES.find((c) => c.value === course) ?? COURSES[COURSES.length - 1];
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const cardVariant = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.15 } },
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>(SEED);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    course: "",
    priority: "2",
    due_date: "",
  });

  const allVisible = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);
  const byStatus = useMemo(
    () => ({
      todo: allVisible.filter((t) => t.status === "todo"),
      in_progress: allVisible.filter((t) => t.status === "in_progress"),
      done: allVisible.filter((t) => t.status === "done"),
    }),
    [allVisible]
  );

  const counts = {
    todo: tasks.filter((t) => t.status === "todo").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    done: tasks.filter((t) => t.status === "done").length,
  };

  function addTask() {
    if (!form.title.trim()) return;
    setTasks((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        title: form.title.trim(),
        description: form.description || undefined,
        status: "todo",
        priority: parseInt(form.priority) as Priority,
        due_date: form.due_date || undefined,
        course: form.course || undefined,
      },
    ]);
    setForm({ title: "", description: "", course: "", priority: "2", due_date: "" });
    setOpen(false);
  }

  function moveTask(id: string, dir: "forward" | "back") {
    const order: Status[] = ["todo", "in_progress", "done"];
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const i = order.indexOf(t.status);
        const next = dir === "forward" ? i + 1 : i - 1;
        if (next < 0 || next >= order.length) return t;
        return { ...t, status: order[next] };
      })
    );
  }

  function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const tabItems = [
    { value: "all" as const, label: "All", count: tasks.length },
    { value: "todo" as const, label: "Todo", count: counts.todo },
    { value: "in_progress" as const, label: "In Progress", count: counts.in_progress },
    { value: "done" as const, label: "Done", count: counts.done },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <motion.div variants={container} initial="hidden" animate="show">

        {/* Header */}
        <motion.div
          variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } }}
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl accent-bg flex items-center justify-center flex-shrink-0">
              <CheckSquare className="h-4.5 w-4.5 text-white" style={{ height: "18px", width: "18px" }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {counts.todo + counts.in_progress} active · {counts.done} completed
              </p>
            </div>
          </div>
          <Button onClick={() => setOpen(true)} size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Task
          </Button>
        </motion.div>

        {/* Filter tabs */}
        <motion.div
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.2, delay: 0.05 } } }}
          className="flex gap-1.5 mb-6 flex-wrap"
        >
          {tabItems.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`pill-btn ${filter === tab.value ? "active" : ""}`}
            >
              {tab.label}
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  filter === tab.value
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </motion.div>

        {/* Kanban */}
        <motion.div
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.2, delay: 0.1 } } }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {COLUMNS.map((col) => (
            <div key={col.id} className="flex flex-col gap-3">
              {/* Column header */}
              <div className="flex items-center gap-2 px-1">
                <span className={`text-xs font-semibold uppercase tracking-wider ${col.accentCls}`}>
                  {col.label}
                </span>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full font-medium">
                  {byStatus[col.id].length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 min-h-[100px]">
                <AnimatePresence mode="popLayout">
                  {byStatus[col.id].length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-center h-20 border border-dashed border-border rounded-xl"
                    >
                      <p className="text-xs text-muted-foreground">No tasks</p>
                    </motion.div>
                  ) : (
                    byStatus[col.id].map((task) => {
                      const due = getDueInfo(task.due_date);
                      const course = getCourseConfig(task.course);
                      const pri = PRIORITY_CONFIG[task.priority];
                      return (
                        <motion.div
                          key={task.id}
                          variants={cardVariant}
                          initial="hidden"
                          animate="show"
                          exit="exit"
                          layout
                          className="group"
                        >
                          <Card
                            className={`transition-all hover:shadow-[var(--shadow-float)] ${
                              task.status === "done" ? "opacity-55" : ""
                            }`}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start gap-2">
                                <GripVertical className="h-4 w-4 text-muted-foreground/25 mt-0.5 flex-shrink-0 group-hover:text-muted-foreground/50 transition-colors cursor-grab" />
                                <div className="flex-1 min-w-0">
                                  <p
                                    className={`text-sm font-medium leading-snug ${
                                      task.status === "done"
                                        ? "line-through text-muted-foreground"
                                        : ""
                                    }`}
                                  >
                                    {task.title}
                                  </p>
                                  {task.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                      {task.description}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                    {task.course && (
                                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${course.cls}`}>
                                        {task.course}
                                      </span>
                                    )}
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${pri.cls}`}>
                                      {pri.label}
                                    </span>
                                    {due && (
                                      <span className={`text-[10px] flex items-center gap-1 ${due.cls}`}>
                                        <Clock className="h-2.5 w-2.5" />
                                        {due.label}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border">
                                <div className="flex gap-1">
                                  {col.id !== "todo" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-[11px] text-muted-foreground"
                                      onClick={() => moveTask(task.id, "back")}
                                    >
                                      ← Back
                                    </Button>
                                  )}
                                  {col.id !== "done" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-[11px] text-muted-foreground hover:text-primary"
                                      onClick={() => moveTask(task.id, "forward")}
                                    >
                                      {col.id === "in_progress" ? "Complete" : "Start"}
                                      <ChevronRight className="h-3 w-3 ml-0.5" />
                                    </Button>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => deleteTask(task.id)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })
                  )}
                </AnimatePresence>
              </div>

              {/* Add to todo column */}
              {col.id === "todo" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground border border-dashed border-border hover:border-primary/40 hover:text-primary w-full h-9"
                  onClick={() => setOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Add task
                </Button>
              )}
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Add Task Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4 text-primary" />
              New Task
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Title</Label>
              <Input
                placeholder="What needs to be done?"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Course</Label>
                <Select
                  value={form.course}
                  onValueChange={(v) => setForm({ ...form, course: v ?? "" })}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {COURSES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm({ ...form, priority: v ?? "2" })}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((p) => (
                      <SelectItem key={p} value={String(p)}>
                        P{p} — {p === 1 ? "Critical" : p === 2 ? "High" : p === 3 ? "Medium" : "Low"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Due Date</Label>
              <Input
                type="datetime-local"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Description{" "}
                <span className="text-muted-foreground font-normal">optional</span>
              </Label>
              <Textarea
                placeholder="Add notes or context…"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="h-20 resize-none text-sm"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                onClick={addTask}
                disabled={!form.title.trim()}
                className="flex-1"
              >
                Add Task
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
