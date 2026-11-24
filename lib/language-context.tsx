"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { translations, type Language, type TranslationKey } from "./translations"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => Promise<void> | void
  t: (key: TranslationKey | string) => string
  isLoading: boolean
}

const defaultContext: LanguageContextType = {
  language: "en",
  setLanguage: () => {},
  t: (key: string) => {
    const enDict = translations.en as Record<string, string>
    return enDict[key] ?? key
  },
  isLoading: false,
}

const LanguageContext = React.createContext<LanguageContextType>(defaultContext)

const STORAGE_KEY = "iron_mind_language"

function isValidLanguage(val: unknown): val is Language {
  return val === "en" || val === "hi" || val === "mr"
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<Language>("en")
  const [isLoading, setIsLoading] = React.useState(true)

  // Initialize from localStorage immediately if available, then fetch from user_settings
  React.useEffect(() => {
    let isMounted = true

    // Quick local storage check
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (isValidLanguage(saved)) {
        setLanguageState(saved)
      }
    }

    async function fetchUserLanguage() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user && isMounted) {
          const { data, error } = await supabase
            .from("user_settings")
            .select("language")
            .eq("user_id", user.id)
            .maybeSingle()

          if (!error && data?.language && isValidLanguage(data.language)) {
            if (isMounted) {
              setLanguageState(data.language)
              if (typeof window !== "undefined") {
                localStorage.setItem(STORAGE_KEY, data.language)
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to load user language preference:", err)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchUserLanguage()

    return () => {
      isMounted = false
    }
  }, [])

  const setLanguage = React.useCallback(async (newLang: Language) => {
    setLanguageState(newLang)
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newLang)
    }

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        // Attempt update; if user_settings row exists, update language
        await supabase
          .from("user_settings")
          .update({
            language: newLang,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id)
      }
    } catch (err) {
      console.error("Failed to persist language preference:", err)
    }
  }, [])

  const t = React.useCallback(
    (key: TranslationKey | string): string => {
      const langDict = translations[language] as Record<string, string> | undefined
      if (langDict && key in langDict) {
        return langDict[key]
      }
      const fallbackDict = translations.en as Record<string, string>
      if (fallbackDict && key in fallbackDict) {
        return fallbackDict[key]
      }
      return key
    },
    [language]
  )

  const value = React.useMemo(
    () => ({
      language,
      setLanguage,
      t,
      isLoading,
    }),
    [language, setLanguage, t, isLoading]
  )

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation() {
  const context = React.useContext(LanguageContext)
  return context ?? defaultContext
}
