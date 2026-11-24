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

export default function NewGoalPage() {
  const router = useRouter()
  const { t } = useTranslation()

  const [title, setTitle] = React.useState("")
  const [why, setWhy] = React.useState("")
  const [deadline, setDeadline] = React.useState("")
  const [dailyHours, setDailyHours] = React.useState("")
  const [currentLevel, setCurrentLevel] = React.useState<string | null>(null)

  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!title.trim() || !why.trim() || !deadline || !dailyHours || !currentLevel) {
      setError("All fields are mandatory. Define your target completely.")
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
          <div className="inline-block text-xs uppercase tracking-widest font-semibold text-[#8B0000]">
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
              placeholder="e.g., Crack NEET 2027, Build a SaaS"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border-[#262626] bg-[#1a1a1a] text-[#f5f5f5] placeholder:text-[#a3a3a3]/50 focus-visible:border-[#8B0000] focus-visible:ring-1 focus-visible:ring-[#8B0000] h-10"
            />
          </div>

          {/* 2. Why it matters */}
          <div className="space-y-2">
            <Label htmlFor="why" className="text-sm font-semibold tracking-wide text-[#f5f5f5]">
              Why does this matter? (Be honest, the AI will remember this)
            </Label>
            <Textarea
              id="why"
              name="why"
              required
              disabled={isLoading}
              placeholder="Explain the stakes. What happens if you fail? What changes when you succeed?"
              rows={4}
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              className="border-[#262626] bg-[#1a1a1a] text-[#f5f5f5] placeholder:text-[#a3a3a3]/50 focus-visible:border-[#8B0000] focus-visible:ring-1 focus-visible:ring-[#8B0000] resize-y min-h-[100px]"
            />
          </div>

          {/* 3. Deadline */}
          <div className="space-y-2">
            <Label htmlFor="deadline" className="text-sm font-semibold tracking-wide text-[#f5f5f5]">
              Deadline
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

          {/* 4. Daily Hours */}
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

          {/* 5. Current Level */}
          <div className="space-y-2">
            <Label htmlFor="currentLevel" className="text-sm font-semibold tracking-wide text-[#f5f5f5]">
              Current level
            </Label>
            <Select
              value={currentLevel}
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

