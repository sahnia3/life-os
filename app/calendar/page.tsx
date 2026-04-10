"use client";

import { Calendar } from "lucide-react";

export default function CalendarPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Calendar className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
      </div>
      <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-xl">
        <p className="text-muted-foreground">Calendar views coming in Module 8</p>
      </div>
    </div>
  );
}
