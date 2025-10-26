import { Question, Stats, QuizzesBySection, AnswerResponse } from './api';

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
  getNextQuestion(sections?: string[], quizzes?: string[], shuffleMode?: boolean, onlyDue?: boolean): Promise<Question>;
  submitAnswer(questionId: string, isCorrect: boolean, selectedOption: string, responseTimeMs?: number): Promise<AnswerResponse>;
  getStats(sections?: string[], quizzes?: string[], timeframeDays?: number): Promise<Stats>;
  initialize(): Promise<void>;
}

// Backend implementation (uses API)
export class BackendQuestionManager implements IQuestionManager {
  private readonly API_BASE = '/api';

  async initialize(): Promise<void> {
    // No initialization needed for backend mode
  }

  async getSections(): Promise<string[]> {
    const response = await fetch(`${this.API_BASE}/sections`);
    if (!response.ok) {
      throw new Error('Failed to fetch sections');
    }
    return response.json();
  }

  async getQuizzes(): Promise<QuizzesBySection[]> {
    const response = await fetch(`${this.API_BASE}/quizzes`);
    if (!response.ok) {
      throw new Error('Failed to fetch quizzes');
    }
    return response.json();
  }

  async getNextQuestion(sections?: string[], quizzes?: string[], shuffleMode?: boolean, onlyDue?: boolean): Promise<Question> {
    const response = await fetch(`${this.API_BASE}/questions/next`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sections: sections && sections.length > 0 ? sections : undefined,
        quizzes: quizzes && quizzes.length > 0 ? quizzes : undefined,
        shuffleMode: shuffleMode || false,
        onlyDue: onlyDue || false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error: any = new Error(errorData.message || 'Failed to fetch question');
      error.isNoDue = errorData.error === 'No questions due';
      throw error;
    }
    return response.json();
  }

  async submitAnswer(
    questionId: string,
    isCorrect: boolean,
    selectedOption: string,
    responseTimeMs?: number
  ): Promise<AnswerResponse> {
    const response = await fetch(`${this.API_BASE}/answers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        questionId,
        isCorrect,
        selectedOption,
        responseTimeMs,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to submit answer');
    }

    return response.json();
  }

  async getStats(sections?: string[], quizzes?: string[], timeframeDays?: number): Promise<Stats> {
    const response = await fetch(`${this.API_BASE}/stats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sections: sections && sections.length > 0 ? sections : undefined,
        quizzes: quizzes && quizzes.length > 0 ? quizzes : undefined,
        timeframeDays: timeframeDays !== undefined ? timeframeDays : 7,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch stats');
    }
    return response.json();
  }
}

// Frontend implementation (loads questions locally, no stats)
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

  async getNextQuestion(sections?: string[], quizzes?: string[], shuffleMode?: boolean, _onlyDue?: boolean): Promise<Question> {
    const allQuestions = this.getAllQuestions(sections, quizzes);

    if (allQuestions.length === 0) {
      throw new Error('No questions available');
    }

    // Check if we need to rebuild the question list (selections changed)
    const needsRebuild = this.currentQuestionList.length === 0 ||
                         this.currentQuestionList.length !== allQuestions.length;

    if (needsRebuild) {
      this.currentQuestionList = shuffleMode ?
        this.shuffleArray([...allQuestions]) :
        [...allQuestions];
      this.currentQuestionIndex = 0;
    }

    // Get current question
    const question = this.currentQuestionList[this.currentQuestionIndex];

    // Advance to next question
    this.currentQuestionIndex = (this.currentQuestionIndex + 1) % this.currentQuestionList.length;

    return question;
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

  async getStats(sections?: string[], quizzes?: string[], _timeframeDays?: number): Promise<Stats> {
    // In frontend-only mode, we don't track individual question stats
    // But we can calculate the total number of questions
    const allQuestions = this.getAllQuestions(sections, quizzes);

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
}

// Factory function to create the appropriate manager
export function createQuestionManager(useBackend: boolean): IQuestionManager {
  return useBackend ? new BackendQuestionManager() : new LocalQuestionManager();
}
