import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LocalQuestionManager } from './questionManager'
import { saveQuestionStates, type QuestionStates } from './questionState'

// Mock question data
const mockQuestionsData = [
  {
    section: 'Test Section 1',
    sectionUrl: 'test-1',
    quizCount: 1,
    quizzes: [
      {
        url: 'quiz-1',
        title: 'Quiz 1',
        questionCount: 3,
        questions: [
          {
            id: 'q1',
            question: 'Question 1',
            options: [
              { text: 'Answer 1', correct: true },
              { text: 'Answer 2', correct: false },
            ],
          },
          {
            id: 'q2',
            question: 'Question 2',
            options: [
              { text: 'Answer 1', correct: false },
              { text: 'Answer 2', correct: true },
            ],
          },
          {
            id: 'q3',
            question: 'Question 3',
            options: [
              { text: 'Answer 1', correct: true },
              { text: 'Answer 2', correct: false },
            ],
          },
        ],
      },
    ],
  },
]

describe('LocalQuestionManager', () => {
  let manager: LocalQuestionManager

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear()

    // Create manager and mock the fetch
    manager = new LocalQuestionManager()

    // Mock fetch for initialization
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockQuestionsData),
      } as Response)
    )
  })

  describe('initialization', () => {
    it('should load questions from fetch', async () => {
      await manager.initialize()
      const sections = await manager.getSections()
      expect(sections).toEqual(['Test Section 1'])
    })

    it('should handle fetch errors', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
        } as Response)
      )

      await expect(manager.initialize()).rejects.toThrow('Failed to load questions.json')
    })
  })

  describe('getSections', () => {
    it('should return all section names', async () => {
      await manager.initialize()
      const sections = await manager.getSections()
      expect(sections).toEqual(['Test Section 1'])
    })
  })

  describe('getQuizzes', () => {
    it('should return quizzes grouped by section', async () => {
      await manager.initialize()
      const quizzes = await manager.getQuizzes()

      expect(quizzes).toHaveLength(1)
      expect(quizzes[0].section).toBe('Test Section 1')
      expect(quizzes[0].quizzes).toHaveLength(1)
      expect(quizzes[0].quizzes[0].url).toBe('quiz-1')
      expect(quizzes[0].quizzes[0].questionCount).toBe(3)
    })
  })

  describe('getNextQuestion - sequential mode', () => {
    it('should return questions in order', async () => {
      await manager.initialize()

      const q1 = await manager.getNextQuestion(undefined, undefined, false, false)
      const q2 = await manager.getNextQuestion(undefined, undefined, false, false)
      const q3 = await manager.getNextQuestion(undefined, undefined, false, false)

      expect(q1.id).toBe('q1')
      expect(q2.id).toBe('q2')
      expect(q3.id).toBe('q3')
    })

    it('should loop back to first question after reaching the end', async () => {
      await manager.initialize()

      await manager.getNextQuestion(undefined, undefined, false, false) // q1
      await manager.getNextQuestion(undefined, undefined, false, false) // q2
      await manager.getNextQuestion(undefined, undefined, false, false) // q3
      const q4 = await manager.getNextQuestion(undefined, undefined, false, false) // back to q1

      expect(q4.id).toBe('q1')
    })
  })

  describe('getNextQuestion - shuffle mode', () => {
    it('should return questions in random order', async () => {
      await manager.initialize()

      // Get questions in shuffle mode multiple times
      const firstRun: string[] = []
      for (let i = 0; i < 3; i++) {
        const q = await manager.getNextQuestion(undefined, undefined, true, false)
        firstRun.push(q.id)
      }

      // Verify all questions are included (order may vary)
      expect(firstRun.sort()).toEqual(['q1', 'q2', 'q3'])
    })
  })

  describe('getNextQuestion - most needed mode', () => {
    it('should prioritize harder questions (lower ratings)', async () => {
      await manager.initialize()

      // Set up ratings: q1=easy(5), q2=medium(3), q3=hard(1)
      const states: QuestionStates = {
        'q1': { rating: 5, selfRating: 0, correctStreak: 0, incorrectCount: 0, lastAnswered: 0 },
        'q2': { rating: 3, selfRating: 0, correctStreak: 0, incorrectCount: 0, lastAnswered: 0 },
        'q3': { rating: 1, selfRating: 0, correctStreak: 0, incorrectCount: 0, lastAnswered: 0 },
      }
      saveQuestionStates(states)

      const q1 = await manager.getNextQuestion(undefined, undefined, false, true)
      const q2 = await manager.getNextQuestion(undefined, undefined, false, true)
      const q3 = await manager.getNextQuestion(undefined, undefined, false, true)

      // Should prioritize hardest first
      expect(q1.id).toBe('q3') // hardest
      expect(q2.id).toBe('q2') // medium
      expect(q3.id).toBe('q1') // easiest
    })

    it('should prioritize questions with many incorrect answers', async () => {
      await manager.initialize()

      // Set up states: q1=many incorrect, q2=few incorrect
      const states: QuestionStates = {
        'q1': { rating: 3, selfRating: 0, correctStreak: 0, incorrectCount: 5, lastAnswered: 0 },
        'q2': { rating: 3, selfRating: 0, correctStreak: 0, incorrectCount: 1, lastAnswered: 0 },
        'q3': { rating: 3, selfRating: 0, correctStreak: 0, incorrectCount: 0, lastAnswered: 0 },
      }
      saveQuestionStates(states)

      const q1 = await manager.getNextQuestion(undefined, undefined, false, true)

      // Should prioritize question with most incorrect answers
      expect(q1.id).toBe('q1')
    })

    it('should deprioritize questions with long correct streaks', async () => {
      await manager.initialize()

      // Set up states: q1=long streak, q2=no streak
      const states: QuestionStates = {
        'q1': { rating: 3, selfRating: 0, correctStreak: 10, incorrectCount: 0, lastAnswered: 0 },
        'q2': { rating: 3, selfRating: 0, correctStreak: 0, incorrectCount: 0, lastAnswered: 0 },
        'q3': { rating: 3, selfRating: 0, correctStreak: 0, incorrectCount: 0, lastAnswered: 0 },
      }
      saveQuestionStates(states)

      const q1 = await manager.getNextQuestion(undefined, undefined, false, true)
      const q2 = await manager.getNextQuestion(undefined, undefined, false, true)
      const q3 = await manager.getNextQuestion(undefined, undefined, false, true)

      // q1 should come last due to long streak
      expect(q3.id).toBe('q1')
    })

    it('should boost questions not seen recently', async () => {
      await manager.initialize()

      const now = Date.now()
      const weekAgo = now - (7 * 24 * 60 * 60 * 1000)

      // Set up states: q1=recently answered, q2=long time ago
      const states: QuestionStates = {
        'q1': { rating: 3, selfRating: 0, correctStreak: 0, incorrectCount: 0, lastAnswered: now },
        'q2': { rating: 3, selfRating: 0, correctStreak: 0, incorrectCount: 0, lastAnswered: weekAgo },
        'q3': { rating: 3, selfRating: 0, correctStreak: 0, incorrectCount: 0, lastAnswered: 0 },
      }
      saveQuestionStates(states)

      const q1 = await manager.getNextQuestion(undefined, undefined, false, true)

      // q2 should come first as it hasn't been seen recently
      expect(q1.id).toBe('q2')
    })

    it('should handle unknown questions appropriately', async () => {
      await manager.initialize()

      // Set up mixed states
      const states: QuestionStates = {
        'q1': { rating: 0, selfRating: 0, correctStreak: 0, incorrectCount: 0, lastAnswered: 0 }, // unknown
        'q2': { rating: 5, selfRating: 0, correctStreak: 0, incorrectCount: 0, lastAnswered: 0 }, // well known
        'q3': { rating: 1, selfRating: 0, correctStreak: 0, incorrectCount: 0, lastAnswered: 0 }, // less known
      }
      saveQuestionStates(states)

      const q1 = await manager.getNextQuestion(undefined, undefined, false, true)
      const q2 = await manager.getNextQuestion(undefined, undefined, false, true)
      const q3 = await manager.getNextQuestion(undefined, undefined, false, true)

      // Unknown should come first (highest priority), then less known, then well known
      expect(q1.id).toBe('q1') // unknown (highest priority)
      expect(q2.id).toBe('q3') // less known
      expect(q3.id).toBe('q2') // well known
    })
  })

  describe('filtering', () => {
    it('should filter by quiz', async () => {
      await manager.initialize()

      const q = await manager.getNextQuestion(undefined, ['quiz-1'], false, false)
      expect(q.quiz).toBe('Quiz 1')
    })

    it('should return error when no questions match filters', async () => {
      await manager.initialize()

      await expect(
        manager.getNextQuestion(undefined, ['non-existent-quiz'], false, false)
      ).rejects.toThrow('No questions available')
    })
  })

  describe('getStats', () => {
    it('should return total question count', async () => {
      await manager.initialize()

      const stats = await manager.getStats()
      expect(stats.totalQuestions).toBe(3)
    })

    it('should respect quiz filter in stats', async () => {
      await manager.initialize()

      const stats = await manager.getStats(undefined, ['quiz-1'])
      expect(stats.totalQuestions).toBe(3)
    })
  })
})
