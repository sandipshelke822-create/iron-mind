"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  ShieldAlert,
  Clock,
  Target,
  ArrowRight,
  Flame,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertCircle,
  Crosshair,
  Award,
} from "lucide-react"

export type PlanBlockType = "deep_work" | "revision" | "test" | "rest" | string

export interface PlanBlock {
  start: string
  end: string
  task: string
  type: PlanBlockType
}

export interface Day1Plan {
  blocks: PlanBlock[]
  non_negotiable: string
}

export interface WarPlan {
  id?: string
  assessment?: string
  weekly_milestones?: Array<{
    week: number
    focus: string
    measurable_outcome: string
  }>
  day_1_plan?: Day1Plan
  warrior_note?: string
}

export interface Goal {
  id: string
  user_id: string
  title: string
  why: string
  deadline: string
  daily_hours: number
  current_level: string
  created_at: string
}

export interface DailyVerdictData {
  id?: string
  verdict: string
  score: number
  excuse_detected: string | null
  directive_tomorrow: string
  date?: string
}

function formatBlockType(type: string): string {
  switch (type.toLowerCase()) {
    case "deep_work":
      return "DEEP WORK"
    case "revision":
      return "REVISION"
    case "test":
      return "TEST DRILL"
    case "rest":
      return "RECOVERY"
    default:
      return type.toUpperCase().replace("_", " ")
  }
}

export default function TodayMissionPage() {
  const router = useRouter()

  // Data fetching state
  const [isLoading, setIsLoading] = React.useState<boolean>(true)
  const [loadingStatus, setLoadingStatus] = React.useState<string>(
    "Establishing uplink with combat headquarters..."
  )
  const [initError, setInitError] = React.useState<string | null>(null)

  // Active records
  const [goal, setGoal] = React.useState<Goal | null>(null)
  const [warPlan, setWarPlan] = React.useState<WarPlan | null>(null)
  const [tasks, setTasks] = React.useState<PlanBlock[]>([])
  const [nonNegotiable, setNonNegotiable] = React.useState<string>("")

  // Form submission state
  const [completedIndices, setCompletedIndices] = React.useState<Set<number>>(
    new Set()
  )
  const [hoursWorked, setHoursWorked] = React.useState<string>("")
  const [userNote, setUserNote] = React.useState<string>("")
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  // Verdict state (null = Form Mode, DailyVerdictData = Verdict Mode)
  const [verdictData, setVerdictData] = React.useState<DailyVerdictData | null>(
    null
  )

  const loadData = React.useCallback(async () => {
    setIsLoading(true)
    setInitError(null)
    setLoadingStatus("Verifying active target credentials...")

    try {
      const supabase = createClient()

      // 1. Authenticate user
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser()

      if (authErr || !user) {
        setInitError("Authentication session expired. Please log in to view today's orders.")
        setIsLoading(false)
        return
      }

      // 2. Fetch the user's latest active goal
      setLoadingStatus("Retrieving active combat objective...")
      const { data: goalData, error: goalErr } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (goalErr) {
        setInitError(`Failed to fetch active objective: ${goalErr.message}`)
        setIsLoading(false)
        return
      }

      if (!goalData) {
        setGoal(null)
        setIsLoading(false)
        return
      }

      const activeGoal = goalData as Goal
      setGoal(activeGoal)
      setHoursWorked(String(activeGoal.daily_hours || 4))

      // 3. Check if user already submitted a verdict today
      const todayDateStr = new Date().toISOString().split("T")[0]
      const { data: existingReport, error: reportErr } = await supabase
        .from("daily_reports")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", todayDateStr)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!reportErr && existingReport && existingReport.ai_verdict) {
        setVerdictData({
          id: existingReport.id,
          verdict: existingReport.ai_verdict,
          score: existingReport.ai_score,
          excuse_detected: null,
          directive_tomorrow: existingReport.directive_tomorrow || "Execute at dawn.",
          date: existingReport.date,
        })
        setIsLoading(false)
        return
      }

      // 4. Fetch the latest battle plan for this goal
      setLoadingStatus("Loading Day 1 tactical schedule...")
      const { data: planData, error: planErr } = await supabase
        .from("battle_plans")
        .select("*")
        .eq("goal_id", activeGoal.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (planErr) {
        setInitError(`Failed to retrieve battle plan: ${planErr.message}`)
        setIsLoading(false)
        return
      }

      if (!planData || !planData.milestones) {
        setWarPlan(null)
        setIsLoading(false)
        return
      }

      let parsedMilestones: WarPlan
      if (typeof planData.milestones === "string") {
        parsedMilestones = JSON.parse(planData.milestones) as WarPlan
      } else {
        parsedMilestones = planData.milestones as WarPlan
      }

      setWarPlan(parsedMilestones)

      const blocks = parsedMilestones.day_1_plan?.blocks || []
      setTasks(blocks)
      setNonNegotiable(parsedMilestones.day_1_plan?.non_negotiable || "")

      setIsLoading(false)
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "An unexpected telemetry disruption occurred."
      setInitError(message)
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  // Checklist toggle helper
  const handleToggleTask = (index: number) => {
    setCompletedIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  // Handle report submission
  const handleSubmitReport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitError(null)

    if (!goal) {
      setSubmitError("No active target identified. Cannot file report.")
      return
    }

    const parsedHours = parseFloat(hoursWorked)
    if (isNaN(parsedHours) || parsedHours < 0 || parsedHours > 24) {
      setSubmitError("Hours worked must be a valid number between 0 and 24.")
      return
    }

    if (!userNote.trim()) {
      setSubmitError(
        "You must submit an honest daily combat note. Silence is evasion."
      )
      return
    }

    setIsSubmitting(true)

    try {
      const plannedTasksPayload = tasks.map((t) => ({
        start: t.start,
        end: t.end,
        task: t.task,
        type: t.type,
      }))

      const completedTasksPayload = tasks
        .filter((_, idx) => completedIndices.has(idx))
        .map((t) => ({
          start: t.start,
          end: t.end,
          task: t.task,
          type: t.type,
          completed: true,
        }))

      const res = await fetch("/api/daily-verdict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          goalId: goal.id,
          plannedTasks: plannedTasksPayload,
          completedTasks: completedTasksPayload,
          hoursWorked: parsedHours,
          userNote: userNote.trim(),
        }),
      })

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}))
        throw new Error(
          errorJson.error ||
          `Failed to generate AI verdict (HTTP ${res.status}).`
        )
      }

      const verdictResult: DailyVerdictData = await res.json()
      setVerdictData(verdictResult)
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while transmitting your report."
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // =========================================================================
  // 1. LOADING VIEW
  // =========================================================================
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] flex flex-col items-center justify-center px-4 selection:bg-[#8B0000] selection:text-[#f5f5f5]">
        <div className="w-full max-w-md bg-[#111111] border border-[#262626] rounded-xl p-8 text-center space-y-6 shadow-2xl">
          <div className="flex justify-center">
            <div className="relative flex items-center justify-center size-16 rounded-full bg-[#1a1a1a] border border-[#8B0000]/60">
              <Loader2 className="size-8 text-[#8B0000] animate-spin" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-widest font-bold text-[#8B0000]">
              Day 1 Command Post
            </div>
            <h2 className="text-xl font-bold tracking-tight text-[#f5f5f5] uppercase">
              Assembling Mission Orders
            </h2>
            <p className="text-xs text-[#a3a3a3] font-mono leading-relaxed">
              {loadingStatus}
            </p>
          </div>

          <div className="border-t border-[#262626] pt-4">
            <p className="text-[11px] text-[#a3a3a3]/70 uppercase tracking-wider">
              No excuses permitted. Stand by.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // 2. ERROR STATE
  // =========================================================================
  if (initError) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] flex items-center justify-center px-4 py-12 selection:bg-[#8B0000] selection:text-[#f5f5f5]">
        <div className="w-full max-w-lg bg-[#111111] border border-[#8B0000]/60 rounded-xl p-8 space-y-6 shadow-2xl">
          <div className="flex items-center gap-3 text-[#8B0000]">
            <AlertTriangle className="size-6 shrink-0" />
            <h1 className="text-lg font-bold uppercase tracking-wider">
              Telemetry Error
            </h1>
          </div>

          <div className="rounded-lg border border-[#8B0000]/40 bg-[#8B0000]/10 p-4 text-sm text-red-300 font-medium">
            {initError}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={() => loadData()}
              className="flex-1 h-11 bg-[#8B0000] hover:bg-[#6e0000] text-[#f5f5f5] font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              <RefreshCw className="mr-2 size-4" />
              Retry Connection
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/goal/new")}
              className="h-11 border-[#262626] bg-[#1a1a1a] text-[#f5f5f5] hover:bg-[#262626] font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Set New Objective
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // 3. NO GOAL OR NO PLAN STATE
  // =========================================================================
  if (!goal) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] flex items-center justify-center px-4 py-12 selection:bg-[#8B0000] selection:text-[#f5f5f5]">
        <div className="w-full max-w-lg bg-[#111111] border border-[#262626] rounded-xl p-8 space-y-6 text-center shadow-2xl">
          <div className="flex justify-center">
            <div className="size-14 rounded-full bg-[#1a1a1a] border border-[#262626] flex items-center justify-center text-[#8B0000]">
              <Target className="size-7" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold uppercase tracking-tight text-[#f5f5f5]">
              No Active Target Found
            </h1>
            <p className="text-sm text-[#a3a3a3]">
              You cannot wage war without a defined objective. Lock in your target
              before facing the daily evaluation.
            </p>
          </div>
          <Button
            onClick={() => router.push("/goal/new")}
            className="w-full h-11 bg-[#8B0000] hover:bg-[#6e0000] text-[#f5f5f5] font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Define Your War
          </Button>
        </div>
      </div>
    )
  }

  if (!warPlan || tasks.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] flex items-center justify-center px-4 py-12 selection:bg-[#8B0000] selection:text-[#f5f5f5]">
        <div className="w-full max-w-lg bg-[#111111] border border-[#262626] rounded-xl p-8 space-y-6 text-center shadow-2xl">
          <div className="flex justify-center">
            <div className="size-14 rounded-full bg-[#1a1a1a] border border-[#262626] flex items-center justify-center text-[#8B0000]">
              <ShieldAlert className="size-7" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold uppercase tracking-tight text-[#f5f5f5]">
              No Battle Plan Generated
            </h1>
            <p className="text-sm text-[#a3a3a3]">
              Objective exists, but no operational schedule has been forged for &ldquo;{goal.title}&rdquo;.
            </p>
          </div>
          <Button
            onClick={() => router.push(`/plan/${goal.id}`)}
            className="w-full h-11 bg-[#8B0000] hover:bg-[#6e0000] text-[#f5f5f5] font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Engineer Battle Plan
          </Button>
        </div>
      </div>
    )
  }

  // =========================================================================
  // 4. VERDICT MODE (AI Judgment Display)
  // =========================================================================
  if (verdictData) {
    const isLowScore = verdictData.score <= 4
    const isMidScore = verdictData.score >= 5 && verdictData.score <= 7
    const isHighScore = verdictData.score >= 8

    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] selection:bg-[#8B0000] selection:text-[#f5f5f5] py-12 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto space-y-10">

          {/* HEADER TAG */}
          <div className="flex items-center justify-between border-b border-[#262626] pb-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#8B0000]/60 bg-[#8B0000]/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#8B0000]">
              <Crosshair className="size-3.5" />
              Evening Combat Verdict
            </div>
            <div className="text-xs font-mono text-[#a3a3a3]">
              {verdictData.date || new Date().toISOString().split("T")[0]}
            </div>
          </div>

          {/* MAIN SCORE BANNER */}
          <div
            className={`rounded-2xl border p-6 sm:p-10 transition-all ${isLowScore
                ? "border-[#8B0000] bg-[#1a0808] shadow-2xl shadow-[#8B0000]/30"
                : isMidScore
                  ? "border-[#383838] bg-[#111111]"
                  : "border-[#262626] bg-[#121212]"
              }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
              <div className="space-y-2">
                <div
                  className={`text-xs font-black uppercase tracking-widest ${isLowScore
                      ? "text-red-400"
                      : isMidScore
                        ? "text-[#a3a3a3]"
                        : "text-emerald-400"
                    }`}
                >
                  {isLowScore
                    ? "Dereliction of Duty // Ground Surrendered"
                    : isMidScore
                      ? "Mediocre Execution // Compromises Made"
                      : "Standard Upheld // Flawless Ownership"}
                </div>
                <div className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-[#f5f5f5]">
                  Daily Combat Rating
                </div>
                <div className="text-xs text-[#a3a3a3] font-mono">
                  Objective: {goal.title}
                </div>
              </div>

              {/* Huge Score Typography */}
              <div className="flex items-baseline gap-2 shrink-0">
                <span
                  className={`text-7xl sm:text-8xl font-black tracking-tighter leading-none ${isLowScore
                      ? "text-[#8B0000]"
                      : isMidScore
                        ? "text-[#f5f5f5]"
                        : "text-white"
                    }`}
                >
                  {verdictData.score}
                </span>
                <span className="text-2xl sm:text-3xl font-extrabold text-[#a3a3a3]/70 font-mono">
                  / 10
                </span>
              </div>
            </div>

            {/* Score Ticks Progress Meter */}
            <div className="mt-8 pt-6 border-t border-[#262626]/80">
              <div className="grid grid-cols-10 gap-1.5 h-2.5 w-full">
                {Array.from({ length: 10 }).map((_, i) => {
                  const tickNum = i + 1
                  const isFilled = tickNum <= verdictData.score
                  return (
                    <div
                      key={i}
                      className={`h-full rounded-xs transition-colors ${isFilled
                          ? isLowScore
                            ? "bg-[#8B0000]"
                            : isMidScore
                              ? "bg-[#f5f5f5]"
                              : "bg-emerald-500"
                          : "bg-[#262626]"
                        }`}
                    />
                  )
                })}
              </div>
            </div>
          </div>

          {/* VERDICT TEXT (HEAVY HIT TYPOGRAPHY) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#8B0000]">
              <ShieldAlert className="size-4" />
              Unsparing Assessment
            </div>
            <div className="rounded-xl border-l-4 border-[#8B0000] bg-[#140808] border-y border-r border-[#262626] p-6 sm:p-8">
              <p className="text-xl sm:text-2xl font-bold italic tracking-tight text-[#f5f5f5] leading-relaxed">
                &ldquo;{verdictData.verdict}&rdquo;
              </p>
            </div>
          </div>

          {/* EXCUSE AUDIT */}
          {verdictData.excuse_detected ? (
            <div className="rounded-xl border border-[#8B0000] bg-[#1a0808] p-5 sm:p-6 space-y-2">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#8B0000]">
                <AlertCircle className="size-4 shrink-0" />
                Excuse Identified & Exposed
              </div>
              <p className="text-base sm:text-lg font-bold text-red-200 uppercase tracking-wide">
                {verdictData.excuse_detected}
              </p>
              <p className="text-xs text-[#a3a3a3] font-mono pt-1">
                The mind seeks comfort where duty demands war. This rationalization
                has been entered into your permanent combat record.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-[#262626] bg-[#111111] p-5 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#a3a3a3]">
                <Award className="size-4 text-emerald-500" />
                Cognitive Audit
              </div>
              <p className="text-sm font-semibold text-[#f5f5f5]">
                Zero excuses detected. Absolute ownership demonstrated.
              </p>
            </div>
          )}

          {/* DIRECTIVE FOR TOMORROW */}
          <div className="rounded-xl border-2 border-[#8B0000] bg-[#120808] p-6 sm:p-7 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#8B0000]">
                <Flame className="size-4" />
                Marching Orders for Tomorrow
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-[#8B0000] text-[#f5f5f5]">
                Non-Negotiable
              </span>
            </div>
            <p className="text-lg sm:text-xl font-extrabold text-[#f5f5f5] leading-snug">
              {verdictData.directive_tomorrow}
            </p>
          </div>

          {/* ACCEPT DIRECTIVE ACTION BUTTON */}
          <div className="pt-6 border-t border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs font-mono text-[#a3a3a3] text-center sm:text-left uppercase">
              The day is judged. Sleep with clear conscience or prepare for atonement.
            </div>
            <Button
              size="lg"
              onClick={() => router.push("/dashboard")}
              className="w-full sm:w-auto h-13 px-8 bg-[#8B0000] hover:bg-[#6e0000] text-[#f5f5f5] font-black uppercase tracking-widest text-sm transition-all shadow-xl shadow-[#8B0000]/30 cursor-pointer"
            >
              <span>Accept Directive and Rest</span>
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>

        </div>
      </div>
    )
  }

  // =========================================================================
  // 5. FORM MODE (Today's Mission & Evening Report Form)
  // =========================================================================
  const completedCount = completedIndices.size
  const totalTasks = tasks.length
  const progressPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] selection:bg-[#8B0000] selection:text-[#f5f5f5] pb-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 space-y-10">

        {/* PAGE HEADER */}
        <header className="space-y-4 border-b border-[#262626] pb-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#8B0000]/60 bg-[#8B0000]/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#8B0000]">
              <Target className="size-3.5" />
              Today&apos;s Mission
            </div>

            <div className="flex items-center gap-2 font-mono text-xs text-[#a3a3a3]">
              <span className="bg-[#1a1a1a] border border-[#262626] px-2.5 py-1 rounded">
                COMMITTED: {goal.daily_hours}H/DAY
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-[#f5f5f5]">
              {goal.title}
            </h1>
            <p className="text-xs sm:text-sm text-[#a3a3a3] font-medium leading-relaxed">
              Check off the operations you executed without compromise. Account for every hour.
            </p>
          </div>
        </header>

        {/* NON-NEGOTIABLE BANNER */}
        {nonNegotiable && (
          <div className="rounded-xl border-2 border-[#8B0000] bg-[#1a0808] p-5 space-y-1 shadow-lg">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#8B0000]">
              <Flame className="size-4 shrink-0" />
              Day 1 Non-Negotiable Directive
            </div>
            <p className="text-base sm:text-lg font-bold text-[#f5f5f5] leading-snug">
              {nonNegotiable}
            </p>
          </div>
        )}

        {/* ERROR NOTIFICATION */}
        {submitError && (
          <div className="rounded-lg border border-[#8B0000] bg-[#8B0000]/15 p-4 text-sm font-semibold text-red-300 flex items-start gap-3">
            <AlertTriangle className="size-5 shrink-0 text-[#8B0000] mt-0.5" />
            <div>
              <div className="font-bold uppercase tracking-wide">
                Submission Rejected
              </div>
              <div>{submitError}</div>
            </div>
          </div>
        )}

        {/* FORM CONTAINER */}
        <form onSubmit={handleSubmitReport} className="space-y-10">

          {/* SECTION 1: COMBAT CHECKLIST */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="size-4 text-[#8B0000]" />
                <h2 className="text-xs uppercase tracking-widest font-extrabold text-[#8B0000]">
                  Section 01 // Tactical Checklist
                </h2>
              </div>
              <div className="text-xs font-mono font-bold text-[#f5f5f5]">
                {completedCount} / {totalTasks} COMPLETED ({progressPercent}%)
              </div>
            </div>

            {/* Checklist items */}
            <div className="space-y-3">
              {tasks.map((block, idx) => {
                const isChecked = completedIndices.has(idx)
                const isNonNeg =
                  Boolean(nonNegotiable) &&
                  (block.task.toLowerCase().includes(nonNegotiable.toLowerCase()) ||
                    nonNegotiable.toLowerCase().includes(block.task.toLowerCase()))

                return (
                  <div
                    key={`${block.start}-${block.end}-${idx}`}
                    onClick={() => handleToggleTask(idx)}
                    className={`flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer select-none ${isChecked
                        ? "border-[#383838] bg-[#141414] text-[#a3a3a3]"
                        : isNonNeg
                          ? "border-[#8B0000]/80 bg-[#160a0a]"
                          : "border-[#262626] bg-[#111111] hover:border-[#383838]"
                      }`}
                  >
                    <div className="pt-0.5">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => handleToggleTask(idx)}
                        className="size-5 border-[#383838] bg-[#1a1a1a] data-checked:bg-[#8B0000] data-checked:border-[#8B0000] data-checked:text-[#f5f5f5] cursor-pointer"
                        aria-label={`Mark task ${block.task} as completed`}
                      />
                    </div>

                    <div className="flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#f5f5f5] bg-[#1a1a1a] border border-[#262626] px-2 py-0.5 rounded">
                          {block.start} - {block.end}
                        </span>
                        <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-[#1a1a1a] border border-[#262626] text-[#a3a3a3]">
                          {formatBlockType(block.type)}
                        </span>
                        {isNonNeg && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#8B0000] text-[#f5f5f5]">
                            Non-Negotiable
                          </span>
                        )}
                      </div>

                      <div
                        className={`text-sm sm:text-base font-semibold leading-snug ${isChecked
                            ? "line-through text-[#a3a3a3]/70"
                            : "text-[#f5f5f5]"
                          }`}
                      >
                        {block.task}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <Separator className="bg-[#262626]" />

          {/* SECTION 2: COMBAT HOURS & HONESTY LOG */}
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-[#8B0000]" />
              <h2 className="text-xs uppercase tracking-widest font-extrabold text-[#8B0000]">
                Section 02 // Combat Hours & Honesty Audit
              </h2>
            </div>

            <Card className="border-[#262626] bg-[#111111]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-[#f5f5f5]">
                  Daily Performance Metrics
                </CardTitle>
                <CardDescription className="text-xs text-[#a3a3a3]">
                  Input exact execution hours and face the mirror honestly.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-2">

                {/* Hours Worked Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="hoursWorked"
                      className="text-xs font-bold uppercase tracking-wider text-[#f5f5f5]"
                    >
                      Hours Spent in Combat Today
                    </label>
                    <span className="text-xs font-mono text-[#a3a3a3]">
                      Committed: {goal.daily_hours} hrs
                    </span>
                  </div>
                  <Input
                    id="hoursWorked"
                    name="hoursWorked"
                    type="number"
                    step="0.1"
                    min="0"
                    max="24"
                    required
                    disabled={isSubmitting}
                    placeholder="e.g., 4.5"
                    value={hoursWorked}
                    onChange={(e) => setHoursWorked(e.target.value)}
                    className="border-[#262626] bg-[#1a1a1a] text-[#f5f5f5] placeholder:text-[#a3a3a3]/40 focus-visible:border-[#8B0000] focus-visible:ring-1 focus-visible:ring-[#8B0000] h-11 text-base font-mono"
                  />
                </div>

                {/* Daily Notes Textarea */}
                <div className="space-y-2">
                  <label
                    htmlFor="userNote"
                    className="text-xs font-bold uppercase tracking-wider text-[#f5f5f5]"
                  >
                    Daily Combat Log & Notes
                  </label>
                  <Textarea
                    id="userNote"
                    name="userNote"
                    required
                    disabled={isSubmitting}
                    rows={4}
                    placeholder="How did the day actually go? Be honest. Did you execute with pure focus or did you succumb to cheap distractions and comfort?"
                    value={userNote}
                    onChange={(e) => setUserNote(e.target.value)}
                    className="border-[#262626] bg-[#1a1a1a] text-[#f5f5f5] placeholder:text-[#a3a3a3]/40 focus-visible:border-[#8B0000] focus-visible:ring-1 focus-visible:ring-[#8B0000] resize-y min-h-[120px] text-sm"
                  />
                  <p className="text-[11px] text-[#a3a3a3]/80 font-mono">
                    Any evasion, justification, or weakness will be detected and addressed by the AI.
                  </p>
                </div>

              </CardContent>
            </Card>
          </section>

          {/* SUBMIT BUTTON */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-13 bg-[#8B0000] hover:bg-[#6e0000] text-[#f5f5f5] font-black uppercase tracking-widest text-sm sm:text-base transition-all shadow-xl shadow-[#8B0000]/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  <span>Submitting Combat Report...</span>
                </>
              ) : (
                <>
                  <span>Submit Evening Report</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>

        </form>

      </div>
    </div>
  )
}

