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

export interface DailyStats {
  date: string;
  correct: number;
  incorrect: number;
  total: number;
  accuracy: number;
  timestamp: number; // Start of day timestamp for sorting
}

export interface TimeSeriesPoint {
  date: string;
  accuracy: number;
  total: number;
  timestamp: number;
}

export interface TrendAnalysis {
  overallTrend: 'improving' | 'stable' | 'declining' | 'insufficient_data';
  trendPercentage: number; // Percentage change
  bestDay: DailyStats | null;
  worstDay: DailyStats | null;
  averageAccuracy: number;
  totalQuestions: number;
  currentStreak: number; // Days with activity
  averageQuestionsPerDay: number;
}

export interface MetricsSummary {
  totalAttempts: number;
  correctAttempts: number;
  incorrectAttempts: number;
  accuracy: number;
  attemptsByDay: { [date: string]: { correct: number; incorrect: number } };
  recentAttempts: AnswerAttempt[];
  questionBreakdown: { [questionId: string]: { correct: number; incorrect: number; questionText: string } };
  dailyStats: DailyStats[]; // Sorted by date
  timeSeriesData: TimeSeriesPoint[];
  trendAnalysis: TrendAnalysis;
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
 * Calculate trend analysis from daily stats
 */
function calculateTrendAnalysis(dailyStats: DailyStats[]): TrendAnalysis {
  if (dailyStats.length === 0) {
    return {
      overallTrend: 'insufficient_data',
      trendPercentage: 0,
      bestDay: null,
      worstDay: null,
      averageAccuracy: 0,
      totalQuestions: 0,
      currentStreak: 0,
      averageQuestionsPerDay: 0,
    };
  }

  // Calculate average accuracy
  const totalQuestions = dailyStats.reduce((sum, day) => sum + day.total, 0);
  const totalCorrect = dailyStats.reduce((sum, day) => sum + day.correct, 0);
  const averageAccuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

  // Find best and worst days
  const daysWithAttempts = dailyStats.filter(day => day.total > 0);
  let bestDay: DailyStats | null = null;
  let worstDay: DailyStats | null = null;

  if (daysWithAttempts.length > 0) {
    bestDay = daysWithAttempts.reduce((best, day) =>
      day.accuracy > best.accuracy ? day : best
    );
    worstDay = daysWithAttempts.reduce((worst, day) =>
      day.accuracy < worst.accuracy ? day : worst
    );
  }

  // Calculate current streak (consecutive days with activity)
  let currentStreak = 0;
  const sortedDays = [...dailyStats].sort((a, b) => b.timestamp - a.timestamp);
  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < sortedDays.length; i++) {
    const day = sortedDays[i];
    if (day.total > 0) {
      const dayDate = new Date(day.timestamp);
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - currentStreak);
      const expectedDateStr = expectedDate.toISOString().split('T')[0];

      if (day.date === expectedDateStr || (currentStreak === 0 && day.date === today)) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate average questions per active day
  const activeDays = daysWithAttempts.length;
  const averageQuestionsPerDay = activeDays > 0 ? totalQuestions / activeDays : 0;

  // Calculate trend (compare first half to second half)
  let overallTrend: 'improving' | 'stable' | 'declining' | 'insufficient_data' = 'insufficient_data';
  let trendPercentage = 0;

  if (daysWithAttempts.length >= 4) {
    const midpoint = Math.floor(daysWithAttempts.length / 2);
    const firstHalf = daysWithAttempts.slice(0, midpoint);
    const secondHalf = daysWithAttempts.slice(midpoint);

    const firstHalfCorrect = firstHalf.reduce((sum, day) => sum + day.correct, 0);
    const firstHalfTotal = firstHalf.reduce((sum, day) => sum + day.total, 0);
    const firstHalfAccuracy = firstHalfTotal > 0 ? (firstHalfCorrect / firstHalfTotal) * 100 : 0;

    const secondHalfCorrect = secondHalf.reduce((sum, day) => sum + day.correct, 0);
    const secondHalfTotal = secondHalf.reduce((sum, day) => sum + day.total, 0);
    const secondHalfAccuracy = secondHalfTotal > 0 ? (secondHalfCorrect / secondHalfTotal) * 100 : 0;

    trendPercentage = secondHalfAccuracy - firstHalfAccuracy;

    if (Math.abs(trendPercentage) < 5) {
      overallTrend = 'stable';
    } else if (trendPercentage > 0) {
      overallTrend = 'improving';
    } else {
      overallTrend = 'declining';
    }
  }

  return {
    overallTrend,
    trendPercentage,
    bestDay,
    worstDay,
    averageAccuracy,
    totalQuestions,
    currentStreak,
    averageQuestionsPerDay,
  };
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
      dailyStats: [],
      timeSeriesData: [],
      trendAnalysis: {
        overallTrend: 'insufficient_data',
        trendPercentage: 0,
        bestDay: null,
        worstDay: null,
        averageAccuracy: 0,
        totalQuestions: 0,
        currentStreak: 0,
        averageQuestionsPerDay: 0,
      },
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

  // Create daily stats array
  const dailyStats: DailyStats[] = Object.entries(attemptsByDay)
    .map(([date, data]) => {
      const total = data.correct + data.incorrect;
      return {
        date,
        correct: data.correct,
        incorrect: data.incorrect,
        total,
        accuracy: total > 0 ? (data.correct / total) * 100 : 0,
        timestamp: new Date(date).getTime(),
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  // Create time series data (for line charts)
  const timeSeriesData: TimeSeriesPoint[] = dailyStats.map(day => ({
    date: day.date,
    accuracy: day.accuracy,
    total: day.total,
    timestamp: day.timestamp,
  }));

  // Calculate trend analysis
  const trendAnalysis = calculateTrendAnalysis(dailyStats);

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
    dailyStats,
    timeSeriesData,
    trendAnalysis,
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
