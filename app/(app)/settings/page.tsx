"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useTranslation, type Language } from "@/lib/translations"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ArrowLeft,
  KeyRound,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  Languages,
} from "lucide-react"

type AIProvider = "gemini" | "openai" | "anthropic" | "deepseek"

const PROVIDER_OPTIONS: Record<AIProvider, string> = {
  gemini: "gemini (Google)",
  openai: "openai (ChatGPT)",
  anthropic: "anthropic (Claude)",
  deepseek: "deepseek",
}

const LANGUAGE_OPTIONS: Record<Language, string> = {
  en: "English",
  hi: "Hindi",
  mr: "Marathi",
}

export default function SettingsPage() {
  const router = useRouter()
  const { language: contextLang, setLanguage: setContextLang, t } = useTranslation()

  const [aiProvider, setAiProvider] = React.useState<AIProvider>("gemini")
  const [apiKey, setApiKey] = React.useState("")
  const [preferredLanguage, setPreferredLanguage] = React.useState<Language>(contextLang)
  const [userId, setUserId] = React.useState<string | null>(null)

  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // Sync preferredLanguage with contextLang if it updates
  React.useEffect(() => {
    setPreferredLanguage(contextLang)
  }, [contextLang])

  React.useEffect(() => {
    let isMounted = true

    async function loadSettings() {
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

        const { data, error } = await supabase
          .from("user_settings")
          .select("ai_provider, api_key, language")
          .eq("user_id", user.id)
          .maybeSingle()

        if (error) {
          console.error("Error fetching user settings:", error)
        } else if (data && isMounted) {
          if (
            data.ai_provider &&
            (data.ai_provider in PROVIDER_OPTIONS)
          ) {
            setAiProvider(data.ai_provider as AIProvider)
          }
          if (data.api_key) {
            setApiKey(data.api_key)
          }
          if (
            data.language &&
            (data.language === "en" || data.language === "hi" || data.language === "mr")
          ) {
            setPreferredLanguage(data.language as Language)
            setContextLang(data.language as Language)
          }
        }
      } catch (err: unknown) {
        console.error("Failed to load user settings:", err)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadSettings()

    return () => {
      isMounted = false
    }
  }, [router, setContextLang])

  const handleLanguageChange = (val: string | null) => {
    if (val === "en" || val === "hi" || val === "mr") {
      setPreferredLanguage(val as Language)
      setContextLang(val as Language)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSuccessMessage(null)
    setErrorMessage(null)

    if (!apiKey.trim()) {
      setErrorMessage(t("API Key is required."))
      return
    }

    setIsSaving(true)

    try {
      const supabase = createClient()
      let currentUserId = userId

      if (!currentUserId) {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          setErrorMessage("User session not found. Please sign in again.")
          setIsSaving(false)
          return
        }
        currentUserId = user.id
        setUserId(user.id)
      }

      const { error: upsertError } = await supabase
        .from("user_settings")
        .upsert(
          {
            user_id: currentUserId,
            ai_provider: aiProvider,
            api_key: apiKey.trim(),
            language: preferredLanguage,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )

      if (upsertError) {
        setErrorMessage(upsertError.message || "Failed to commit settings.")
      } else {
        await setContextLang(preferredLanguage)
        setSuccessMessage(t("Settings saved. The AI is now using your key."))
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("An unexpected error occurred while saving settings.")
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] flex items-center justify-center px-4 py-12 selection:bg-[#8B0000] selection:text-[#f5f5f5]">
      <div className="w-full max-w-xl space-y-6">
        {/* Navigation link back to Dashboard */}
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
            <span>{t("AI Configuration")}</span>
          </div>
        </div>

        <Card className="bg-[#111111] border-[#262626] text-[#f5f5f5] p-6 sm:p-8 space-y-6 rounded-xl shadow-2xl">
          <CardHeader className="space-y-2 p-0 text-left">
            <div className="inline-block text-xs uppercase tracking-widest font-semibold text-[#8B0000]">
              {t("Custom Intelligence")}
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#f5f5f5]">
              {t("AI Provider Settings")}
            </CardTitle>
            <CardDescription className="text-sm text-[#a3a3a3]">
              {t(
                "Configure your personal AI credentials. Your key is stored securely with Row Level Security and used exclusively for your account operations."
              )}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <Loader2 className="h-6 w-6 animate-spin text-[#8B0000]" />
                <p className="text-xs tracking-wider uppercase text-[#a3a3a3]">
                  {t("Retrieving secure settings...")}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {errorMessage && (
                  <div
                    role="alert"
                    className="flex items-start gap-3 rounded-md border border-[#8B0000]/60 bg-[#8B0000]/10 px-4 py-3 text-sm font-medium text-red-400"
                  >
                    <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {successMessage && (
                  <div
                    role="status"
                    className="flex items-start gap-3 rounded-md border border-emerald-900/60 bg-emerald-950/30 px-4 py-3 text-sm font-medium text-emerald-400"
                  >
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* Preferred Language Select */}
                <div className="space-y-2">
                  <Label
                    htmlFor="preferred_language"
                    className="text-xs font-semibold uppercase tracking-wider text-[#a3a3a3] flex items-center gap-2"
                  >
                    <Languages className="h-4 w-4 text-[#8B0000]" />
                    <span>{t("Preferred Language")}</span>
                  </Label>
                  <Select
                    value={preferredLanguage}
                    onValueChange={handleLanguageChange}
                    items={LANGUAGE_OPTIONS}
                    disabled={isSaving}
                  >
                    <SelectTrigger
                      id="preferred_language"
                      className="w-full h-10 border-[#262626] bg-[#1a1a1a] text-[#f5f5f5] focus-visible:border-[#8B0000] focus-visible:ring-1 focus-visible:ring-[#8B0000] justify-between px-3"
                    >
                      <SelectValue placeholder={t("Select preferred language")} />
                    </SelectTrigger>
                    <SelectContent className="border-[#262626] bg-[#1a1a1a] text-[#f5f5f5]">
                      <SelectItem
                        value="en"
                        className="focus:bg-[#8B0000]/20 focus:text-[#f5f5f5] cursor-pointer"
                      >
                        English
                      </SelectItem>
                      <SelectItem
                        value="hi"
                        className="focus:bg-[#8B0000]/20 focus:text-[#f5f5f5] cursor-pointer"
                      >
                        Hindi
                      </SelectItem>
                      <SelectItem
                        value="mr"
                        className="focus:bg-[#8B0000]/20 focus:text-[#f5f5f5] cursor-pointer"
                      >
                        Marathi
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* AI Provider Select */}
                <div className="space-y-2">
                  <Label
                    htmlFor="ai_provider"
                    className="text-xs font-semibold uppercase tracking-wider text-[#a3a3a3] flex items-center gap-2"
                  >
                    <Cpu className="h-4 w-4 text-[#8B0000]" />
                    <span>{t("AI Provider")}</span>
                  </Label>
                  <Select
                    value={aiProvider}
                    onValueChange={(val) => {
                      if (val && (val in PROVIDER_OPTIONS)) {
                        setAiProvider(val as AIProvider)
                      }
                    }}
                    items={PROVIDER_OPTIONS}
                    disabled={isSaving}
                  >
                    <SelectTrigger
                      id="ai_provider"
                      className="w-full h-10 border-[#262626] bg-[#1a1a1a] text-[#f5f5f5] focus-visible:border-[#8B0000] focus-visible:ring-1 focus-visible:ring-[#8B0000] justify-between px-3"
                    >
                      <SelectValue placeholder={t("Select AI provider")} />
                    </SelectTrigger>
                    <SelectContent className="border-[#262626] bg-[#1a1a1a] text-[#f5f5f5]">
                      <SelectItem
                        value="gemini"
                        className="focus:bg-[#8B0000]/20 focus:text-[#f5f5f5] cursor-pointer"
                      >
                        gemini (Google)
                      </SelectItem>
                      <SelectItem
                        value="openai"
                        className="focus:bg-[#8B0000]/20 focus:text-[#f5f5f5] cursor-pointer"
                      >
                        openai (ChatGPT)
                      </SelectItem>
                      <SelectItem
                        value="anthropic"
                        className="focus:bg-[#8B0000]/20 focus:text-[#f5f5f5] cursor-pointer"
                      >
                        anthropic (Claude)
                      </SelectItem>
                      <SelectItem
                        value="deepseek"
                        className="focus:bg-[#8B0000]/20 focus:text-[#f5f5f5] cursor-pointer"
                      >
                        deepseek
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* API Key Input */}
                <div className="space-y-2">
                  <Label
                    htmlFor="api_key"
                    className="text-xs font-semibold uppercase tracking-wider text-[#a3a3a3] flex items-center gap-2"
                  >
                    <KeyRound className="h-4 w-4 text-[#8B0000]" />
                    <span>{t("Enter your API Key")}</span>
                  </Label>
                  <Input
                    id="api_key"
                    name="api_key"
                    type="password"
                    autoComplete="off"
                    required
                    disabled={isSaving}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={t("Paste provider API key...")}
                    className="h-10 border-[#262626] bg-[#1a1a1a] text-[#f5f5f5] placeholder:text-[#a3a3a3]/40 focus-visible:border-[#8B0000] focus-visible:ring-1 focus-visible:ring-[#8B0000]"
                  />
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="w-full h-11 bg-[#8B0000] hover:bg-[#6e0000] text-[#f5f5f5] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSaving ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{t("Saving Configuration...")}</span>
                      </span>
                    ) : (
                      t("Save Settings")
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>

          <CardFooter className="p-0 border-t border-[#262626] pt-4 flex items-center justify-between text-xs text-[#a3a3a3]">
            <span>{t("Isolation: Encrypted via Supabase RLS")}</span>
            <span className="font-mono text-[10px] text-[#a3a3a3]/60">{t("IRON MIND CORE")}</span>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
