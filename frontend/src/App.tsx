import { useState, useEffect } from 'react'
import { Question, QuestionOption, Stats, QuizzesBySection, getNextQuestion, submitAnswer, getStats, getSections, getQuizzes, initializeQuestionManager } from './api'
import { getQuestionState, setQuestionRating, setQuestionSelfRating, updateRatingAfterAnswer, exportState, importState } from './questionState'

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
  const [mostNeededMode, setMostNeededMode] = useState(false)
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 })
  const [isInitializing, setIsInitializing] = useState(true)
  const [showChapters, setShowChapters] = useState(true)
  const [showOtherTopics, setShowOtherTopics] = useState(false)
  const [showRatingUI, setShowRatingUI] = useState(false)
  const [currentQuestionRating, setCurrentQuestionRating] = useState(0)
  const [currentSelfRating, setCurrentSelfRating] = useState(0)
  const [showSelfRatingUI, setShowSelfRatingUI] = useState(false)
  const [ratingFilter, setRatingFilter] = useState<[number, number] | null>(null)

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
      const nextQuestion = await getNextQuestion(sections, quizzes, shuffleMode, mostNeededMode, ratingFilter || undefined)
      setQuestion(nextQuestion)
      setShuffledOptions(shuffleArray(nextQuestion.options))
      setSelectedOption(null)
      setAnswered(false)
      setStartTime(Date.now())
      setShowTranslations(false)
      setShowRatingUI(false)
      setShowSelfRatingUI(false)

      // Load current ratings for this question
      const state = getQuestionState(nextQuestion.id)
      setCurrentQuestionRating(state.rating)
      setCurrentSelfRating(state.selfRating)
    } catch (err: any) {
      setError('Failed to load question.')
      console.error(err)
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
      const currentStats = await getStats(sections, quizzes, 0)
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

      const savedMostNeededMode = localStorage.getItem('mostNeededMode')
      if (savedMostNeededMode) {
        setMostNeededMode(savedMostNeededMode === 'true')
      }

      const savedRatingFilter = localStorage.getItem('ratingFilter')
      if (savedRatingFilter) {
        try {
          const parsed = JSON.parse(savedRatingFilter)
          setRatingFilter(parsed)
        } catch {
          // Ignore invalid filter
        }
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

        // Initialize the question manager
        await initializeQuestionManager()

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
  }, [selectedSections, selectedQuizzes, shuffleMode, mostNeededMode, ratingFilter, isInitializing])

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

    // Update session stats
    setSessionStats(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }))

    // Auto-update rating based on answer
    if (question) {
      const updatedState = updateRatingAfterAnswer(question.id, isCorrect)
      setCurrentQuestionRating(updatedState.rating)
    }
  }

  const handleRatingSelect = (rating: number) => {
    if (!question) return
    const updatedState = setQuestionRating(question.id, rating)
    setCurrentQuestionRating(updatedState.rating)
    setShowRatingUI(false)
  }

  const handleSelfRatingSelect = (rating: number) => {
    if (!question) return
    const updatedState = setQuestionSelfRating(question.id, rating)
    setCurrentSelfRating(updatedState.selfRating)
    setShowSelfRatingUI(false)
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
      // Turn off most needed mode when shuffling
      if (newValue) {
        setMostNeededMode(false)
        localStorage.setItem('mostNeededMode', 'false')
      }
      return newValue
    })
  }

  const toggleMostNeededMode = () => {
    setMostNeededMode(prev => {
      const newValue = !prev
      localStorage.setItem('mostNeededMode', String(newValue))
      // Turn off shuffle mode when using most needed
      if (newValue) {
        setShuffleMode(false)
        localStorage.setItem('shuffleMode', 'false')
      }
      return newValue
    })
  }

  const handleDownloadState = () => {
    const stateJson = exportState()
    const blob = new Blob([stateJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `quizz-state-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleRestoreState = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (file) {
        try {
          const text = await file.text()
          const success = importState(text)
          if (success) {
            alert('State restored successfully!')
            // Reload question to reflect new state
            loadQuestion()
          } else {
            alert('Failed to restore state. Invalid file format.')
          }
        } catch (err) {
          console.error('Failed to restore state:', err)
          alert('Failed to restore state.')
        }
      }
    }
    input.click()
  }

  const jumpToSection = async (section: string) => {
    // Select only quizzes from this section
    const sectionData = quizzesBySection.find(s => s.section === section)
    if (!sectionData) return

    const sectionQuizUrls = sectionData.quizzes.map(q => q.url)
    setSelectedQuizzes(sectionQuizUrls)
    localStorage.setItem('selectedQuizzes', JSON.stringify(sectionQuizUrls))
  }

  const renderSettingsPanel = () => (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>Question Selection</h2>
      </div>
      <div className="settings-content">
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
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={input => {
                            if (input) input.indeterminate = someSelected
                          }}
                          onChange={() => toggleSection(sectionData.section)}
                          style={{ cursor: 'pointer', accentColor: '#a31537' }}
                        />
                        <span
                          className="section-name"
                          onClick={() => jumpToSection(sectionData.section)}
                          style={{ cursor: 'pointer', flex: 1 }}
                        >
                          {sectionData.section} ({selectedCount}/{totalCount})
                        </span>
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
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={input => {
                            if (input) input.indeterminate = someSelected
                          }}
                          onChange={() => toggleSection(sectionData.section)}
                          style={{ cursor: 'pointer', accentColor: '#a31537' }}
                        />
                        <span
                          className="section-name"
                          onClick={() => jumpToSection(sectionData.section)}
                          style={{ cursor: 'pointer', flex: 1 }}
                        >
                          {sectionData.section} ({selectedCount}/{totalCount})
                        </span>
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

        <div className="settings-section">
          <div className="settings-section-header">
            <h3>Question Order</h3>
          </div>
          <label className="checkbox-item">
            <input
              type="checkbox"
              checked={mostNeededMode}
              onChange={toggleMostNeededMode}
            />
            <span>Most needed order (prioritize questions you know least)</span>
          </label>
          <label className="checkbox-item" style={{ marginTop: '8px' }}>
            <input
              type="checkbox"
              checked={shuffleMode}
              onChange={toggleShuffleMode}
            />
            <span>Shuffle questions</span>
          </label>
          <div style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '8px', paddingLeft: '38px' }}>
            {mostNeededMode
              ? 'Questions ordered by knowledge level and performance'
              : shuffleMode
                ? 'Questions in random order'
                : 'Questions in sequential order'}
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-header">
            <h3>Knowledge Level Filter</h3>
            <button
              onClick={() => {
                setRatingFilter(null)
                localStorage.removeItem('ratingFilter')
              }}
              className="text-button"
              style={{
                fontSize: '0.75rem',
                padding: '4px 8px'
              }}
            >
              Reset
            </button>
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '16px' }}>
            {ratingFilter === null
              ? 'Showing all questions (0-10)'
              : `Showing level ${ratingFilter[0]}-${ratingFilter[1]}`}
          </div>
          <div style={{ padding: '0 8px' }}>
            <div style={{ position: 'relative', height: '40px', marginBottom: '8px' }}>
              <input
                type="range"
                min="0"
                max="10"
                value={ratingFilter?.[0] ?? 0}
                onChange={(e) => {
                  const min = parseInt(e.target.value)
                  const max = ratingFilter?.[1] ?? 10
                  const filter: [number, number] = [min, Math.max(min, max)]
                  setRatingFilter(filter)
                  localStorage.setItem('ratingFilter', JSON.stringify(filter))
                }}
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '4px',
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  background: 'transparent',
                  outline: 'none',
                  pointerEvents: 'all',
                  zIndex: ratingFilter && ratingFilter[0] > ratingFilter[1] - 2 ? 3 : 2
                } as any}
                className="range-slider-thumb"
              />
              <input
                type="range"
                min="0"
                max="10"
                value={ratingFilter?.[1] ?? 10}
                onChange={(e) => {
                  const max = parseInt(e.target.value)
                  const min = ratingFilter?.[0] ?? 0
                  const filter: [number, number] = [Math.min(min, max), max]
                  setRatingFilter(filter)
                  localStorage.setItem('ratingFilter', JSON.stringify(filter))
                }}
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '4px',
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  background: 'transparent',
                  outline: 'none',
                  pointerEvents: 'all',
                  zIndex: 2
                } as any}
                className="range-slider-thumb"
              />
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '0',
                right: '0',
                height: '4px',
                background: '#e5e7eb',
                borderRadius: '2px',
                transform: 'translateY(-50%)',
                zIndex: 1
              }} />
              <div style={{
                position: 'absolute',
                top: '50%',
                left: `${((ratingFilter?.[0] ?? 0) / 10) * 100}%`,
                right: `${100 - ((ratingFilter?.[1] ?? 10) / 10) * 100}%`,
                height: '4px',
                background: '#a31537',
                borderRadius: '2px',
                transform: 'translateY(-50%)',
                zIndex: 1
              }} />
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: '#9ca3af',
              paddingTop: '4px'
            }}>
              <span>0 (Unknown)</span>
              <span>10 (Mastered)</span>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-header">
            <h3>State Management</h3>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
            <button
              onClick={handleDownloadState}
              className="text-button"
              style={{
                padding: '10px 16px',
                background: 'transparent',
                color: '#9ca3af',
                border: '1px solid #374151',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#a31537'
                e.currentTarget.style.color = '#f3f4f6'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#374151'
                e.currentTarget.style.color = '#9ca3af'
              }}
            >
              Download Progress
            </button>
            <button
              onClick={handleRestoreState}
              className="text-button"
              style={{
                padding: '10px 16px',
                background: 'transparent',
                color: '#9ca3af',
                border: '1px solid #374151',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#a31537'
                e.currentTarget.style.color = '#f3f4f6'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#374151'
                e.currentTarget.style.color = '#9ca3af'
              }}
            >
              Restore Progress
            </button>
          </div>
          <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '8px' }}>
            Save or load your ratings and progress
          </div>
        </div>
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
        {stats && (
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

            <div className="question-section">
              <div className="question-text">
                {showTranslations && question.questionEn ? question.questionEn : question.question}
              </div>
              {showTranslations && question.section && (
                <div style={{
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  textAlign: 'center',
                  marginTop: '8px',
                  fontStyle: 'italic'
                }}>
                  {question.section}{question.quiz && ` • ${question.quiz}`}
                </div>
              )}
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

                {/* Knowledge Level Display */}
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.875rem', opacity: 0.8 }}>Knowledge level:</span>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: '600',
                      color: currentQuestionRating === 0 ? '#9ca3af' : '#10b981',
                      minWidth: '32px',
                      textAlign: 'center'
                    }}>
                      {currentQuestionRating}
                    </div>
                    <button
                      onClick={() => setShowRatingUI(!showRatingUI)}
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '4px',
                        padding: '4px 12px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        color: 'white',
                        opacity: 0.7
                      }}
                    >
                      {showRatingUI ? 'Close' : 'Adjust'}
                    </button>
                  </div>

                  {showRatingUI && (
                    <div style={{ marginTop: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', marginBottom: '8px', opacity: 0.7 }}>
                        Set knowledge level manually:
                      </div>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => (
                          <button
                            key={level}
                            onClick={() => handleRatingSelect(level)}
                            style={{
                              background: level === currentQuestionRating ? '#a31537' : 'rgba(255,255,255,0.1)',
                              border: level === currentQuestionRating ? '2px solid #a31537' : '1px solid rgba(255,255,255,0.2)',
                              borderRadius: '6px',
                              width: '40px',
                              height: '40px',
                              cursor: 'pointer',
                              fontSize: '1rem',
                              fontWeight: level === currentQuestionRating ? '600' : '400',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={(e) => {
                              if (level !== currentQuestionRating) {
                                e.currentTarget.style.background = 'rgba(163, 21, 55, 0.3)'
                                e.currentTarget.style.borderColor = '#a31537'
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (level !== currentQuestionRating) {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
                              }
                            }}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                      <div style={{ fontSize: '0.65rem', marginTop: '8px', opacity: 0.5 }}>
                        0 = don't know, higher = better knowledge
                      </div>
                    </div>
                  )}

                  {/* Self-Rating Display */}
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.875rem', opacity: 0.8 }}>Your self-rating:</span>
                      <div style={{
                        fontSize: '1.5rem',
                        fontWeight: '600',
                        color: currentSelfRating === 0 ? '#9ca3af' : '#3b82f6',
                        minWidth: '32px',
                        textAlign: 'center'
                      }}>
                        {currentSelfRating}
                      </div>
                      <button
                        onClick={() => setShowSelfRatingUI(!showSelfRatingUI)}
                        style={{
                          background: 'rgba(255,255,255,0.1)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '4px',
                          padding: '4px 12px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          color: 'white',
                          opacity: 0.7
                        }}
                      >
                        {showSelfRatingUI ? 'Close' : 'Rate'}
                      </button>
                    </div>

                    {showSelfRatingUI && (
                      <div style={{ marginTop: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', marginBottom: '8px', opacity: 0.7 }}>
                          How confident are you with this question?
                        </div>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => (
                            <button
                              key={level}
                              onClick={() => handleSelfRatingSelect(level)}
                              style={{
                                background: level === currentSelfRating ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                                border: level === currentSelfRating ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '6px',
                                width: '40px',
                                height: '40px',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: level === currentSelfRating ? '600' : '400',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={(e) => {
                                if (level !== currentSelfRating) {
                                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)'
                                  e.currentTarget.style.borderColor = '#3b82f6'
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (level !== currentSelfRating) {
                                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
                                }
                              }}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                        <div style={{ fontSize: '0.65rem', marginTop: '8px', opacity: 0.5 }}>
                          0 = not confident, 10 = very confident
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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
          <h1>Indfødsretsprøven</h1>
          {question && (question.questionEn || question.options.some(opt => opt.textEn)) && (
            <button
              className="peek-icon peek-icon-header"
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
        </div>
        {renderMainContent()}
      </div>
    </>
  )
}

export default App
