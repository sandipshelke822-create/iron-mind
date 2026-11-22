import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

// This route always redirects based on auth state — opt out of static prerender.
export const instant = false

export default async function HomePage() {
  let user = null

  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    user = null
  }

  if (user) {
    redirect("/dashboard")
  } else {
    redirect("/login")
  }
}
