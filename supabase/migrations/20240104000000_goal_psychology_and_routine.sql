-- IRON MIND: Goal Psychology & Routine Schema Migration
-- Migration: 20240104000000_goal_psychology_and_routine.sql

-- 1. Alter profiles table: Add birth_date for Memento Mori / Working Mondays Left calculation
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS birth_date DATE;

COMMENT ON COLUMN public.profiles.birth_date IS 'User birth date used to calculate working Mondays left (Memento Mori).';

-- 2. Alter goals table: Add advanced psychology and routine fields
ALTER TABLE public.goals
ADD COLUMN IF NOT EXISTS why_image_url TEXT,
ADD COLUMN IF NOT EXISTS sacrifice_cost TEXT,
ADD COLUMN IF NOT EXISTS stop_doing_list TEXT,
ADD COLUMN IF NOT EXISTS decision_deadline DATE,
ADD COLUMN IF NOT EXISTS routine JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.goals.why_image_url IS 'Visual anchor / strong Why image URL.';
COMMENT ON COLUMN public.goals.sacrifice_cost IS 'What the user must sacrifice or give up to achieve this goal.';
COMMENT ON COLUMN public.goals.stop_doing_list IS 'Habits, vices, and distractions to stop doing.';
COMMENT ON COLUMN public.goals.decision_deadline IS 'Critical deadline for high-stakes decisions.';
COMMENT ON COLUMN public.goals.routine IS 'Daily time schedule allocation (e.g., wake_up, sleep, office_hours).';

-- 3. Grant standard permissions to authenticated and anon roles
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO anon;

GRANT ALL ON TABLE public.goals TO authenticated;
GRANT ALL ON TABLE public.goals TO anon;
