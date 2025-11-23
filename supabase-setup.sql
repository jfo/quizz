-- Supabase Database Setup for Quiz App
-- Run this SQL in your Supabase SQL Editor to set up the database

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- Table: question_states
-- Stores user progress for each question
-- =====================================================

CREATE TABLE IF NOT EXISTS question_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 0,
  correct_streak INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  last_answered TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_question_states_user_id ON question_states(user_id);
CREATE INDEX IF NOT EXISTS idx_question_states_question_id ON question_states(question_id);
CREATE INDEX IF NOT EXISTS idx_question_states_last_answered ON question_states(last_answered);

-- Enable Row Level Security
ALTER TABLE question_states ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own question states
CREATE POLICY "Users can view their own question states"
  ON question_states FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own question states"
  ON question_states FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own question states"
  ON question_states FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own question states"
  ON question_states FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- Table: metrics
-- Stores historical answer attempts for analytics
-- =====================================================

CREATE TABLE IF NOT EXISTS metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  correct BOOLEAN NOT NULL,
  question_text TEXT NOT NULL,
  section TEXT NOT NULL,
  quiz TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_metrics_user_id ON metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_question_id ON metrics(question_id);
CREATE INDEX IF NOT EXISTS idx_metrics_user_timestamp ON metrics(user_id, timestamp DESC);

-- Enable Row Level Security
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own metrics
CREATE POLICY "Users can view their own metrics"
  ON metrics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own metrics"
  ON metrics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own metrics"
  ON metrics FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- Table: user_preferences
-- Stores user settings and preferences
-- =====================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Enable Row Level Security
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own preferences
CREATE POLICY "Users can view their own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences"
  ON user_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- Function: Update updated_at timestamp automatically
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_question_states_updated_at
  BEFORE UPDATE ON question_states
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Setup Complete!
-- =====================================================

-- Verify tables were created
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('question_states', 'metrics', 'user_preferences')
ORDER BY table_name;
