import { NextRequest, NextResponse } from "next/server"
import { IRON_MIND_SYSTEM_PROMPT } from "@/lib/prompts"
import { createClient } from "@/lib/supabase/server"
import { getAIClient, callAI } from "@/lib/ai-client"

export interface DailyVerdictResponse {
  verdict: string
  score: number
  excuse_detected: string | null
  directive_tomorrow: string
}

interface DailyVerdictRequestBody {
  goalId?: string
  plannedTasks: unknown
  completedTasks: unknown
  hoursWorked: number | string
  userNote?: string
}

function formatTaskList(tasks: unknown): string {
  if (Array.isArray(tasks)) {
    if (tasks.length === 0) return "None specified."
    return tasks
      .map((t, idx) => {
        if (typeof t === "string") return `${idx + 1}. ${t}`
        if (typeof t === "object" && t !== null) {
          const item = t as Record<string, unknown>
          const name =
            item.task ||
            item.title ||
            item.name ||
            item.description ||
            JSON.stringify(item)
          const status = item.completed
            ? "[COMPLETED]"
            : item.status
            ? `[${item.status}]`
            : ""
          return `${idx + 1}. ${name} ${status}`.trim()
        }
        return `${idx + 1}. ${String(t)}`
      })
      .join("\n")
  }
  if (typeof tasks === "string" && tasks.trim()) {
    return tasks.trim()
  }
  return "None specified."
}

function parseAndValidateVerdict(rawText: string): DailyVerdictResponse {
  let cleaned = rawText.trim()

  // Strip markdown code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim()
  } else {
    // If text contains markdown block or commentary, extract between first { and last }
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
    throw new Error("Invalid verdict structure: response is not a JSON object")
  }

  const candidate = parsed as Record<string, unknown>

  if (typeof candidate.verdict !== "string" || !candidate.verdict.trim()) {
    throw new Error("Invalid verdict structure: missing or non-string 'verdict'")
  }

  const rawScore = Number(candidate.score)
  if (isNaN(rawScore) || rawScore < 1 || rawScore > 10) {
    throw new Error("Invalid verdict structure: 'score' must be a number between 1 and 10")
  }
  const score = Math.round(rawScore)

  let excuseDetected: string | null = null
  if (
    candidate.excuse_detected !== null &&
    candidate.excuse_detected !== undefined
  ) {
    if (typeof candidate.excuse_detected === "string") {
      const trimmed = candidate.excuse_detected.trim()
      excuseDetected =
        trimmed.toLowerCase() === "null" ||
        trimmed.toLowerCase() === "none" ||
        trimmed === ""
          ? null
          : trimmed
    } else {
      excuseDetected = String(candidate.excuse_detected)
    }
  }

  if (
    typeof candidate.directive_tomorrow !== "string" ||
    !candidate.directive_tomorrow.trim()
  ) {
    throw new Error(
      "Invalid verdict structure: missing or non-string 'directive_tomorrow'"
    )
  }

  return {
    verdict: candidate.verdict.trim(),
    score,
    excuse_detected: excuseDetected,
    directive_tomorrow: candidate.directive_tomorrow.trim(),
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Parse and validate JSON request body
    let body: DailyVerdictRequestBody
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body." },
        { status: 400 }
      )
    }

    const { goalId, plannedTasks, completedTasks, hoursWorked, userNote } = body

    if (plannedTasks === undefined || plannedTasks === null) {
      return NextResponse.json(
        { error: "Missing required field: plannedTasks." },
        { status: 400 }
      )
    }

    if (completedTasks === undefined || completedTasks === null) {
      return NextResponse.json(
        { error: "Missing required field: completedTasks." },
        { status: 400 }
      )
    }

    if (hoursWorked === undefined || hoursWorked === null) {
      return NextResponse.json(
        { error: "Missing required field: hoursWorked." },
        { status: 400 }
      )
    }

    const parsedHoursWorked =
      typeof hoursWorked === "number" ? hoursWorked : parseFloat(String(hoursWorked))

    if (isNaN(parsedHoursWorked) || parsedHoursWorked < 0 || parsedHoursWorked > 24) {
      return NextResponse.json(
        { error: "hoursWorked must be a valid number between 0 and 24." },
        { status: 400 }
      )
    }

    // 2. Authenticate user via Supabase server client
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

    // 3. Optional goal context retrieval
    let goalContext = ""
    if (goalId && typeof goalId === "string") {
      try {
        const { data: goal } = await supabase
          .from("goals")
          .select("title, why, daily_hours")
          .eq("id", goalId)
          .eq("user_id", user.id)
          .maybeSingle()

        if (goal) {
          goalContext = `GOAL CONTEXT:
- Target Goal: ${goal.title}
- Stated Purpose ("Why"): ${goal.why}
- Committed Daily Hours: ${goal.daily_hours} hours/day`
        }
      } catch (goalFetchError) {
        console.warn("[daily-verdict] Non-fatal goal context retrieval issue:", goalFetchError)
      }
    }

    // 3. Retrieve BYOK AI client for this user
    let aiClientResult: Awaited<ReturnType<typeof getAIClient>>
    try {
      aiClientResult = await getAIClient(user.id)
    } catch (keyError: unknown) {
      const message = keyError instanceof Error ? keyError.message : String(keyError)
      return NextResponse.json({ error: message }, { status: 402 })
    }

    // 5. Construct prompt for Claude
    const formattedPlannedTasks = formatTaskList(plannedTasks)
    const formattedCompletedTasks = formatTaskList(completedTasks)
    const cleanUserNote =
      typeof userNote === "string" && userNote.trim()
        ? userNote.trim()
        : "No notes or explanations provided."

    const userPrompt = `
DAILY COMBAT LOG EVALUATION:
${goalContext ? `${goalContext}\n` : ""}- Planned Tasks for Today:
${formattedPlannedTasks}

- Actually Completed Tasks:
${formattedCompletedTasks}

- Total Hours Logged Today: ${parsedHoursWorked} hours
- User's Self-Report / Daily Note: "${cleanUserNote}"

TACTICAL MISSION:
Review this daily log with unsparing rigor against the IRON MIND persona and operating rules.
Compare what was promised versus what was actually executed. Evaluate whether hours logged translate to true progress or mechanical evasion. Examine the user's note for covert excuses, comfort rationalizations, or weakness masquerading as reason.

CRITICAL OPERATIONAL CONSTRAINTS:
1. You must respond ONLY with a single valid JSON object.
2. Do NOT wrap the JSON in markdown code blocks (\`\`\`json or \`\`\`).
3. Do NOT include any introductory or concluding text, conversational filler, or preamble.
4. ZERO EMOJIS: Never include emojis anywhere in your output under any circumstances.
5. In "verdict": 3-4 lines of brutal, honest assessment of logged actions vs. the plan. State clearly whether the day was won or lost. Seamlessly integrate exactly ONE stoic or warrior maxim (philosophical anchor) into the assessment.
6. In "score": An integer from 1 to 10 based on the rubric (10 = Flawless execution with zero deviation; 7 = Duty fulfilled but mechanical; 5 = Mediocrity, compromises made; 1-4 = Total dereliction of duty, surrender to comfort).
7. In "excuse_detected": Name the exact excuse or cognitive trap identified (e.g., "Fatigue rationalization", "Passive procrastination", "Dopamine-seeking detour"). If execution was flawless with absolute ownership, return null.
8. In "directive_tomorrow": Exactly ONE specific, time-bound, non-negotiable operational action order for tomorrow (e.g., "05:00: 90-minute uninterrupted deep work block on core module without internet connectivity. Non-negotiable.").

JSON STRUCTURE REQUIRED:
{
  "verdict": "3-4 lines of brutal honest assessment, philosophical anchor included, no emojis",
  "score": 7,
  "excuse_detected": "name the excuse if any, else null",
  "directive_tomorrow": "ONE non-negotiable action for tomorrow — specific, time-bound"
}
`.trim()

    // 6. Invoke AI
    let responseText = ""
    try {
      responseText = await callAI(aiClientResult, IRON_MIND_SYSTEM_PROMPT, userPrompt, 1500)
    } catch (aiError: unknown) {
      const message =
        aiError instanceof Error ? aiError.message : String(aiError)
      console.error("[daily-verdict] AI API invocation failure:", aiError)
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

    // 7. Parse and validate Claude's response
    let parsedVerdict: DailyVerdictResponse
    try {
      parsedVerdict = parseAndValidateVerdict(responseText)
    } catch (validationError: unknown) {
      const message =
        validationError instanceof Error
          ? validationError.message
          : String(validationError)
      console.error(
        "[daily-verdict] JSON validation failure:",
        message,
        "Raw text:",
        responseText
      )
      return NextResponse.json(
        { error: `Invalid AI verdict generated: ${message}` },
        { status: 500 }
      )
    }

    // 8. Prepare completed_tasks JSONB for database insertion
    let jsonbCompletedTasks: unknown = completedTasks
    if (typeof completedTasks === "string") {
      try {
        jsonbCompletedTasks = JSON.parse(completedTasks)
      } catch {
        jsonbCompletedTasks = [completedTasks]
      }
    }

    const todayDate = new Date().toISOString().split("T")[0]

    // 9. Persist into daily_reports table
    const { data: dailyReportRecord, error: dbError } = await supabase
      .from("daily_reports")
      .insert({
        user_id: user.id,
        date: todayDate,
        completed_tasks: jsonbCompletedTasks,
        hours_worked: parsedHoursWorked,
        ai_verdict: parsedVerdict.verdict,
        ai_score: parsedVerdict.score,
        directive_tomorrow: parsedVerdict.directive_tomorrow,
      })
      .select("id, date, created_at")
      .single()

    if (dbError) {
      console.error("[daily-verdict] Supabase insertion error:", dbError)
      return NextResponse.json(
        { error: `Failed to save daily report to database: ${dbError.message}` },
        { status: 500 }
      )
    }

    // 10. Return generated verdict to frontend
    return NextResponse.json(
      {
        id: dailyReportRecord.id,
        verdict: parsedVerdict.verdict,
        score: parsedVerdict.score,
        excuse_detected: parsedVerdict.excuse_detected,
        directive_tomorrow: parsedVerdict.directive_tomorrow,
        date: todayDate,
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error"
    console.error("[daily-verdict] Unhandled error:", error)
    return NextResponse.json(
      { error: `Internal server error: ${message}` },
      { status: 500 }
    )
  }
}

