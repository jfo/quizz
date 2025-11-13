import { createQuestionManager, IQuestionManager } from './questionManager';

export interface QuestionOption {
  text: string;
  correct: boolean;
  textEn?: string;
}

export interface Question {
  id: string;
  question: string;
  questionEn?: string;
  metadata?: string;
  section?: string;
  quiz?: string;
  options: QuestionOption[];
}

export interface AnswerResponse {
  success: boolean;
  nextReviewIn: number;
  stats: {
    totalAttempts: number;
    correctAttempts: number;
    incorrectAttempts: number;
    accuracy: number;
  };
  strength: {
    level: string;
    color: string;
    easeFactor: number;
    intervalDays: number;
    repetitions: number;
  };
}

export interface Stats {
  totalQuestions: number;
  studiedQuestions: number;
  unstudiedQuestions: number;
  totalAttempts: number;
  correctAttempts: number;
  incorrectAttempts: number;
  overallAccuracy: number;
}

export interface QuizInfo {
  title: string;
  url: string;
  questionCount: number;
}

export interface QuizzesBySection {
  section: string;
  quizzes: QuizInfo[];
}

// Global question manager instance
let questionManager: IQuestionManager | null = null;

// Initialize the question manager
export async function initializeQuestionManager(): Promise<void> {
  if (!questionManager) {
    questionManager = createQuestionManager();
    await questionManager.initialize();
  }
}

// Get current question manager (for internal use)
function getManager(): IQuestionManager {
  if (!questionManager) {
    throw new Error('Question manager not initialized. Call initializeQuestionManager first.');
  }
  return questionManager;
}

// API functions that delegate to the question manager
export async function getNextQuestion(sections?: string[], quizzes?: string[], shuffleMode?: boolean, mostNeededMode?: boolean): Promise<Question> {
  return getManager().getNextQuestion(sections, quizzes, shuffleMode, mostNeededMode);
}

export async function getSections(): Promise<string[]> {
  return getManager().getSections();
}

export async function getQuizzes(): Promise<QuizzesBySection[]> {
  return getManager().getQuizzes();
}

export async function submitAnswer(
  questionId: string,
  isCorrect: boolean,
  selectedOption: string,
  responseTimeMs?: number
): Promise<AnswerResponse> {
  return getManager().submitAnswer(questionId, isCorrect, selectedOption, responseTimeMs);
}

export async function getStats(sections?: string[], quizzes?: string[], timeframeDays?: number): Promise<Stats> {
  return getManager().getStats(sections, quizzes, timeframeDays);
}
