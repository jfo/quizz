/**
 * Learning State Management
 * Handles localStorage persistence for learning cards and session data
 */

import {
  LearningCard,
  SessionStats,
  DailyGoals,
  createLearningCard,
  calculateNextReview,
  confidenceToQuality,
  updateConfidence,
  calculatePriority,
  updateAllPriorities,
} from './learningEngine';

const STORAGE_KEY = 'learning-cards';
const SESSION_KEY = 'current-session';
const DAILY_GOALS_KEY = 'daily-goals';
const STREAK_KEY = 'learning-streak';

/**
 * Load all learning cards from localStorage
 */
export function loadLearningCards(): Record<string, LearningCard> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};

    const cards = JSON.parse(stored);

    // Update priorities on load
    const cardArray = Object.values(cards) as LearningCard[];
    const updatedCards = updateAllPriorities(cardArray);

    const cardsMap: Record<string, LearningCard> = {};
    updatedCards.forEach(card => {
      cardsMap[card.questionId] = card;
    });

    return cardsMap;
  } catch (err) {
    console.error('Failed to load learning cards:', err);
    return {};
  }
}

/**
 * Save all learning cards to localStorage
 */
export function saveLearningCards(cards: Record<string, LearningCard>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  } catch (err) {
    console.error('Failed to save learning cards:', err);
  }
}

/**
 * Get or create a learning card for a question
 */
export function getLearningCard(questionId: string): LearningCard {
  const cards = loadLearningCards();
  if (cards[questionId]) {
    return cards[questionId];
  }

  // Create new card
  return createLearningCard(questionId);
}

/**
 * Record an answer and update the learning card
 */
export function recordAnswer(
  questionId: string,
  wasCorrect: boolean,
  confidence: number
): LearningCard {
  const cards = loadLearningCards();
  let card = cards[questionId] || createLearningCard(questionId);

  // Convert confidence to SM-2 quality
  const quality = confidenceToQuality(confidence, wasCorrect);

  // Update card using SM-2 algorithm
  card = calculateNextReview(card, quality, wasCorrect);

  // Update confidence tracking
  card = updateConfidence(card, confidence);

  // Update priority
  card.priority = calculatePriority(card);

  // Save
  cards[questionId] = card;
  saveLearningCards(cards);

  // Update session stats
  updateSessionStats(wasCorrect, confidence);

  // Update daily goals
  updateDailyGoals();

  return card;
}

/**
 * Get all learning cards as array
 */
export function getAllLearningCards(): LearningCard[] {
  const cards = loadLearningCards();
  return Object.values(cards);
}

/**
 * Clear all learning data
 */
export function clearAllLearningData(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(DAILY_GOALS_KEY);
  localStorage.removeItem(STREAK_KEY);
}

/**
 * Export learning data
 */
export function exportLearningData(): string {
  const cards = loadLearningCards();
  const session = loadSessionStats();
  const goals = loadDailyGoals();
  const streak = loadStreak();

  return JSON.stringify({
    cards,
    session,
    goals,
    streak,
    exportedAt: new Date().toISOString(),
  }, null, 2);
}

/**
 * Import learning data
 */
export function importLearningData(jsonData: string): boolean {
  try {
    const data = JSON.parse(jsonData);

    if (data.cards) {
      saveLearningCards(data.cards);
    }
    if (data.session) {
      saveSessionStats(data.session);
    }
    if (data.goals) {
      saveDailyGoals(data.goals);
    }
    if (data.streak !== undefined) {
      saveStreak(data.streak);
    }

    return true;
  } catch (err) {
    console.error('Failed to import learning data:', err);
    return false;
  }
}

/**
 * Session Stats Management
 */
export function loadSessionStats(): SessionStats {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) {
      return createNewSession();
    }
    return JSON.parse(stored);
  } catch (err) {
    return createNewSession();
  }
}

export function saveSessionStats(stats: SessionStats): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(stats));
}

export function createNewSession(): SessionStats {
  const session: SessionStats = {
    startTime: Date.now(),
    questionsAnswered: 0,
    correctAnswers: 0,
    totalConfidence: 0,
    streak: 0,
    timeSpent: 0,
  };
  saveSessionStats(session);
  return session;
}

export function updateSessionStats(wasCorrect: boolean, confidence: number): void {
  const stats = loadSessionStats();
  stats.questionsAnswered++;
  if (wasCorrect) {
    stats.correctAnswers++;
    stats.streak++;
  } else {
    stats.streak = 0;
  }
  stats.totalConfidence += confidence;
  stats.timeSpent = Date.now() - stats.startTime;
  saveSessionStats(stats);
}

export function resetSession(): void {
  createNewSession();
}

/**
 * Daily Goals Management
 */
export function loadDailyGoals(): DailyGoals {
  try {
    const stored = localStorage.getItem(DAILY_GOALS_KEY);
    if (!stored) {
      return createDefaultGoals();
    }

    const goals: DailyGoals = JSON.parse(stored);
    const today = new Date().toDateString();

    // Reset daily counters if it's a new day
    if (goals.lastStudyDate !== today) {
      goals.cardsCompleted = 0;
      goals.minutesSpent = 0;
      goals.lastStudyDate = today;
      saveDailyGoals(goals);
    }

    return goals;
  } catch (err) {
    return createDefaultGoals();
  }
}

export function saveDailyGoals(goals: DailyGoals): void {
  localStorage.setItem(DAILY_GOALS_KEY, JSON.stringify(goals));
}

export function createDefaultGoals(): DailyGoals {
  const goals: DailyGoals = {
    targetCards: 20,
    cardsCompleted: 0,
    targetMinutes: 20,
    minutesSpent: 0,
    streak: 0,
    lastStudyDate: new Date().toDateString(),
  };
  saveDailyGoals(goals);
  return goals;
}

export function updateDailyGoals(): void {
  const goals = loadDailyGoals();
  const session = loadSessionStats();

  goals.cardsCompleted = session.questionsAnswered;
  goals.minutesSpent = Math.floor(session.timeSpent / (60 * 1000));

  // Check if goal completed today
  const wasGoalMet = goals.cardsCompleted >= goals.targetCards &&
                     goals.minutesSpent >= goals.targetMinutes;

  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();

  if (wasGoalMet && goals.lastStudyDate === today) {
    // Goal met today, check streak
    if (goals.lastStudyDate === yesterday || goals.streak === 0) {
      goals.streak++;
    }
  }

  saveDailyGoals(goals);
}

export function setDailyGoalTargets(targetCards: number, targetMinutes: number): void {
  const goals = loadDailyGoals();
  goals.targetCards = targetCards;
  goals.targetMinutes = targetMinutes;
  saveDailyGoals(goals);
}

/**
 * Streak Management
 */
export function loadStreak(): number {
  try {
    const stored = localStorage.getItem(STREAK_KEY);
    return stored ? parseInt(stored, 10) : 0;
  } catch (err) {
    return 0;
  }
}

export function saveStreak(streak: number): void {
  localStorage.setItem(STREAK_KEY, String(streak));
}

/**
 * Get learning progress summary
 */
export function getLearningProgress() {
  const cards = getAllLearningCards();
  const session = loadSessionStats();
  const goals = loadDailyGoals();

  const newCards = cards.filter(c => c.stage === 'new').length;
  const learning = cards.filter(c => c.stage === 'learning').length;
  const review = cards.filter(c => c.stage === 'review').length;
  const mastered = cards.filter(c => c.stage === 'mastered').length;
  const dueCards = cards.filter(c => c.dueDate <= Date.now()).length;

  const totalReviews = cards.reduce((sum, c) => sum + c.totalReviews, 0);
  const totalCorrect = cards.reduce((sum, c) => sum + c.correctReviews, 0);
  const overallAccuracy = totalReviews > 0 ? (totalCorrect / totalReviews) * 100 : 0;

  const avgConfidence = cards.length > 0
    ? cards.reduce((sum, c) => sum + c.averageConfidence, 0) / cards.length
    : 0;

  return {
    totalCards: cards.length,
    newCards,
    learning,
    review,
    mastered,
    dueCards,
    totalReviews,
    overallAccuracy,
    avgConfidence,
    session,
    goals,
  };
}
