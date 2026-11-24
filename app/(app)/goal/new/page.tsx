"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTranslation } from "@/lib/translations"
import { Clock, Image as ImageIcon, Flame, Ban, Calendar, Target } from "lucide-react"

export default function NewGoalPage() {
  const router = useRouter()
  const { t } = useTranslation()

  const [title, setTitle] = React.useState("")
  const [why, setWhy] = React.useState("")
  const [whyImageUrl, setWhyImageUrl] = React.useState("")
  const [sacrificeCost, setSacrificeCost] = React.useState("")
  const [stopDoingList, setStopDoingList] = React.useState("")
  const [decisionDeadline, setDecisionDeadline] = React.useState("")
  const [wakeUpTime, setWakeUpTime] = React.useState("05:00")
  const [sleepTime, setSleepTime] = React.useState("22:00")
  const [deadline, setDeadline] = React.useState("")
  const [dailyHours, setDailyHours] = React.useState("")
  const [currentLevel, setCurrentLevel] = React.useState<string | null>(null)

  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!title.trim() || !why.trim() || !deadline || !dailyHours || !currentLevel) {
      setError("Title, Why, Deadline, Daily Hours, and Current Level are required.")
      return
    }

    const hours = parseInt(dailyHours, 10)
    if (isNaN(hours) || hours <= 0 || hours > 24) {
      setError("Daily hours must be a realistic number between 1 and 24.")
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        setError("User session not found. Please log in first.")
        setIsLoading(false)
        return
      }

      const { data, error: insertError } = await supabase
        .from("goals")
        .insert({
          user_id: user.id,
          title: title.trim(),
          why: why.trim(),
          why_image_url: whyImageUrl.trim() || null,
          sacrifice_cost: sacrificeCost.trim() || null,
          stop_doing_list: stopDoingList.trim() || null,
          decision_deadline: decisionDeadline || null,
          routine: {
            wake_up_time: wakeUpTime || null,
            sleep_time: sleepTime || null,
          },
          deadline,
          daily_hours: hours,
          current_level: currentLevel,
        })
        .select("id")
        .single()

      if (insertError) {
        setError(insertError.message || "Failed to commit goal to database.")
        setIsLoading(false)
        return
      }

      router.push(`/plan/${data.id}`)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("An unexpected error occurred while saving your goal.")
      }
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] flex items-center justify-center px-4 py-12 selection:bg-[#8B0000] selection:text-[#f5f5f5]">
      <div className="w-full max-w-xl space-y-8 bg-[#111111] border border-[#262626] rounded-xl p-6 sm:p-8 shadow-2xl">
        <div className="space-y-2 text-left">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-semibold text-[#8B0000]">
            <Target className="size-3.5" />
            Target Acquisition
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#f5f5f5]">
            Define Your War
          </h1>
          <p className="text-sm text-[#a3a3a3]">
            No delusions. Total accountability. Enter the objective you will hold yourself to.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md border border-[#8B0000]/60 bg-[#8B0000]/10 px-4 py-3 text-sm font-medium text-red-400">
              {error}
            </div>
          )}

          {/* 1. Goal Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-semibold tracking-wide text-[#f5f5f5]">
              What is your goal?
            </Label>
            <Input
              id="title"
              name="title"
              type="text"
              required
              disabled={isLoading}
              placeholder="e.g., Crack NEET 2027, Build a SaaS, Sub-3hr Marathon"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border-[#262626] bg-[#1a1a1a] text-[#f5f5f5] placeholder:text-[#a3a3a3]/50 focus-visible:border-[#8B0000] focus-visible:ring-1 focus-visible:ring-[#8B0000] h-10"
            />
          </div>

          {/* 2. Why it matters (The Strong Why) */}
          <div className="space-y-2">
            <Label htmlFor="why" className="text-sm font-semibold tracking-wide text-[#f5f5f5] flex items-center gap-2">
              <Flame className="size-3.5 text-[#8B0000]" />
              The Strong Why (Why does this matter?)
            </Label>
            <Textarea
              id="why"
              name="why"
              required
              disabled={isLoading}
              placeholder="Explain the stakes. What happens if you fail? What changes when you succeed? The AI will hold you to this."
              rows={4}
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              className="border-[#262626] bg-[#1a1a1a] text-[#f5f5f5] placeholder:text-[#a3a3a3]/50 focus-visible:border-[#8B0000] focus-visible:ring-1 focus-visible:ring-[#8B0000] resize-y min-h-[100px]"
            />
          </div>

          {/* 3. Why Image URL */}
          <div className="space-y-2">
            <Label htmlFor="why_image_url" className="text-sm font-semibold tracking-wide text-[#f5f5f5] flex items-center gap-2">
              <ImageIcon className="size-3.5 text-[#8B0000]" />
              Visual Anchor Image URL (Optional)
            </Label>
            <Input
              id="why_image_url"
              name="why_image_url"
              type="url"
              disabled={isLoading}
              placeholder="https://images.unsplash.com/... or any image URL"
              value={whyImageUrl}
              onChange={(e) => setWhyImageUrl(e.target.value)}
              className="border-[#262626] bg-[#1a1a1a] text-[#f5f5f5] placeholder:text-[#a3a3a3]/50 focus-visible:border-[#8B0000] focus-visible:ring-1 focus-visible:ring-[#8B0000] h-10"
            />
            <p className="text-[11px] font-mono text-[#a3a3a3]">
              Displayed prominently on your Dashboard to visually reinforce your purpose daily.
            </p>
          </div>

          {/* 4. Sacrifice Cost */}
          <div className="space-y-2">
            <Label htmlFor="sacrifice_cost" className="text-sm font-semibold tracking-wide text-[#f5f5f5]">
              Sacrifice Cost
            </Label>
            <Input
              id="sacrifice_cost"
              name="sacrifice_cost"
              type="text"
              disabled={isLoading}
              placeholder="e.g., Weekend leisure, social media binges, late-night snacking"
              value={sacrificeCost}
              onChange={(e) => setSacrificeCost(e.target.value)}
              className="border-[#262626] bg-[#1a1a1a] text-[#f5f5f5] placeholder:text-[#a3a3a3]/50 focus-visible:border-[#8B0000] focus-visible:ring-1 focus-visible:ring-[#8B0000] h-10"
            />
          </div>

          {/* 5. Stop Doing List */}
          <div className="space-y-2">
            <Label htmlFor="stop_doing_list" className="text-sm font-semibold tracking-wide text-[#f5f5f5] flex items-center gap-2">
              <Ban className="size-3.5 text-[#8B0000]" />
              Stop Doing List (Vices to Eliminate)
            </Label>
            <Textarea
              id="stop_doing_list"
              name="stop_doing_list"
              disabled={isLoading}
              placeholder="List habits, toxic loops, and time sinks you must completely stop doing."
              rows={3}
              value={stopDoingList}
              onChange={(e) => setStopDoingList(e.target.value)}
              className="border-[#262626] bg-[#1a1a1a] text-[#f5f5f5] placeholder:text-[#a3a3a3]/50 focus-visible:border-[#8B0000] focus-visible:ring-1 focus-visible:ring-[#8B0000] resize-y"
            />
          </div>

          {/* 6. Decision Deadline */}
          <div className="space-y-2">
            <Label htmlFor="decision_deadline" className="text-sm font-semibold tracking-wide text-[#f5f5f5] flex items-center gap-2">
              <Calendar className="size-3.5 text-[#8B0000]" />
              Decision Deadline
            </Label>
            <Input
              id="decision_deadline"
              name="decision_deadline"
              type="date"
              disabled={isLoading}
              value={decisionDeadline}
              onChange={(e) => setDecisionDeadline(e.target.value)}
              className="border-[#262626] bg-[#1a1a1a] text-[#f5f5f5] [color-scheme:dark] focus-visible:border-[#8B0000] focus-visible:ring-1 focus-visible:ring-[#8B0000] h-10"
            />
            <p className="text-[11px] font-mono text-[#a3a3a3]">
              Date by which you commit to making the hard strategic pivot or critical choice.
            </p>
          </div>

          {/* 7. Daily Routine Section */}
          <div className="rounded-lg border border-[#262626] bg-[#161616] p-4 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#262626] pb-2">
              <Clock className="size-4 text-[#8B0000]" />
              <span className="text-xs font-mono font-bold tracking-widest text-[#f5f5f5] uppercase">
                Daily Routine Protocol
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="wake_up_time" className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider">
                  Wake Up Time
                </Label>
                <Input
                  id="wake_up_time"
                  name="wake_up_time"
                  type="time"
                  disabled={isLoading}
                  value={wakeUpTime}
                  onChange={(e) => setWakeUpTime(e.target.value)}
                  className="border-[#262626] bg-[#1a1a1a] text-[#f5f5f5] [color-scheme:dark] focus-visible:border-[#8B0000] focus-visible:ring-1 focus-visible:ring-[#8B0000] h-10 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sleep_time" className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider">
                  Sleep Time
                </Label>
                <Input
                  id="sleep_time"
                  name="sleep_time"
                  type="time"
                  disabled={isLoading}
                  value={sleepTime}
                  onChange={(e) => setSleepTime(e.target.value)}
                  className="border-[#262626] bg-[#1a1a1a] text-[#f5f5f5] [color-scheme:dark] focus-visible:border-[#8B0000] focus-visible:ring-1 focus-visible:ring-[#8B0000] h-10 font-mono"
                />
              </div>
            </div>
          </div>

          {/* 8. Target Deadline */}
          <div className="space-y-2">
            <Label htmlFor="deadline" className="text-sm font-semibold tracking-wide text-[#f5f5f5]">
              Target Deadline
            </Label>
            <Input
              id="deadline"
              name="deadline"
              type="date"
              required
              disabled={isLoading}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="border-[#262626] bg-[#1a1a1a] text-[#f5f5f5] [color-scheme:dark] focus-visible:border-[#8B0000] focus-visible:ring-1 focus-visible:ring-[#8B0000] h-10"
            />
          </div>

          {/* 9. Daily Hours */}
          <div className="space-y-2">
            <Label htmlFor="dailyHours" className="text-sm font-semibold tracking-wide text-[#f5f5f5]">
              Daily hours you can commit
            </Label>
            <Input
              id="dailyHours"
              name="dailyHours"
              type="number"
              min="1"
              max="24"
              step="1"
              required
              disabled={isLoading}
              placeholder="e.g., 4"
              value={dailyHours}
              onChange={(e) => setDailyHours(e.target.value)}
              className="border-[#262626] bg-[#1a1a1a] text-[#f5f5f5] placeholder:text-[#a3a3a3]/50 focus-visible:border-[#8B0000] focus-visible:ring-1 focus-visible:ring-[#8B0000] h-10"
            />
          </div>

          {/* 10. Current Level */}
          <div className="space-y-2">
            <Label htmlFor="currentLevel" className="text-sm font-semibold tracking-wide text-[#f5f5f5]">
              Current level
            </Label>
            <Select
              value={currentLevel ?? undefined}
              onValueChange={(val) => setCurrentLevel(val)}
              disabled={isLoading}
            >
              <SelectTrigger
                id="currentLevel"
                className="w-full border-[#262626] bg-[#1a1a1a] text-[#f5f5f5] focus-visible:border-[#8B0000] focus-visible:ring-1 focus-visible:ring-[#8B0000] h-10 justify-between px-3"
              >
                <SelectValue placeholder="Select current level" />
              </SelectTrigger>
              <SelectContent className="border-[#262626] bg-[#1a1a1a] text-[#f5f5f5]">
                <SelectItem
                  value="Beginner"
                  className="focus:bg-[#8B0000]/20 focus:text-[#f5f5f5] cursor-pointer"
                >
                  Beginner
                </SelectItem>
                <SelectItem
                  value="Intermediate"
                  className="focus:bg-[#8B0000]/20 focus:text-[#f5f5f5] cursor-pointer"
                >
                  Intermediate
                </SelectItem>
                <SelectItem
                  value="Advanced"
                  className="focus:bg-[#8B0000]/20 focus:text-[#f5f5f5] cursor-pointer"
                >
                  Advanced
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-[#8B0000] hover:bg-[#6e0000] text-[#f5f5f5] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? t("Locking in Objective...") : t("Lock in Goal")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
