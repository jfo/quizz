-- Database schema for spaced repetition quiz app
-- Run this after creating the database: CREATE DATABASE quizz_db;

-- Table to track statistics and spaced repetition data for each question
CREATE TABLE IF NOT EXISTS question_stats (
  question_id VARCHAR(20) PRIMARY KEY,

  -- Spaced repetition algorithm fields (SM-2 based)
  ease_factor DECIMAL(3,2) DEFAULT 2.5,  -- Difficulty multiplier (starts at 2.5)
  interval_days INT DEFAULT 1,            -- Days until next review
  repetitions INT DEFAULT 0,              -- Consecutive correct answers
  next_review TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- When to show next
  last_reviewed TIMESTAMP,                 -- Last time shown

  -- Performance tracking
  total_attempts INT DEFAULT 0,
  correct_attempts INT DEFAULT 0,
  incorrect_attempts INT DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table to log each response for historical tracking
CREATE TABLE IF NOT EXISTS response_history (
  id SERIAL PRIMARY KEY,
  question_id VARCHAR(20) NOT NULL,
  is_correct BOOLEAN NOT NULL,
  selected_option TEXT,
  response_time_ms INT,  -- Time taken to answer in milliseconds
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_question_id ON response_history(question_id);
CREATE INDEX IF NOT EXISTS idx_timestamp ON response_history(timestamp);

-- Table to track overall session stats (optional, for analytics)
CREATE TABLE IF NOT EXISTS session_stats (
  id SERIAL PRIMARY KEY,
  questions_answered INT DEFAULT 0,
  correct_answers INT DEFAULT 0,
  incorrect_answers INT DEFAULT 0,
  average_response_time_ms INT,
  session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  session_end TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_session_start ON session_stats(session_start);
