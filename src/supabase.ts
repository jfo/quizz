import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if Supabase is configured
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'your-project-url.supabase.co');

// Create a single supabase client for interacting with your database
// If not configured, create a dummy client (will be null-checked before use)
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any; // Will be checked before use

// Database types
export interface Database {
  public: {
    Tables: {
      question_states: {
        Row: {
          id: string;
          user_id: string;
          question_id: string;
          rating: number;
          correct_streak: number;
          incorrect_count: number;
          last_answered: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          question_id: string;
          rating: number;
          correct_streak: number;
          incorrect_count: number;
          last_answered: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          question_id?: string;
          rating?: number;
          correct_streak?: number;
          incorrect_count?: number;
          last_answered?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      metrics: {
        Row: {
          id: string;
          user_id: string;
          question_id: string;
          timestamp: number;
          correct: boolean;
          question_text: string;
          section: string;
          quiz: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          question_id: string;
          timestamp: number;
          correct: boolean;
          question_text: string;
          section: string;
          quiz: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          question_id?: string;
          timestamp?: number;
          correct?: boolean;
          question_text?: string;
          section?: string;
          quiz?: string;
          created_at?: string;
        };
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          preferences: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          preferences: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          preferences?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

export type QuestionStateRow = Database['public']['Tables']['question_states']['Row'];
export type MetricRow = Database['public']['Tables']['metrics']['Row'];
export type UserPreferencesRow = Database['public']['Tables']['user_preferences']['Row'];
