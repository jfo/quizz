// Question state management with localStorage persistence

export interface QuestionState {
  rating: number; // 0 = unrated/unknown, higher = better knowledge (increments on correct, decrements on incorrect)
  correctStreak: number; // consecutive correct answers
  incorrectCount: number; // total incorrect answers
  lastAnswered: number; // timestamp
}

export interface QuestionStates {
  [questionId: string]: QuestionState;
}

const STORAGE_KEY = 'questionStates';

// Load all question states from localStorage
export function loadQuestionStates(): QuestionStates {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error('Failed to load question states:', err);
  }
  return {};
}

// Save all question states to localStorage
export function saveQuestionStates(states: QuestionStates): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
  } catch (err) {
    console.error('Failed to save question states:', err);
  }
}

// Get state for a specific question
export function getQuestionState(questionId: string): QuestionState {
  const states = loadQuestionStates();
  return states[questionId] || {
    rating: 0,
    correctStreak: 0,
    incorrectCount: 0,
    lastAnswered: 0,
  };
}

// Update state for a specific question
export function updateQuestionState(questionId: string, updates: Partial<QuestionState>): QuestionState {
  const states = loadQuestionStates();
  const current = getQuestionState(questionId);
  const updated = { ...current, ...updates, lastAnswered: Date.now() };
  states[questionId] = updated;
  saveQuestionStates(states);
  return updated;
}

// Auto-update rating based on answer correctness
export function updateRatingAfterAnswer(questionId: string, isCorrect: boolean): QuestionState {
  const current = getQuestionState(questionId);

  if (isCorrect) {
    // Correct answer - increment rating by 1
    return updateQuestionState(questionId, {
      rating: current.rating + 1,
      correctStreak: current.correctStreak + 1,
    });
  } else {
    // Incorrect answer - decrement rating by 1 (minimum 0)
    return updateQuestionState(questionId, {
      rating: Math.max(0, current.rating - 1),
      correctStreak: 0,
      incorrectCount: current.incorrectCount + 1,
    });
  }
}

// Manually set rating
export function setQuestionRating(questionId: string, rating: number): QuestionState {
  return updateQuestionState(questionId, { rating });
}

// Calculate "need" score for prioritization (higher = more needed)
export function calculateNeedScore(state: QuestionState): number {
  const { rating, correctStreak, incorrectCount, lastAnswered } = state;

  // Lower rating = less knowledge = more needed
  // Rating 0 = 100 points (unknown), higher ratings = lower priority
  // Each rating point reduces need by 15 points
  const ratingScore = 100 - (rating * 15);

  // Boost if we've gotten it wrong recently
  const incorrectBoost = incorrectCount * 5;

  // Reduce if we have a long correct streak
  const streakPenalty = correctStreak * 3;

  // Time decay: boost questions we haven't seen recently (1 point per day)
  const daysSinceLastAnswer = lastAnswered > 0
    ? Math.floor((Date.now() - lastAnswered) / (1000 * 60 * 60 * 24))
    : 0;
  const timeBoost = Math.min(daysSinceLastAnswer, 30); // cap at 30 days

  return ratingScore + incorrectBoost - streakPenalty + timeBoost;
}

// Export state as JSON for download
export function exportState(): string {
  const states = loadQuestionStates();
  return JSON.stringify(states, null, 2);
}

// Import state from JSON
export function importState(jsonString: string): boolean {
  try {
    const states = JSON.parse(jsonString);
    // Validate structure
    if (typeof states !== 'object') {
      throw new Error('Invalid state format');
    }

    // Basic validation
    for (const [key, value] of Object.entries(states)) {
      const state = value as any;
      if (typeof state.rating !== 'number' ||
          typeof state.correctStreak !== 'number' ||
          typeof state.incorrectCount !== 'number' ||
          typeof state.lastAnswered !== 'number') {
        throw new Error(`Invalid state for question ${key}`);
      }
    }

    saveQuestionStates(states as QuestionStates);
    return true;
  } catch (err) {
    console.error('Failed to import state:', err);
    return false;
  }
}

// Clear all question state data
export function clearAllState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear question states:', err);
  }
}
