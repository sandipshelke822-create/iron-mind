import { NextRequest, NextResponse } from "next/server"
import { getSystemPrompt } from "@/lib/prompts"
import { createClient } from "@/lib/supabase/server"
import { getAIClient, callAI } from "@/lib/ai-client"

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
  assessment: string
  weekly_milestones: WeeklyMilestone[]
  day_1_plan: Day1Plan
  warrior_note: string
}

interface RoutineConfig {
  wake_up_time?: string | null
  sleep_time?: string | null
}

interface GeneratePlanRequestBody {
  goalId: string
  title: string
  why: string
  deadline: string
  dailyHours: number | string
  currentLevel: string
  routine?: RoutineConfig | null
  sacrifice_cost?: string | null
  sacrificeCost?: string | null
  stop_doing_list?: string | null
  stopDoingList?: string | null
}

function calculateDaysRemaining(deadlineStr: string): number {
  const targetDate = new Date(deadlineStr)
  const now = new Date()

  const targetUTC = Date.UTC(
    targetDate.getUTCFullYear(),
    targetDate.getUTCMonth(),
    targetDate.getUTCDate()
  )
  const nowUTC = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  )

  const diffMs = targetUTC - nowUTC
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

function parseAndValidatePlan(rawText: string): WarPlan {
  let cleaned = rawText.trim()

  // Strip markdown code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")
  } else {
    // If text contains markdown block inside or surrounding text, extract between first { and last }
    const firstBrace = cleaned.indexOf("{")
    const lastBrace = cleaned.lastIndexOf("}")
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1)
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to parse Claude response as JSON: ${message}`)
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid plan structure: output is not a JSON object")
  }

  const candidate = parsed as Record<string, unknown>

  if (typeof candidate.assessment !== "string" || !candidate.assessment.trim()) {
    throw new Error("Invalid plan structure: missing or non-string 'assessment'")
  }

  if (!Array.isArray(candidate.weekly_milestones)) {
    throw new Error("Invalid plan structure: missing or non-array 'weekly_milestones'")
  }

  for (let i = 0; i < candidate.weekly_milestones.length; i++) {
    const milestone = candidate.weekly_milestones[i]
    if (
      !milestone ||
      typeof milestone !== "object" ||
      typeof (milestone as Record<string, unknown>).week !== "number" ||
      typeof (milestone as Record<string, unknown>).focus !== "string" ||
      typeof (milestone as Record<string, unknown>).measurable_outcome !== "string"
    ) {
      throw new Error(`Invalid milestone item at index ${i}`)
    }
  }

  if (!candidate.day_1_plan || typeof candidate.day_1_plan !== "object") {
    throw new Error("Invalid plan structure: missing or invalid 'day_1_plan' object")
  }

  const day1 = candidate.day_1_plan as Record<string, unknown>
  if (!Array.isArray(day1.blocks)) {
    throw new Error("Invalid plan structure: 'day_1_plan.blocks' must be an array")
  }

  for (let i = 0; i < day1.blocks.length; i++) {
    const block = day1.blocks[i]
    if (
      !block ||
      typeof block !== "object" ||
      typeof (block as Record<string, unknown>).start !== "string" ||
      typeof (block as Record<string, unknown>).end !== "string" ||
      typeof (block as Record<string, unknown>).task !== "string" ||
      typeof (block as Record<string, unknown>).type !== "string"
    ) {
      throw new Error(`Invalid schedule block item at index ${i}`)
    }
  }

  if (typeof day1.non_negotiable !== "string" || !day1.non_negotiable.trim()) {
    throw new Error("Invalid plan structure: missing or non-string 'day_1_plan.non_negotiable'")
  }

  if (typeof candidate.warrior_note !== "string" || !candidate.warrior_note.trim()) {
    throw new Error("Invalid plan structure: missing or non-string 'warrior_note'")
  }

  return parsed as WarPlan
}

export async function POST(req: NextRequest) {
  try {
    let body: GeneratePlanRequestBody
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body." },
        { status: 400 }
      )
    }

    const { goalId, title, why, deadline, dailyHours, currentLevel } = body

    if (
      !goalId ||
      typeof goalId !== "string" ||
      !title ||
      typeof title !== "string" ||
      !why ||
      typeof why !== "string" ||
      !deadline ||
      typeof deadline !== "string" ||
      currentLevel === undefined ||
      currentLevel === null ||
      typeof currentLevel !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "Missing or invalid required fields: goalId, title, why, deadline, dailyHours, and currentLevel are mandatory.",
        },
        { status: 400 }
      )
    }

    const numericDailyHours = Number(dailyHours)
    if (isNaN(numericDailyHours) || numericDailyHours <= 0 || numericDailyHours > 24) {
      return NextResponse.json(
        { error: "dailyHours must be a valid number between 1 and 24." },
        { status: 400 }
      )
    }

    const targetDate = new Date(deadline)
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid deadline date format. Provide a valid date (e.g., YYYY-MM-DD)." },
        { status: 400 }
      )
    }

    const daysLeft = calculateDaysRemaining(deadline)

    // 1. Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Valid authentication session required." },
        { status: 401 }
      )
    }

    // 2. Fetch the goal record from Supabase to retrieve routine, sacrifice_cost, and stop_doing_list
    const { data: goalRecord, error: goalFetchError } = await supabase
      .from("goals")
      .select("routine, sacrifice_cost, stop_doing_list")
      .eq("id", goalId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (goalFetchError) {
      console.warn("[generate-plan] Could not fetch goal record details:", goalFetchError.message)
    }

    const routine: RoutineConfig =
      body.routine || (goalRecord?.routine as RoutineConfig) || {}
    const sacrificeCost = (
      body.sacrifice_cost ||
      body.sacrificeCost ||
      goalRecord?.sacrifice_cost ||
      ""
    ).trim()
    const stopDoingList = (
      body.stop_doing_list ||
      body.stopDoingList ||
      goalRecord?.stop_doing_list ||
      ""
    ).trim()

    const wakeUpTime = routine.wake_up_time?.trim() || "05:00"
    const sleepTime = routine.sleep_time?.trim() || "22:00"

    // 3. Retrieve BYOK AI client for this user
    let aiClientResult: Awaited<ReturnType<typeof getAIClient>>
    try {
      aiClientResult = await getAIClient(user.id)
    } catch (keyError: unknown) {
      const message = keyError instanceof Error ? keyError.message : String(keyError)
      return NextResponse.json({ error: message }, { status: 402 })
    }

    // Fetch user language preference from user_settings table
    const { data: settingsData } = await supabase
      .from("user_settings")
      .select("language")
      .eq("user_id", user.id)
      .maybeSingle()

    const systemPrompt = getSystemPrompt(settingsData?.language || "en")

    const userPrompt = `
TARGET ACQUISITION DETAILS:
- Target Goal: ${title.trim()}
- Core Motivation ("Why"): ${why.trim()}
- Target Deadline: ${deadline}
- Days Remaining: ${daysLeft} days
- Dedicated Daily Hours: ${numericDailyHours} hours/day
- Current Baseline Level: ${currentLevel.trim()}
- Daily Routine: Wake Up at ${wakeUpTime}, Sleep at ${sleepTime}
- Sacrifice Cost: ${sacrificeCost || "Not specified (demand extreme ownership)"}
- Stop Doing List: ${stopDoingList || "Not specified (demand elimination of vices and distractions)"}

TACTICAL MISSION:
As IRON MIND, engineer a ruthless, highly structured War Plan for this user based on their stated goal, baseline level, allocated time, routine schedule, and deadline urgency.

URGENCY CONTEXT:
The user has ${daysLeft} days remaining. ${
      daysLeft <= 0
        ? "The deadline is immediate or past due. Extreme crisis triage mode."
        : daysLeft < 30
        ? "High urgency combat timeline. Every single hour is critical."
        : "Mid-to-long term war campaign. Compounding daily execution required."
    }

CRITICAL RULES:
1. You must respond ONLY with a single valid JSON object.
2. Do NOT wrap the JSON in markdown code blocks (\`\`\`json or \`\`\`).
3. Do NOT include any introductory or concluding text, conversational filler, or preamble.
4. Adhere strictly to the zero-emojis rule. Never include emojis anywhere.
5. In "day_1_plan", provide concrete, realistic time blocks that distribute the user's ${numericDailyHours} daily hours with precision.
6. Each block "type" must be strictly one of: "deep_work", "revision", "test", or "rest".
7. THE SEED RULE: Do NOT overwhelm the user on Day 1. Day 1 must only be about setup and tiny wins (e.g., creating accounts, gathering tools, writing down the idea). Day 2 should be slightly bigger. Build the habit first.
8. ROUTINE RULE: Respect the user's wake_up and sleep times. Schedule their peak focus blocks around their available hours.
9. REMINDER: In the \`warrior_note\`, remind them of their \`sacrifice_cost\` and tell them to stop doing things in their \`stop_doing_list\`.
10. The JSON must have this exact shape:
{
  "assessment": "2-3 lines of brutal honest reality check about the goal and timeline",
  "weekly_milestones": [
    {
      "week": 1,
      "focus": "...",
      "measurable_outcome": "..."
    }
  ],
  "day_1_plan": {
    "blocks": [
      {
        "start": "06:00",
        "end": "07:30",
        "task": "...",
        "type": "deep_work"
      }
    ],
    "non_negotiable": "The ONE task that cannot be skipped"
  },
  "warrior_note": "One hard truth about this path, reminding them of their sacrifice_cost and commanding them to stop doing items from their stop_doing_list"
}
`.trim()

    // 4. Invoke AI
    let responseText = ""
    try {
      responseText = await callAI(aiClientResult, systemPrompt, userPrompt, 3000)
    } catch (aiError: unknown) {
      const message = aiError instanceof Error ? aiError.message : String(aiError)
      console.error("[generate-plan] AI API invocation failure:", aiError)
      return NextResponse.json(
        { error: `AI API failure: ${message}` },
        { status: 500 }
      )
    }

    if (!responseText.trim()) {
      return NextResponse.json(
        { error: "Claude returned an empty response." },
        { status: 500 }
      )
    }

    let parsedPlan: WarPlan
    try {
      parsedPlan = parseAndValidatePlan(responseText)
    } catch (validationError: unknown) {
      const message =
        validationError instanceof Error
          ? validationError.message
          : String(validationError)
      console.error("[generate-plan] JSON validation failure:", message, "Raw text:", responseText)
      return NextResponse.json(
        { error: `Invalid AI plan generated: ${message}` },
        { status: 500 }
      )
    }

    const { data: battlePlanRecord, error: dbError } = await supabase
      .from("battle_plans")
      .insert({
        goal_id: goalId,
        week_number: 1,
        milestones: parsedPlan,
      })
      .select("id, goal_id, week_number, created_at")
      .single()

    if (dbError) {
      console.error("[generate-plan] Supabase insertion error:", dbError)
      return NextResponse.json(
        { error: `Failed to save battle plan to database: ${dbError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        ...parsedPlan,
        id: battlePlanRecord.id,
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    console.error("[generate-plan] Unhandled error:", error)
    return NextResponse.json(
      { error: `Internal server error: ${message}` },
      { status: 500 }
    )
  }
}
