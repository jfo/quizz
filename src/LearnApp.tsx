/**
 * Advanced Learning App - Cutting Edge Learning System
 * Features: SM-2 Spaced Repetition, Confidence-based Learning,
 * Focus Sessions, Analytics Dashboard, Gamification
 */

import { useState, useEffect, useRef } from 'react';
import { Question, QuestionOption, initializeQuestionManager } from './api';
import { LocalQuestionManager } from './questionManager';
import { smartSelector } from './smartQuestionManager';
import {
  recordAnswer,
  getLearningCard,
  loadSessionStats,
  loadDailyGoals,
  getLearningProgress,
  resetSession,
  clearAllLearningData,
  exportLearningData,
  importLearningData,
  setDailyGoalTargets,
} from './learningState';
import { LearningCard } from './learningEngine';

type StudyMode = 'smart' | 'due-only' | 'new-only' | 'weak-areas';
type View = 'study' | 'dashboard' | 'settings';

function LearnApp() {
  // Core state
  const [view, setView] = useState<View>('dashboard');
  const [question, setQuestion] = useState<Question | null>(null);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Answer state
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [shuffledOptions, setShuffledOptions] = useState<QuestionOption[]>([]);
  const [answered, setAnswered] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);

  // Study mode
  const [studyMode, setStudyMode] = useState<StudyMode>('smart');
  const [focusMode, setFocusMode] = useState(false);
  const [sessionTarget, setSessionTarget] = useState(20);
  const [questionsInSession, setQuestionsInSession] = useState(0);

  // Timer
  const [sessionTime, setSessionTime] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Stats
  const [learningProgress, setLearningProgress] = useState<any>(null);
  const [currentCard, setCurrentCard] = useState<LearningCard | null>(null);

  // UI state
  const [showConfetti, setShowConfetti] = useState(false);
  const [showTranslations, setShowTranslations] = useState(false);

  const questionManager = useRef(new LocalQuestionManager());

  // Initialize
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        await questionManager.current.initialize();

        // Load all questions
        const sections = await questionManager.current.getSections();
        const allQs: Question[] = [];

        for (const section of sections) {
          const sectionData = questionManager.current['questionsData'].find(
            (s: any) => s.section === section
          );
          if (sectionData) {
            for (const quiz of sectionData.quizzes) {
              allQs.push(...quiz.questions.map((q: Question) => ({
                ...q,
                section,
                quiz: quiz.title,
              })));
            }
          }
        }

        setAllQuestions(allQs);
        updateProgress();
        setLoading(false);
      } catch (err) {
        console.error('Failed to initialize:', err);
        setError('Failed to load questions');
        setLoading(false);
      }
    };

    init();
  }, []);

  // Timer effect
  useEffect(() => {
    if (focusMode && view === 'study') {
      timerRef.current = window.setInterval(() => {
        setSessionTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [focusMode, view]);

  const updateProgress = () => {
    const progress = getLearningProgress();
    setLearningProgress(progress);
  };

  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const loadNextQuestion = () => {
    if (allQuestions.length === 0) {
      setError('No questions available');
      return;
    }

    const nextQ = smartSelector.getNextQuestion(allQuestions, studyMode);

    if (!nextQ) {
      setError('No more questions available in this mode');
      return;
    }

    setQuestion(nextQ);
    setShuffledOptions(shuffleArray(nextQ.options));
    setSelectedOption(null);
    setAnswered(false);
    setConfidence(null);

    const card = getLearningCard(nextQ.id);
    setCurrentCard(card);
  };

  const startStudySession = () => {
    setView('study');
    setQuestionsInSession(0);
    setSessionTime(0);
    resetSession();
    loadNextQuestion();
  };

  const handleAnswer = (optionIndex: number) => {
    if (answered) {
      // Already answered, advance to next
      if (questionsInSession >= sessionTarget && focusMode) {
        // Session complete!
        setShowConfetti(true);
        setTimeout(() => {
          setShowConfetti(false);
          setView('dashboard');
          updateProgress();
        }, 2000);
      } else {
        loadNextQuestion();
        setQuestionsInSession(prev => prev + 1);
      }
      return;
    }

    setSelectedOption(optionIndex);
    setAnswered(true);
  };

  const handleConfidenceSelect = (confidenceLevel: number) => {
    if (!question || selectedOption === null) return;

    setConfidence(confidenceLevel);

    const wasCorrect = shuffledOptions[selectedOption].correct;

    // Record the answer with the learning engine
    const updatedCard = recordAnswer(question.id, wasCorrect, confidenceLevel);
    setCurrentCard(updatedCard);

    updateProgress();

    // Show encouragement for correct answers
    if (wasCorrect && confidenceLevel >= 2) {
      // Brief celebration for confident correct answers
      const celebration = document.createElement('div');
      celebration.textContent = '🎉';
      celebration.style.position = 'fixed';
      celebration.style.fontSize = '3rem';
      celebration.style.top = '50%';
      celebration.style.left = '50%';
      celebration.style.transform = 'translate(-50%, -50%) scale(0)';
      celebration.style.transition = 'all 0.5s ease-out';
      celebration.style.zIndex = '10000';
      celebration.style.pointerEvents = 'none';
      document.body.appendChild(celebration);

      setTimeout(() => {
        celebration.style.transform = 'translate(-50%, -50%) scale(2)';
        celebration.style.opacity = '0';
      }, 50);

      setTimeout(() => {
        document.body.removeChild(celebration);
      }, 600);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderDashboard = () => {
    if (!learningProgress) return <div>Loading...</div>;

    const { session, goals, totalCards, newCards, learning, review, mastered, dueCards, overallAccuracy } = learningProgress;
    const sessionAccuracy = session.questionsAnswered > 0
      ? (session.correctAnswers / session.questionsAnswered) * 100
      : 0;

    const goalProgress = goals.targetCards > 0 ? (goals.cardsCompleted / goals.targetCards) * 100 : 0;

    return (
      <div style={{
        padding: '2rem',
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: '700',
          marginBottom: '0.5rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          Smart Learning Dashboard
        </h1>
        <p style={{ color: '#6b7280', marginBottom: '2rem', fontSize: '1.1rem' }}>
          Master your knowledge with science-backed spaced repetition
        </p>

        {/* Daily Goals */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '16px',
          padding: '2rem',
          marginBottom: '2rem',
          color: 'white',
          boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontWeight: '600' }}>
                Daily Goal
              </h2>
              <p style={{ opacity: 0.9, fontSize: '0.95rem' }}>
                {goals.cardsCompleted} / {goals.targetCards} cards today
              </p>
            </div>
            <div style={{
              fontSize: '3rem',
              fontWeight: '700',
              opacity: goalProgress >= 100 ? 1 : 0.6,
            }}>
              {goalProgress >= 100 ? '✓' : `${Math.round(goalProgress)}%`}
            </div>
          </div>
          <div style={{
            marginTop: '1rem',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '8px',
            height: '12px',
            overflow: 'hidden',
          }}>
            <div style={{
              background: 'white',
              height: '100%',
              width: `${Math.min(goalProgress, 100)}%`,
              transition: 'width 0.5s ease',
              borderRadius: '8px',
            }}/>
          </div>
          {goals.streak > 0 && (
            <div style={{ marginTop: '1rem', fontSize: '1.1rem', opacity: 0.95 }}>
              🔥 {goals.streak} day streak!
            </div>
          )}
        </div>

        {/* Study Now Section */}
        <div style={{
          background: '#1f2937',
          borderRadius: '16px',
          padding: '2rem',
          marginBottom: '2rem',
          border: '2px solid #374151',
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', fontWeight: '600', color: '#f3f4f6' }}>
            📚 Ready to Study?
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ textAlign: 'center', padding: '1rem', background: '#374151', borderRadius: '12px' }}>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ef4444', marginBottom: '0.25rem' }}>
                {dueCards}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Due Now</div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem', background: '#374151', borderRadius: '12px' }}>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#3b82f6', marginBottom: '0.25rem' }}>
                {newCards}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>New</div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem', background: '#374151', borderRadius: '12px' }}>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#f59e0b', marginBottom: '0.25rem' }}>
                {learning}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Learning</div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem', background: '#374151', borderRadius: '12px' }}>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#10b981', marginBottom: '0.25rem' }}>
                {mastered}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Mastered</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={startStudySession}
              style={{
                flex: 1,
                minWidth: '200px',
                padding: '1.25rem 2rem',
                fontSize: '1.1rem',
                fontWeight: '600',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
              }}
            >
              🚀 Start Learning
            </button>
            <button
              onClick={() => setView('settings')}
              style={{
                padding: '1.25rem 2rem',
                fontSize: '1.1rem',
                fontWeight: '600',
                background: 'transparent',
                color: '#9ca3af',
                border: '2px solid #374151',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#667eea';
                e.currentTarget.style.color = '#f3f4f6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#374151';
                e.currentTarget.style.color = '#9ca3af';
              }}
            >
              ⚙️ Settings
            </button>
          </div>
        </div>

        {/* Statistics */}
        <div style={{
          background: '#1f2937',
          borderRadius: '16px',
          padding: '2rem',
          border: '2px solid #374151',
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', fontWeight: '600', color: '#f3f4f6' }}>
            📊 Your Progress
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                Total Cards
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#f3f4f6' }}>
                {totalCards}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                Overall Accuracy
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: overallAccuracy >= 70 ? '#10b981' : '#f59e0b' }}>
                {overallAccuracy.toFixed(1)}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                Session Accuracy
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: sessionAccuracy >= 70 ? '#10b981' : '#f59e0b' }}>
                {sessionAccuracy.toFixed(1)}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                Questions Today
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#f3f4f6' }}>
                {session.questionsAnswered}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStudyView = () => {
    if (loading) {
      return <div style={{ textAlign: 'center', padding: '4rem', fontSize: '1.2rem', color: '#9ca3af' }}>
        Loading questions...
      </div>;
    }

    if (error || !question) {
      return <div style={{ textAlign: 'center', padding: '4rem', fontSize: '1.2rem', color: '#ef4444' }}>
        {error || 'No question available'}
      </div>;
    }

    const correctIndex = shuffledOptions.findIndex(opt => opt.correct);
    const wasCorrect = selectedOption !== null && shuffledOptions[selectedOption].correct;

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '2rem',
        maxWidth: '900px',
        margin: '0 auto',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <button
            onClick={() => {
              setView('dashboard');
              updateProgress();
            }}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#374151',
              color: '#f3f4f6',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '500',
            }}
          >
            ← Back to Dashboard
          </button>

          {focusMode && (
            <div style={{
              display: 'flex',
              gap: '1.5rem',
              alignItems: 'center',
              fontSize: '1rem',
              color: '#f3f4f6',
            }}>
              <div>⏱️ {formatTime(sessionTime)}</div>
              <div>📝 {questionsInSession}/{sessionTarget}</div>
            </div>
          )}

          {question && (question.questionEn || question.options.some(opt => opt.textEn)) && (
            <button
              onMouseDown={() => setShowTranslations(true)}
              onMouseUp={() => setShowTranslations(false)}
              onMouseLeave={() => setShowTranslations(false)}
              onTouchStart={() => setShowTranslations(true)}
              onTouchEnd={() => setShowTranslations(false)}
              style={{
                padding: '0.75rem 1.5rem',
                background: showTranslations ? '#667eea' : '#374151',
                color: '#f3f4f6',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                transition: 'all 0.2s',
              }}
              title="Hold to see translations"
            >
              {showTranslations ? '👁️ Showing' : '👁️‍🗨️ Translate'}
            </button>
          )}
        </div>

        {/* Progress bar for focus mode */}
        {focusMode && (
          <div style={{
            background: '#374151',
            borderRadius: '8px',
            height: '8px',
            marginBottom: '2rem',
            overflow: 'hidden',
          }}>
            <div style={{
              background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
              height: '100%',
              width: `${(questionsInSession / sessionTarget) * 100}%`,
              transition: 'width 0.3s ease',
            }}/>
          </div>
        )}

        {/* Question Card */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}>
          <div style={{
            background: '#1f2937',
            borderRadius: '20px',
            padding: '3rem',
            border: '2px solid #374151',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          }}>
            {currentCard && (
              <div style={{
                display: 'flex',
                gap: '1rem',
                marginBottom: '1.5rem',
                fontSize: '0.875rem',
                color: '#9ca3af',
                flexWrap: 'wrap',
              }}>
                <span style={{
                  background: currentCard.stage === 'new' ? '#3b82f6' :
                             currentCard.stage === 'learning' ? '#f59e0b' :
                             currentCard.stage === 'review' ? '#8b5cf6' : '#10b981',
                  color: 'white',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                }}>
                  {currentCard.stage}
                </span>
                {currentCard.totalReviews > 0 && (
                  <span>
                    Accuracy: {((currentCard.correctReviews / currentCard.totalReviews) * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            )}

            <div style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: '#f3f4f6',
              marginBottom: '2rem',
              lineHeight: '1.6',
            }}>
              {showTranslations && question.questionEn ? question.questionEn : question.question}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {shuffledOptions.map((option, index) => {
                let bgColor = '#374151';
                let borderColor = '#4b5563';
                let textColor = '#f3f4f6';

                if (answered) {
                  if (index === correctIndex) {
                    bgColor = '#065f46';
                    borderColor = '#10b981';
                  } else if (index === selectedOption) {
                    bgColor = '#7f1d1d';
                    borderColor = '#ef4444';
                  }
                }

                return (
                  <button
                    key={index}
                    onClick={() => handleAnswer(index)}
                    disabled={answered && index !== correctIndex && index !== selectedOption}
                    style={{
                      padding: '1.5rem',
                      background: bgColor,
                      border: `2px solid ${borderColor}`,
                      borderRadius: '12px',
                      color: textColor,
                      fontSize: '1.1rem',
                      cursor: (answered && index !== correctIndex) ? 'default' : 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'left',
                      fontWeight: '500',
                      opacity: (answered && index !== correctIndex && index !== selectedOption) ? 0.4 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!answered || index === correctIndex) {
                        e.currentTarget.style.transform = 'translateX(4px)';
                        if (!answered) e.currentTarget.style.borderColor = '#667eea';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateX(0)';
                      if (!answered) e.currentTarget.style.borderColor = '#4b5563';
                    }}
                  >
                    {showTranslations && option.textEn ? option.textEn : option.text}
                  </button>
                );
              })}
            </div>

            {/* Confidence Selection */}
            {answered && confidence === null && (
              <div style={{
                marginTop: '2rem',
                padding: '2rem',
                background: wasCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                borderRadius: '12px',
                border: `2px solid ${wasCorrect ? '#10b981' : '#ef4444'}`,
              }}>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: '#f3f4f6',
                  marginBottom: '1rem',
                  textAlign: 'center',
                }}>
                  {wasCorrect ? '✅ Correct!' : '❌ Incorrect'} How confident were you?
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: '1rem',
                  marginTop: '1.5rem',
                }}>
                  {[
                    { level: 0, label: 'Guessed', emoji: '🎲', color: '#ef4444' },
                    { level: 1, label: 'Uncertain', emoji: '🤔', color: '#f59e0b' },
                    { level: 2, label: 'Confident', emoji: '😊', color: '#3b82f6' },
                    { level: 3, label: 'Mastered', emoji: '🎯', color: '#10b981' },
                  ].map(({ level, label, emoji, color }) => (
                    <button
                      key={level}
                      onClick={() => handleConfidenceSelect(level)}
                      style={{
                        padding: '1.25rem 1rem',
                        background: '#374151',
                        border: `2px solid ${color}`,
                        borderRadius: '12px',
                        color: '#f3f4f6',
                        fontSize: '1rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontWeight: '600',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = color;
                        e.currentTarget.style.transform = 'scale(1.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#374151';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <div style={{ fontSize: '2rem' }}>{emoji}</div>
                      <div>{label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Next button after confidence selection */}
            {answered && confidence !== null && (
              <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                <button
                  onClick={() => handleAnswer(correctIndex)}
                  style={{
                    padding: '1.25rem 3rem',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '1.2rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  Next Question →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Confetti effect */}
        {showConfetti && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.8)',
            zIndex: 10000,
            fontSize: '4rem',
          }}>
            🎉 Session Complete! 🎉
          </div>
        )}
      </div>
    );
  };

  const renderSettings = () => {
    return (
      <div style={{
        padding: '2rem',
        maxWidth: '800px',
        margin: '0 auto',
      }}>
        <button
          onClick={() => setView('dashboard')}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#374151',
            color: '#f3f4f6',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '500',
            marginBottom: '2rem',
          }}
        >
          ← Back
        </button>

        <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#f3f4f6', marginBottom: '2rem' }}>
          Settings
        </h1>

        <div style={{
          background: '#1f2937',
          borderRadius: '16px',
          padding: '2rem',
          border: '2px solid #374151',
          marginBottom: '1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#f3f4f6', marginBottom: '1.5rem' }}>
            Study Mode
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { value: 'smart' as StudyMode, label: '🧠 Smart Mode', desc: 'AI-optimized question selection' },
              { value: 'due-only' as StudyMode, label: '⏰ Due Cards Only', desc: 'Review cards that are due now' },
              { value: 'new-only' as StudyMode, label: '🆕 New Cards Only', desc: 'Learn new material' },
              { value: 'weak-areas' as StudyMode, label: '💪 Weak Areas', desc: 'Focus on challenging cards' },
            ].map(({ value, label, desc }) => (
              <label
                key={value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem',
                  background: studyMode === value ? '#374151' : 'transparent',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                <input
                  type="radio"
                  name="studyMode"
                  checked={studyMode === value}
                  onChange={() => setStudyMode(value)}
                  style={{ accentColor: '#667eea' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: '#f3f4f6', marginBottom: '0.25rem' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                    {desc}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div style={{
          background: '#1f2937',
          borderRadius: '16px',
          padding: '2rem',
          border: '2px solid #374151',
          marginBottom: '1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#f3f4f6', marginBottom: '1.5rem' }}>
            Focus Mode
          </h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={focusMode}
              onChange={(e) => setFocusMode(e.target.checked)}
              style={{ accentColor: '#667eea', width: '20px', height: '20px' }}
            />
            <div>
              <div style={{ fontWeight: '600', color: '#f3f4f6' }}>
                Enable Focus Mode
              </div>
              <div style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                Set a target and track your session progress
              </div>
            </div>
          </label>

          {focusMode && (
            <div style={{ marginTop: '1.5rem' }}>
              <label style={{ display: 'block', color: '#9ca3af', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Session Target (cards)
              </label>
              <input
                type="number"
                value={sessionTarget}
                onChange={(e) => setSessionTarget(parseInt(e.target.value) || 20)}
                min="5"
                max="100"
                style={{
                  padding: '0.75rem',
                  background: '#374151',
                  border: '2px solid #4b5563',
                  borderRadius: '8px',
                  color: '#f3f4f6',
                  fontSize: '1rem',
                  width: '100%',
                }}
              />
            </div>
          )}
        </div>

        <div style={{
          background: '#1f2937',
          borderRadius: '16px',
          padding: '2rem',
          border: '2px solid #374151',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#f3f4f6', marginBottom: '1.5rem' }}>
            Data Management
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button
              onClick={() => {
                const data = exportLearningData();
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `learning-progress-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              style={{
                padding: '1rem',
                background: '#374151',
                color: '#f3f4f6',
                border: '2px solid #4b5563',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '500',
              }}
            >
              📥 Export Progress
            </button>
            <button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'application/json';
                input.onchange = async (e: any) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const text = await file.text();
                    if (importLearningData(text)) {
                      alert('Progress imported successfully!');
                      updateProgress();
                    } else {
                      alert('Failed to import. Invalid file format.');
                    }
                  }
                };
                input.click();
              }}
              style={{
                padding: '1rem',
                background: '#374151',
                color: '#f3f4f6',
                border: '2px solid #4b5563',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '500',
              }}
            >
              📤 Import Progress
            </button>
            <button
              onClick={() => {
                if (window.confirm('Are you sure? This will delete ALL your progress!')) {
                  clearAllLearningData();
                  updateProgress();
                  alert('All data cleared!');
                }
              }}
              style={{
                padding: '1rem',
                background: 'transparent',
                color: '#ef4444',
                border: '2px solid #7f1d1d',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '500',
              }}
            >
              🗑️ Reset All Data
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#111827',
      color: '#f3f4f6',
    }}>
      {view === 'dashboard' && renderDashboard()}
      {view === 'study' && renderStudyView()}
      {view === 'settings' && renderSettings()}
    </div>
  );
}

export default LearnApp;
