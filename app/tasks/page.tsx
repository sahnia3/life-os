"use client";

import { CheckSquare } from "lucide-react";

export default function TasksPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <CheckSquare className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
      </div>
      <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-xl">
        <p className="text-muted-foreground">Kanban board coming in Module 2</p>
      </div>
    </div>
  );
}
