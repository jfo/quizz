/**
 * Advanced Learning Engine with SM-2 Spaced Repetition Algorithm
 * Based on SuperMemo 2 algorithm and cognitive science research
 */

export interface LearningCard {
  questionId: string;

  // SM-2 Algorithm fields
  easeFactor: number;        // 1.3 to 2.5+ (difficulty adjustment)
  interval: number;          // Days until next review
  repetitions: number;       // Number of successful reviews
  dueDate: number;          // Timestamp when card is due

  // Performance tracking
  totalReviews: number;
  correctReviews: number;
  lastReviewed: number;      // Timestamp

  // Confidence tracking
  confidenceHistory: number[]; // Last 10 confidence ratings (0-3)
  averageConfidence: number;

  // Learning stage
  stage: 'new' | 'learning' | 'review' | 'mastered';

  // Priority (calculated)
  priority: number;
}

export interface SessionStats {
  startTime: number;
  questionsAnswered: number;
  correctAnswers: number;
  totalConfidence: number;
  streak: number;
  timeSpent: number;
}

export interface DailyGoals {
  targetCards: number;
  cardsCompleted: number;
  targetMinutes: number;
  minutesSpent: number;
  streak: number;
  lastStudyDate: string;
}

/**
 * SM-2 Algorithm Implementation
 * Quality scale:
 * 0 - Complete blackout (total guess, got it wrong)
 * 1 - Incorrect response, but recognized correct answer
 * 2 - Correct response with serious difficulty
 * 3 - Correct response with hesitation
 * 4 - Correct response with perfect recall
 * 5 - Perfect response (instant, easy)
 */
export function calculateNextReview(
  card: LearningCard,
  quality: number,
  wasCorrect: boolean
): LearningCard {
  const updatedCard = { ...card };

  // Update tracking
  updatedCard.totalReviews++;
  if (wasCorrect) {
    updatedCard.correctReviews++;
  }
  updatedCard.lastReviewed = Date.now();

  // Calculate new easiness factor
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  let newEF = updatedCard.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  // Keep EF between 1.3 and 2.5
  newEF = Math.max(1.3, Math.min(2.5, newEF));
  updatedCard.easeFactor = newEF;

  // Calculate interval and repetitions
  if (quality < 3) {
    // Reset if quality is too low (failed)
    updatedCard.repetitions = 0;
    updatedCard.interval = 1; // Review tomorrow
    updatedCard.stage = 'learning';
  } else {
    // Successful review
    updatedCard.repetitions++;

    if (updatedCard.repetitions === 1) {
      updatedCard.interval = 1; // 1 day
      updatedCard.stage = 'learning';
    } else if (updatedCard.repetitions === 2) {
      updatedCard.interval = 6; // 6 days
      updatedCard.stage = 'learning';
    } else {
      // n > 2: I(n) = I(n-1) * EF
      updatedCard.interval = Math.round(updatedCard.interval * newEF);
      updatedCard.stage = updatedCard.repetitions >= 5 ? 'mastered' : 'review';
    }
  }

  // Calculate due date
  updatedCard.dueDate = Date.now() + (updatedCard.interval * 24 * 60 * 60 * 1000);

  return updatedCard;
}

/**
 * Convert user confidence + correctness to SM-2 quality (0-5)
 *
 * Confidence levels:
 * 0 - Complete guess
 * 1 - Uncertain
 * 2 - Confident
 * 3 - Instant/Perfect
 */
export function confidenceToQuality(confidence: number, wasCorrect: boolean): number {
  if (!wasCorrect) {
    return confidence === 0 ? 0 : 1; // Total blackout or recognized answer
  }

  // Correct answers map to quality 2-5
  const qualityMap = {
    0: 2, // Got it right but was guessing (serious difficulty)
    1: 3, // Got it right but unsure (with hesitation)
    2: 4, // Got it right confidently (perfect recall)
    3: 5, // Got it right instantly (easy)
  };

  return qualityMap[confidence as keyof typeof qualityMap] || 3;
}

/**
 * Calculate priority score for question selection
 * Higher score = should be studied sooner
 */
export function calculatePriority(card: LearningCard): number {
  const now = Date.now();
  const daysOverdue = Math.max(0, (now - card.dueDate) / (24 * 60 * 60 * 1000));

  let priority = 0;

  // 1. Overdue cards get highest priority
  if (daysOverdue > 0) {
    priority += 100 + daysOverdue * 10;
  }

  // 2. New cards get medium-high priority
  if (card.stage === 'new') {
    priority += 50;
  }

  // 3. Learning stage cards
  if (card.stage === 'learning') {
    priority += 30;
  }

  // 4. Low confidence cards
  if (card.averageConfidence < 1.5) {
    priority += 20;
  }

  // 5. Poor performance
  const accuracy = card.totalReviews > 0
    ? card.correctReviews / card.totalReviews
    : 0;
  if (accuracy < 0.7) {
    priority += 15;
  }

  // 6. Due soon (within 1 day)
  const daysUntilDue = (card.dueDate - now) / (24 * 60 * 60 * 1000);
  if (daysUntilDue <= 1 && daysUntilDue > 0) {
    priority += 10;
  }

  return priority;
}

/**
 * Initialize a new learning card
 */
export function createLearningCard(questionId: string): LearningCard {
  return {
    questionId,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    dueDate: Date.now(), // Due now for new cards
    totalReviews: 0,
    correctReviews: 0,
    lastReviewed: 0,
    confidenceHistory: [],
    averageConfidence: 0,
    stage: 'new',
    priority: 50,
  };
}

/**
 * Update confidence history and average
 */
export function updateConfidence(card: LearningCard, confidence: number): LearningCard {
  const updated = { ...card };
  updated.confidenceHistory = [...updated.confidenceHistory, confidence].slice(-10);
  updated.averageConfidence =
    updated.confidenceHistory.reduce((a, b) => a + b, 0) / updated.confidenceHistory.length;
  return updated;
}

/**
 * Get cards that are due for review
 */
export function getDueCards(cards: LearningCard[]): LearningCard[] {
  const now = Date.now();
  return cards.filter(card => card.dueDate <= now);
}

/**
 * Get cards by stage
 */
export function getCardsByStage(cards: LearningCard[], stage: LearningCard['stage']): LearningCard[] {
  return cards.filter(card => card.stage === stage);
}

/**
 * Sort cards by priority (highest first)
 */
export function sortCardsByPriority(cards: LearningCard[]): LearningCard[] {
  return [...cards].sort((a, b) => b.priority - a.priority);
}

/**
 * Update all card priorities
 */
export function updateAllPriorities(cards: LearningCard[]): LearningCard[] {
  return cards.map(card => ({
    ...card,
    priority: calculatePriority(card)
  }));
}

/**
 * Calculate learning statistics
 */
export function calculateLearningStats(cards: LearningCard[]) {
  const total = cards.length;
  const newCards = getCardsByStage(cards, 'new').length;
  const learning = getCardsByStage(cards, 'learning').length;
  const review = getCardsByStage(cards, 'review').length;
  const mastered = getCardsByStage(cards, 'mastered').length;
  const dueCards = getDueCards(cards).length;

  const totalReviews = cards.reduce((sum, c) => sum + c.totalReviews, 0);
  const totalCorrect = cards.reduce((sum, c) => sum + c.correctReviews, 0);
  const overallAccuracy = totalReviews > 0 ? (totalCorrect / totalReviews) * 100 : 0;

  const avgConfidence = cards.length > 0
    ? cards.reduce((sum, c) => sum + c.averageConfidence, 0) / cards.length
    : 0;

  return {
    total,
    newCards,
    learning,
    review,
    mastered,
    dueCards,
    totalReviews,
    overallAccuracy,
    avgConfidence,
  };
}

/**
 * Get recommended study session size
 */
export function getRecommendedSessionSize(cards: LearningCard[]): number {
  const dueCards = getDueCards(cards);
  const newCards = getCardsByStage(cards, 'new');

  // Mix of due cards and new cards
  const dueCount = Math.min(dueCards.length, 20);
  const newCount = Math.min(newCards.length, 10);

  return dueCount + newCount;
}
