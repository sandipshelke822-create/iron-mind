"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useTranslation } from "@/lib/translations"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn, calculateWorkingMondaysLeft } from "@/lib/utils"
import {
  User,
  Mail,
  Target,
  Flame,
  Shield,
  Clock,
  Calendar,
  LogOut,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Crosshair,
  Activity,
  ArrowLeft,
  Hourglass,
} from "lucide-react"

interface Goal {
  id: string
  user_id: string
  title: string
  why: string
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
}

interface ProfileData {
  full_name: string | null
  avatar_url: string | null
  birth_date?: string | null
}

function calculateStreak(reports: DailyReport[]): number {
  if (!reports || reports.length === 0) return 0

  const uniqueDates = Array.from(
    new Set(
      reports
        .map((r) => r.date?.split("T")[0])
        .filter((d): d is string => Boolean(d))
    )
  ).sort().reverse()

  if (uniqueDates.length === 0) return 0

  const parseLocalDate = (str: string) => {
    const [y, m, d] = str.split("-").map(Number)
    return new Date(y, m - 1, d)
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const latestDate = parseLocalDate(uniqueDates[0])

  const diffDays = Math.round((today.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays > 1) {
    return 0
  }

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

function calculateProbability(
  goal: Goal | null,
  streak: number,
  reports: DailyReport[]
): { percentage: number; statusText: string; toneClass: string } {
  if (!goal) {
    return {
      percentage: 0,
      statusText: "NO ACTIVE COMBAT OBJECTIVE",
      toneClass: "text-[#a3a3a3]",
    }
  }

  // Base battle probability
  let score = 38

  // 1. Streak influence (unbroken discipline)
  if (streak === 0) {
    score -= 12
  } else if (streak <= 3) {
    score += streak * 6
  } else if (streak <= 7) {
    score += 18 + (streak - 3) * 4
  } else {
    score += 34 + Math.min(14, (streak - 7) * 2)
  }

  // 2. Timeline urgency & pacing
  try {
    const parts = goal.deadline.split("T")[0].split("-")
    if (parts.length === 3) {
      const [year, month, day] = parts.map(Number)
      const targetDate = new Date(year, month - 1, day)
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      if (diffDays < 0) {
        score -= 30 // Overdue
      } else if (diffDays <= 3) {
        if (streak >= 3) {
          score += 10
        } else {
          score -= 16
        }
      } else if (diffDays <= 14) {
        if (streak >= 2) {
          score += 6
        }
      } else {
        score += 4
      }
    }
  } catch {
    // ignore
  }

  // 3. Daily Hours Commitment
  if (goal.daily_hours >= 4 && goal.daily_hours <= 10) {
    score += 10
  } else if (goal.daily_hours < 4 && goal.daily_hours > 0) {
    score += 4
  } else if (goal.daily_hours > 10) {
    score += 3 // Extreme load penalty risk
  }

  // 4. Historical AI execution scores
  const recentReportsWithScores = reports.filter((r) => typeof r.ai_score === "number" && r.ai_score !== null)
  if (recentReportsWithScores.length > 0) {
    const sample = recentReportsWithScores.slice(0, 7)
    const avgScore = sample.reduce((sum, r) => sum + (r.ai_score ?? 0), 0) / sample.length

    if (avgScore >= 8) {
      score += 15
    } else if (avgScore >= 6) {
      score += 8
    } else if (avgScore < 4) {
      score -= 14
    }
  }

  // Clamp probability between 5% and 98% (no victory is 100% until finished)
  const finalScore = Math.max(5, Math.min(98, Math.round(score)))

  let statusText = "VULNERABLE TRAJECTORY"
  let toneClass = "text-orange-400"

  if (finalScore >= 80) {
    statusText = "DOMINANT CADENCE"
    toneClass = "text-emerald-400"
  } else if (finalScore >= 60) {
    statusText = "COMBAT READY"
    toneClass = "text-amber-400"
  } else if (finalScore < 40) {
    statusText = "CRITICAL FAILURE IMMINENT"
    toneClass = "text-[#8B0000]"
  }

  return {
    percentage: finalScore,
    statusText,
    toneClass,
  }
}

export default function ProfilePage() {
  const router = useRouter()
  const { t } = useTranslation()

  const [isLoading, setIsLoading] = React.useState(true)
  const [isSavingProfile, setIsSavingProfile] = React.useState(false)
  const [isSigningOut, setIsSigningOut] = React.useState(false)

  const [userId, setUserId] = React.useState<string | null>(null)
  const [userEmail, setUserEmail] = React.useState<string>("")
  const [fullName, setFullName] = React.useState<string>("")
  const [birthDate, setBirthDate] = React.useState<string>("")

  const [activeGoal, setActiveGoal] = React.useState<Goal | null>(null)
  const [streak, setStreak] = React.useState<number>(0)
  const [reports, setReports] = React.useState<DailyReport[]>([])

  const [saveSuccess, setSaveSuccess] = React.useState<string | null>(null)
  const [saveError, setSaveError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let isMounted = true

    async function loadProfile() {
      try {
        const supabase = createClient()
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          router.push("/login")
          return
        }

        if (!isMounted) return
        setUserId(user.id)
        setUserEmail(user.email || "")

        // 1. Fetch Profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, avatar_url, birth_date")
          .eq("id", user.id)
          .maybeSingle()

        if (profileData && isMounted) {
          const prof = profileData as ProfileData
          if (prof.full_name) {
            setFullName(prof.full_name)
          } else if (user.user_metadata?.full_name) {
            setFullName(user.user_metadata.full_name)
          }
          if (prof.birth_date) {
            setBirthDate(prof.birth_date.split("T")[0])
          }
        } else if (user.user_metadata?.full_name && isMounted) {
          setFullName(user.user_metadata.full_name)
        }

        // 2. Fetch Active Goal
        const { data: goalData } = await supabase
          .from("goals")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (goalData && isMounted) {
          setActiveGoal(goalData as Goal)
        }

        // 3. Fetch Daily Reports for Streak and Calculation
        const { data: reportsData } = await supabase
          .from("daily_reports")
          .select("id, user_id, date, ai_score")
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .limit(30)

        if (reportsData && isMounted) {
          const reps = reportsData as DailyReport[]
          setReports(reps)
          setStreak(calculateStreak(reps))
        }
      } catch (err) {
        console.error("Error loading profile:", err)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [router])

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaveSuccess(null)
    setSaveError(null)

    if (!userId) return

    setIsSavingProfile(true)
    try {
      const supabase = createClient()
      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            full_name: fullName.trim(),
            birth_date: birthDate ? birthDate : null,
          },
          { onConflict: "id" }
        )

      if (upsertError) {
        setSaveError(upsertError.message || "Failed to update profile.")
      } else {
        setSaveSuccess(t("Profile updated successfully."))
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred."
      setSaveError(msg)
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true)
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push("/login")
      router.refresh()
    } catch (err) {
      console.error("Failed to sign out:", err)
      setIsSigningOut(false)
    }
  }

  const probabilityData = calculateProbability(activeGoal, streak, reports)
  const mondaysLeft = calculateWorkingMondaysLeft(birthDate)

  // Circular gauge constants
  const radius = 68
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset =
    circumference - (probabilityData.percentage / 100) * circumference

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] flex items-center justify-center px-4 selection:bg-[#8B0000] selection:text-[#f5f5f5]">
        <div className="w-full max-w-md bg-[#111111] border border-[#262626] rounded-xl p-8 text-center space-y-4 shadow-2xl">
          <Loader2 className="h-8 w-8 animate-spin text-[#8B0000] mx-auto" />
          <div className="text-xs font-mono uppercase tracking-widest text-[#a3a3a3]">
            {t("Tactical Assessment")}
          </div>
          <p className="text-sm font-bold text-[#f5f5f5]">
            Retrieving warrior records...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] py-10 px-4 sm:px-6 selection:bg-[#8B0000] selection:text-[#f5f5f5]">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Top Bar Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "border-[#262626] bg-[#111111] text-[#a3a3a3] hover:bg-[#1a1a1a] hover:text-[#f5f5f5] transition-colors flex items-center gap-2 h-9 px-3"
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t("Back to Dashboard")}</span>
          </Link>

          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#8B0000]">
            <Shield className="h-4 w-4" />
            <span>{t("Warrior Profile")}</span>
          </div>
        </div>

        {/* SECTION 1: WORKING MONDAYS LEFT (STRIKING MORTALITY DISPLAY) */}
        <Card className="bg-[#111111] border-2 border-[#8B0000] rounded-xl p-6 sm:p-8 relative overflow-hidden shadow-2xl shadow-[#8B0000]/20">
          <div className="relative z-10 space-y-5">
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <div className="flex items-center gap-2">
                <Hourglass className="size-4 text-[#8B0000]" />
                <span className="text-xs font-mono font-bold tracking-widest text-[#8B0000] uppercase">
                  MORTAL RUNWAY // TEMPORAL HORIZON
                </span>
              </div>
              <span className="text-[11px] font-mono text-[#a3a3a3] uppercase tracking-wider">
                Baseline: Age 60
              </span>
            </div>

            {mondaysLeft !== null ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4">
                  <div className="text-6xl sm:text-7xl md:text-8xl font-black font-mono tracking-tighter text-[#f5f5f5]">
                    {mondaysLeft.toLocaleString()}
                  </div>
                  <div className="text-xs sm:text-sm font-mono uppercase tracking-widest text-[#8B0000] font-bold">
                    Working Mondays Remaining
                  </div>
                </div>

                <div className="border-l-2 border-[#8B0000] pl-4 sm:pl-6 py-2 bg-[#1a1a1a]/60 rounded-r-lg">
                  <p className="text-base sm:text-xl font-bold tracking-tight text-[#f5f5f5] font-sans">
                    &ldquo;You have roughly {mondaysLeft.toLocaleString()} Mondays left to build your legacy. Do not waste this one.&rdquo;
                  </p>
                  <p className="text-xs font-mono text-[#a3a3a3] uppercase tracking-wider mt-1.5">
                    Calculated from your birth date to age 60 (52 operational weeks per year). Time is finite.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 py-2">
                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-[#a3a3a3] uppercase">
                  MORTAL RUNWAY UNLOCKED BY BIRTH DATE
                </div>
                <p className="text-xs sm:text-sm font-mono text-[#a3a3a3] uppercase leading-relaxed">
                  Date of birth not yet recorded. Save your birth date in the Personal Dossier below to compute your working Mondays remaining.
                </p>
              </div>
            )}
          </div>

          {/* Watermark icon accent in background */}
          <div className="absolute -right-6 -bottom-6 pointer-events-none opacity-5 text-[#8B0000]">
            <Hourglass className="size-48" />
          </div>
        </Card>

        {/* SECTION 2: INTIMIDATING SUCCESS PROBABILITY GAUGE */}
        <Card className="bg-[#111111] border-2 border-[#8B0000]/80 rounded-xl p-6 sm:p-8 relative overflow-hidden shadow-2xl shadow-[#8B0000]/15">
          <div className="flex flex-col md:flex-row items-center gap-8 justify-between">
            {/* Left text description */}
            <div className="space-y-3 text-center md:text-left max-w-md">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#8B0000]/60 bg-[#8B0000]/20 px-3 py-1 text-xs font-mono font-bold uppercase tracking-widest text-[#8B0000]">
                <Activity className="size-3.5" />
                <span>{t("Tactical Assessment")}</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#f5f5f5]">
                {t("SUCCESS PROBABILITY")}
              </h1>

              <div className="space-y-1">
                <div className={cn("text-sm font-mono font-black tracking-widest uppercase", probabilityData.toneClass)}>
                  {probabilityData.statusText}
                </div>
                <p className="text-xs text-[#a3a3a3] font-mono leading-relaxed">
                  Calculated against your daily hours target, unbroken streak, and mission deadline.
                  Discipline compounds odds; complacency guarantees failure.
                </p>
              </div>
            </div>

            {/* Circular Gauge Graphic */}
            <div className="relative flex items-center justify-center shrink-0">
              <svg className="w-48 h-48 -rotate-90 transform" viewBox="0 0 160 160">
                {/* Background Track Ring */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke="#1a1a1a"
                  strokeWidth="12"
                  fill="transparent"
                />
                {/* Active Progress Ring */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke="#8B0000"
                  strokeWidth="12"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-1000 ease-out"
                  style={{
                    filter: "drop-shadow(0 0 8px rgba(139, 0, 0, 0.7))",
                  }}
                />
              </svg>

              {/* Center Content */}
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-4xl sm:text-5xl font-black font-mono tracking-tighter text-[#f5f5f5]">
                  {probabilityData.percentage}%
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#a3a3a3]">
                  ODDS
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* SECTION 3: USER IDENTITY & EDITABLE DOSSIER */}
        <Card className="bg-[#111111] border border-[#262626] rounded-xl p-6 sm:p-8 space-y-6 shadow-xl">
          <CardHeader className="p-0 text-left space-y-1">
            <CardTitle className="text-xl font-black uppercase tracking-tight text-[#f5f5f5] flex items-center gap-2">
              <User className="size-5 text-[#8B0000]" />
              <span>Personal Dossier</span>
            </CardTitle>
            <CardDescription className="text-xs text-[#a3a3a3] font-mono">
              Operational identity registered on the IRON MIND network.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              {saveError && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-md border border-[#8B0000]/60 bg-[#8B0000]/10 px-4 py-3 text-sm font-medium text-red-400"
                >
                  <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
                  <span>{saveError}</span>
                </div>
              )}

              {saveSuccess && (
                <div
                  role="status"
                  className="flex items-start gap-3 rounded-md border border-emerald-900/60 bg-emerald-950/30 px-4 py-3 text-sm font-medium text-emerald-400"
                >
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                  <span>{saveSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Full Name (Editable) */}
                <div className="space-y-2">
                  <Label
                    htmlFor="full_name"
                    className="text-xs font-semibold uppercase tracking-wider text-[#a3a3a3] flex items-center gap-2"
                  >
                    <User className="h-4 w-4 text-[#8B0000]" />
                    <span>{t("Full Name")}</span>
                  </Label>
                  <Input
                    id="full_name"
                    name="full_name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter warrior name..."
                    disabled={isSavingProfile}
                    className="h-10 border-[#262626] bg-[#1a1a1a] text-[#f5f5f5] placeholder:text-[#a3a3a3]/40 focus-visible:border-[#8B0000] focus-visible:ring-1 focus-visible:ring-[#8B0000]"
                  />
                </div>

                {/* Date of Birth (Editable) */}
                <div className="space-y-2">
                  <Label
                    htmlFor="birth_date"
                    className="text-xs font-semibold uppercase tracking-wider text-[#a3a3a3] flex items-center gap-2"
                  >
                    <Calendar className="h-4 w-4 text-[#8B0000]" />
                    <span>Date of Birth</span>
                  </Label>
                  <Input
                    id="birth_date"
                    name="birth_date"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    disabled={isSavingProfile}
                    className="h-10 border-[#262626] bg-[#1a1a1a] text-[#f5f5f5] placeholder:text-[#a3a3a3]/40 focus-visible:border-[#8B0000] focus-visible:ring-1 focus-visible:ring-[#8B0000] [color-scheme:dark]"
                  />
                </div>

                {/* Email (Read-Only Identity) */}
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="text-xs font-semibold uppercase tracking-wider text-[#a3a3a3] flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4 text-[#8B0000]" />
                    <span>{t("Email Address")}</span>
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={userEmail}
                    readOnly
                    disabled
                    className="h-10 border-[#262626] bg-[#161616] text-[#a3a3a3] cursor-not-allowed select-none opacity-80"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  disabled={isSavingProfile}
                  className="h-10 bg-[#8B0000] hover:bg-[#6e0000] text-[#f5f5f5] font-bold uppercase tracking-wider text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSavingProfile ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{t("Saving...")}</span>
                    </span>
                  ) : (
                    t("Update Profile")
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* SECTION 4: CURRENT GOAL & STREAK DETAILS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* ACTIVE OBJECTIVE CARD */}
          <Card className="bg-[#111111] border-[#262626] rounded-xl p-6 flex flex-col justify-between shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#262626] pb-3">
                <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-[#8B0000]">
                  <Crosshair className="size-4" />
                  <span>{t("Active Combat Objective")}</span>
                </div>
                {activeGoal && (
                  <span className="text-[11px] font-mono text-[#a3a3a3] uppercase">
                    {activeGoal.daily_hours}h / Day
                  </span>
                )}
              </div>

              {activeGoal ? (
                <div className="space-y-3">
                  <h3 className="text-xl font-black uppercase tracking-tight text-[#f5f5f5] break-words">
                    {activeGoal.title}
                  </h3>

                  <div className="space-y-2 text-xs font-mono text-[#a3a3a3]">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-3.5 text-[#8B0000]" />
                      <span>DEADLINE: {activeGoal.deadline.split("T")[0]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="size-3.5 text-[#8B0000]" />
                      <span>LEVEL: {activeGoal.current_level}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center space-y-2">
                  <Target className="size-8 text-[#a3a3a3]/40 mx-auto" />
                  <p className="text-xs font-mono text-[#a3a3a3] uppercase">
                    No active mission locked.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#1f1f1f] mt-4">
              {activeGoal ? (
                <Link
                  href={`/plan/${activeGoal.id}`}
                  className="text-xs font-mono font-bold uppercase tracking-wider text-[#8B0000] hover:text-red-400 flex items-center gap-1.5 transition-colors"
                >
                  <span>Review Combat Strategy</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              ) : (
                <Link
                  href="/goal/new"
                  className="text-xs font-mono font-bold uppercase tracking-wider text-[#8B0000] hover:text-red-400 flex items-center gap-1.5 transition-colors"
                >
                  <span>Lock In Objective</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              )}
            </div>
          </Card>

          {/* STREAK & CADENCE CARD */}
          <Card className="bg-[#111111] border-[#262626] rounded-xl p-6 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between border-b border-[#262626] pb-3">
                <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-[#8B0000]">
                  <Flame className="size-4" />
                  <span>{t("Current Streak")}</span>
                </div>
                <span className="text-[11px] font-mono text-[#a3a3a3] uppercase">
                  Cadence
                </span>
              </div>

              <div className="my-4">
                <div className="text-5xl sm:text-6xl font-black font-mono tracking-tighter text-[#f5f5f5]">
                  {streak}
                </div>
                <div className="text-xs font-mono uppercase tracking-widest text-[#a3a3a3] mt-1">
                  {streak === 1 ? "Day Unbroken" : "Days Unbroken"}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#1f1f1f]">
              <p className="text-xs font-mono text-[#a3a3a3] uppercase tracking-wider">
                {streak > 0
                  ? "Standard maintained. One missing log resets momentum to absolute zero."
                  : "Streak is currently dormant. Log today's mission to establish momentum."}
              </p>
            </div>
          </Card>

        </div>

        {/* SECTION 5: SIGN OUT BUTTON */}
        <div className="pt-4 pb-12 border-t border-[#262626] flex items-center justify-between">
          <div className="text-xs font-mono text-[#a3a3a3]/70 uppercase tracking-wider">
            Identity Isolation: Supabase RLS Active
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="border border-[#8B0000]/60 bg-[#161616] hover:bg-[#8B0000]/20 hover:border-[#8B0000] text-[#f5f5f5] text-xs font-bold uppercase tracking-wider h-10 px-4 transition-colors cursor-pointer flex items-center gap-2"
          >
            {isSigningOut ? (
              <Loader2 className="size-4 animate-spin text-[#8B0000]" />
            ) : (
              <LogOut className="size-4 text-[#8B0000]" />
            )}
            <span>{isSigningOut ? t("Signing Out...") : t("Sign Out")}</span>
          </Button>
        </div>

      </div>
    </div>
  )
}
