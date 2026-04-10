"use client";

import { Bot } from "lucide-react";

export default function AssistantPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Bot className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">AI Assistant</h1>
      </div>
      <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-xl">
        <p className="text-muted-foreground">AI chat interface coming in Module 6</p>
      </div>
    </div>
  );
}
