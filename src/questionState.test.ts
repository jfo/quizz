import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadQuestionStates,
  saveQuestionStates,
  getQuestionState,
  updateQuestionState,
  updateRatingAfterAnswer,
  setQuestionRating,
  calculateNeedScore,
  exportState,
  importState,
  type QuestionStates,
} from './questionState'

describe('questionState', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  describe('loadQuestionStates and saveQuestionStates', () => {
    it('should save and load question states', () => {
      const states: QuestionStates = {
        'q1': { rating: 3, correctStreak: 2, incorrectCount: 1, lastAnswered: 1000 },
        'q2': { rating: 5, correctStreak: 0, incorrectCount: 3, lastAnswered: 2000 },
      }

      saveQuestionStates(states)
      const loaded = loadQuestionStates()

      expect(loaded).toEqual(states)
    })

    it('should return empty object when no states exist', () => {
      const states = loadQuestionStates()
      expect(states).toEqual({})
    })

    it('should handle corrupted localStorage data', () => {
      localStorage.setItem('questionStates', 'invalid json')
      const states = loadQuestionStates()
      expect(states).toEqual({})
    })
  })

  describe('getQuestionState', () => {
    it('should return default state for new question', () => {
      const state = getQuestionState('newQuestion')
      expect(state).toEqual({
        rating: 0,
        correctStreak: 0,
        incorrectCount: 0,
        lastAnswered: 0,
      })
    })

    it('should return existing state for known question', () => {
      const states: QuestionStates = {
        'q1': { rating: 3, correctStreak: 2, incorrectCount: 1, lastAnswered: 1000 },
      }
      saveQuestionStates(states)

      const state = getQuestionState('q1')
      expect(state).toEqual(states['q1'])
    })
  })

  describe('updateQuestionState', () => {
    it('should update question state and persist to localStorage', () => {
      updateQuestionState('q1', { rating: 3, correctStreak: 1 })

      const loaded = loadQuestionStates()
      expect(loaded['q1'].rating).toBe(3)
      expect(loaded['q1'].correctStreak).toBe(1)
      expect(loaded['q1'].lastAnswered).toBeGreaterThan(0)
    })

    it('should merge updates with existing state', () => {
      updateQuestionState('q1', { rating: 3 })
      updateQuestionState('q1', { correctStreak: 5 })

      const state = getQuestionState('q1')
      expect(state.rating).toBe(3)
      expect(state.correctStreak).toBe(5)
    })
  })

  describe('updateRatingAfterAnswer', () => {
    it('should increment rating and streak when correct', () => {
      const state = updateRatingAfterAnswer('q1', true)
      expect(state.correctStreak).toBe(1)
      expect(state.rating).toBe(1) // Incremented from 0
    })

    it('should increment rating when already rated and correct', () => {
      updateQuestionState('q1', { rating: 3, correctStreak: 2 })
      const state = updateRatingAfterAnswer('q1', true)
      expect(state.rating).toBe(4) // Incremented
      expect(state.correctStreak).toBe(3) // Streak incremented
    })

    it('should decrement rating when incorrect and already rated', () => {
      updateQuestionState('q1', { rating: 4, correctStreak: 2 })
      const state = updateRatingAfterAnswer('q1', false)
      expect(state.rating).toBe(3) // Decremented by 1
      expect(state.correctStreak).toBe(0) // Streak reset
      expect(state.incorrectCount).toBe(1)
    })

    it('should not decrement rating below 0', () => {
      updateQuestionState('q1', { rating: 0 })
      const state = updateRatingAfterAnswer('q1', false)
      expect(state.rating).toBe(0) // Minimum rating
    })

    it('should track incorrect count and stay at 0 when unrated', () => {
      const state = updateRatingAfterAnswer('q1', false)
      expect(state.rating).toBe(0) // Still at 0
      expect(state.incorrectCount).toBe(1)
      expect(state.correctStreak).toBe(0)
    })
  })

  describe('setQuestionRating', () => {
    it('should set rating for question', () => {
      const state = setQuestionRating('q1', 4)
      expect(state.rating).toBe(4)
    })

    it('should override existing rating', () => {
      setQuestionRating('q1', 2)
      const state = setQuestionRating('q1', 5)
      expect(state.rating).toBe(5)
    })
  })

  describe('calculateNeedScore', () => {
    it('should give high priority to unknown questions (rating 0)', () => {
      const state = { rating: 0, selfRating: 0, correctStreak: 0, incorrectCount: 0, lastAnswered: 0 }
      const score = calculateNeedScore(state)
      expect(score).toBe(100) // Max score for unknown questions
    })

    it('should prioritize unknown questions with incorrect answers', () => {
      const state1 = { rating: 0, selfRating: 0, correctStreak: 0, incorrectCount: 0, lastAnswered: 0 }
      const state2 = { rating: 0, selfRating: 0, correctStreak: 0, incorrectCount: 2, lastAnswered: 0 }

      const score1 = calculateNeedScore(state1)
      const score2 = calculateNeedScore(state2)

      expect(score2).toBeGreaterThan(score1)
    })

    it('should give higher priority to questions with lower knowledge (lower rating)', () => {
      const wellKnown = { rating: 5, selfRating: 0, correctStreak: 0, incorrectCount: 0, lastAnswered: 0 }
      const lessKnown = { rating: 1, selfRating: 0, correctStreak: 0, incorrectCount: 0, lastAnswered: 0 }

      const wellKnownScore = calculateNeedScore(wellKnown)
      const lessKnownScore = calculateNeedScore(lessKnown)

      expect(lessKnownScore).toBeGreaterThan(wellKnownScore)
    })

    it('should boost questions with many incorrect answers', () => {
      const state1 = { rating: 3, selfRating: 0, correctStreak: 0, incorrectCount: 0, lastAnswered: 0 }
      const state2 = { rating: 3, selfRating: 0, correctStreak: 0, incorrectCount: 3, lastAnswered: 0 }

      const score1 = calculateNeedScore(state1)
      const score2 = calculateNeedScore(state2)

      expect(score2).toBeGreaterThan(score1)
    })

    it('should reduce priority for questions with correct streaks', () => {
      const state1 = { rating: 3, selfRating: 0, correctStreak: 0, incorrectCount: 0, lastAnswered: 0 }
      const state2 = { rating: 3, selfRating: 0, correctStreak: 5, incorrectCount: 0, lastAnswered: 0 }

      const score1 = calculateNeedScore(state1)
      const score2 = calculateNeedScore(state2)

      expect(score2).toBeLessThan(score1)
    })

    it('should boost questions not seen recently', () => {
      const now = Date.now()
      const recent = { rating: 3, selfRating: 0, correctStreak: 0, incorrectCount: 0, lastAnswered: now }
      const old = { rating: 3, selfRating: 0, correctStreak: 0, incorrectCount: 0, lastAnswered: now - (7 * 24 * 60 * 60 * 1000) } // 7 days ago

      const recentScore = calculateNeedScore(recent)
      const oldScore = calculateNeedScore(old)

      expect(oldScore).toBeGreaterThan(recentScore)
    })
  })

  describe('exportState and importState', () => {
    it('should export state as JSON string', () => {
      const states: QuestionStates = {
        'q1': { rating: 3, correctStreak: 2, incorrectCount: 1, lastAnswered: 1000 },
        'q2': { rating: 5, correctStreak: 0, incorrectCount: 3, lastAnswered: 2000 },
      }
      saveQuestionStates(states)

      const exported = exportState()
      const parsed = JSON.parse(exported)

      expect(parsed).toEqual(states)
    })

    it('should import valid state from JSON string', () => {
      const states: QuestionStates = {
        'q1': { rating: 3, selfRating: 0, correctStreak: 2, incorrectCount: 1, lastAnswered: 1000 },
      }
      const json = JSON.stringify(states)

      const success = importState(json)
      expect(success).toBe(true)

      const loaded = loadQuestionStates()
      expect(loaded).toEqual(states)
    })

    it('should reject invalid JSON', () => {
      const success = importState('invalid json')
      expect(success).toBe(false)
    })

    it('should reject invalid state structure', () => {
      const invalid = JSON.stringify({ q1: 'not a valid state' })
      const success = importState(invalid)
      expect(success).toBe(false)
    })

    it('should reject state with missing fields', () => {
      const invalid = JSON.stringify({ q1: { rating: 3 } })
      const success = importState(invalid)
      expect(success).toBe(false)
    })

    it('should reject non-object state', () => {
      const success = importState(JSON.stringify('string'))
      expect(success).toBe(false)
    })
  })
})
