import * as React from "react"
import { Navbar } from "@/components/navbar"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] flex flex-col selection:bg-[#8B0000] selection:text-[#f5f5f5]">
      <Navbar />
      <div className="flex-1">
        {children}
      </div>
    </div>
  )
}
