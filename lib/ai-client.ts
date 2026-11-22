import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { createClient } from "@/lib/supabase/server"

export type AIProvider = "anthropic" | "gemini" | "deepseek" | "openai"

interface AIClientResult {
  client: Anthropic | OpenAI
  provider: AIProvider
  model: string
}

const PROVIDER_BASE_URLS: Record<Exclude<AIProvider, "anthropic" | "openai">, string> = {
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/",
  deepseek: "https://api.deepseek.com",
}

const PROVIDER_MODELS: Record<AIProvider, string> = {
  anthropic: "claude-3-5-sonnet-20241022",
  gemini: "gemini-3.8-flash",
  deepseek: "deepseek-chat",
  openai: "gpt-4o-mini",
}

function isValidProvider(value: string): value is AIProvider {
  return ["anthropic", "gemini", "deepseek", "openai"].includes(value)
}

export async function getAIClient(userId: string): Promise<AIClientResult> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("user_settings")
    .select("ai_provider, api_key")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to retrieve AI settings: ${error.message}`)
  }

  if (!data || !data.api_key || !data.ai_provider) {
    throw new Error(
      "No API key found. Please go to Settings and add your key."
    )
  }

  const rawProvider = String(data.ai_provider).toLowerCase()
  if (!isValidProvider(rawProvider)) {
    throw new Error(
      `Unsupported AI provider: "${data.ai_provider}". Supported providers: anthropic, gemini, deepseek, openai.`
    )
  }

  const provider: AIProvider = rawProvider
  const apiKey: string = data.api_key
  const model = PROVIDER_MODELS[provider]

  if (provider === "anthropic") {
    return { client: new Anthropic({ apiKey }), provider, model }
  }

  // OpenAI-compatible providers (gemini, deepseek, openai)
  const baseURL =
    provider === "openai" ? undefined : PROVIDER_BASE_URLS[provider]

  return {
    client: new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) }),
    provider,
    model,
  }
}

/**
 * Calls the AI client with a system prompt and user prompt, returning the
 * raw text response. Handles both Anthropic and OpenAI-compatible clients.
 */
export async function callAI(
  clientResult: AIClientResult,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  const { client, provider, model } = clientResult

  if (provider === "anthropic") {
    const anthropic = client as Anthropic
    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    })

    let text = ""
    for (const block of response.content) {
      if (block.type === "text") {
        text += block.text
      }
    }
    return text
  }

  // OpenAI-compatible path (gemini, deepseek, openai)
  const openai = client as OpenAI
  const response = await openai.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  })

  return response.choices[0]?.message?.content ?? ""
}
