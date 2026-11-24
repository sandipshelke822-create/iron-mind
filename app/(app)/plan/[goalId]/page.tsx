"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  ShieldAlert,
  Calendar,
  Clock,
  Target,
  ArrowRight,
  Flame,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Quote,
  Zap,
  KeyRound,
  Save,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlanBlockType = "deep_work" | "revision" | "test" | "rest"

export interface PlanBlock {
  start: string
  end: string
  task: string
  type: PlanBlockType | string
}

export interface Day1Plan {
  blocks: PlanBlock[]
  non_negotiable: string
}

export interface WeeklyMilestone {
  week: number
  focus: string
  measurable_outcome: string
}

export interface WarPlan {
  id?: string
  assessment: string
  weekly_milestones: WeeklyMilestone[]
  day_1_plan: Day1Plan
  warrior_note: string
}

export interface Goal {
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

type AIProvider = "gemini" | "openai" | "anthropic" | "deepseek"

type UIMode = "loading" | "plan" | "key-required" | "error"

interface PageProps {
  params: Promise<{ goalId: string }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Sub-views
// ---------------------------------------------------------------------------

function BattlePlanLoadingView({ message }: { message: string }) {
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
            Combat Strategist Active
          </div>
          <h2 className="text-xl font-bold tracking-tight text-[#f5f5f5]">
            ENGINEERING BATTLE PLAN
          </h2>
          <p className="text-xs text-[#a3a3a3] font-mono leading-relaxed">
            {message}
          </p>
        </div>

        <div className="border-t border-[#262626] pt-4">
          <p className="text-[11px] text-[#a3a3a3]/70 uppercase tracking-wider">
            Calibrating milestones. Non-negotiables incoming.
          </p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Key-Required inline form
// ---------------------------------------------------------------------------

interface KeyRequiredViewProps {
  onKeySaved: () => void
}

function KeyRequiredView({ onKeySaved }: KeyRequiredViewProps) {
  const [provider, setProvider] = React.useState<AIProvider>("gemini")
  const [apiKey, setApiKey] = React.useState<string>("")
  const [isSaving, setIsSaving] = React.useState<boolean>(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaveError(null)

    const trimmedKey = apiKey.trim()
    if (!trimmedKey) {
      setSaveError("API key cannot be blank.")
      return
    }

    setIsSaving(true)
    try {
      const supabase = createClient()

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        setSaveError("Authentication session expired. Please reload and log in again.")
        setIsSaving(false)
        return
      }

      const { error: upsertError } = await supabase
        .from("user_settings")
        .upsert(
          {
            user_id: user.id,
            ai_provider: provider,
            api_key: trimmedKey,
          },
          { onConflict: "user_id" }
        )

      if (upsertError) {
        setSaveError(`Failed to save key: ${upsertError.message}`)
        setIsSaving(false)
        return
      }

      // Key saved — trigger plan generation
      onKeySaved()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unexpected error saving API key."
      setSaveError(message)
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] flex items-center justify-center px-4 py-12 selection:bg-[#8B0000] selection:text-[#f5f5f5]">
      <div className="w-full max-w-lg space-y-6">

        {/* Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#8B0000]/50 bg-[#8B0000]/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#8B0000]">
            <ShieldAlert className="size-3.5" />
            System Override Required
          </div>

          <div className="flex items-start gap-3">
            <KeyRound className="size-6 text-[#8B0000] shrink-0 mt-0.5" />
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#f5f5f5] uppercase leading-tight">
              Mission Blocked:<br />
              AI API Key Required
            </h1>
          </div>

          <p className="text-sm text-[#a3a3a3] leading-relaxed border-l-2 border-[#8B0000]/50 pl-3">
            No API key is registered for your account. Supply your key below to
            authorize the AI engine and generate your battle plan. The key is
            stored securely and never exposed to the client.
          </p>
        </div>

        {/* Form card */}
        <div className="bg-[#111111] border border-[#262626] rounded-xl p-6 sm:p-8 space-y-6 shadow-2xl">

          <div className="text-[11px] font-bold uppercase tracking-widest text-[#8B0000]">
            Authorize AI Engine
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Provider Select */}
            <div className="space-y-2">
              <label
                htmlFor="ai-provider"
                className="block text-xs font-bold uppercase tracking-widest text-[#a3a3a3]"
              >
                AI Provider
              </label>
              <Select
                value={provider}
                onValueChange={(val) => setProvider(val as AIProvider)}
              >
                <SelectTrigger
                  id="ai-provider"
                  className="h-11 bg-[#0a0a0a] border-[#262626] text-[#f5f5f5] focus:ring-[#8B0000] focus:border-[#8B0000] font-mono text-sm"
                >
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent className="bg-[#111111] border-[#262626] text-[#f5f5f5]">
                  <SelectItem
                    value="gemini"
                    className="font-mono text-sm focus:bg-[#8B0000]/20 focus:text-[#f5f5f5] cursor-pointer"
                  >
                    Google Gemini
                  </SelectItem>
                  <SelectItem
                    value="openai"
                    className="font-mono text-sm focus:bg-[#8B0000]/20 focus:text-[#f5f5f5] cursor-pointer"
                  >
                    OpenAI
                  </SelectItem>
                  <SelectItem
                    value="anthropic"
                    className="font-mono text-sm focus:bg-[#8B0000]/20 focus:text-[#f5f5f5] cursor-pointer"
                  >
                    Anthropic (Claude)
                  </SelectItem>
                  <SelectItem
                    value="deepseek"
                    className="font-mono text-sm focus:bg-[#8B0000]/20 focus:text-[#f5f5f5] cursor-pointer"
                  >
                    DeepSeek
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* API Key Input */}
            <div className="space-y-2">
              <label
                htmlFor="api-key"
                className="block text-xs font-bold uppercase tracking-widest text-[#a3a3a3]"
              >
                API Key
              </label>
              <Input
                id="api-key"
                type="password"
                autoComplete="off"
                placeholder="Enter your API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="h-11 bg-[#0a0a0a] border-[#262626] text-[#f5f5f5] placeholder:text-[#a3a3a3]/50 focus-visible:ring-[#8B0000] focus-visible:border-[#8B0000] font-mono text-sm"
              />
              <p className="text-[11px] text-[#a3a3a3]/70 font-mono">
                Key is encrypted at rest. Only used server-side for AI inference.
              </p>
            </div>

            {/* Save error */}
            {saveError && (
              <div className="rounded-lg border border-[#8B0000]/40 bg-[#8B0000]/10 p-3 text-xs text-red-300 font-mono">
                {saveError}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={isSaving}
              className="w-full h-11 bg-[#8B0000] hover:bg-[#6e0000] disabled:opacity-60 text-[#f5f5f5] font-extrabold uppercase tracking-widest text-sm transition-all shadow-lg shadow-[#8B0000]/20 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Authorizing...
                </>
              ) : (
                <>
                  <Save className="mr-2 size-4" />
                  Save Key &amp; Generate Plan
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Footer note */}
        <p className="text-center text-[11px] text-[#a3a3a3]/60 uppercase tracking-wider">
          You can update your key at any time from Settings.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main content component
// ---------------------------------------------------------------------------

function BattlePlanContent({ params }: PageProps) {
  const router = useRouter()
  const { goalId } = React.use(params)

  const [mode, setMode] = React.useState<UIMode>("loading")
  const [statusMessage, setStatusMessage] = React.useState<string>("Mobilizing command center...")
  const [error, setError] = React.useState<string | null>(null)
  const [goal, setGoal] = React.useState<Goal | null>(null)
  const [plan, setPlan] = React.useState<WarPlan | null>(null)

  const loadOrCreatePlan = React.useCallback(async () => {
    if (!goalId) {
      setError("No target objective identifier provided.")
      setMode("error")
      return
    }

    setMode("loading")
    setError(null)
    setStatusMessage("Verifying active target credentials...")

    try {
      const supabase = createClient()

      // 1. Fetch Goal details
      const { data: goalData, error: goalErr } = await supabase
        .from("goals")
        .select("*")
        .eq("id", goalId)
        .single()

      if (goalErr || !goalData) {
        setError(goalErr?.message || "Target objective was not found in active records.")
        setMode("error")
        return
      }

      const fetchedGoal = goalData as Goal
      setGoal(fetchedGoal)

      // 2. Check if a battle plan already exists for this goal
      setStatusMessage("Scanning battle records for existing operational plans...")
      const { data: planData, error: planErr } = await supabase
        .from("battle_plans")
        .select("*")
        .eq("goal_id", goalId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (planErr) {
        console.warn("[BattlePlanPage] Error checking battle_plans table:", planErr)
      }

      if (planData && planData.milestones) {
        let existingPlan: WarPlan
        if (typeof planData.milestones === "string") {
          existingPlan = JSON.parse(planData.milestones) as WarPlan
        } else {
          existingPlan = planData.milestones as WarPlan
        }

        setPlan(existingPlan)
        setMode("plan")
        return
      }

      // 3. No plan exists — call API to generate plan
      setStatusMessage("No prior battle plan detected. Mobilizing AI coach to forge battle plan...")

      const response = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalId: fetchedGoal.id,
          title: fetchedGoal.title,
          why: fetchedGoal.why,
          deadline: fetchedGoal.deadline,
          dailyHours: fetchedGoal.daily_hours,
          currentLevel: fetchedGoal.current_level,
          routine: fetchedGoal.routine,
          sacrifice_cost: fetchedGoal.sacrifice_cost,
          stop_doing_list: fetchedGoal.stop_doing_list,
        }),
      })

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}))
        const errorMessage: string =
          (errorJson as { error?: string }).error ||
          `Failed to engineer war plan (HTTP ${response.status}).`

        // 402 → user has no API key configured
        if (
          response.status === 402 ||
          errorMessage.toLowerCase().includes("no api key found")
        ) {
          setMode("key-required")
          return
        }

        setError(errorMessage)
        setMode("error")
        return
      }

      const generatedPlan: WarPlan = await response.json()
      setPlan(generatedPlan)
      setMode("plan")
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected tactical failure occurred."
      setError(message)
      setMode("error")
    }
  }, [goalId])

  React.useEffect(() => {
    loadOrCreatePlan()
  }, [loadOrCreatePlan])

  // ---- Render by mode ----

  if (mode === "loading") {
    return <BattlePlanLoadingView message={statusMessage} />
  }

  if (mode === "key-required") {
    return <KeyRequiredView onKeySaved={loadOrCreatePlan} />
  }

  if (mode === "error" || !plan) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] flex items-center justify-center px-4 py-12 selection:bg-[#8B0000] selection:text-[#f5f5f5]">
        <div className="w-full max-w-lg bg-[#111111] border border-[#8B0000]/60 rounded-xl p-8 space-y-6 shadow-2xl">
          <div className="flex items-center gap-3 text-[#8B0000]">
            <AlertTriangle className="size-6 shrink-0" />
            <h1 className="text-lg font-bold uppercase tracking-wider">
              Deployment Failure
            </h1>
          </div>

          <div className="rounded-lg border border-[#8B0000]/40 bg-[#8B0000]/10 p-4 text-sm text-red-300 font-medium">
            {error || "Unknown error encountered while assembling the battle plan."}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={() => loadOrCreatePlan()}
              className="flex-1 h-11 bg-[#8B0000] hover:bg-[#6e0000] text-[#f5f5f5] font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              <RefreshCw className="mr-2 size-4" />
              Retry Mobilization
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/goal/new")}
              className="h-11 border-[#262626] bg-[#1a1a1a] text-[#f5f5f5] hover:bg-[#262626] font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Reconfigure Goal
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ---- Plan view (unchanged) ----

  const nonNegotiableText = plan.day_1_plan?.non_negotiable || ""

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] selection:bg-[#8B0000] selection:text-[#f5f5f5] pb-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 space-y-12">

        {/* HEADER SECTION */}
        <header className="space-y-6 border-b border-[#262626] pb-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#8B0000]/40 bg-[#8B0000]/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#8B0000]">
              <Target className="size-3.5" />
              Tactical War Plan
            </div>

            {goal && (
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#a3a3a3]">
                <span className="flex items-center gap-1 bg-[#1a1a1a] border border-[#262626] px-2.5 py-1 rounded">
                  <Calendar className="size-3 text-[#8B0000]" />
                  {goal.deadline}
                </span>
                <span className="flex items-center gap-1 bg-[#1a1a1a] border border-[#262626] px-2.5 py-1 rounded">
                  <Clock className="size-3 text-[#8B0000]" />
                  {goal.daily_hours}H / DAY
                </span>
                <span className="bg-[#1a1a1a] border border-[#262626] px-2.5 py-1 rounded text-[#f5f5f5]">
                  {goal.current_level.toUpperCase()}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-[#f5f5f5] uppercase">
              {goal?.title || "Active Directive"}
            </h1>

            {goal?.why && (
              <div className="rounded-xl border border-[#262626] bg-[#121212] p-4 sm:p-5">
                <div className="text-[11px] font-bold tracking-widest uppercase text-[#8B0000] mb-1.5 flex items-center gap-1.5">
                  <Zap className="size-3.5" />
                  Stated Stakes // The Why
                </div>
                <p className="text-sm sm:text-base text-[#a3a3a3] font-normal leading-relaxed">
                  &ldquo;{goal.why}&rdquo;
                </p>
              </div>
            )}
          </div>
        </header>

        {/* SECTION 1: ASSESSMENT */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-[#8B0000]" />
            <h2 className="text-xs uppercase tracking-widest font-extrabold text-[#8B0000]">
              Section 01 // Assessment
            </h2>
          </div>

          <Card className="border-[#262626] bg-[#111111]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold tracking-wider text-[#a3a3a3] uppercase">
                Brutal Reality Check
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-l-4 border-[#8B0000] bg-[#161616]/70 pl-5 pr-4 py-4 rounded-r-lg">
                <p className="text-lg sm:text-xl italic font-medium text-[#f5f5f5] leading-relaxed">
                  &ldquo;{plan.assessment}&rdquo;
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <Separator className="bg-[#262626]" />

        {/* SECTION 2: WEEKLY MILESTONES */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-[#8B0000]" />
              <h2 className="text-xs uppercase tracking-widest font-extrabold text-[#8B0000]">
                Section 02 // Weekly Milestones
              </h2>
            </div>
            <span className="text-xs font-mono text-[#a3a3a3]">
              {plan.weekly_milestones?.length || 0} Phase Targets
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plan.weekly_milestones?.map((milestone, idx) => (
              <Card
                key={`${milestone.week}-${idx}`}
                className="border-[#262626] bg-[#111111] hover:border-[#8B0000]/60 transition-colors"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <span className="inline-block text-xs font-extrabold tracking-wider px-2 py-0.5 rounded bg-[#8B0000]/15 text-[#8B0000] border border-[#8B0000]/30 font-mono">
                      WEEK {String(milestone.week).padStart(2, "0")}
                    </span>
                  </div>
                  <CardTitle className="text-base font-bold text-[#f5f5f5] pt-1">
                    {milestone.focus}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="pt-2 border-t border-[#262626]">
                    <div className="text-[10px] uppercase tracking-widest font-semibold text-[#a3a3a3] mb-1 flex items-center gap-1">
                      <Target className="size-3 text-[#8B0000]" />
                      Measurable Outcome
                    </div>
                    <p className="text-xs sm:text-sm text-[#f5f5f5] leading-relaxed">
                      {milestone.measurable_outcome}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator className="bg-[#262626]" />

        {/* SECTION 3: DAY 1 SCHEDULE */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-[#8B0000]" />
              <h2 className="text-xs uppercase tracking-widest font-extrabold text-[#8B0000]">
                Section 03 // Day 1 Schedule
              </h2>
            </div>
            <span className="text-xs font-mono text-[#a3a3a3]">
              Non-Negotiable Execution
            </span>
          </div>

          {/* Non-Negotiable Directive Banner */}
          {nonNegotiableText && (
            <div className="rounded-xl border-2 border-[#8B0000] bg-[#8B0000]/10 p-5 shadow-lg">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-[#8B0000] mb-1">
                <Flame className="size-4 shrink-0" />
                Non-Negotiable Directive
              </div>
              <p className="text-base sm:text-lg font-bold text-[#f5f5f5] leading-snug">
                {nonNegotiableText}
              </p>
            </div>
          )}

          {/* Time Blocks List */}
          <div className="space-y-3">
            {plan.day_1_plan?.blocks?.map((block, idx) => {
              const isNonNegotiable =
                Boolean(nonNegotiableText) &&
                (block.task.toLowerCase().includes(nonNegotiableText.toLowerCase()) ||
                  nonNegotiableText.toLowerCase().includes(block.task.toLowerCase()))

              return (
                <div
                  key={`${block.start}-${block.end}-${idx}`}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl transition-colors ${
                    isNonNegotiable
                      ? "border-2 border-[#8B0000] bg-[#1a0808]"
                      : "border border-[#262626] bg-[#111111] hover:border-[#383838]"
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-[#f5f5f5] bg-[#1a1a1a] border border-[#262626] px-3 py-1.5 rounded-lg shrink-0">
                      <Clock className="size-3.5 text-[#8B0000]" />
                      <span>
                        {block.start} - {block.end}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm sm:text-base font-semibold text-[#f5f5f5]">
                          {block.task}
                        </span>
                        {isNonNegotiable && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#8B0000] text-[#f5f5f5]">
                            Non-Negotiable
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center self-start sm:self-center">
                    <span className="text-[11px] font-mono uppercase tracking-wider px-2.5 py-1 rounded bg-[#1a1a1a] border border-[#262626] text-[#a3a3a3]">
                      {formatBlockType(block.type)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <Separator className="bg-[#262626]" />

        {/* SECTION 4: WARRIOR NOTE */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Quote className="size-4 text-[#8B0000]" />
            <h2 className="text-xs uppercase tracking-widest font-extrabold text-[#8B0000]">
              Section 04 // Warrior Note
            </h2>
          </div>

          <div className="rounded-xl border border-[#8B0000]/60 bg-[#140808] p-6 sm:p-7 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#8B0000]/5 rounded-full blur-2xl pointer-events-none" />
            <div className="text-[11px] font-extrabold uppercase tracking-widest text-[#8B0000] mb-2">
              Stoic Truth
            </div>
            <p className="text-base sm:text-xl font-semibold text-[#f5f5f5] leading-relaxed">
              &ldquo;{plan.warrior_note}&rdquo;
            </p>
          </div>
        </section>

        {/* ACTION BUTTON */}
        <div className="pt-6 pb-12 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#262626]">
          <div className="text-xs text-[#a3a3a3] uppercase tracking-wider text-center sm:text-left">
            War plan established. Hesitation is defeat.
          </div>

          <Button
            size="lg"
            onClick={() => router.push("/today")}
            className="w-full sm:w-auto h-12 px-8 bg-[#8B0000] hover:bg-[#6e0000] text-[#f5f5f5] font-extrabold uppercase tracking-widest text-sm transition-all shadow-xl shadow-[#8B0000]/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Start Day 1</span>
            <ArrowRight className="size-4" />
          </Button>
        </div>

      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

export default function BattlePlanPage(props: PageProps) {
  return (
    <React.Suspense fallback={<BattlePlanLoadingView message="Initializing command telemetry..." />}>
      <BattlePlanContent {...props} />
    </React.Suspense>
  )
}
