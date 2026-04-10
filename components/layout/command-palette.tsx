"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  Lightbulb,
  Dumbbell,
  Calendar,
  Bot,
  TrendingUp,
  Plus,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useCommandPalette } from "@/stores/command-palette-store";

const NAV_COMMANDS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Ideas", href: "/ideas", icon: Lightbulb },
  { label: "Fitness", href: "/fitness", icon: Dumbbell },
  { label: "Markets", href: "/markets", icon: TrendingUp },
  { label: "Calendar", href: "/calendar", icon: Calendar },
  { label: "Assistant", href: "/assistant", icon: Bot },
];

export function CommandPalette() {
  const { isOpen, close, toggle } = useCommandPalette();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  const runCommand = (fn: () => void) => {
    close();
    fn();
  };

  return (
    <CommandDialog open={isOpen} onOpenChange={(open) => (open ? null : close())}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => runCommand(() => router.push("/tasks?new=true"))}>
            <Plus className="mr-2 h-4 w-4" />
            New Task
            <kbd className="ml-auto text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">N</kbd>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/ideas?new=true"))}>
            <Plus className="mr-2 h-4 w-4" />
            New Idea
            <kbd className="ml-auto text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">I</kbd>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          {NAV_COMMANDS.map((item) => (
            <CommandItem key={item.href} onSelect={() => runCommand(() => router.push(item.href))}>
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Settings">
          <CommandItem onSelect={() => runCommand(() => setTheme(theme === "dark" ? "light" : "dark"))}>
            <Sun className="mr-2 h-4 w-4 hidden dark:block" />
            <Moon className="mr-2 h-4 w-4 dark:hidden" />
            Toggle Theme
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
