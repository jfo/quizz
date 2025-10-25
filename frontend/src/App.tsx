import { useState, useEffect } from 'react'
import { Question, Stats, getNextQuestion, submitAnswer, getStats } from './api'

function App() {
  const [question, setQuestion] = useState<Question | null>(null)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [startTime, setStartTime] = useState<number>(Date.now())
  const [showTranslations, setShowTranslations] = useState(false)

  const loadQuestion = async () => {
    try {
      setLoading(true)
      setError(null)
      const nextQuestion = await getNextQuestion()
      setQuestion(nextQuestion)
      setSelectedOption(null)
      setAnswered(false)
      setStartTime(Date.now())
      setShowTranslations(false)
    } catch (err) {
      setError('Failed to load question. Make sure the backend is running.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const currentStats = await getStats()
      setStats(currentStats)
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
  }

  useEffect(() => {
    loadQuestion()
    loadStats()
  }, [])

  const handleOptionClick = async (index: number) => {
    if (!question) return

    // If already answered, clicking the correct answer advances to next question
    if (answered) {
      if (question.options[index].correct) {
        loadQuestion()
      }
      return
    }

    // First time answering
    setSelectedOption(index)
    setAnswered(true)

    const isCorrect = question.options[index].correct
    const responseTimeMs = Date.now() - startTime

    try {
      await submitAnswer(
        question.id,
        isCorrect,
        question.options[index].text,
        responseTimeMs
      )
      await loadStats()
    } catch (err) {
      console.error('Failed to submit answer:', err)
    }
  }

  if (loading) {
    return (
      <div className="app">
        <div className="header">
          <h1>Quizz</h1>
          <p>Spaced Repetition Quiz</p>
        </div>
        <div className="loading">Loading question...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app">
        <div className="header">
          <h1>Quizz</h1>
          <p>Spaced Repetition Quiz</p>
        </div>
        <div className="error">{error}</div>
      </div>
    )
  }

  if (!question) {
    return (
      <div className="app">
        <div className="header">
          <h1>Quizz</h1>
          <p>Spaced Repetition Quiz</p>
        </div>
        <div className="loading">No question available</div>
      </div>
    )
  }

  const correctOptionIndex = question.options.findIndex(opt => opt.correct)

  return (
    <div className="app">
      <div className="header">
        <h1>Quizz</h1>
        <p>Spaced Repetition Quiz</p>
      </div>

      {stats && (
        <div className="stats-bar">
          <div className="stat">
            <div className="stat-value">{stats.studiedQuestions}/{stats.totalQuestions}</div>
            <div className="stat-label">Studied</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.totalAttempts}</div>
            <div className="stat-label">Total Attempts</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.overallAccuracy.toFixed(1)}%</div>
            <div className="stat-label">Accuracy</div>
          </div>
        </div>
      )}

      <div className="content">
        <div className="question-card">
          {question.metadata && (
            <div className="question-meta">{question.metadata}</div>
          )}

          {(question.questionEn || question.options.some(opt => opt.textEn)) && (
            <button
              className="peek-icon peek-icon-global"
              onMouseDown={() => setShowTranslations(true)}
              onMouseUp={() => setShowTranslations(false)}
              onMouseLeave={() => setShowTranslations(false)}
              onTouchStart={() => setShowTranslations(true)}
              onTouchEnd={() => setShowTranslations(false)}
              title="Hold to see translations"
            >
              {showTranslations ? '👁️' : '👁️‍🗨️'}
            </button>
          )}

          <div className="question-section">
            <div className="question-text">
              {showTranslations && question.questionEn ? question.questionEn : question.question}
            </div>
          </div>

          <div className="options">
            {question.options.map((option, index) => {
              let className = 'option-button'

              if (answered) {
                if (index === correctOptionIndex) {
                  className += ' correct'
                } else if (index === selectedOption) {
                  className += ' incorrect'
                }
              }

              const isCorrect = option.correct
              const canAdvance = answered && isCorrect

              return (
                <button
                  key={index}
                  className={className}
                  onClick={() => handleOptionClick(index)}
                  style={canAdvance ? { cursor: 'pointer' } : undefined}
                >
                  {showTranslations && option.textEn ? option.textEn : option.text}
                  {canAdvance && <span className="next-hint"> → Click to continue</span>}
                </button>
              )
            })}
          </div>

          {answered && (
            <div className={`feedback ${selectedOption === correctOptionIndex ? 'correct' : 'incorrect'}`}>
              {selectedOption === correctOptionIndex ? (
                <strong>Correct! Click the answer again to continue.</strong>
              ) : (
                <strong>Incorrect. Click the correct answer to continue.</strong>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
