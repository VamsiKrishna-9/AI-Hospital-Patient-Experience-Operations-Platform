-- ============================================================================
-- Migration: Add User Preferences & AI Hospital Assistant Setting
-- File: /supabase/migrations/20261028000000_add_user_preferences_chatbot.sql
-- Goal: Provide persistent storage for user interface preferences, including
--       enabling or removing the AI Hospital Assistant chatbot.
-- Design Principles:
--   1. Additive-first, non-destructive schema modification.
--   2. Default enabled: '{"chatbot_enabled": true}'::jsonb.
--   3. Compatible with PostgreSQL 15+ and Supabase app_users table.
-- ============================================================================

BEGIN;

-- 1. Add preferences JSONB column to public.app_users table
ALTER TABLE public.app_users
    ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{"chatbot_enabled": true}'::jsonb;

-- 2. Backfill existing app_users rows with default chatbot_enabled setting
UPDATE public.app_users
SET preferences = '{"chatbot_enabled": true}'::jsonb
WHERE preferences IS NULL;

-- 3. Create index on preferences JSONB for efficient querying
CREATE INDEX IF NOT EXISTS idx_app_users_preferences ON public.app_users USING gin (preferences);

COMMIT;
