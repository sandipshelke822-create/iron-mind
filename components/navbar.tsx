"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { LogOut, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

function NavLinks() {
  const pathname = usePathname()

  return (
    <div className="flex items-center gap-2 sm:gap-4">
      <Link
        href="/dashboard"
        className={cn(
          "text-xs sm:text-sm font-semibold uppercase tracking-wider px-3 py-1.5 rounded-md transition-colors",
          pathname === "/dashboard"
            ? "text-[#f5f5f5] bg-[#1a1a1a] border border-[#262626]"
            : "text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#1a1a1a]/60"
        )}
      >
        Dashboard
      </Link>

      <Link
        href="/settings"
        className={cn(
          "text-xs sm:text-sm font-semibold uppercase tracking-wider px-3 py-1.5 rounded-md transition-colors",
          pathname === "/settings"
            ? "text-[#f5f5f5] bg-[#1a1a1a] border border-[#262626]"
            : "text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#1a1a1a]/60"
        )}
      >
        Settings
      </Link>
    </div>
  )
}

function NavLinksFallback() {
  return (
    <div className="flex items-center gap-2 sm:gap-4">
      <Link
        href="/dashboard"
        className="text-xs sm:text-sm font-semibold uppercase tracking-wider px-3 py-1.5 rounded-md text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#1a1a1a]/60 transition-colors"
      >
        Dashboard
      </Link>

      <Link
        href="/settings"
        className="text-xs sm:text-sm font-semibold uppercase tracking-wider px-3 py-1.5 rounded-md text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#1a1a1a]/60 transition-colors"
      >
        Settings
      </Link>
    </div>
  )
}

function SignOutButton() {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = React.useState(false)

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

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-md border border-[#262626] bg-[#1a1a1a] text-xs sm:text-sm font-semibold text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#8B0000]/20 hover:border-[#8B0000]/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      aria-label="Sign out of account"
    >
      {isSigningOut ? (
        <Loader2 className="size-4 animate-spin text-[#8B0000]" />
      ) : (
        <LogOut className="size-4 text-[#8B0000]" />
      )}
      <span>Sign Out</span>
    </button>
  )
}

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full bg-[#111111] border-b border-[#262626]">
      <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left Side: Brand Logo / Text */}
        <div className="flex items-center">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 group transition-opacity hover:opacity-90"
            aria-label="Iron Mind Home"
          >
            <span className="font-black text-lg sm:text-xl tracking-widest uppercase text-[#8B0000]">
              IRON MIND
            </span>
          </Link>
        </div>

        {/* Right Side: Links & Sign Out */}
        <div className="flex items-center gap-3 sm:gap-6">
          <React.Suspense fallback={<NavLinksFallback />}>
            <NavLinks />
          </React.Suspense>
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
