export { cn } from "cn"

/**
 * Calculates the number of working Mondays left until age 60:
 * (60 - current_age) * 52
 */
export function calculateWorkingMondaysLeft(birthDateStr: string | null | undefined): number | null {
  if (!birthDateStr) return null
  try {
    const parts = birthDateStr.split("T")[0].split("-")
    if (parts.length !== 3) return null
    const [year, month, day] = parts.map(Number)
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null

    const birthDate = new Date(year, month - 1, day)
    if (isNaN(birthDate.getTime())) return null

    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }

    return Math.max(0, (60 - age) * 52)
  } catch {
    return null
  }
}
