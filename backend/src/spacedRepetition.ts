/**
 * SM-2 Spaced Repetition Algorithm
 * Based on SuperMemo 2 algorithm
 */

export interface SM2Result {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

/**
 * Calculate next review parameters based on answer quality
 * @param quality - Quality of answer (0-5): 0=complete fail, 5=perfect
 * @param currentEaseFactor - Current ease factor (default 2.5)
 * @param currentInterval - Current interval in days (default 1)
 * @param currentRepetitions - Current repetition count (default 0)
 * @returns New SM-2 parameters
 */
export function calculateSM2(
  quality: number,
  currentEaseFactor: number = 2.5,
  currentInterval: number = 1,
  currentRepetitions: number = 0
): SM2Result {
  // Ensure quality is between 0 and 5
  quality = Math.max(0, Math.min(5, quality));

  // Calculate new ease factor
  let newEaseFactor = currentEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  // Minimum ease factor is 1.3
  newEaseFactor = Math.max(1.3, newEaseFactor);

  let newRepetitions: number;
  let newInterval: number;

  if (quality < 3) {
    // Answer was incorrect - reset repetitions
    newRepetitions = 0;
    newInterval = 1;
  } else {
    // Answer was correct
    newRepetitions = currentRepetitions + 1;

    if (newRepetitions === 1) {
      newInterval = 1;
    } else if (newRepetitions === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.round(currentInterval * newEaseFactor);
    }
  }

  return {
    easeFactor: newEaseFactor,
    intervalDays: newInterval,
    repetitions: newRepetitions,
  };
}

/**
 * Convert boolean correctness to quality score
 * @param isCorrect - Whether the answer was correct
 * @returns Quality score (3 for correct, 0 for incorrect)
 */
export function correctnessToQuality(isCorrect: boolean): number {
  return isCorrect ? 4 : 0;
}
