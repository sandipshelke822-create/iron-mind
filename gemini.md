# IRON MIND — Global Rules & Guidelines

## 1. Project Overview & Architecture
IRON MIND is a brutal accountability coach application designed with a stoic/warrior mindset.
- **Core Loop:** Goal entry -> Personalized war-plan timetable generation -> Daily evening log -> Brutal, honest AI verdict.
- **Stack:**
  - Framework: Next.js 14 (App Router)
  - Language: TypeScript (strict mode)
  - Styling & UI: Tailwind CSS + shadcn/ui
  - Database & Auth: Supabase (PostgreSQL + RLS)
  - AI Engine: Anthropic Claude API (server-side only)

---

## 2. Design System & Theme Tokens
The interface is strictly dark, disciplined, and utilitarian.
- **Background:** `#0a0a0a` (Deep Void)
- **Accent / Primary:** `#8B0000` (War Blood Red)
- **Text / Foreground:** `#f5f5f5` (Bone White)
- **Muted / Secondary:** `#1a1a1a` (Dark Slate)
- **Border / Outline:** `#262626` (Subtle Dark Border)
- **Muted Foreground:** `#a3a3a3` (Ash Grey)

### UI Rules
- **No emojis in UI:** Never use emojis in UI buttons, headings, cards, badges, or notifications. Use clean Lucide icons or austere typographic indicators instead.
- **Dark theme only:** Light mode is completely forbidden. Do not include toggle controls or light palette fallbacks.
- **Tone:** Minimalist, high contrast, industrial, razor-sharp focus.

---

## 3. Engineering Conventions

### Frontend (`app/`, `components/`)
- Server Components by default. Use `"use client"` only for client-side interactivity, state, and form hooks.
- Follow shadcn/ui patterns and Tailwind CSS utility classes.
- Zero emojis across all views and alerts.

### Backend (`app/api/`, `lib/`)
- All Claude API requests must remain strictly server-side (Route Handlers or Server Actions). Never expose API credentials to the client.
- Always validate incoming payloads with schemas (e.g. Zod) and handle AI call timeouts/errors gracefully.
- Validate JSON outputs from AI before persisting or returning to the client.

### Database (`supabase/`)
- Row Level Security (RLS) is **mandatory** on every table without exception.
- Explicit access policies: Users can only select, insert, update, or delete their own rows (`auth.uid() = user_id`).
- Migrations must be version-controlled, idempotent, and reviewed.

---

## 4. AI Coach Persona & Mental-Health Guardrails

### Persona
- Blended archetype: Marcus Aurelius, Kobe Bryant, Jocko Willink, David Goggins, Chanakya, and Miyamoto Musashi.
- Tone: Direct, terse sentences, stoic accountability, zero sugarcoating, zero flattery.
- Structure:
  1. Direct assessment of logged actions vs. war-plan.
  2. Exactly one philosophical anchor.
  3. Exactly one non-negotiable directive for tomorrow.

### Mandatory Safety Guardrail
- **CRITICAL:** Never remove the mental-health guardrail from prompts.
- If a user expresses, implies, or hints at self-harm, severe crisis, or hopelessness:
  - Immediately drop the warrior persona.
  - Respond with genuine empathy, calm warmth, and direct links/hotlines for professional help (e.g., 988 Suicide & Crisis Lifeline).
  - This rule overrides all persona guidelines and is non-negotiable.

---

## 5. Strict Do-Not Rules
- **DO NOT** use emojis anywhere in the interface or AI outputs unless explicitly testing crisis responses.
- **DO NOT** remove or dilute the mental-health safety guardrail under any circumstances.
- **DO NOT** make client-side AI API calls.
- **DO NOT** disable or bypass Supabase RLS policies.
- **DO NOT** cross ownership boundaries: each agent operates only within its defined directory scope.
- **DO NOT** introduce loose TypeScript `any` types.

