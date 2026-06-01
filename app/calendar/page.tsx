"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  BookOpen,
  GraduationCap,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface CalEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD (inclusive), for multi-day events
  time?: string; // HH:MM
  type: "exam-period" | "deadline" | "course";
  course?: string;
  color: string; // tailwind bg class
  textColor: string;
  borderColor: string;
}

const EVENTS: CalEvent[] = [
  {
    id: "exam-period",
    title: "Final Exam Period",
    date: "2026-04-09",
    endDate: "2026-04-22",
    type: "exam-period",
    color: "bg-violet-500/15",
    textColor: "text-violet-600 dark:text-violet-400",
    borderColor: "border-violet-500",
  },
  {
    id: "inspire-final",
    title: "INSPIRE 1PL3 Final Assignment",
    date: "2026-04-13",
    time: "23:59",
    type: "deadline",
    course: "INSPIRE 1PL3",
    color: "bg-rose-500/15",
    textColor: "text-rose-600 dark:text-rose-400",
    borderColor: "border-rose-500",
  },
  {
    id: "compsci-final",
    title: "COMPSCI 4EN3 Final Project",
    date: "2026-04-15",
    time: "23:59",
    type: "deadline",
    course: "COMPSCI 4EN3",
    color: "bg-amber-500/15",
    textColor: "text-amber-600 dark:text-amber-400",
    borderColor: "border-amber-500",
  },
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toYMD(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseYMD(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isBetween(ymd: string, start: string, end: string) {
  return ymd >= start && ymd <= end;
}

export default function CalendarPage() {
  const today = "2026-04-13";
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(3); // 0-indexed: 3 = April

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Build grid cells (always 6 rows × 7 cols = 42 cells)
  const cells = useMemo(() => {
    const arr: { ymd: string; inMonth: boolean }[] = [];
    for (let i = 0; i < firstDay; i++) {
      const d = daysInPrevMonth - firstDay + 1 + i;
      const prevM = month - 1 < 0 ? 11 : month - 1;
      const prevY = month - 1 < 0 ? year - 1 : year;
      arr.push({ ymd: toYMD(prevY, prevM, d), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push({ ymd: toYMD(year, month, d), inMonth: true });
    }
    const remaining = 42 - arr.length;
    for (let d = 1; d <= remaining; d++) {
      const nextM = month + 1 > 11 ? 0 : month + 1;
      const nextY = month + 1 > 11 ? year + 1 : year;
      arr.push({ ymd: toYMD(nextY, nextM, d), inMonth: false });
    }
    return arr;
  }, [year, month, firstDay, daysInMonth, daysInPrevMonth]);

  function getEventsForDay(ymd: string): CalEvent[] {
    return EVENTS.filter((e) => {
      if (e.endDate) return isBetween(ymd, e.date, e.endDate);
      return e.date === ymd;
    });
  }

  function isMultiDayStart(e: CalEvent, ymd: string) {
    return !!e.endDate && e.date === ymd;
  }

  function isMultiDayEnd(e: CalEvent, ymd: string) {
    return !!e.endDate && e.endDate === ymd;
  }

  function isMultiDayMiddle(e: CalEvent, ymd: string) {
    return !!e.endDate && ymd > e.date && ymd < e.endDate;
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const upcomingEvents = useMemo(() => {
    return EVENTS
      .filter((e) => e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, []);

  function formatEventDate(e: CalEvent) {
    const d = parseYMD(e.date);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (e.endDate) {
      const d2 = parseYMD(e.endDate);
      return `${label} – ${d2.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    }
    return e.time ? `${label} at ${e.time}` : label;
  }

  function daysUntil(ymd: string) {
    const now = parseYMD(today);
    const target = parseYMD(ymd);
    const diff = Math.round((target.getTime() - now.getTime()) / 86400000);
    if (diff < 0) return "Overdue";
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return `In ${diff} days`;
  }

  const urgencyBadge = (ymd: string) => {
    const d = parseYMD(today);
    const t = parseYMD(ymd);
    const diff = Math.round((t.getTime() - d.getTime()) / 86400000);
    if (diff <= 0) return "bg-rose-500/15 text-rose-600 dark:text-rose-400";
    if (diff <= 3) return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
    return "bg-muted text-muted-foreground";
  };

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
              <Calendar style={{ height: "18px", width: "18px" }} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Synced from Google Calendar
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-6">
          {/* Calendar Grid */}
          <div className="flex-1 min-w-0">
            <Card>
              <CardContent className="p-4 sm:p-6">
                {/* Month nav */}
                <div className="flex items-center justify-between mb-5">
                  <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <AnimatePresence mode="wait">
                    <motion.h2
                      key={`${year}-${month}`}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.18 }}
                      className="text-base font-semibold"
                    >
                      {MONTH_NAMES[month]} {year}
                    </motion.h2>
                  </AnimatePresence>
                  <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 mb-1">
                  {DAY_NAMES.map((d) => (
                    <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground py-1">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Cells */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${year}-${month}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden"
                  >
                    {cells.map(({ ymd, inMonth }) => {
                      const isToday = ymd === today;
                      const dayEvents = getEventsForDay(ymd);
                      const dayNum = parseInt(ymd.split("-")[2], 10);

                      return (
                        <div
                          key={ymd}
                          className={`bg-card min-h-[72px] p-1.5 flex flex-col gap-0.5 ${
                            !inMonth ? "opacity-30" : ""
                          }`}
                        >
                          {/* Day number */}
                          <div className="flex justify-center mb-0.5">
                            <span
                              className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full transition-colors ${
                                isToday
                                  ? "bg-primary text-white font-bold"
                                  : "text-foreground"
                              }`}
                            >
                              {dayNum}
                            </span>
                          </div>

                          {/* Events */}
                          <div className="flex flex-col gap-0.5 overflow-hidden">
                            {dayEvents.map((e) => {
                              const isStart = !e.endDate || isMultiDayStart(e, ymd);
                              const isEnd = !e.endDate || isMultiDayEnd(e, ymd);
                              const isMiddle = isMultiDayMiddle(e, ymd);

                              return (
                                <div
                                  key={e.id}
                                  className={`text-[10px] font-medium px-1 py-0.5 leading-tight ${e.color} ${e.textColor} ${
                                    isMiddle
                                      ? "rounded-none -mx-px px-0.5"
                                      : isStart && e.endDate
                                      ? "rounded-l-sm rounded-r-none -mr-px"
                                      : isEnd && e.endDate
                                      ? "rounded-r-sm rounded-l-none -ml-px"
                                      : "rounded-sm"
                                  } truncate`}
                                >
                                  {(isStart || !e.endDate) ? (
                                    e.time ? `${e.time} ${e.title}` : e.title
                                  ) : (
                                    <span className="opacity-0 select-none">·</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-border">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-violet-500/30 inline-block" />
                    <span className="text-[11px] text-muted-foreground">Final Exam Period</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-rose-500/30 inline-block" />
                    <span className="text-[11px] text-muted-foreground">INSPIRE 1PL3</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-amber-500/30 inline-block" />
                    <span className="text-[11px] text-muted-foreground">COMPSCI 4EN3</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-primary inline-block" />
                    <span className="text-[11px] text-muted-foreground">Today</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar — Upcoming */}
          <div className="xl:w-72 flex flex-col gap-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-primary" />
                  Upcoming Deadlines
                </h3>
                {upcomingEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No upcoming events</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {upcomingEvents.map((e, i) => (
                      <motion.div
                        key={e.id}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06, duration: 0.22 }}
                        className={`rounded-xl p-3 border-l-4 ${e.borderColor} ${e.color}`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold leading-snug ${e.textColor}`}>
                              {e.title}
                            </p>
                            <div className="flex items-center gap-1 mt-1">
                              <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground">
                                {formatEventDate(e)}
                              </span>
                            </div>
                            {e.course && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <BookOpen className="h-2.5 w-2.5 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground">{e.course}</span>
                              </div>
                            )}
                          </div>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${urgencyBadge(e.date)}`}>
                            {daysUntil(e.date)}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* This Month at a Glance */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  This Month
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Exam Period</span>
                    <span className="text-xs font-semibold">Apr 9 – 22</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Deadlines</span>
                    <span className="text-xs font-semibold">2 remaining</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Next: </span>
                    <span className="text-xs font-semibold text-rose-500">INSPIRE 1PL3 — today</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
