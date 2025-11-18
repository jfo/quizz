/**
 * Smart Question Manager with Spaced Repetition
 * Integrates the learning engine with question selection
 */

import { Question } from './api';
import { LearningCard, sortCardsByPriority, getDueCards } from './learningEngine';
import { loadLearningCards, getLearningCard } from './learningState';

export interface SmartQuestionSelector {
  getNextQuestion(
    allQuestions: Question[],
    mode: 'smart' | 'due-only' | 'new-only' | 'review-only' | 'weak-areas'
  ): Question | null;

  getSessionQuestions(
    allQuestions: Question[],
    maxCards: number,
    mixNewCards: boolean
  ): Question[];
}

/**
 * Smart question selection based on spaced repetition and priorities
 */
export class SmartSelector implements SmartQuestionSelector {
  private questionMap: Map<string, Question> = new Map();
  private lastSelectedIds: Set<string> = new Set();
  private readonly MAX_RECENT = 5;

  /**
   * Get the next best question to study
   */
  getNextQuestion(
    allQuestions: Question[],
    mode: 'smart' | 'due-only' | 'new-only' | 'review-only' | 'weak-areas' = 'smart'
  ): Question | null {
    // Build question map
    this.questionMap.clear();
    allQuestions.forEach(q => this.questionMap.set(q.id, q));

    // Load learning cards
    const cardsMap = loadLearningCards();

    // Get or create cards for all questions
    const cards: LearningCard[] = allQuestions.map(q => {
      if (cardsMap[q.id]) {
        return cardsMap[q.id];
      }
      return getLearningCard(q.id);
    });

    // Filter based on mode
    let filteredCards = this.filterCardsByMode(cards, mode);

    if (filteredCards.length === 0) {
      // Fallback to any card if no cards match the mode
      filteredCards = cards;
    }

    // Sort by priority
    const sortedCards = sortCardsByPriority(filteredCards);

    // Avoid recently selected questions
    const availableCards = sortedCards.filter(
      card => !this.lastSelectedIds.has(card.questionId)
    );

    const selectedCards = availableCards.length > 0 ? availableCards : sortedCards;

    if (selectedCards.length === 0) {
      return null;
    }

    // Select the highest priority card
    const selectedCard = selectedCards[0];

    // Track recently selected
    this.lastSelectedIds.add(selectedCard.questionId);
    if (this.lastSelectedIds.size > this.MAX_RECENT) {
      const firstId = Array.from(this.lastSelectedIds)[0];
      this.lastSelectedIds.delete(firstId);
    }

    return this.questionMap.get(selectedCard.questionId) || null;
  }

  /**
   * Get a batch of questions for a study session
   */
  getSessionQuestions(
    allQuestions: Question[],
    maxCards: number = 20,
    mixNewCards: boolean = true
  ): Question[] {
    // Build question map
    this.questionMap.clear();
    allQuestions.forEach(q => this.questionMap.set(q.id, q));

    // Load learning cards
    const cardsMap = loadLearningCards();

    // Get or create cards for all questions
    const cards: LearningCard[] = allQuestions.map(q => {
      if (cardsMap[q.id]) {
        return cardsMap[q.id];
      }
      return getLearningCard(q.id);
    });

    const sessionCards: LearningCard[] = [];

    // 1. Add due cards (highest priority)
    const dueCards = getDueCards(cards);
    const sortedDueCards = sortCardsByPriority(dueCards);
    const dueCount = Math.min(sortedDueCards.length, Math.floor(maxCards * 0.7));
    sessionCards.push(...sortedDueCards.slice(0, dueCount));

    // 2. Add new cards if mixing
    if (mixNewCards && sessionCards.length < maxCards) {
      const newCards = cards.filter(c => c.stage === 'new');
      const sortedNewCards = sortCardsByPriority(newCards);
      const newCount = Math.min(
        sortedNewCards.length,
        maxCards - sessionCards.length,
        Math.floor(maxCards * 0.3)
      );
      sessionCards.push(...sortedNewCards.slice(0, newCount));
    }

    // 3. Fill remaining with high-priority cards
    if (sessionCards.length < maxCards) {
      const sessionIds = new Set(sessionCards.map(c => c.questionId));
      const remainingCards = cards.filter(c => !sessionIds.has(c.questionId));
      const sortedRemaining = sortCardsByPriority(remainingCards);
      const remainingCount = maxCards - sessionCards.length;
      sessionCards.push(...sortedRemaining.slice(0, remainingCount));
    }

    // Convert to questions
    return sessionCards
      .map(card => this.questionMap.get(card.questionId))
      .filter((q): q is Question => q !== undefined);
  }

  /**
   * Filter cards based on study mode
   */
  private filterCardsByMode(
    cards: LearningCard[],
    mode: 'smart' | 'due-only' | 'new-only' | 'review-only' | 'weak-areas'
  ): LearningCard[] {
    switch (mode) {
      case 'due-only':
        return getDueCards(cards);

      case 'new-only':
        return cards.filter(c => c.stage === 'new');

      case 'review-only':
        return cards.filter(c => c.stage === 'review' || c.stage === 'learning');

      case 'weak-areas':
        // Cards with low accuracy or low confidence
        return cards.filter(c => {
          const accuracy = c.totalReviews > 0 ? c.correctReviews / c.totalReviews : 0;
          return accuracy < 0.7 || c.averageConfidence < 1.5;
        });

      case 'smart':
      default:
        // Smart mode: mix of due, new, and high-priority cards
        return cards;
    }
  }

  /**
   * Get weak areas - questions that need more practice
   */
  getWeakAreas(allQuestions: Question[]): Question[] {
    this.questionMap.clear();
    allQuestions.forEach(q => this.questionMap.set(q.id, q));

    const cardsMap = loadLearningCards();
    const cards = allQuestions
      .map(q => cardsMap[q.id])
      .filter((c): c is LearningCard => c !== undefined);

    // Find cards with low accuracy or confidence
    const weakCards = cards.filter(c => {
      const accuracy = c.totalReviews > 0 ? c.correctReviews / c.totalReviews : 1;
      return (
        c.totalReviews >= 3 && // Only consider if reviewed at least 3 times
        (accuracy < 0.6 || c.averageConfidence < 1.5)
      );
    });

    // Sort by performance (worst first)
    weakCards.sort((a, b) => {
      const accA = a.correctReviews / a.totalReviews;
      const accB = b.correctReviews / b.totalReviews;
      return accA - accB;
    });

    return weakCards
      .map(card => this.questionMap.get(card.questionId))
      .filter((q): q is Question => q !== undefined);
  }

  /**
   * Get study forecast - when to study next
   */
  getStudyForecast(allQuestions: Question[]): {
    dueNow: number;
    dueToday: number;
    dueTomorrow: number;
    dueThisWeek: number;
  } {
    const cardsMap = loadLearningCards();
    const cards = allQuestions
      .map(q => cardsMap[q.id] || getLearningCard(q.id))
      .filter((c): c is LearningCard => c !== undefined);

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const endOfToday = new Date().setHours(23, 59, 59, 999);
    const endOfTomorrow = endOfToday + oneDayMs;
    const endOfWeek = endOfToday + (7 * oneDayMs);

    return {
      dueNow: cards.filter(c => c.dueDate <= now).length,
      dueToday: cards.filter(c => c.dueDate <= endOfToday).length,
      dueTomorrow: cards.filter(c => c.dueDate > endOfToday && c.dueDate <= endOfTomorrow).length,
      dueThisWeek: cards.filter(c => c.dueDate <= endOfWeek).length,
    };
  }
}

export const smartSelector = new SmartSelector();
