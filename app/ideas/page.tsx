"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, Plus, Search, Pin, X, Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Idea {
  id: string;
  title: string;
  body?: string;
  tags: string[];
  color: string;
  is_pinned: boolean;
  created_at: string;
}

const COLOR_OPTIONS = [
  { value: "default", dot: "bg-zinc-400" },
  { value: "indigo", dot: "bg-primary" },
  { value: "amber", dot: "bg-amber-500" },
  { value: "emerald", dot: "bg-emerald-500" },
  { value: "rose", dot: "bg-rose-500" },
  { value: "purple", dot: "bg-purple-500" },
];

const BORDER_CLASS: Record<string, string> = {
  default: "border-l-4 border-l-border",
  indigo: "border-l-4 border-l-primary",
  amber: "border-l-4 border-l-amber-500",
  emerald: "border-l-4 border-l-emerald-500",
  rose: "border-l-4 border-l-rose-500",
  purple: "border-l-4 border-l-purple-500",
};

const SEED_IDEAS: Idea[] = [
  {
    id: "idea-1",
    title: "Life OS Dashboard Enhancements",
    body: "Add a weekly review page. Show correlation between habits completed and tasks done. Energy tracking vs. task completion rate graph. Pomodoro timer integration with task auto-selection.",
    tags: ["life-os", "features"],
    color: "indigo",
    is_pinned: true,
    created_at: "2026-04-10T10:00:00",
  },
  {
    id: "idea-2",
    title: "Polymarket Research Angles",
    body: "Political prediction markets have more edge — retail bettors are less sophisticated here. Hungarian election (TISZA vs Fidesz), Iranian ceasefire timeline, US tariff resolution.",
    tags: ["polymarket", "research"],
    color: "amber",
    is_pinned: false,
    created_at: "2026-04-09T15:30:00",
  },
  {
    id: "idea-3",
    title: "COMPSCI 4EN3 Project Notes",
    body: "Document algorithm complexity analysis in the final report. Include time/space complexity comparison table. Emphasize real-world applications section — delivery routes, circuit boards.",
    tags: ["school", "COMPSCI 4EN3"],
    color: "emerald",
    is_pinned: true,
    created_at: "2026-04-08T09:00:00",
  },
];

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>(SEED_IDEAS);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    tags: "",
    color: "default",
  });

  const allTags = useMemo(() => {
    const set = new Set<string>();
    ideas.forEach((i) => i.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [ideas]);

  const filtered = useMemo(() => {
    let result = [...ideas];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.body?.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (activeTag) {
      result = result.filter((i) => i.tags.includes(activeTag));
    }
    return result.sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned));
  }, [ideas, search, activeTag]);

  function addIdea() {
    if (!form.title.trim()) return;
    const tags = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    setIdeas((prev) => [
      {
        id: Date.now().toString(),
        title: form.title.trim(),
        body: form.body.trim() || undefined,
        tags,
        color: form.color,
        is_pinned: false,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    setForm({ title: "", body: "", tags: "", color: "default" });
    setOpen(false);
  }

  function togglePin(id: string) {
    setIdeas((prev) =>
      prev.map((i) => (i.id === id ? { ...i, is_pinned: !i.is_pinned } : i))
    );
  }

  function deleteIdea(id: string) {
    setIdeas((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl accent-bg flex items-center justify-center flex-shrink-0">
              <Lightbulb style={{ height: "18px", width: "18px" }} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Ideas</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {ideas.length} captured · {ideas.filter((i) => i.is_pinned).length} pinned
              </p>
            </div>
          </div>
          <Button onClick={() => setOpen(true)} size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New Idea
          </Button>
        </div>

        {/* Search + tag filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search ideas…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {allTags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap items-center">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  className={`pill-btn py-1 px-2.5 text-[11px] gap-1 ${
                    activeTag === tag ? "active" : ""
                  }`}
                >
                  <Tag className="h-2.5 w-2.5" />
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 border border-dashed border-border rounded-2xl gap-3">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
              <Lightbulb className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-muted-foreground">
                {search || activeTag ? "No matching ideas" : "No ideas yet"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {search || activeTag
                  ? "Try a different search or tag"
                  : "Capture your first thought"}
              </p>
            </div>
            {!search && !activeTag && (
              <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5 mt-1">
                <Plus className="h-3.5 w-3.5" /> New Idea
              </Button>
            )}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
              {filtered.map((idea, i) => (
                <motion.div
                  key={idea.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.04, duration: 0.22 }}
                  className="break-inside-avoid mb-4"
                >
                  <Card
                    className={`group hover:shadow-[var(--shadow-float)] transition-all ${
                      BORDER_CLASS[idea.color] ?? BORDER_CLASS.default
                    }`}
                  >
                    <CardContent className="p-4">
                      {/* Title row */}
                      <div className="flex items-start gap-2 mb-2">
                        <h3 className="text-sm font-semibold leading-snug flex-1 min-w-0">
                          {idea.title}
                        </h3>
                        <div className="flex gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => togglePin(idea.id)}
                            className={`p-1 rounded hover:bg-muted transition-colors ${
                              idea.is_pinned
                                ? "text-amber-500"
                                : "text-muted-foreground hover:text-amber-500"
                            }`}
                            title={idea.is_pinned ? "Unpin" : "Pin"}
                          >
                            <Pin className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => deleteIdea(idea.id)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {/* Body */}
                      {idea.body && (
                        <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-5">
                          {idea.body}
                        </p>
                      )}

                      {/* Tags */}
                      {idea.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {idea.tags.map((tag) => (
                            <button
                              key={tag}
                              onClick={() =>
                                setActiveTag(activeTag === tag ? null : tag)
                              }
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full transition-colors ${
                                activeTag === tag
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                              }`}
                            >
                              #{tag}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between">
                        {idea.is_pinned ? (
                          <span className="text-[10px] text-amber-500 flex items-center gap-1">
                            <Pin className="h-2.5 w-2.5" /> Pinned
                          </span>
                        ) : (
                          <span />
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(idea.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </motion.div>

      {/* New Idea Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-primary" />
              New Idea
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Title</Label>
              <Input
                placeholder="What's the idea?"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Notes{" "}
                <span className="text-muted-foreground font-normal">optional</span>
              </Label>
              <Textarea
                placeholder="Expand on the idea…"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                className="h-28 resize-none text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Tags{" "}
                <span className="text-muted-foreground font-normal">
                  comma-separated
                </span>
              </Label>
              <Input
                placeholder="school, project, research…"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Color</Label>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setForm({ ...form, color: c.value })}
                    className={`w-6 h-6 rounded-full transition-all ${c.dot} ${
                      form.color === c.value
                        ? "ring-2 ring-offset-2 ring-primary scale-110"
                        : "opacity-60 hover:opacity-100"
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                onClick={addIdea}
                disabled={!form.title.trim()}
                className="flex-1"
              >
                Capture Idea
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
