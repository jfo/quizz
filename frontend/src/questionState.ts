// Question state management with localStorage persistence

export interface QuestionState {
  rating: number; // 0 = unrated, 1-5 = rated difficulty
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
    // Correct answer
    if (current.rating === 0) {
      // Unrated - start building streak
      return updateQuestionState(questionId, {
        correctStreak: current.correctStreak + 1,
      });
    } else {
      // Already rated - maintain or increase rating slightly
      // But streak doesn't change the rating once it's set
      return updateQuestionState(questionId, {
        correctStreak: current.correctStreak + 1,
      });
    }
  } else {
    // Incorrect answer
    if (current.rating > 0) {
      // Already rated - downgrade by 1 (minimum 1)
      return updateQuestionState(questionId, {
        rating: Math.max(1, current.rating - 1),
        correctStreak: 0,
        incorrectCount: current.incorrectCount + 1,
      });
    } else {
      // Unrated - just track incorrect count
      return updateQuestionState(questionId, {
        correctStreak: 0,
        incorrectCount: current.incorrectCount + 1,
      });
    }
  }
}

// Manually set rating
export function setQuestionRating(questionId: string, rating: number): QuestionState {
  return updateQuestionState(questionId, { rating });
}

// Calculate "need" score for prioritization (higher = more needed)
export function calculateNeedScore(state: QuestionState): number {
  const { rating, correctStreak, incorrectCount, lastAnswered } = state;

  // Unrated questions have medium priority
  if (rating === 0) {
    // Prioritize questions we've gotten wrong
    return 50 + (incorrectCount * 10) - (correctStreak * 5);
  }

  // Rated questions: lower rating = harder = more needed
  // Rating 1 = 100 points, Rating 5 = 20 points
  const ratingScore = (6 - rating) * 20;

  // Boost if we've gotten it wrong recently
  const incorrectBoost = incorrectCount * 5;

  // Reduce if we have a streak
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
