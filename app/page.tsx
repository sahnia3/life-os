"use client";

import { motion } from "framer-motion";
import {
  Lightbulb,
  Dumbbell,
  Calendar,
  Bot,
  Plus,
  Timer,
  TrendingUp,
  Flame,
  Target,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

export default function DashboardPage() {
  const now = new Date();
  const greeting =
    now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <motion.div variants={container} initial="hidden" animate="show">
        {/* Header */}
        <motion.div variants={item} className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {greeting}, <span className="gradient-text">Aditya</span>
          </h1>
          <p className="text-muted-foreground mt-1">{dateStr}</p>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={item} className="flex gap-2 mb-6 flex-wrap">
          <Link href="/tasks?new=true">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New Task
            </Button>
          </Link>
          <Link href="/ideas?new=true">
            <Button size="sm" variant="outline" className="gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" /> New Idea
            </Button>
          </Link>
          <Link href="/fitness/log">
            <Button size="sm" variant="outline" className="gap-1.5">
              <Dumbbell className="h-3.5 w-3.5" /> Log Workout
            </Button>
          </Link>
        </motion.div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Left column - 2/3 width */}
          <div className="lg:col-span-2 space-y-4 lg:space-y-6">
            {/* Today's Focus */}
            <motion.div variants={item}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Today&apos;s Focus
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { title: "Submit COMP372 Assignment", priority: "P1", due: "Today", course: "COMP372" },
                    { title: "Review pull request for MapleRewards", priority: "P2", due: "Today" },
                    { title: "Prepare presentation slides", priority: "P2", due: "Tomorrow" },
                  ].map((task, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors group"
                    >
                      <div className="h-5 w-5 rounded-md border-2 border-border group-hover:border-primary transition-colors cursor-pointer flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              task.priority === "P1"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {task.priority}
                          </span>
                          {task.course && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              {task.course}
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground">{task.due}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Link href="/tasks" className="block">
                    <Button variant="ghost" size="sm" className="w-full text-muted-foreground">
                      View all tasks
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>

            {/* Upcoming Deadlines */}
            <motion.div variants={item}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Upcoming Deadlines
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { title: "COMP372 Final Project", due: "Apr 10", daysLeft: 8 },
                      { title: "Portfolio redesign", due: "Apr 15", daysLeft: 13 },
                      { title: "Fitness goal checkpoint", due: "Apr 20", daysLeft: 18 },
                    ].map((deadline, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-accent/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              deadline.daysLeft <= 7
                                ? "bg-destructive"
                                : deadline.daysLeft <= 14
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                          />
                          <span className="text-sm">{deadline.title}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{deadline.due}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Productivity Stats */}
            <motion.div variants={item}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    This Week
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-primary">12</p>
                      <p className="text-xs text-muted-foreground mt-1">Tasks Done</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-emerald-500">85%</p>
                      <p className="text-xs text-muted-foreground mt-1">Habits</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-amber-500">4</p>
                      <p className="text-xs text-muted-foreground mt-1">Workouts</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Right column - 1/3 width */}
          <div className="space-y-4 lg:space-y-6">
            {/* Habit Check-in */}
            <motion.div variants={item}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Flame className="h-4 w-4 text-amber-500" />
                    Daily Habits
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { name: "Workout", streak: 14, done: true },
                    { name: "Read 30min", streak: 7, done: true },
                    { name: "Meditate", streak: 3, done: false },
                    { name: "No junk food", streak: 21, done: false },
                    { name: "Code 1hr", streak: 30, done: true },
                  ].map((habit, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`h-5 w-5 rounded-md border-2 flex items-center justify-center text-[10px] cursor-pointer transition-colors ${
                            habit.done
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border hover:border-primary"
                          }`}
                        >
                          {habit.done && "✓"}
                        </div>
                        <span className="text-sm">{habit.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Flame className="h-3 w-3 text-amber-500" />
                        {habit.streak}
                      </span>
                    </div>
                  ))}
                  <div className="pt-2">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">Today&apos;s progress</span>
                      <span className="font-medium">3/5</span>
                    </div>
                    <Progress value={60} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Focus Timer */}
            <motion.div variants={item}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Timer className="h-4 w-4 text-primary" />
                    Focus Timer
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="text-4xl font-mono font-bold tracking-wider mb-4">25:00</div>
                  <div className="flex gap-2 justify-center">
                    <Button size="sm" className="gap-1.5">Start Focus</Button>
                    <Button size="sm" variant="outline">Reset</Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    1h 30m focused today
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* AI Assistant Quick Access */}
            <motion.div variants={item}>
              <Link href="/assistant">
                <Card className="hover:border-primary/30 hover:shadow-[var(--shadow-accent)] transition-all cursor-pointer">
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl accent-bg flex items-center justify-center flex-shrink-0">
                        <Bot className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Ask AI Assistant</p>
                        <p className="text-xs text-muted-foreground">
                          &quot;What should I focus on?&quot;
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
