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

export interface Quiz {
  url: string;
  title: string;
  questionCount: number;
  questions: Question[];
}

export interface Section {
  section: string;
  sectionUrl: string;
  quizCount: number;
  quizzes: Quiz[];
}

export interface QuestionStats {
  question_id: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review: Date;
  last_reviewed: Date | null;
  total_attempts: number;
  correct_attempts: number;
  incorrect_attempts: number;
}

export interface AnswerSubmission {
  questionId: string;
  isCorrect: boolean;
  selectedOption: string;
  responseTimeMs?: number;
}
