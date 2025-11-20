/**
 * Metrics tracking system for quiz answers
 * Stores historical correct/incorrect answers in localStorage
 */

export interface AnswerAttempt {
  questionId: string;
  timestamp: number;
  correct: boolean;
  questionText: string;
  section: string;
  quiz: string;
}

export interface MetricsSummary {
  totalAttempts: number;
  correctAttempts: number;
  incorrectAttempts: number;
  accuracy: number;
  attemptsByDay: { [date: string]: { correct: number; incorrect: number } };
  recentAttempts: AnswerAttempt[];
  questionBreakdown: { [questionId: string]: { correct: number; incorrect: number; questionText: string } };
}

const METRICS_STORAGE_KEY = 'quizMetrics';
const MAX_STORED_ATTEMPTS = 1000; // Keep last 1000 attempts to prevent storage bloat

/**
 * Load all answer attempts from localStorage
 */
export function loadMetrics(): AnswerAttempt[] {
  try {
    const stored = localStorage.getItem(METRICS_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as AnswerAttempt[];
  } catch (error) {
    console.error('Failed to load metrics:', error);
    return [];
  }
}

/**
 * Save answer attempts to localStorage
 */
function saveMetrics(attempts: AnswerAttempt[]): void {
  try {
    localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(attempts));
  } catch (error) {
    console.error('Failed to save metrics:', error);
  }
}

/**
 * Record a new answer attempt
 */
export function recordAnswer(
  questionId: string,
  correct: boolean,
  questionText: string,
  section: string,
  quiz: string
): void {
  const attempts = loadMetrics();

  const newAttempt: AnswerAttempt = {
    questionId,
    timestamp: Date.now(),
    correct,
    questionText,
    section,
    quiz,
  };

  attempts.push(newAttempt);

  // Keep only the most recent MAX_STORED_ATTEMPTS to prevent localStorage bloat
  if (attempts.length > MAX_STORED_ATTEMPTS) {
    attempts.splice(0, attempts.length - MAX_STORED_ATTEMPTS);
  }

  saveMetrics(attempts);
}

/**
 * Get metrics summary with various statistics
 */
export function getMetricsSummary(): MetricsSummary {
  const attempts = loadMetrics();

  if (attempts.length === 0) {
    return {
      totalAttempts: 0,
      correctAttempts: 0,
      incorrectAttempts: 0,
      accuracy: 0,
      attemptsByDay: {},
      recentAttempts: [],
      questionBreakdown: {},
    };
  }

  const correctAttempts = attempts.filter(a => a.correct).length;
  const incorrectAttempts = attempts.filter(a => !a.correct).length;

  // Group attempts by day
  const attemptsByDay: { [date: string]: { correct: number; incorrect: number } } = {};
  attempts.forEach(attempt => {
    const date = new Date(attempt.timestamp).toISOString().split('T')[0];
    if (!attemptsByDay[date]) {
      attemptsByDay[date] = { correct: 0, incorrect: 0 };
    }
    if (attempt.correct) {
      attemptsByDay[date].correct++;
    } else {
      attemptsByDay[date].incorrect++;
    }
  });

  // Group attempts by question
  const questionBreakdown: { [questionId: string]: { correct: number; incorrect: number; questionText: string } } = {};
  attempts.forEach(attempt => {
    if (!questionBreakdown[attempt.questionId]) {
      questionBreakdown[attempt.questionId] = {
        correct: 0,
        incorrect: 0,
        questionText: attempt.questionText,
      };
    }
    if (attempt.correct) {
      questionBreakdown[attempt.questionId].correct++;
    } else {
      questionBreakdown[attempt.questionId].incorrect++;
    }
  });

  // Get last 50 attempts for recent history
  const recentAttempts = attempts.slice(-50).reverse();

  return {
    totalAttempts: attempts.length,
    correctAttempts,
    incorrectAttempts,
    accuracy: (correctAttempts / attempts.length) * 100,
    attemptsByDay,
    recentAttempts,
    questionBreakdown,
  };
}

/**
 * Clear all metrics data
 */
export function clearMetrics(): void {
  localStorage.removeItem(METRICS_STORAGE_KEY);
}

/**
 * Export metrics as JSON for backup
 */
export function exportMetrics(): string {
  const attempts = loadMetrics();
  return JSON.stringify(attempts, null, 2);
}

/**
 * Import metrics from JSON
 */
export function importMetrics(jsonData: string): boolean {
  try {
    const attempts = JSON.parse(jsonData) as AnswerAttempt[];
    saveMetrics(attempts);
    return true;
  } catch (error) {
    console.error('Failed to import metrics:', error);
    return false;
  }
}
