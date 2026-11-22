"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
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
import { Button } from "@/components/ui/button"
import { Loader2, Shield, Lock, Mail } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = React.useState<"signin" | "signup">("signin")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [infoMessage, setInfoMessage] = React.useState<string | null>(null)

  const toggleMode = () => {
    setMode((prev) => (prev === "signin" ? "signup" : "signin"))
    setError(null)
    setInfoMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setInfoMessage(null)

    if (!email.trim() || !password) {
      setError("Email and password are required.")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()

      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        if (signInError) {
          setError(signInError.message)
          setIsLoading(false)
          return
        }

        router.push("/dashboard")
        router.refresh()
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        })

        if (signUpError) {
          setError(signUpError.message)
          setIsLoading(false)
          return
        }

        if (data.session) {
          router.push("/dashboard")
          router.refresh()
        } else if (data.user) {
          setInfoMessage(
            "Account created. If email verification is enabled, confirm your email before signing in."
          )
          setIsLoading(false)
        } else {
          router.push("/dashboard")
          router.refresh()
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("An unexpected error occurred during authentication.")
      }
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] flex items-center justify-center px-4 py-12 selection:bg-[#8B0000] selection:text-[#f5f5f5]">
      <Card className="w-full max-w-md bg-[#111111] border-[#262626] text-[#f5f5f5] p-6 sm:p-8 space-y-6 rounded-xl shadow-2xl">
        <CardHeader className="space-y-2 p-0 text-left">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#8B0000]" />
            <span className="text-xs font-semibold uppercase tracking-widest text-[#8B0000]">
              Iron Mind Terminal
            </span>
          </div>
          <CardTitle className="text-2xl font-extrabold tracking-tight text-[#f5f5f5]">
            {mode === "signin" ? "Command Access" : "Enlist Account"}
          </CardTitle>
          <CardDescription className="text-sm text-[#a3a3a3]">
            {mode === "signin"
              ? "Identify yourself to access your timetable and accountability log."
              : "Set your credentials. No retreat, no compromise."}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-md border border-[#8B0000]/60 bg-[#8B0000]/10 px-4 py-3 text-sm font-medium text-red-400"
              >
                {error}
              </div>
            )}

            {infoMessage && (
              <div
                role="status"
                className="rounded-md border border-[#262626] bg-[#1a1a1a] px-4 py-3 text-sm font-medium text-[#f5f5f5]"
              >
                {infoMessage}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-[#a3a3a3]">
                Email Address
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={isLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="warrior@ironmind.app"
                  className="h-10 border-[#262626] bg-[#1a1a1a] text-[#f5f5f5] placeholder:text-[#a3a3a3]/40 focus-visible:border-[#8B0000] focus-visible:ring-1 focus-visible:ring-[#8B0000] pl-9"
                />
                <Mail className="absolute left-3 top-3 h-4 w-4 text-[#a3a3a3]/60 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-[#a3a3a3]">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="h-10 border-[#262626] bg-[#1a1a1a] text-[#f5f5f5] placeholder:text-[#a3a3a3]/40 focus-visible:border-[#8B0000] focus-visible:ring-1 focus-visible:ring-[#8B0000] pl-9"
                />
                <Lock className="absolute left-3 top-3 h-4 w-4 text-[#a3a3a3]/60 pointer-events-none" />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 bg-[#8B0000] hover:bg-[#8B0000]/80 text-[#f5f5f5] font-semibold tracking-wide transition-colors cursor-pointer"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing Authorization...</span>
                </span>
              ) : mode === "signin" ? (
                "Authorize Access"
              ) : (
                "Enlist Account"
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="p-0 border-t border-[#262626] pt-4 flex justify-center">
          <button
            type="button"
            onClick={toggleMode}
            disabled={isLoading}
            className="text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors cursor-pointer"
          >
            {mode === "signin" ? (
              <span>
                Need access clearance?{" "}
                <span className="text-[#f5f5f5] underline underline-offset-4 font-medium">
                  Sign Up
                </span>
              </span>
            ) : (
              <span>
                Already enlisted?{" "}
                <span className="text-[#f5f5f5] underline underline-offset-4 font-medium">
                  Sign In
                </span>
              </span>
            )}
          </button>
        </CardFooter>
      </Card>
    </div>
  )
}

