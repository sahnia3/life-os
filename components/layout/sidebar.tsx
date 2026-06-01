"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  Lightbulb,
  Dumbbell,
  Calendar,
  Bot,
  TrendingUp,
  Terminal,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Search,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useCommandPalette } from "@/stores/command-palette-store";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Agent OS", href: "/agent-os", icon: Terminal },
  { label: "Jobs", href: "/agent-os/jobs", icon: Briefcase },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Ideas", href: "/ideas", icon: Lightbulb },
  { label: "Fitness", href: "/fitness", icon: Dumbbell },
  { label: "Markets", href: "/markets", icon: TrendingUp },
  { label: "Calendar", href: "/calendar", icon: Calendar },
  { label: "Assistant", href: "/assistant", icon: Bot },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggle } = useSidebarStore();
  const { theme, setTheme } = useTheme();
  const { open: openCommandPalette } = useCommandPalette();

  return (
    <aside
      className={cn(
        "fixed top-0 left-0 z-40 h-screen border-r border-border bg-sidebar hidden lg:flex flex-col",
        "transition-[width] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]",
        isCollapsed ? "w-14" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-3 border-b border-border">
        <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg accent-bg flex items-center justify-center">
            <span className="text-white font-bold text-sm">L</span>
          </div>
          {!isCollapsed && (
            <span className="font-semibold text-sm tracking-tight whitespace-nowrap">
              Life OS
            </span>
          )}
        </Link>
      </div>

      {/* Search trigger */}
      <div className="px-2 mt-3 mb-1">
        <button
          onClick={openCommandPalette}
          className={cn(
            "w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground",
            "hover:bg-accent hover:text-accent-foreground transition-colors",
            isCollapsed && "justify-center"
          )}
        >
          <Search className="h-4 w-4 flex-shrink-0" />
          {!isCollapsed && (
            <>
              <span className="flex-1 text-left">Search...</span>
              <kbd className="hidden xl:inline-flex text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">
                ⌘K
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                isCollapsed && "justify-center px-2"
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-2 py-3 space-y-1 border-t border-border">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={cn(
            "w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground",
            "hover:bg-accent hover:text-accent-foreground transition-colors",
            isCollapsed && "justify-center px-2"
          )}
        >
          <Sun className="h-4 w-4 hidden dark:block flex-shrink-0" />
          <Moon className="h-4 w-4 dark:hidden flex-shrink-0" />
          {!isCollapsed && <span>Toggle theme</span>}
        </button>

        <button
          onClick={toggle}
          className={cn(
            "w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground",
            "hover:bg-accent hover:text-accent-foreground transition-colors",
            isCollapsed && "justify-center px-2"
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 flex-shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
