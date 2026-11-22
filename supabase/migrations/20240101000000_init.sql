-- IRON MIND: Initial Database Schema & RLS Policies
-- Migration: 20240101000000_init.sql

-- 1. Goals Table
CREATE TABLE IF NOT EXISTS public.goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    why TEXT NOT NULL,
    deadline DATE NOT NULL,
    daily_hours INT NOT NULL,
    current_level TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 2. Battle Plans Table
CREATE TABLE IF NOT EXISTS public.battle_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE NOT NULL,
    week_number INT NOT NULL,
    milestones JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 3. Daily Reports Table
CREATE TABLE IF NOT EXISTS public.daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    completed_tasks JSONB,
    hours_worked DOUBLE PRECISION,
    honesty_score INT,
    ai_verdict TEXT,
    ai_score INT,
    directive_tomorrow TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Performance & Foreign Key Indexes
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);
CREATE INDEX IF NOT EXISTS idx_battle_plans_goal_id ON public.battle_plans(goal_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_user_id ON public.daily_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_user_date ON public.daily_reports(user_id, date);

-- ============================================================================
-- Row Level Security (RLS) Configuration
-- ============================================================================

-- Goals RLS
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own goals"
    ON public.goals
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals"
    ON public.goals
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
    ON public.goals
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
    ON public.goals
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Battle Plans RLS (Access governed by ownership of the parent goal)
ALTER TABLE public.battle_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own battle plans"
    ON public.battle_plans
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.goals
            WHERE public.goals.id = public.battle_plans.goal_id
              AND public.goals.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own battle plans"
    ON public.battle_plans
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.goals
            WHERE public.goals.id = public.battle_plans.goal_id
              AND public.goals.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own battle plans"
    ON public.battle_plans
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.goals
            WHERE public.goals.id = public.battle_plans.goal_id
              AND public.goals.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.goals
            WHERE public.goals.id = public.battle_plans.goal_id
              AND public.goals.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own battle plans"
    ON public.battle_plans
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.goals
            WHERE public.goals.id = public.battle_plans.goal_id
              AND public.goals.user_id = auth.uid()
        )
    );

-- Daily Reports RLS
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own daily reports"
    ON public.daily_reports
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily reports"
    ON public.daily_reports
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily reports"
    ON public.daily_reports
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily reports"
    ON public.daily_reports
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

