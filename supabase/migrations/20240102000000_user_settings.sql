-- IRON MIND: User Settings Schema & RLS Policies
-- Migration: 20240102000000_user_settings.sql

-- 1. Create user_settings Table
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    ai_provider TEXT NOT NULL DEFAULT 'gemini' CHECK (ai_provider IN ('gemini', 'openai', 'anthropic', 'deepseek')),
    api_key TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 2. Row Level Security (RLS) Configuration
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own settings"
    ON public.user_settings
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
    ON public.user_settings
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
    ON public.user_settings
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings"
    ON public.user_settings
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
