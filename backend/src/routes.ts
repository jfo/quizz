import { Router, Request, Response } from 'express';
import pool from './db';
import { Question, Section, AnswerSubmission } from './types';
import { calculateSM2, correctnessToQuality } from './spacedRepetition';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

// Load questions from JSON file
let questionsData: Section[] = [];

async function loadQuestions() {
  const filePath = path.join(__dirname, '../..', 'questions.json');
  const data = await fs.readFile(filePath, 'utf-8');
  questionsData = JSON.parse(data);
}

// Initialize questions on startup
loadQuestions().catch(console.error);

/**
 * Get all questions flattened into a single array
 */
function getAllQuestions(): Question[] {
  const allQuestions: Question[] = [];
  for (const section of questionsData) {
    for (const quiz of section.quizzes) {
      allQuestions.push(...quiz.questions);
    }
  }
  return allQuestions;
}

/**
 * GET /api/questions/next
 * Get the next question to study based on spaced repetition
 */
router.get('/questions/next', async (req: Request, res: Response) => {
  try {
    const allQuestions = getAllQuestions();

    if (allQuestions.length === 0) {
      return res.status(404).json({ error: 'No questions available' });
    }

    // Get all question stats from database
    const statsResult = await pool.query(
      'SELECT * FROM question_stats WHERE next_review <= NOW() ORDER BY next_review ASC LIMIT 1'
    );

    let nextQuestion: Question;

    if (statsResult.rows.length > 0) {
      // Found a question due for review
      const stat = statsResult.rows[0];
      nextQuestion = allQuestions.find((q) => q.id === stat.question_id)!;
    } else {
      // No questions due, find one that hasn't been studied yet
      const studiedIds = (await pool.query('SELECT question_id FROM question_stats')).rows.map(
        (row) => row.question_id
      );

      const unstudiedQuestions = allQuestions.filter(
        (q) => !studiedIds.includes(q.id)
      );

      if (unstudiedQuestions.length > 0) {
        // Pick a random unstudied question
        nextQuestion = unstudiedQuestions[Math.floor(Math.random() * unstudiedQuestions.length)];
      } else {
        // All questions studied, get the one with earliest next_review
        const earliestResult = await pool.query(
          'SELECT question_id FROM question_stats ORDER BY next_review ASC LIMIT 1'
        );

        if (earliestResult.rows.length > 0) {
          nextQuestion = allQuestions.find(
            (q) => q.id === earliestResult.rows[0].question_id
          )!;
        } else {
          // Fallback to random
          nextQuestion = allQuestions[Math.floor(Math.random() * allQuestions.length)];
        }
      }
    }

    res.json(nextQuestion);
  } catch (error) {
    console.error('Error getting next question:', error);
    res.status(500).json({ error: 'Failed to get next question' });
  }
});

/**
 * POST /api/answers
 * Submit an answer and update spaced repetition data
 */
router.post('/answers', async (req: Request, res: Response) => {
  try {
    const { questionId, isCorrect, selectedOption, responseTimeMs }: AnswerSubmission = req.body;

    if (!questionId || isCorrect === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Log the response
    await pool.query(
      `INSERT INTO response_history (question_id, is_correct, selected_option, response_time_ms)
       VALUES ($1, $2, $3, $4)`,
      [questionId, isCorrect, selectedOption, responseTimeMs]
    );

    // Get current stats or create new ones
    const existingStats = await pool.query(
      'SELECT * FROM question_stats WHERE question_id = $1',
      [questionId]
    );

    let currentEaseFactor = 2.5;
    let currentInterval = 1;
    let currentRepetitions = 0;
    let totalAttempts = 0;
    let correctAttempts = 0;
    let incorrectAttempts = 0;

    if (existingStats.rows.length > 0) {
      const stats = existingStats.rows[0];
      currentEaseFactor = parseFloat(stats.ease_factor);
      currentInterval = stats.interval_days;
      currentRepetitions = stats.repetitions;
      totalAttempts = stats.total_attempts;
      correctAttempts = stats.correct_attempts;
      incorrectAttempts = stats.incorrect_attempts;
    }

    // Update attempt counts
    totalAttempts++;
    if (isCorrect) {
      correctAttempts++;
    } else {
      incorrectAttempts++;
    }

    // Calculate new SM-2 parameters
    const quality = correctnessToQuality(isCorrect);
    const sm2Result = calculateSM2(quality, currentEaseFactor, currentInterval, currentRepetitions);

    // Calculate next review date
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + sm2Result.intervalDays);

    // Update or insert stats
    await pool.query(
      `INSERT INTO question_stats
       (question_id, ease_factor, interval_days, repetitions, next_review, last_reviewed,
        total_attempts, correct_attempts, incorrect_attempts)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8)
       ON CONFLICT (question_id)
       DO UPDATE SET
         ease_factor = $2,
         interval_days = $3,
         repetitions = $4,
         next_review = $5,
         last_reviewed = NOW(),
         total_attempts = $6,
         correct_attempts = $7,
         incorrect_attempts = $8`,
      [
        questionId,
        sm2Result.easeFactor,
        sm2Result.intervalDays,
        sm2Result.repetitions,
        nextReview,
        totalAttempts,
        correctAttempts,
        incorrectAttempts,
      ]
    );

    res.json({
      success: true,
      nextReviewIn: sm2Result.intervalDays,
      stats: {
        totalAttempts,
        correctAttempts,
        incorrectAttempts,
        accuracy: totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0,
      },
    });
  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});

/**
 * GET /api/stats
 * Get overall statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const totalQuestions = getAllQuestions().length;

    const statsResult = await pool.query(`
      SELECT
        COUNT(*) as studied_count,
        SUM(total_attempts) as total_attempts,
        SUM(correct_attempts) as correct_attempts,
        SUM(incorrect_attempts) as incorrect_attempts
      FROM question_stats
    `);

    const stats = statsResult.rows[0];

    res.json({
      totalQuestions,
      studiedQuestions: parseInt(stats.studied_count) || 0,
      unstudiedQuestions: totalQuestions - (parseInt(stats.studied_count) || 0),
      totalAttempts: parseInt(stats.total_attempts) || 0,
      correctAttempts: parseInt(stats.correct_attempts) || 0,
      incorrectAttempts: parseInt(stats.incorrect_attempts) || 0,
      overallAccuracy:
        parseInt(stats.total_attempts) > 0
          ? ((parseInt(stats.correct_attempts) || 0) / parseInt(stats.total_attempts)) * 100
          : 0,
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export default router;
