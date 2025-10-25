const API_BASE = '/api';

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

export async function getNextQuestion(sections?: string[], quizzes?: string[], shuffleMode?: boolean, onlyDue?: boolean): Promise<Question> {
  const response = await fetch(`${API_BASE}/questions/next`, {
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

export async function getSections(): Promise<string[]> {
  const response = await fetch(`${API_BASE}/sections`);
  if (!response.ok) {
    throw new Error('Failed to fetch sections');
  }
  return response.json();
}

export async function getQuizzes(): Promise<QuizzesBySection[]> {
  const response = await fetch(`${API_BASE}/quizzes`);
  if (!response.ok) {
    throw new Error('Failed to fetch quizzes');
  }
  return response.json();
}

export async function submitAnswer(
  questionId: string,
  isCorrect: boolean,
  selectedOption: string,
  responseTimeMs?: number
): Promise<AnswerResponse> {
  const response = await fetch(`${API_BASE}/answers`, {
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

export async function getStats(sections?: string[], quizzes?: string[], timeframeDays?: number): Promise<Stats> {
  const response = await fetch(`${API_BASE}/stats`, {
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
