import { useState, useEffect } from 'react'
import { Question, QuestionOption, Stats, QuizzesBySection, getNextQuestion, submitAnswer, getStats, getSections, getQuizzes, initializeQuestionManager, setBackendMode } from './api'

function App() {
  const [question, setQuestion] = useState<Question | null>(null)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [startTime, setStartTime] = useState<number>(Date.now())
  const [showTranslations, setShowTranslations] = useState(false)
  const [selectedSections, setSelectedSections] = useState<string[]>([])
  const [availableSections, setAvailableSections] = useState<string[]>([])
  const [selectedQuizzes, setSelectedQuizzes] = useState<string[]>([])
  const [quizzesBySection, setQuizzesBySection] = useState<QuizzesBySection[]>([])
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [shuffledOptions, setShuffledOptions] = useState<QuestionOption[]>([])
  const [shuffleMode, setShuffleMode] = useState(false)
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 })
  const [questionStrength, setQuestionStrength] = useState<{ level: string; color: string; intervalDays: number } | null>(null)
  const [timeframeDays, setTimeframeDays] = useState(7)
  const [onlyDueMode, setOnlyDueMode] = useState(true)
  const [exploratoryMode, setExploratoryMode] = useState(false)
  const [useBackendStats, setUseBackendStats] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [showChapters, setShowChapters] = useState(true)
  const [showOtherTopics, setShowOtherTopics] = useState(false)

  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array]
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]]
    }
    return newArray
  }

  const loadQuestion = async () => {
    try {
      setLoading(true)
      setError(null)

      if (selectedQuizzes.length === 0) {
        setQuestion(null)
        setLoading(false)
        return
      }

      const sections = selectedSections.length > 0 ? selectedSections : undefined
      const quizzes = selectedQuizzes.length > 0 ? selectedQuizzes : undefined
      const nextQuestion = await getNextQuestion(sections, quizzes, shuffleMode, onlyDueMode)
      setQuestion(nextQuestion)
      setShuffledOptions(shuffleArray(nextQuestion.options))
      setSelectedOption(null)
      setAnswered(false)
      setStartTime(Date.now())
      setShowTranslations(false)
      setQuestionStrength(null)
    } catch (err: any) {
      if (err.isNoDue) {
        setError(err.message)
        setQuestion(null)
      } else {
        setError('Failed to load question. Make sure the backend is running.')
        console.error(err)
      }
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      if (selectedQuizzes.length === 0) {
        setStats(null)
        return
      }

      const sections = selectedSections.length > 0 ? selectedSections : undefined
      const quizzes = selectedQuizzes.length > 0 ? selectedQuizzes : undefined
      const currentStats = await getStats(sections, quizzes, timeframeDays)
      setStats(currentStats)
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
  }

  const loadSections = async () => {
    try {
      // Fetch sections and quizzes in parallel
      const [sections, quizzesData] = await Promise.all([
        getSections(),
        getQuizzes()
      ])

      setAvailableSections(sections)
      setQuizzesBySection(quizzesData)

      // Try to load from localStorage
      const savedSections = localStorage.getItem('selectedSections')
      const savedQuizzes = localStorage.getItem('selectedQuizzes')
      const savedShuffleMode = localStorage.getItem('shuffleMode')

      if (savedSections) {
        try {
          const parsed = JSON.parse(savedSections)
          setSelectedSections(parsed)
        } catch {
          setSelectedSections(sections)
        }
      } else {
        setSelectedSections(sections)
      }

      if (savedQuizzes) {
        try {
          const parsed = JSON.parse(savedQuizzes)
          setSelectedQuizzes(parsed)
        } catch {
          // Select all quizzes by default
          const allQuizUrls = quizzesData.flatMap(s => s.quizzes.map(q => q.url))
          setSelectedQuizzes(allQuizUrls)
        }
      } else {
        // Select all quizzes by default
        const allQuizUrls = quizzesData.flatMap(s => s.quizzes.map(q => q.url))
        setSelectedQuizzes(allQuizUrls)
      }

      if (savedShuffleMode) {
        setShuffleMode(savedShuffleMode === 'true')
      }

      const savedOnlyDueMode = localStorage.getItem('onlyDueMode')
      if (savedOnlyDueMode !== null) {
        setOnlyDueMode(savedOnlyDueMode === 'true')
      }

      const savedExploratoryMode = localStorage.getItem('exploratoryMode')
      if (savedExploratoryMode !== null) {
        setExploratoryMode(savedExploratoryMode === 'true')
      }
    } catch (err) {
      console.error('Failed to load sections:', err)
    }
  }

  // Initialize question manager on startup
  useEffect(() => {
    const initialize = async () => {
      try {
        setIsInitializing(true)

        // Always default to frontend-only mode (no backend)
        const shouldUseBackend = false
        setUseBackendStats(shouldUseBackend)

        // Initialize the question manager
        await initializeQuestionManager(shouldUseBackend)

        // Load sections and quizzes
        await loadSections()

        setIsInitializing(false)
      } catch (err) {
        console.error('Failed to initialize:', err)
        setError('Failed to initialize. Please refresh the page.')
        setIsInitializing(false)
      }
    }

    initialize()
  }, [])

  // Load question and stats when selections or shuffle mode change
  useEffect(() => {
    if (availableSections.length > 0 && !isInitializing) {
      // Load question and stats in parallel
      const loadPromises = [loadQuestion(), loadStats()]
      Promise.all(loadPromises).catch(err => {
        console.error('Failed to load data:', err)
      })
    }
  }, [selectedSections, selectedQuizzes, shuffleMode, timeframeDays, onlyDueMode, exploratoryMode, isInitializing])

  const handleOptionClick = async (index: number) => {
    if (!question) return

    // If already answered, clicking the correct answer advances to next question
    if (answered) {
      if (shuffledOptions[index].correct) {
        loadQuestion()
      }
      return
    }

    // First time answering
    setSelectedOption(index)
    setAnswered(true)

    const isCorrect = shuffledOptions[index].correct
    const responseTimeMs = Date.now() - startTime

    // Update session stats
    setSessionStats(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }))

    // Only track answers if using backend and not in exploratory mode
    if (useBackendStats && !exploratoryMode) {
      try {
        const response = await submitAnswer(
          question.id,
          isCorrect,
          shuffledOptions[index].text,
          responseTimeMs
        )
        setQuestionStrength(response.strength)
        await loadStats()
      } catch (err) {
        console.error('Failed to submit answer:', err)
      }
    }
  }

  const toggleSection = (section: string) => {
    const sectionData = quizzesBySection.find(s => s.section === section)
    if (!sectionData) return

    const sectionQuizUrls = sectionData.quizzes.map(q => q.url)
    const allSelected = sectionQuizUrls.every(url => selectedQuizzes.includes(url))

    if (allSelected) {
      // Deselect all quizzes in this section
      const newQuizzes = selectedQuizzes.filter(url => !sectionQuizUrls.includes(url))
      setSelectedQuizzes(newQuizzes)
      localStorage.setItem('selectedQuizzes', JSON.stringify(newQuizzes))
    } else {
      // Select all quizzes in this section
      const newQuizzes = [...new Set([...selectedQuizzes, ...sectionQuizUrls])]
      setSelectedQuizzes(newQuizzes)
      localStorage.setItem('selectedQuizzes', JSON.stringify(newQuizzes))
    }
  }

  const toggleQuiz = (quizUrl: string) => {
    setSelectedQuizzes(prev => {
      const newQuizzes = prev.includes(quizUrl)
        ? prev.filter(url => url !== quizUrl)
        : [...prev, quizUrl]
      localStorage.setItem('selectedQuizzes', JSON.stringify(newQuizzes))
      return newQuizzes
    })
  }

  const toggleSectionExpanded = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(section)) {
        newSet.delete(section)
      } else {
        newSet.add(section)
      }
      return newSet
    })
  }

  const selectAllQuizzes = () => {
    const allQuizUrls = quizzesBySection.flatMap(s => s.quizzes.map(q => q.url))
    setSelectedQuizzes(allQuizUrls)
    localStorage.setItem('selectedQuizzes', JSON.stringify(allQuizUrls))
  }

  const deselectAllQuizzes = () => {
    setSelectedQuizzes([])
    localStorage.setItem('selectedQuizzes', JSON.stringify([]))
  }

  const toggleShuffleMode = () => {
    setShuffleMode(prev => {
      const newValue = !prev
      localStorage.setItem('shuffleMode', String(newValue))
      return newValue
    })
  }

  const toggleOnlyDueMode = () => {
    setOnlyDueMode(prev => {
      const newValue = !prev
      localStorage.setItem('onlyDueMode', String(newValue))
      return newValue
    })
  }

  const toggleExploratoryMode = () => {
    setExploratoryMode(prev => {
      const newValue = !prev
      localStorage.setItem('exploratoryMode', String(newValue))
      return newValue
    })
  }

  const toggleBackendStats = async () => {
    try {
      const newValue = !useBackendStats

      // Reinitialize with new mode
      setLoading(true)
      await setBackendMode(newValue)

      // Update state after reinitialization
      setUseBackendStats(newValue)

      // If switching to frontend-only, clear exploratory mode
      if (!newValue) {
        setExploratoryMode(false)
        localStorage.setItem('exploratoryMode', 'false')
      }

      // Reload sections/quizzes and first question
      await loadSections()
      setLoading(false)
    } catch (err) {
      console.error('Failed to switch mode:', err)
      setError('Failed to switch mode. Please refresh the page.')
      setLoading(false)
    }
  }

  const renderSettingsPanel = () => (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>Question Selection</h2>
      </div>
      <div className="settings-content">
        {useBackendStats && (
          <div className="settings-section">
            <div className="settings-section-header">
              <h3>Study Mode</h3>
            </div>
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={exploratoryMode}
                onChange={toggleExploratoryMode}
              />
              <span>Exploratory mode (answers not tracked)</span>
            </label>
            {exploratoryMode && (
              <div style={{ fontSize: '0.8125rem', color: '#f59e0b', marginTop: '8px', paddingLeft: '38px' }}>
                Practice mode - your progress won't be saved
              </div>
            )}
          </div>
        )}

        {useBackendStats && (
          <div className="settings-section">
            <div className="settings-section-header">
              <h3>Question Order</h3>
            </div>
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={shuffleMode}
                onChange={toggleShuffleMode}
                disabled={!exploratoryMode && onlyDueMode}
              />
              <span>Shuffle questions (random order)</span>
            </label>
            {!shuffleMode && !exploratoryMode && (
              <>
                <label className="checkbox-item" style={{ marginTop: '8px' }}>
                  <input
                    type="checkbox"
                    checked={onlyDueMode}
                    onChange={toggleOnlyDueMode}
                  />
                  <span>Only show questions due for review today</span>
                </label>
                <div style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '8px', paddingLeft: '38px' }}>
                  Using spaced repetition algorithm
                </div>
              </>
            )}
          </div>
        )}

        <div className="settings-section">
          <div className="settings-section-header">
            <h3>Quizzes ({selectedQuizzes.length}/{quizzesBySection.flatMap(s => s.quizzes).length})</h3>
            <div className="settings-actions">
              <button onClick={selectAllQuizzes} className="text-button">All</button>
              <button onClick={deselectAllQuizzes} className="text-button">None</button>
            </div>
          </div>
          <div className="quiz-tree">
            {/* Group 1: Chapters */}
            <div style={{ marginBottom: '16px' }}>
              <button
                onClick={() => setShowChapters(!showChapters)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '8px',
                  paddingLeft: '0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  width: '100%',
                  textAlign: 'left'
                }}
              >
                <span style={{ fontSize: '0.65rem' }}>{showChapters ? '▼' : '▶'}</span>
                <span>Book Chapters</span>
              </button>
              {showChapters && quizzesBySection
                .filter(sectionData => sectionData.section.toLowerCase().includes('kapitel'))
                .sort((a, b) => a.section.localeCompare(b.section, 'da'))
                .map(sectionData => {
                  const sectionQuizUrls = sectionData.quizzes.map(q => q.url)
                  const selectedCount = sectionQuizUrls.filter(url => selectedQuizzes.includes(url)).length
                  const totalCount = sectionQuizUrls.length
                  const allSelected = selectedCount === totalCount
                  const someSelected = selectedCount > 0 && selectedCount < totalCount
                  const isExpanded = expandedSections.has(sectionData.section)

                  return (
                    <div key={sectionData.section} className="section-group" style={{ marginBottom: '4px' }}>
                      <div className="section-header-row">
                        <button
                          className="expand-button"
                          onClick={() => toggleSectionExpanded(sectionData.section)}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                        <label className="section-checkbox">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={input => {
                              if (input) input.indeterminate = someSelected
                            }}
                            onChange={() => toggleSection(sectionData.section)}
                          />
                          <span className="section-name">
                            {sectionData.section} ({selectedCount}/{totalCount})
                          </span>
                        </label>
                      </div>
                      {isExpanded && (
                        <div className="quiz-list">
                          {sectionData.quizzes.map(quiz => (
                            <label key={quiz.url} className="quiz-item">
                              <input
                                type="checkbox"
                                checked={selectedQuizzes.includes(quiz.url)}
                                onChange={() => toggleQuiz(quiz.url)}
                              />
                              <span className="quiz-title">{quiz.title}</span>
                              <span className="quiz-count">({quiz.questionCount})</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>

            {/* Group 2: Everything Else */}
            <div>
              <button
                onClick={() => setShowOtherTopics(!showOtherTopics)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '8px',
                  paddingLeft: '0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  width: '100%',
                  textAlign: 'left'
                }}
              >
                <span style={{ fontSize: '0.65rem' }}>{showOtherTopics ? '▼' : '▶'}</span>
                <span>Other Topics</span>
              </button>
              {showOtherTopics && quizzesBySection
                .filter(sectionData => !sectionData.section.toLowerCase().includes('kapitel'))
                .sort((a, b) => a.section.localeCompare(b.section, 'da'))
                .map(sectionData => {
                  const sectionQuizUrls = sectionData.quizzes.map(q => q.url)
                  const selectedCount = sectionQuizUrls.filter(url => selectedQuizzes.includes(url)).length
                  const totalCount = sectionQuizUrls.length
                  const allSelected = selectedCount === totalCount
                  const someSelected = selectedCount > 0 && selectedCount < totalCount
                  const isExpanded = expandedSections.has(sectionData.section)

                  return (
                    <div key={sectionData.section} className="section-group" style={{ marginBottom: '4px' }}>
                      <div className="section-header-row">
                        <button
                          className="expand-button"
                          onClick={() => toggleSectionExpanded(sectionData.section)}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                        <label className="section-checkbox">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={input => {
                              if (input) input.indeterminate = someSelected
                            }}
                            onChange={() => toggleSection(sectionData.section)}
                          />
                          <span className="section-name">
                            {sectionData.section} ({selectedCount}/{totalCount})
                          </span>
                        </label>
                      </div>
                      {isExpanded && (
                        <div className="quiz-list">
                          {sectionData.quizzes.map(quiz => (
                            <label key={quiz.url} className="quiz-item">
                              <input
                                type="checkbox"
                                checked={selectedQuizzes.includes(quiz.url)}
                                onChange={() => toggleQuiz(quiz.url)}
                              />
                              <span className="quiz-title">{quiz.title}</span>
                              <span className="quiz-count">({quiz.questionCount})</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        </div>

        {import.meta.env.DEV && (
          <div className="settings-section" style={{ borderTop: '1px solid #374151', paddingTop: '16px', marginTop: '16px' }}>
            <button
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              style={{
                background: 'none',
                border: 'none',
                color: '#9ca3af',
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0',
                width: '100%',
                textAlign: 'left'
              }}
            >
              <span>{showAdvancedSettings ? '▼' : '▶'}</span>
              <span>Advanced Settings</span>
            </button>

            {showAdvancedSettings && (
              <div style={{ marginTop: '12px' }}>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={useBackendStats}
                    onChange={toggleBackendStats}
                  />
                  <span>Use backend for stats & spaced repetition</span>
                </label>
                {useBackendStats ? (
                  <div style={{ fontSize: '0.8125rem', color: '#3b82f6', marginTop: '8px', paddingLeft: '38px' }}>
                    Full mode - tracks progress with spaced repetition
                  </div>
                ) : (
                  <div style={{ fontSize: '0.8125rem', color: '#10b981', marginTop: '8px', paddingLeft: '38px' }}>
                    Simple mode - all questions loaded locally, no tracking
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )

  const renderMainContent = () => {
    if (isInitializing) {
      return (
        <div className="loading">Initializing...</div>
      )
    }

    if (loading) {
      return (
        <div className="loading">Loading question...</div>
      )
    }

    if (error || !question) {
      return (
        <div className={error ? "error" : "loading"}>
          {error || (selectedQuizzes.length === 0
            ? 'No quizzes selected. Select quizzes from the settings.'
            : 'No question available')}
        </div>
      )
    }

    const correctOptionIndex = shuffledOptions.findIndex(opt => opt.correct)

    return (
      <>
        {useBackendStats && stats && (
          <div className="stats-bar">
            <div className="stat">
              <div className="stat-value">{stats.studiedQuestions}/{stats.totalQuestions}</div>
              <div className="stat-label">Studied</div>
            </div>
            <div className="stat">
              <div className="stat-value">{stats.overallAccuracy.toFixed(1)}%</div>
              <div className="stat-label">
                <select
                  value={timeframeDays}
                  onChange={(e) => setTimeframeDays(Number(e.target.value))}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: '0.75rem',
                    color: '#9ca3af',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="1">Today</option>
                  <option value="7">Past Week</option>
                  <option value="30">Past Month</option>
                  <option value="90">Past 3 Months</option>
                  <option value="0">All Time</option>
                </select>
              </div>
            </div>
            <div className="stat">
              <div className="stat-value">
                {sessionStats.total > 0 ? ((sessionStats.correct / sessionStats.total) * 100).toFixed(1) : '0.0'}%
              </div>
              <div className="stat-label">Session ({sessionStats.total})</div>
            </div>
          </div>
        )}

        {!useBackendStats && stats && (
          <div className="stats-bar">
            <div className="stat">
              <div className="stat-value">{stats.totalQuestions}</div>
              <div className="stat-label">Total Questions</div>
            </div>
            <div className="stat">
              <div className="stat-value">
                {sessionStats.total > 0 ? ((sessionStats.correct / sessionStats.total) * 100).toFixed(1) : '0.0'}%
              </div>
              <div className="stat-label">Session ({sessionStats.total})</div>
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
              {shuffledOptions.map((option, index) => {
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
                {useBackendStats && questionStrength && !exploratoryMode && (
                  <div className="strength-indicator" style={{ marginTop: '12px', fontSize: '0.875rem' }}>
                    <span style={{ color: questionStrength.color, fontWeight: '600' }}>
                      {questionStrength.level}
                    </span>
                    {' • '}
                    Next review in {questionStrength.intervalDays} day{questionStrength.intervalDays !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {renderSettingsPanel()}
      <div className="app">
        <div className="header">
          <h1>
            Indfødsretsprøven
            {exploratoryMode && (
              <span style={{
                fontSize: '0.75rem',
                fontWeight: '400',
                color: '#fef2f2',
                marginLeft: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                opacity: 0.9
              }}>
                Exploratory Mode
              </span>
            )}
          </h1>
        </div>
        {renderMainContent()}
      </div>
    </>
  )
}

export default App
