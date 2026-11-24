-- IRON MIND: User Profiles birth_date addition
-- Migration: 20240105000000_profile_birth_date.sql

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS birth_date DATE;
