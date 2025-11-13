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
    <div className="settings-panel" role="complementary" aria-label="Settings and quiz selection">
      <div className="settings-header">
        <h2>Question Selection</h2>
      </div>
      <div className="settings-content">
        <div className="settings-section">
          <div className="settings-section-header">
            <h3>Quizzes ({selectedQuizzes.length}/{quizzesBySection.flatMap(s => s.quizzes).length})</h3>
            <div className="settings-actions">
              <button
                onClick={selectAllQuizzes}
                className="text-button"
                aria-label="Select all quizzes"
              >
                All
              </button>
              <button
                onClick={deselectAllQuizzes}
                className="text-button"
                aria-label="Deselect all quizzes"
              >
                None
              </button>
            </div>
          </div>
          <div className="quiz-tree">
            {/* Group 1: Chapters */}
            <div style={{ marginBottom: '16px' }}>
              <button
                onClick={() => setShowChapters(!showChapters)}
                className="category-header"
                aria-expanded={showChapters}
                aria-controls="book-chapters-list"
              >
                <span className="category-icon">{showChapters ? '▼' : '▶'}</span>
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
                          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${sectionData.section}`}
                          aria-expanded={isExpanded}
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
                          aria-label={`Select all quizzes in ${sectionData.section}`}
                        />
                        <span
                          className="section-name"
                          onClick={() => jumpToSection(sectionData.section)}
                          role="button"
                          tabIndex={0}
                          onKeyPress={(e) => e.key === 'Enter' && jumpToSection(sectionData.section)}
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
                                aria-label={`${quiz.title} (${quiz.questionCount} questions)`}
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
                className="category-header"
                aria-expanded={showOtherTopics}
                aria-controls="other-topics-list"
              >
                <span className="category-icon">{showOtherTopics ? '▼' : '▶'}</span>
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
                          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${sectionData.section}`}
                          aria-expanded={isExpanded}
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
                          aria-label={`Select all quizzes in ${sectionData.section}`}
                        />
                        <span
                          className="section-name"
                          onClick={() => jumpToSection(sectionData.section)}
                          role="button"
                          tabIndex={0}
                          onKeyPress={(e) => e.key === 'Enter' && jumpToSection(sectionData.section)}
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
                                aria-label={`${quiz.title} (${quiz.questionCount} questions)`}
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
          </div>
          <p className="filter-hint" style={{ marginBottom: '12px' }}>
            Only show questions with knowledge level:
          </p>
          <div className="filter-buttons">
            <button
              onClick={() => {
                setRatingFilter(null)
                localStorage.removeItem('ratingFilter')
              }}
              className={`filter-button ${ratingFilter === null ? 'active' : ''}`}
              aria-pressed={ratingFilter === null}
            >
              All
            </button>
            <button
              onClick={() => {
                const filter: [number, number] = [0, 0]
                setRatingFilter(filter)
                localStorage.setItem('ratingFilter', JSON.stringify(filter))
              }}
              className={`filter-button ${ratingFilter?.[0] === 0 && ratingFilter?.[1] === 0 ? 'active' : ''}`}
              aria-pressed={ratingFilter?.[0] === 0 && ratingFilter?.[1] === 0}
            >
              0 (Unknown)
            </button>
            <button
              onClick={() => {
                const filter: [number, number] = [1, 3]
                setRatingFilter(filter)
                localStorage.setItem('ratingFilter', JSON.stringify(filter))
              }}
              className={`filter-button ${ratingFilter?.[0] === 1 && ratingFilter?.[1] === 3 ? 'active' : ''}`}
              aria-pressed={ratingFilter?.[0] === 1 && ratingFilter?.[1] === 3}
            >
              1-3 (Learning)
            </button>
            <button
              onClick={() => {
                const filter: [number, number] = [4, 7]
                setRatingFilter(filter)
                localStorage.setItem('ratingFilter', JSON.stringify(filter))
              }}
              className={`filter-button ${ratingFilter?.[0] === 4 && ratingFilter?.[1] === 7 ? 'active' : ''}`}
              aria-pressed={ratingFilter?.[0] === 4 && ratingFilter?.[1] === 7}
            >
              4-7 (Familiar)
            </button>
            <button
              onClick={() => {
                const filter: [number, number] = [8, 100]
                setRatingFilter(filter)
                localStorage.setItem('ratingFilter', JSON.stringify(filter))
              }}
              className={`filter-button ${ratingFilter?.[0] === 8 && ratingFilter?.[1] === 100 ? 'active' : ''}`}
              aria-pressed={ratingFilter?.[0] === 8 && ratingFilter?.[1] === 100}
            >
              8+ (Mastered)
            </button>
          </div>
          <p className="filter-hint">
            {ratingFilter === null
              ? 'Showing all questions'
              : `Showing questions with level ${ratingFilter[0]}-${ratingFilter[1] === 100 ? '∞' : ratingFilter[1]}`}
          </p>
        </div>

        <div className="settings-section">
          <div className="settings-section-header">
            <h3>State Management</h3>
          </div>
          <div className="state-buttons">
            <button
              onClick={handleDownloadState}
              className="state-button"
              aria-label="Download your progress and ratings as a file"
            >
              Download Progress
            </button>
            <button
              onClick={handleRestoreState}
              className="state-button"
              aria-label="Restore progress and ratings from a file"
            >
              Restore Progress
            </button>
          </div>
          <p className="state-hint">
            Save or load your ratings and progress
          </p>
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

            {(question.questionEn || question.options.some(opt => opt.textEn)) && (
              <button
                className="peek-icon peek-icon-global"
                onMouseDown={() => setShowTranslations(true)}
                onMouseUp={() => setShowTranslations(false)}
                onMouseLeave={() => setShowTranslations(false)}
                onTouchStart={() => setShowTranslations(true)}
                onTouchEnd={() => setShowTranslations(false)}
                aria-label="Hold to see English translations"
                aria-pressed={showTranslations}
                title="Hold to see translations"
              >
                {showTranslations ? '👁️' : '👁️‍🗨️'}
              </button>
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

            <div className="options" role="radiogroup" aria-label="Answer options">
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
                    role="radio"
                    aria-checked={index === selectedOption}
                    aria-label={`Option ${index + 1}: ${showTranslations && option.textEn ? option.textEn : option.text}`}
                    disabled={answered && !canAdvance}
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
                <div className="rating-container">
                  <div className="rating-row">
                    <span className="rating-label">Knowledge level:</span>
                    <div
                      className="rating-value"
                      style={{ color: currentQuestionRating === 0 ? '#9ca3af' : '#10b981' }}
                      aria-label={`Current knowledge level: ${currentQuestionRating} out of 10`}
                    >
                      {currentQuestionRating}
                    </div>
                    <button
                      onClick={() => setShowRatingUI(!showRatingUI)}
                      className="rating-button"
                      aria-label={showRatingUI ? 'Close rating adjustment' : 'Adjust knowledge level'}
                      aria-expanded={showRatingUI}
                    >
                      {showRatingUI ? 'Close' : 'Adjust'}
                    </button>
                  </div>

                  {showRatingUI && (
                    <div className="rating-picker">
                      <div className="rating-picker-label">
                        Set knowledge level manually:
                      </div>
                      <div className="rating-buttons">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => (
                          <button
                            key={level}
                            onClick={() => handleRatingSelect(level)}
                            className={`rating-number-button ${level === currentQuestionRating ? 'active' : ''}`}
                            aria-label={`Set knowledge level to ${level}`}
                            aria-pressed={level === currentQuestionRating}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                      <div className="rating-hint">
                        0 = don't know, higher = better knowledge
                      </div>
                    </div>
                  )}

                  {/* Self-Rating Display */}
                  <div className="rating-container">
                    <div className="rating-row">
                      <span className="rating-label">Your self-rating:</span>
                      <div
                        className="rating-value"
                        style={{ color: currentSelfRating === 0 ? '#9ca3af' : '#3b82f6' }}
                        aria-label={`Current confidence level: ${currentSelfRating} out of 10`}
                      >
                        {currentSelfRating}
                      </div>
                      <button
                        onClick={() => setShowSelfRatingUI(!showSelfRatingUI)}
                        className="rating-button"
                        aria-label={showSelfRatingUI ? 'Close self-rating' : 'Rate your confidence'}
                        aria-expanded={showSelfRatingUI}
                      >
                        {showSelfRatingUI ? 'Close' : 'Rate'}
                      </button>
                    </div>

                    {showSelfRatingUI && (
                      <div className="rating-picker">
                        <div className="rating-picker-label">
                          How confident are you with this question?
                        </div>
                        <div className="rating-buttons">
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => (
                            <button
                              key={level}
                              onClick={() => handleSelfRatingSelect(level)}
                              className={`rating-number-button ${level === currentSelfRating ? 'active' : ''}`}
                              style={{
                                background: level === currentSelfRating ? '#3b82f6' : undefined,
                                borderColor: level === currentSelfRating ? '#3b82f6' : undefined
                              }}
                              aria-label={`Set confidence level to ${level}`}
                              aria-pressed={level === currentSelfRating}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                        <div className="rating-hint">
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
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {renderSettingsPanel()}
      <main className="app" role="main" id="main-content">
        <header className="header">
          <h1>Indfødsretsprøven</h1>
        </header>
        {renderMainContent()}
      </main>
    </>
  )
}

export default App
