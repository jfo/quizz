import { Question, Stats, QuizzesBySection, AnswerResponse } from './api';
import { loadQuestionStates, calculateNeedScore } from './questionState';

// Types from backend
interface Quiz {
  url: string;
  title: string;
  questionCount: number;
  questions: Question[];
}

interface Section {
  section: string;
  sectionUrl: string;
  quizCount: number;
  quizzes: Quiz[];
}

// Interface for question management
export interface IQuestionManager {
  getSections(): Promise<string[]>;
  getQuizzes(): Promise<QuizzesBySection[]>;
  getNextQuestion(sections?: string[], quizzes?: string[], shuffleMode?: boolean, mostNeededMode?: boolean, ratingRange?: [number, number]): Promise<Question>;
  submitAnswer(questionId: string, isCorrect: boolean, selectedOption: string, responseTimeMs?: number): Promise<AnswerResponse>;
  getStats(sections?: string[], quizzes?: string[], timeframeDays?: number, ratingRange?: [number, number]): Promise<Stats>;
  getAllQuestionsForStats(sections?: string[], quizzes?: string[]): Promise<Question[]>;
  initialize(): Promise<void>;
}

// Local frontend implementation (loads questions locally)
export class LocalQuestionManager implements IQuestionManager {
  private questionsData: Section[] = [];
  private currentQuestionIndex: number = 0;
  private currentQuestionList: Question[] = [];

  async initialize(): Promise<void> {
    // Fetch questions.json from public folder
    // Use relative path to work with GitHub Pages base path
    const response = await fetch('./questions.json');
    if (!response.ok) {
      throw new Error('Failed to load questions.json');
    }
    this.questionsData = await response.json();
  }

  async getSections(): Promise<string[]> {
    return this.questionsData.map(section => section.section);
  }

  async getQuizzes(): Promise<QuizzesBySection[]> {
    return this.questionsData.map(section => ({
      section: section.section,
      quizzes: section.quizzes.map(quiz => ({
        title: quiz.title,
        url: quiz.url,
        questionCount: quiz.questionCount,
      }))
    }));
  }

  private getAllQuestions(sectionFilter?: string[], quizFilter?: string[]): Question[] {
    const allQuestions: Question[] = [];
    for (const section of this.questionsData) {
      // Skip if section filter is provided and this section is not included
      if (sectionFilter && sectionFilter.length > 0 && !sectionFilter.includes(section.section)) {
        continue;
      }
      for (const quiz of section.quizzes) {
        // Skip if quiz filter is provided and this quiz is not included
        if (quizFilter && quizFilter.length > 0 && !quizFilter.includes(quiz.url)) {
          continue;
        }
        // Add section and quiz metadata to each question
        const questionsWithMetadata = quiz.questions.map(q => ({
          ...q,
          section: section.section,
          quiz: quiz.title
        }));
        allQuestions.push(...questionsWithMetadata);
      }
    }
    return allQuestions;
  }

  async getNextQuestion(sections?: string[], quizzes?: string[], shuffleMode?: boolean, mostNeededMode?: boolean, ratingRange?: [number, number]): Promise<Question> {
    let allQuestions = this.getAllQuestions(sections, quizzes);

    // Filter by rating range if specified
    if (ratingRange) {
      const states = loadQuestionStates();
      allQuestions = allQuestions.filter(q => {
        const state = states[q.id] || { rating: 0, correctStreak: 0, incorrectCount: 0, lastAnswered: 0 };
        return state.rating >= ratingRange[0] && state.rating <= ratingRange[1];
      });
    }

    if (allQuestions.length === 0) {
      throw new Error('No questions available with the selected filters');
    }

    // Check if we need to rebuild the question list (selections changed)
    const needsRebuild = this.currentQuestionList.length === 0 ||
                         this.currentQuestionList.length !== allQuestions.length;

    if (needsRebuild) {
      if (mostNeededMode) {
        // Sort by need score (highest first)
        this.currentQuestionList = this.sortByNeed([...allQuestions]);
      } else if (shuffleMode) {
        // Shuffle randomly
        this.currentQuestionList = this.shuffleArray([...allQuestions]);
      } else {
        // Sequential order
        this.currentQuestionList = [...allQuestions];
      }
      this.currentQuestionIndex = 0;
    }

    // Get current question
    const question = this.currentQuestionList[this.currentQuestionIndex];

    // Advance to next question
    this.currentQuestionIndex = (this.currentQuestionIndex + 1) % this.currentQuestionList.length;

    return question;
  }

  private sortByNeed(questions: Question[]): Question[] {
    const states = loadQuestionStates();
    return questions.sort((a, b) => {
      const stateA = states[a.id] || { rating: 0, correctStreak: 0, incorrectCount: 0, lastAnswered: 0 };
      const stateB = states[b.id] || { rating: 0, correctStreak: 0, incorrectCount: 0, lastAnswered: 0 };
      const scoreA = calculateNeedScore(stateA);
      const scoreB = calculateNeedScore(stateB);
      return scoreB - scoreA; // Higher score = more needed = earlier in list
    });
  }

  private shuffleArray<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }

  async submitAnswer(
    _questionId: string,
    _isCorrect: boolean,
    _selectedOption: string,
    _responseTimeMs?: number
  ): Promise<AnswerResponse> {
    // In frontend-only mode, we don't track stats
    // Return dummy response
    return {
      success: true,
      nextReviewIn: 0,
      stats: {
        totalAttempts: 0,
        correctAttempts: 0,
        incorrectAttempts: 0,
        accuracy: 0,
      },
      strength: {
        level: 'N/A',
        color: '#9ca3af',
        easeFactor: 0,
        intervalDays: 0,
        repetitions: 0,
      },
    };
  }

  async getStats(sections?: string[], quizzes?: string[], _timeframeDays?: number, ratingRange?: [number, number]): Promise<Stats> {
    // In frontend-only mode, we don't track individual question stats
    // But we can calculate the total number of questions
    let allQuestions = this.getAllQuestions(sections, quizzes);

    // Filter by rating range if specified
    if (ratingRange) {
      const states = loadQuestionStates();
      allQuestions = allQuestions.filter(q => {
        const state = states[q.id] || { rating: 0, correctStreak: 0, incorrectCount: 0, lastAnswered: 0 };
        return state.rating >= ratingRange[0] && state.rating <= ratingRange[1];
      });
    }

    return {
      totalQuestions: allQuestions.length,
      studiedQuestions: 0,
      unstudiedQuestions: allQuestions.length,
      totalAttempts: 0,
      correctAttempts: 0,
      incorrectAttempts: 0,
      overallAccuracy: 0,
    };
  }

  async getAllQuestionsForStats(sections?: string[], quizzes?: string[]): Promise<Question[]> {
    return this.getAllQuestions(sections, quizzes);
  }
}

// Factory function to create the manager
export function createQuestionManager(): IQuestionManager {
  return new LocalQuestionManager();
}
