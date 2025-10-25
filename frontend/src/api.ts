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

export async function getNextQuestion(): Promise<Question> {
  const response = await fetch(`${API_BASE}/questions/next`);
  if (!response.ok) {
    throw new Error('Failed to fetch question');
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

export async function getStats(): Promise<Stats> {
  const response = await fetch(`${API_BASE}/stats`);
  if (!response.ok) {
    throw new Error('Failed to fetch stats');
  }
  return response.json();
}
