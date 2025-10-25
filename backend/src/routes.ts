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
function getAllQuestions(sectionFilter?: string[], quizFilter?: string[]): Question[] {
  const allQuestions: Question[] = [];
  for (const section of questionsData) {
    // Skip if section filter is provided and this section is not included
    if (sectionFilter && sectionFilter.length > 0 && !sectionFilter.includes(section.section)) {
      continue;
    }
    for (const quiz of section.quizzes) {
      // Skip if quiz filter is provided and this quiz is not included
      if (quizFilter && quizFilter.length > 0 && !quizFilter.includes(quiz.url)) {
        continue;
      }
      allQuestions.push(...quiz.questions);
    }
  }
  return allQuestions;
}

/**
 * GET /api/sections
 * Get all available sections
 */
router.get('/sections', async (req: Request, res: Response) => {
  try {
    const sections = questionsData.map(section => section.section);
    res.json(sections);
  } catch (error) {
    console.error('Error getting sections:', error);
    res.status(500).json({ error: 'Failed to get sections' });
  }
});

/**
 * GET /api/quizzes
 * Get all quizzes grouped by section
 */
router.get('/quizzes', async (req: Request, res: Response) => {
  try {
    const quizzesBySection = questionsData.map(section => ({
      section: section.section,
      quizzes: section.quizzes.map(quiz => ({
        title: quiz.title,
        url: quiz.url,
        questionCount: quiz.questionCount,
      }))
    }));
    res.json(quizzesBySection);
  } catch (error) {
    console.error('Error getting quizzes:', error);
    res.status(500).json({ error: 'Failed to get quizzes' });
  }
});

/**
 * POST /api/questions/next
 * Get the next question to study based on spaced repetition or random shuffle
 */
router.post('/questions/next', async (req: Request, res: Response) => {
  try {
    // Get filters from request body
    const { sections, quizzes, shuffleMode, onlyDue } = req.body;

    const allQuestions = getAllQuestions(sections, quizzes);

    if (allQuestions.length === 0) {
      return res.status(404).json({ error: 'No questions available' });
    }

    let nextQuestion: Question | null = null;

    // Get IDs of filtered questions
    const questionIds = allQuestions.map(q => q.id);

    // If shuffle mode is enabled, just pick a random question
    if (shuffleMode) {
      nextQuestion = allQuestions[Math.floor(Math.random() * allQuestions.length)];
    } else {
      // Use spaced repetition algorithm
      // Get all question stats from database, filtered to only questions in the current selection
      const statsResult = await pool.query(
        'SELECT * FROM question_stats WHERE question_id = ANY($1) AND next_review <= NOW() ORDER BY next_review ASC LIMIT 1',
        [questionIds]
      );

      if (statsResult.rows.length > 0) {
        // Found a question due for review
        const stat = statsResult.rows[0];
        nextQuestion = allQuestions.find((q) => q.id === stat.question_id)!;
      } else {
        // No questions due, find one that hasn't been studied yet
        const studiedIdsResult = await pool.query(
          'SELECT question_id FROM question_stats WHERE question_id = ANY($1)',
          [questionIds]
        );
        const studiedIds = studiedIdsResult.rows.map((row) => row.question_id);

        const unstudiedQuestions = allQuestions.filter(
          (q) => !studiedIds.includes(q.id)
        );

        if (unstudiedQuestions.length > 0) {
          // Pick a random unstudied question
          nextQuestion = unstudiedQuestions[Math.floor(Math.random() * unstudiedQuestions.length)];
        } else if (!onlyDue) {
          // Only continue if not in "only due" mode
          // All questions studied, get the one with earliest next_review
          const earliestResult = await pool.query(
            'SELECT question_id FROM question_stats WHERE question_id = ANY($1) ORDER BY next_review ASC LIMIT 1',
            [questionIds]
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
    }

    if (!nextQuestion) {
      return res.status(404).json({
        error: 'No questions due',
        message: 'Great work! No more questions are due for review today. Come back later!'
      });
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

    // Calculate strength level
    let strengthLevel = 'New';
    let strengthColor = '#9ca3af';

    if (totalAttempts > 0) {
      const accuracy = (correctAttempts / totalAttempts) * 100;

      if (sm2Result.intervalDays >= 30 && sm2Result.easeFactor >= 2.5 && accuracy >= 80) {
        strengthLevel = 'Mastered';
        strengthColor = '#10b981';
      } else if (sm2Result.intervalDays >= 7 && sm2Result.easeFactor >= 2.3 && accuracy >= 70) {
        strengthLevel = 'Strong';
        strengthColor = '#059669';
      } else if (sm2Result.intervalDays >= 3 && accuracy >= 60) {
        strengthLevel = 'Good';
        strengthColor = '#3b82f6';
      } else if (sm2Result.repetitions >= 1) {
        strengthLevel = 'Learning';
        strengthColor = '#f59e0b';
      } else {
        strengthLevel = 'Weak';
        strengthColor = '#ef4444';
      }
    }

    res.json({
      success: true,
      nextReviewIn: sm2Result.intervalDays,
      stats: {
        totalAttempts,
        correctAttempts,
        incorrectAttempts,
        accuracy: totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0,
      },
      strength: {
        level: strengthLevel,
        color: strengthColor,
        easeFactor: sm2Result.easeFactor,
        intervalDays: sm2Result.intervalDays,
        repetitions: sm2Result.repetitions,
      },
    });
  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});

/**
 * POST /api/stats
 * Get overall statistics with optional timeframe
 */
router.post('/stats', async (req: Request, res: Response) => {
  try {
    // Get filters from request body
    const { sections, quizzes, timeframeDays } = req.body;

    const allQuestions = getAllQuestions(sections, quizzes);
    const totalQuestions = allQuestions.length;

    // Get IDs of questions in the filtered set
    const questionIds = allQuestions.map(q => q.id);

    // Get all-time studied count from question_stats
    let studiedCount = 0;
    if (questionIds.length > 0) {
      const studiedResult = await pool.query(
        'SELECT COUNT(*) as count FROM question_stats WHERE question_id = ANY($1)',
        [questionIds]
      );
      studiedCount = parseInt(studiedResult.rows[0].count) || 0;
    }

    // Get timeframe-based accuracy from response_history
    let statsResult;
    if (questionIds.length > 0 && timeframeDays && timeframeDays > 0) {
      // Calculate date threshold
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - timeframeDays);

      statsResult = await pool.query(`
        SELECT
          COUNT(*) as total_attempts,
          SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_attempts,
          SUM(CASE WHEN NOT is_correct THEN 1 ELSE 0 END) as incorrect_attempts
        FROM response_history
        WHERE question_id = ANY($1) AND timestamp >= $2
      `, [questionIds, cutoffDate]);
    } else if (questionIds.length > 0) {
      // No timeframe (0 or undefined), get all-time stats from question_stats
      statsResult = await pool.query(`
        SELECT
          SUM(total_attempts) as total_attempts,
          SUM(correct_attempts) as correct_attempts,
          SUM(incorrect_attempts) as incorrect_attempts
        FROM question_stats
        WHERE question_id = ANY($1)
      `, [questionIds]);
    } else {
      statsResult = { rows: [{ total_attempts: 0, correct_attempts: 0, incorrect_attempts: 0 }] };
    }

    const stats = statsResult.rows[0];
    const totalAttempts = parseInt(stats.total_attempts) || 0;
    const correctAttempts = parseInt(stats.correct_attempts) || 0;
    const incorrectAttempts = parseInt(stats.incorrect_attempts) || 0;

    res.json({
      totalQuestions,
      studiedQuestions: studiedCount,
      unstudiedQuestions: totalQuestions - studiedCount,
      totalAttempts,
      correctAttempts,
      incorrectAttempts,
      overallAccuracy:
        totalAttempts > 0
          ? (correctAttempts / totalAttempts) * 100
          : 0,
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export default router;
