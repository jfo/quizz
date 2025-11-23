import { supabase, isSupabaseConfigured } from './supabase';
import type { User } from '@supabase/supabase-js';
import type { QuestionStates, QuestionState } from './questionState';
import type { AnswerAttempt } from './metrics';

/**
 * Sync service to keep localStorage data in sync with Supabase
 */

let currentUser: User | null = null;
let syncInProgress = false;

export function setCurrentUser(user: User | null) {
  currentUser = user;
}

// Question States Sync
// =====================

export async function syncQuestionStates(localStates: QuestionStates): Promise<QuestionStates> {
  if (!isSupabaseConfigured || !currentUser || syncInProgress) return localStates;

  syncInProgress = true;
  try {
    // Fetch all question states from Supabase
    const { data: remoteData, error } = await supabase
      .from('question_states')
      .select('*')
      .eq('user_id', currentUser.id);

    if (error) throw error;

    // Convert remote data to QuestionStates format
    const remoteStates: QuestionStates = {};
    if (remoteData) {
      remoteData.forEach((row) => {
        remoteStates[row.question_id] = {
          rating: row.rating,
          correctStreak: row.correct_streak,
          incorrectCount: row.incorrect_count,
          lastAnswered: new Date(row.last_answered).getTime(),
        };
      });
    }

    // Merge local and remote (take most recent based on lastAnswered)
    const merged: QuestionStates = { ...remoteStates };

    for (const [questionId, localState] of Object.entries(localStates)) {
      const remoteState = remoteStates[questionId];

      if (!remoteState || localState.lastAnswered > remoteState.lastAnswered) {
        // Local is newer or doesn't exist remotely - use local
        merged[questionId] = localState;
      }
    }

    return merged;
  } catch (error) {
    console.error('Failed to sync question states:', error);
    return localStates;
  } finally {
    syncInProgress = false;
  }
}

export async function saveQuestionStateToCloud(questionId: string, state: QuestionState): Promise<void> {
  if (!isSupabaseConfigured || !currentUser) return;

  try {
    const { error } = await supabase
      .from('question_states')
      .upsert({
        user_id: currentUser.id,
        question_id: questionId,
        rating: state.rating,
        correct_streak: state.correctStreak,
        incorrect_count: state.incorrectCount,
        last_answered: new Date(state.lastAnswered).toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,question_id',
      });

    if (error) throw error;
  } catch (error) {
    console.error('Failed to save question state to cloud:', error);
  }
}

// Metrics Sync
// ============

export async function syncMetrics(localMetrics: AnswerAttempt[]): Promise<AnswerAttempt[]> {
  if (!isSupabaseConfigured || !currentUser || syncInProgress) return localMetrics;

  syncInProgress = true;
  try {
    // Fetch all metrics from Supabase
    const { data: remoteData, error } = await supabase
      .from('metrics')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('timestamp', { ascending: false })
      .limit(1000); // Match MAX_STORED_ATTEMPTS

    if (error) throw error;

    // Convert remote data to AnswerAttempt format
    const remoteMetrics: AnswerAttempt[] = remoteData || [];
    const remoteConverted = remoteMetrics.map((row) => ({
      questionId: row.question_id,
      timestamp: row.timestamp,
      correct: row.correct,
      questionText: row.question_text,
      section: row.section,
      quiz: row.quiz,
    }));

    // Merge: combine local and remote, remove duplicates, keep most recent 1000
    const combined = [...localMetrics, ...remoteConverted];

    // Remove duplicates (same questionId + timestamp)
    const uniqueMap = new Map<string, AnswerAttempt>();
    combined.forEach((attempt) => {
      const key = `${attempt.questionId}-${attempt.timestamp}`;
      uniqueMap.set(key, attempt);
    });

    const merged = Array.from(uniqueMap.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 1000);

    return merged;
  } catch (error) {
    console.error('Failed to sync metrics:', error);
    return localMetrics;
  } finally {
    syncInProgress = false;
  }
}

export async function saveMetricToCloud(attempt: AnswerAttempt): Promise<void> {
  if (!isSupabaseConfigured || !currentUser) return;

  try {
    const { error } = await supabase
      .from('metrics')
      .insert({
        user_id: currentUser.id,
        question_id: attempt.questionId,
        timestamp: attempt.timestamp,
        correct: attempt.correct,
        question_text: attempt.questionText,
        section: attempt.section,
        quiz: attempt.quiz,
      });

    if (error) throw error;
  } catch (error) {
    console.error('Failed to save metric to cloud:', error);
  }
}

// User Preferences Sync
// =====================

export interface UserPreferences {
  selectedSections?: string[];
  selectedQuizzes?: string[];
  shuffleMode?: boolean;
  mostNeededMode?: boolean;
  ratingFilter?: [number, number];
  darkMode?: boolean;
  settingsCollapsed?: boolean;
  soundEnabled?: boolean;
  hapticEnabled?: boolean;
}

export async function syncUserPreferences(localPrefs: UserPreferences): Promise<UserPreferences> {
  if (!isSupabaseConfigured || !currentUser || syncInProgress) return localPrefs;

  syncInProgress = true;
  try {
    // Fetch preferences from Supabase
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"

    if (data && data.preferences) {
      // Merge remote preferences with local (remote takes precedence)
      return { ...localPrefs, ...data.preferences };
    }

    return localPrefs;
  } catch (error) {
    console.error('Failed to sync user preferences:', error);
    return localPrefs;
  } finally {
    syncInProgress = false;
  }
}

export async function saveUserPreferencesToCloud(preferences: UserPreferences): Promise<void> {
  if (!isSupabaseConfigured || !currentUser) return;

  try {
    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: currentUser.id,
        preferences,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (error) throw error;
  } catch (error) {
    console.error('Failed to save user preferences to cloud:', error);
  }
}

// Migration: Upload all local data to cloud on first sign-in
// ===========================================================

export async function migrateLocalDataToCloud(
  localStates: QuestionStates,
  localMetrics: AnswerAttempt[],
  localPrefs: UserPreferences
): Promise<void> {
  if (!isSupabaseConfigured || !currentUser) return;

  console.log('Migrating local data to cloud...');

  try {
    // Check if user already has data in cloud
    const { data: existingStates } = await supabase
      .from('question_states')
      .select('id')
      .eq('user_id', currentUser.id)
      .limit(1);

    // Only migrate if no existing data (first sign-in)
    if (!existingStates || existingStates.length === 0) {
      // Upload all question states
      const stateRecords = Object.entries(localStates).map(([questionId, state]) => ({
        user_id: currentUser!.id,
        question_id: questionId,
        rating: state.rating,
        correct_streak: state.correctStreak,
        incorrect_count: state.incorrectCount,
        last_answered: new Date(state.lastAnswered).toISOString(),
      }));

      if (stateRecords.length > 0) {
        const { error: statesError } = await supabase
          .from('question_states')
          .insert(stateRecords);

        if (statesError) throw statesError;
      }

      // Upload all metrics
      const metricRecords = localMetrics.map((attempt) => ({
        user_id: currentUser!.id,
        question_id: attempt.questionId,
        timestamp: attempt.timestamp,
        correct: attempt.correct,
        question_text: attempt.questionText,
        section: attempt.section,
        quiz: attempt.quiz,
      }));

      if (metricRecords.length > 0) {
        const { error: metricsError } = await supabase
          .from('metrics')
          .insert(metricRecords);

        if (metricsError) throw metricsError;
      }

      // Upload preferences
      await saveUserPreferencesToCloud(localPrefs);

      console.log('Local data migrated to cloud successfully!');
    } else {
      console.log('User already has cloud data, skipping migration');
    }
  } catch (error) {
    console.error('Failed to migrate local data to cloud:', error);
  }
}
