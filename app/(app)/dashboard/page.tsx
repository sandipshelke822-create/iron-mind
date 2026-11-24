"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useTranslation } from "@/lib/translations"
import { Button } from "@/components/ui/button"
import {
  Card,
} from "@/components/ui/card"
import {
  Target,
  Flame,
  ShieldAlert,
  ArrowRight,
  Calendar,
  Clock,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Crosshair,
} from "lucide-react"
import { cn, calculateWorkingMondaysLeft } from "@/lib/utils"

interface Goal {
  id: string
  user_id: string
  title: string
  why: string
  why_image_url?: string | null
  sacrifice_cost?: string | null
  stop_doing_list?: string | null
  decision_deadline?: string | null
  routine?: {
    wake_up_time?: string | null
    sleep_time?: string | null
  } | null
  deadline: string
  daily_hours: number
  current_level: string
  created_at: string
}

interface DailyReport {
  id: string
  user_id: string
  date: string
  ai_score: number | null
  ai_verdict: string | null
  directive_tomorrow: string | null
  created_at: string
}

function calculateDaysRemaining(
  deadlineStr: string,
  t: (key: string) => string
): { days: number; text: string } {
  try {
    const parts = deadlineStr.split("T")[0].split("-")
    if (parts.length !== 3) {
      return { days: 0, text: t("DEADLINE PENDING") }
    }
    const [year, month, day] = parts.map(Number)
    const targetDate = new Date(year, month - 1, day)

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const diffMs = targetDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays > 1) {
      return { days: diffDays, text: `${diffDays} ${t("DAYS REMAINING")}` }
    } else if (diffDays === 1) {
      return { days: 1, text: `1 ${t("DAY REMAINING")}` }
    } else if (diffDays === 0) {
      return { days: 0, text: t("DEADLINE IS TODAY") }
    } else {
      return { days: diffDays, text: `${Math.abs(diffDays)} ${t("DAYS OVERDUE")}` }
    }
  } catch {
    return { days: 0, text: t("DEADLINE PENDING") }
  }
}

function calculateTimeWatch(
  createdAtStr: string,
  streak: number
): { totalDays: number; daysWasted: number; daysWon: number } {
  try {
    const createdDate = new Date(createdAtStr)
    const now = new Date()
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const createdMidnight = new Date(
      createdDate.getFullYear(),
      createdDate.getMonth(),
      createdDate.getDate()
    ).getTime()
    const msPerDay = 1000 * 60 * 60 * 24
    const totalDays = Math.max(0, Math.floor((todayMidnight - createdMidnight) / msPerDay))
    const daysWon = streak
    const daysWasted = Math.max(0, totalDays - daysWon)
    return { totalDays, daysWasted, daysWon }
  } catch {
    return { totalDays: 0, daysWasted: 0, daysWon: streak }
  }
}

function formatDisplayDate(dateStr: string): string {
  try {
    const parts = dateStr.split("T")[0].split("-")
    if (parts.length === 3) {
      const [year, month, day] = parts.map(Number)
      const d = new Date(year, month - 1, day)
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).toUpperCase()
    }
    return dateStr.toUpperCase()
  } catch {
    return dateStr.toUpperCase()
  }
}

function calculateStreak(reports: DailyReport[]): number {
  if (!reports || reports.length === 0) return 0

  // Deduplicate dates in YYYY-MM-DD
  const uniqueDates = Array.from(
    new Set(
      reports
        .map((r) => r.date?.split("T")[0])
        .filter((d): d is string => Boolean(d))
    )
  ).sort().reverse() // descending order: newest first

  if (uniqueDates.length === 0) return 0

  const parseLocalDate = (str: string) => {
    const [y, m, d] = str.split("-").map(Number)
    return new Date(y, m - 1, d)
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const latestDate = parseLocalDate(uniqueDates[0])

  // Difference in calendar days from today
  const diffDays = Math.round((today.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24))

  // If latest report is older than yesterday (> 1 day gap), the unbroken streak is broken
  if (diffDays > 1) {
    return 0
  }

  // Count consecutive dates starting with the latest report
  let streak = 1
  let prevDate = latestDate

  for (let i = 1; i < uniqueDates.length; i++) {
    const currDate = parseLocalDate(uniqueDates[i])
    const dayGap = Math.round((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24))
    if (dayGap === 1) {
      streak++
      prevDate = currDate
    } else {
      break
    }
  }

  return streak
}

export default function DashboardPage() {
  const router = useRouter()
  const { t } = useTranslation()

  const [isLoading, setIsLoading] = React.useState<boolean>(true)
  const [error, setError] = React.useState<string | null>(null)

  const [goal, setGoal] = React.useState<Goal | null>(null)
  const [streak, setStreak] = React.useState<number>(0)
  const [latestReport, setLatestReport] = React.useState<DailyReport | null>(null)
  const [birthDate, setBirthDate] = React.useState<string | null>(null)

  const loadDashboardData = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Fetch user
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser()

      if (authErr || !user) {
        setError("User session not found. Please log in first.")
        setIsLoading(false)
        return
      }

      // 1. Fetch user's most recent active goal
      const { data: goalData, error: goalErr } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (goalErr) {
        throw new Error(`Failed to load combat objective: ${goalErr.message}`)
      }

      if (!goalData) {
        setGoal(null)
        setIsLoading(false)
        return
      }

      const activeGoal = goalData as Goal
      setGoal(activeGoal)

      // 2. Fetch user's birth_date from profiles
      const { data: profileData } = await supabase
        .from("profiles")
        .select("birth_date")
        .eq("id", user.id)
        .maybeSingle()

      if (profileData?.birth_date) {
        setBirthDate(profileData.birth_date)
      } else {
        setBirthDate(null)
      }

      // 3. Fetch daily reports to compute streak & get most recent verdict
      const { data: reportsData, error: reportsErr } = await supabase
        .from("daily_reports")
        .select("id, user_id, date, ai_score, ai_verdict, directive_tomorrow, created_at")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(30)

      if (reportsErr) {
        throw new Error(`Failed to retrieve combat logs: ${reportsErr.message}`)
      }

      const reports = (reportsData || []) as DailyReport[]

      // Calculate streak
      const calculatedStreak = calculateStreak(reports)
      setStreak(calculatedStreak)

      // Most recent daily report (first item from descending query)
      if (reports.length > 0) {
        setLatestReport(reports[0])
      } else {
        setLatestReport(null)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected failure occurred."
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // =========================================================================
  // 1. LOADING STATE
  // =========================================================================
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] flex items-center justify-center px-4 selection:bg-[#8B0000] selection:text-[#f5f5f5]">
        <div className="w-full max-w-md bg-[#111111] border border-[#262626] rounded-xl p-8 text-center space-y-6 shadow-2xl">
          <div className="flex justify-center">
            <div className="size-16 rounded-full bg-[#1a1a1a] border border-[#8B0000]/60 flex items-center justify-center">
              <Loader2 className="size-8 text-[#8B0000] animate-spin" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs uppercase font-mono tracking-widest font-bold text-[#8B0000]">
              {t("Headquarters Uplink")}
            </div>
            <h2 className="text-xl font-bold uppercase tracking-tight text-[#f5f5f5]">
              {t("Loading Combat Dashboard")}
            </h2>
            <p className="text-xs text-[#a3a3a3] font-mono leading-relaxed">
              {t("Verifying credentials and analyzing tactical history...")}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // 2. ERROR STATE
  // =========================================================================
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] flex items-center justify-center px-4 py-12 selection:bg-[#8B0000] selection:text-[#f5f5f5]">
        <div className="w-full max-w-lg bg-[#111111] border border-[#8B0000]/60 rounded-xl p-8 space-y-6 shadow-2xl">
          <div className="flex items-center gap-3 text-[#8B0000]">
            <AlertTriangle className="size-6 shrink-0" />
            <h1 className="text-lg font-bold uppercase tracking-wider">
              {t("Telemetry Error")}
            </h1>
          </div>
          <p className="text-sm text-[#a3a3a3] font-mono leading-relaxed">
            {error}
          </p>
          <Button
            onClick={() => loadDashboardData()}
            className="w-full h-11 bg-[#8B0000] hover:bg-[#6e0000] text-[#f5f5f5] font-bold uppercase tracking-wider transition-colors cursor-pointer border border-[#8B0000] flex items-center justify-center gap-2"
          >
            <RefreshCw className="size-4" />
            {t("Retry Connection")}
          </Button>
        </div>
      </div>
    )
  }

  // =========================================================================
  // 3. NO GOALS STATE (Centered CTA)
  // =========================================================================
  if (!goal) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] flex items-center justify-center px-4 py-12 selection:bg-[#8B0000] selection:text-[#f5f5f5]">
        <div className="w-full max-w-lg bg-[#111111] border border-[#262626] rounded-xl p-8 sm:p-10 space-y-6 text-center shadow-2xl">
          <div className="flex justify-center">
            <div className="size-16 rounded-full bg-[#1a1a1a] border border-[#8B0000]/60 flex items-center justify-center text-[#8B0000]">
              <Target className="size-8" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs uppercase font-mono tracking-widest font-bold text-[#8B0000]">
              {t("Mission Directive")}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#f5f5f5]">
              {t("No active mission. Forge your first goal.")}
            </h1>
            <p className="text-sm text-[#a3a3a3] font-mono leading-relaxed">
              {t(
                "Without a clear, uncompromising target, discipline has no direction. Commit your objective and establish your wartime standard."
              )}
            </p>
          </div>

          <div className="pt-2">
            <Button
              onClick={() => router.push("/goal/new")}
              className="w-full h-12 bg-[#8B0000] hover:bg-[#6e0000] text-[#f5f5f5] font-bold uppercase tracking-wider text-sm transition-colors border border-[#8B0000] cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{t("Forge Your First Goal")}</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // 4. ACTIVE GOAL DASHBOARD
  // =========================================================================
  const deadlineInfo = calculateDaysRemaining(goal.deadline, t)
  const timeWatch = calculateTimeWatch(goal.created_at, streak)
  const mondaysLeft = calculateWorkingMondaysLeft(birthDate)
  const lastScore = latestReport?.ai_score ?? null
  const directiveText =
    latestReport?.directive_tomorrow?.trim() ||
    "Execute today's mission with uncompromising discipline. The standard does not bend."

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] selection:bg-[#8B0000] selection:text-[#f5f5f5] py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* 1. THE WHY CARD - VERY FIRST THING AT THE TOP */}
        <div className="border-2 border-[#8B0000] bg-[#111111] rounded-xl p-6 sm:p-8 space-y-5 shadow-2xl shadow-[#8B0000]/15 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#262626] pb-3">
            <div className="flex items-center gap-2">
              <Flame className="size-5 text-[#8B0000]" />
              <span className="text-xs font-mono font-bold tracking-widest text-[#8B0000] uppercase">
                {t("THE WHY // CORE PURPOSE")}
              </span>
            </div>
            <span className="text-[11px] font-mono text-[#a3a3a3] uppercase tracking-wider hidden sm:block">
              {t("Non-Negotiable North Star")}
            </span>
          </div>

          <div className={cn("grid gap-6 items-center", goal.why_image_url ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1")}>
            <div className={cn("space-y-4", goal.why_image_url ? "md:col-span-2" : "w-full")}>
              <div className="text-xs font-mono uppercase tracking-wider text-[#a3a3a3]">
                {t("The Uncompromising Reason You Fight:")}
              </div>
              <blockquote className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-[#f5f5f5] leading-snug break-words italic">
                &ldquo;{goal.why}&rdquo;
              </blockquote>

              {(goal.sacrifice_cost || goal.stop_doing_list) && (
                <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-[#1f1f1f]">
                  {goal.sacrifice_cost && (
                    <div className="text-xs font-mono">
                      <span className="text-[#8B0000] font-bold uppercase block tracking-wider mb-0.5">
                        {t("SACRIFICE REQUIRED")}
                      </span>
                      <span className="text-[#f5f5f5]">{goal.sacrifice_cost}</span>
                    </div>
                  )}
                  {goal.stop_doing_list && (
                    <div className="text-xs font-mono">
                      <span className="text-[#8B0000] font-bold uppercase block tracking-wider mb-0.5">
                        {t("PURGED VICES")}
                      </span>
                      <span className="text-[#a3a3a3]">{goal.stop_doing_list}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {goal.why_image_url && (
              <div className="md:col-span-1 relative rounded-lg overflow-hidden border border-[#8B0000]/60 bg-[#1a1a1a] shadow-xl group">
                <img
                  src={goal.why_image_url}
                  alt="The Why Visual Anchor"
                  className="w-full h-48 sm:h-60 object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    // Hide image element on broken link
                    e.currentTarget.style.display = "none"
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-2 left-2 text-[10px] font-mono tracking-widest uppercase text-[#f5f5f5] bg-black/80 px-2 py-0.5 rounded border border-[#262626]">
                  {t("Visual Anchor")}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. TIME WATCH WIDGET */}
        <div className="bg-[#111111] border border-[#262626] rounded-xl p-6 sm:p-8 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#262626] pb-3">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-[#8B0000]" />
              <span className="text-xs font-mono font-bold tracking-widest text-[#8B0000] uppercase">
                {t("TIME WATCH")}
              </span>
            </div>
            <span className="text-xs font-mono text-[#a3a3a3] uppercase tracking-wider">
              {t("CAMPAIGN DURATION")}: {timeWatch.totalDays} {timeWatch.totalDays === 1 ? t("DAY") : t("DAYS")}
            </span>
          </div>

          <div className="p-5 sm:p-7 rounded-lg bg-[#1a1a1a] border border-[#262626] text-center space-y-3">
            <div className="text-xs font-mono font-bold uppercase tracking-widest text-[#a3a3a3]">
              {t("TEMPORAL ACCOUNTABILITY")}
            </div>
            <div className="text-3xl sm:text-5xl md:text-6xl font-black font-mono tracking-tight text-[#f5f5f5]">
              DAYS WASTED: <span className="text-[#8B0000]">{timeWatch.daysWasted}</span> | DAYS WON: <span className="text-[#f5f5f5]">{timeWatch.daysWon}</span>
            </div>
            <p className="text-xs font-mono text-[#a3a3a3] uppercase tracking-wider">
              {timeWatch.daysWasted > 0
                ? `${timeWatch.daysWasted} days lost to hesitation or inaction. Days won = current streak (${timeWatch.daysWon}).`
                : `Zero days wasted. Unbroken execution since campaign initiation.`}
            </p>
          </div>
        </div>

        {/* 2b. WORKING MONDAYS LEFT WIDGET (BELOW TIME WATCH) */}
        <div className="bg-[#111111] border border-[#262626] rounded-xl px-6 py-4 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <Calendar className="size-4 text-[#8B0000]" />
            <div className="text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-[#f5f5f5]">
              WORKING MONDAYS LEFT:{" "}
              <span className="text-[#8B0000] font-black text-sm sm:text-base">
                {mondaysLeft !== null ? mondaysLeft.toLocaleString() : "--"}
              </span>
            </div>
          </div>
          {mondaysLeft === null ? (
            <Link
              href="/profile"
              className="text-xs font-mono uppercase tracking-wider text-[#a3a3a3] hover:text-[#f5f5f5] flex items-center gap-1 transition-colors"
            >
              <span>Set in profile</span>
              <ArrowRight className="size-3.5" />
            </Link>
          ) : (
            <span className="text-[11px] font-mono text-[#a3a3a3] uppercase tracking-wider hidden sm:inline">
              Age 60 Threshold
            </span>
          )}
        </div>

        {/* 3. ACTIVE GOAL TITLE & DEADLINE */}
        <div className="bg-[#111111] border border-[#262626] rounded-xl p-6 sm:p-8 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#262626] pb-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#8B0000]/60 bg-[#8B0000]/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#8B0000]">
              <Crosshair className="size-3.5" />
              {t("Active Combat Objective")}
            </div>
            <div className="text-xs font-mono text-[#a3a3a3] uppercase tracking-wider hidden sm:block">
              {t("Daily Target")}: {goal.daily_hours}h
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-[#f5f5f5] leading-tight break-words">
              {goal.title}
            </h1>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-[#a3a3a3] bg-[#1a1a1a] border border-[#262626] px-3 py-1.5 rounded-md">
                <Calendar className="size-3.5 text-[#8B0000]" />
                <span>{t("DEADLINE")}: {formatDisplayDate(goal.deadline)}</span>
              </div>

              <div
                className={cn(
                  "inline-flex items-center gap-2 text-xs font-mono font-bold px-3 py-1.5 rounded-md border",
                  deadlineInfo.days <= 3
                    ? "bg-[#8B0000]/20 border-[#8B0000] text-red-400"
                    : "bg-[#1a1a1a] border-[#262626] text-[#f5f5f5]"
                )}
              >
                <Clock className="size-3.5 text-[#8B0000]" />
                <span>{deadlineInfo.text}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. TWO LARGE METRIC CARDS SIDE-BY-SIDE */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* CARD 1: DAYS UNBROKEN */}
          <Card className="bg-[#111111] border-[#262626] rounded-xl p-6 relative overflow-hidden flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono font-bold tracking-widest text-[#a3a3a3] uppercase">
                  {t("DAYS UNBROKEN")}
                </span>
                <div className="size-9 rounded-lg bg-[#1a1a1a] border border-[#262626] flex items-center justify-center text-[#8B0000]">
                  <Flame className="size-5" />
                </div>
              </div>

              <div className="text-6xl sm:text-7xl font-black font-mono tracking-tighter text-[#f5f5f5] my-2">
                {streak}
              </div>
            </div>

            <div className="pt-4 border-t border-[#1f1f1f] mt-4">
              <p className="text-xs font-mono text-[#a3a3a3] uppercase tracking-wider">
                {streak === 0
                  ? t("Streak at zero. Log today's mission to ignite.")
                  : streak === 1
                  ? `1 ${t("consecutive day logged without failure.")}`
                  : `${streak} ${t("consecutive days logged without failure.")}`}
              </p>
            </div>
          </Card>

          {/* CARD 2: LAST VERDICT SCORE */}
          <Card className="bg-[#111111] border-[#262626] rounded-xl p-6 relative overflow-hidden flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono font-bold tracking-widest text-[#a3a3a3] uppercase">
                  {t("LAST VERDICT SCORE")}
                </span>
                <div className="size-9 rounded-lg bg-[#1a1a1a] border border-[#262626] flex items-center justify-center text-[#8B0000]">
                  <Target className="size-5" />
                </div>
              </div>

              <div
                className={cn(
                  "text-6xl sm:text-7xl font-black font-mono tracking-tighter my-2",
                  lastScore !== null
                    ? lastScore < 5
                      ? "text-[#8B0000]"
                      : "text-[#f5f5f5]"
                    : "text-[#a3a3a3]"
                )}
              >
                {lastScore !== null ? `${lastScore}/10` : "--/10"}
              </div>
            </div>

            <div className="pt-4 border-t border-[#1f1f1f] mt-4">
              <p className="text-xs font-mono text-[#a3a3a3] uppercase tracking-wider">
                {lastScore !== null
                  ? lastScore < 5
                    ? t("Substandard performance. Correct course immediately.")
                    : t("Standard satisfied. Maintain momentum.")
                  : t("No prior verdict logged. Mission pending.")}
              </p>
            </div>
          </Card>

        </div>

        {/* 5. TODAY'S DIRECTIVE (HEAVY RED-BORDERED BOX) */}
        <div className="border-2 border-[#8B0000] bg-[#111111] rounded-xl p-6 sm:p-8 space-y-4 shadow-xl shadow-[#8B0000]/10">
          <div className="flex items-center justify-between border-b border-[#262626] pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-[#8B0000]" />
              <span className="text-xs font-mono font-bold tracking-widest text-[#8B0000] uppercase">
                {t("TODAY'S DIRECTIVE")}
              </span>
            </div>
            {latestReport?.date && (
              <span className="text-xs font-mono text-[#a3a3a3] uppercase tracking-wider">
                {t("From Verdict")}: {formatDisplayDate(latestReport.date)}
              </span>
            )}
          </div>

          <blockquote className="text-lg sm:text-2xl font-bold tracking-wide text-[#f5f5f5] leading-relaxed font-sans">
            &ldquo;{directiveText}&rdquo;
          </blockquote>

          <div className="text-[11px] font-mono uppercase tracking-wider text-[#a3a3a3]/70 pt-1">
            {t("Non-negotiable operational order. Carry out without deviation.")}
          </div>
        </div>

        {/* 6. ACTION BUTTON: ENTER TODAY'S MISSION */}
        <div className="pt-2">
          <Button
            size="lg"
            onClick={() => router.push("/today")}
            className="w-full h-14 bg-[#8B0000] hover:bg-[#6e0000] text-[#f5f5f5] font-bold text-base uppercase tracking-widest transition-all cursor-pointer border border-[#8B0000] shadow-xl shadow-[#8B0000]/20 flex items-center justify-center gap-2"
          >
            <span>{t("Enter Today's Mission")}</span>
            <ArrowRight className="size-5" />
          </Button>
        </div>

      </div>
    </div>
  )
}
