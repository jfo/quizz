import { useState, useEffect } from 'react';
import { getMetricsSummary, clearMetrics, exportMetrics, type MetricsSummary, type DailyStats } from './metrics';

interface MetricsViewProps {
  onClose: () => void;
}

type TimePeriod = 7 | 30 | 90 | 'all';

export function MetricsView({ onClose }: MetricsViewProps) {
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [view, setView] = useState<'overview' | 'analytics' | 'history' | 'questions'>('analytics');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>(30);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = () => {
    setSummary(getMetricsSummary());
  };

  const handleClearMetrics = () => {
    if (confirm('Are you sure you want to clear all metrics data? This cannot be undone.')) {
      clearMetrics();
      loadSummary();
    }
  };

  const handleExportMetrics = () => {
    const data = exportMetrics();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz-metrics-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!summary) {
    return <div className="metrics-view">Loading metrics...</div>;
  }

  if (summary.totalAttempts === 0) {
    return (
      <div className="metrics-view">
        <div className="metrics-header">
          <h2>Metrics</h2>
          <button onClick={onClose} className="close-button">✕</button>
        </div>
        <div className="metrics-empty">
          <p>No metrics data yet. Start answering questions to see your progress!</p>
        </div>
      </div>
    );
  }

  // Filter data based on time period
  const getFilteredData = () => {
    if (timePeriod === 'all') {
      return summary.dailyStats;
    }
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timePeriod);
    return summary.dailyStats.filter(day => day.timestamp >= cutoffDate.getTime());
  };

  const filteredData = getFilteredData();
  const dailyData = filteredData.slice(-14); // Last 14 days for the overview chart

  const renderAnalyticsTab = () => {
    const data = filteredData;
    const trend = summary.trendAnalysis;

    // Calculate moving average (7-day)
    const movingAverageData = data.map((day, index) => {
      const start = Math.max(0, index - 6);
      const window = data.slice(start, index + 1);
      const totalCorrect = window.reduce((sum, d) => sum + d.correct, 0);
      const totalAttempts = window.reduce((sum, d) => sum + d.total, 0);
      return {
        date: day.date,
        accuracy: totalAttempts > 0 ? (totalCorrect / totalAttempts) * 100 : 0,
      };
    });

    // Get max values for chart scaling
    const maxAccuracy = 100;
    const maxVolume = Math.max(...data.map(d => d.total), 1);

    return (
      <div className="metrics-content">
        {/* Trend Summary Cards */}
        <div className="trend-summary">
          <div className="trend-card">
            <div className="trend-label">Overall Trend</div>
            <div className={`trend-value trend-${trend.overallTrend}`}>
              {trend.overallTrend === 'improving' && '↗ Improving'}
              {trend.overallTrend === 'stable' && '→ Stable'}
              {trend.overallTrend === 'declining' && '↘ Declining'}
              {trend.overallTrend === 'insufficient_data' && '— Not enough data'}
            </div>
            {trend.overallTrend !== 'insufficient_data' && (
              <div className="trend-detail">
                {Math.abs(trend.trendPercentage).toFixed(1)}% change
              </div>
            )}
          </div>

          <div className="trend-card">
            <div className="trend-label">Current Streak</div>
            <div className="trend-value">{trend.currentStreak} days</div>
            <div className="trend-detail">Consecutive practice days</div>
          </div>

          <div className="trend-card">
            <div className="trend-label">Avg. Accuracy</div>
            <div className="trend-value">{trend.averageAccuracy.toFixed(1)}%</div>
            <div className="trend-detail">
              {trend.averageQuestionsPerDay.toFixed(1)} questions/day
            </div>
          </div>

          {trend.bestDay && (
            <div className="trend-card">
              <div className="trend-label">Best Day</div>
              <div className="trend-value">{trend.bestDay.accuracy.toFixed(0)}%</div>
              <div className="trend-detail">
                {new Date(trend.bestDay.timestamp).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
            </div>
          )}
        </div>

        {/* Time Period Selector */}
        <div className="time-period-selector">
          <button
            className={timePeriod === 7 ? 'active' : ''}
            onClick={() => setTimePeriod(7)}
          >
            7 Days
          </button>
          <button
            className={timePeriod === 30 ? 'active' : ''}
            onClick={() => setTimePeriod(30)}
          >
            30 Days
          </button>
          <button
            className={timePeriod === 90 ? 'active' : ''}
            onClick={() => setTimePeriod(90)}
          >
            90 Days
          </button>
          <button
            className={timePeriod === 'all' ? 'active' : ''}
            onClick={() => setTimePeriod('all')}
          >
            All Time
          </button>
        </div>

        {/* Accuracy Trend Chart */}
        <div className="metrics-section">
          <h3>Accuracy Over Time</h3>
          <div className="line-chart">
            <div className="line-chart-y-axis">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>
            <div className="line-chart-content">
              <svg viewBox="0 0 800 300" preserveAspectRatio="none">
                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map(pct => (
                  <line
                    key={pct}
                    x1="0"
                    y1={300 - (pct / 100) * 300}
                    x2="800"
                    y2={300 - (pct / 100) * 300}
                    stroke="var(--color-border)"
                    strokeWidth="1"
                    opacity="0.3"
                  />
                ))}

                {/* Daily accuracy line */}
                {data.length > 1 && (
                  <polyline
                    points={data
                      .map((day, i) => {
                        const x = (i / (data.length - 1)) * 800;
                        const y = 300 - (day.accuracy / 100) * 300;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth="3"
                    opacity="0.6"
                  />
                )}

                {/* Moving average line */}
                {movingAverageData.length > 1 && (
                  <polyline
                    points={movingAverageData
                      .map((day, i) => {
                        const x = (i / (movingAverageData.length - 1)) * 800;
                        const y = 300 - (day.accuracy / 100) * 300;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="var(--color-success-border)"
                    strokeWidth="3"
                  />
                )}

                {/* Data points */}
                {data.map((day, i) => {
                  const x = (i / Math.max(1, data.length - 1)) * 800;
                  const y = 300 - (day.accuracy / 100) * 300;
                  return (
                    <circle
                      key={day.date}
                      cx={x}
                      cy={y}
                      r="5"
                      fill="var(--color-primary)"
                      opacity="0.8"
                    >
                      <title>
                        {day.date}: {day.accuracy.toFixed(1)}% ({day.correct}/{day.total})
                      </title>
                    </circle>
                  );
                })}
              </svg>
              <div className="line-chart-legend">
                <div className="legend-item">
                  <div className="legend-dot" style={{ background: 'var(--color-primary)', opacity: 0.6 }}></div>
                  <span>Daily Accuracy</span>
                </div>
                <div className="legend-item">
                  <div className="legend-dot" style={{ background: 'var(--color-success-border)' }}></div>
                  <span>7-Day Moving Avg</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Volume Chart */}
        <div className="metrics-section">
          <h3>Questions Answered Per Day</h3>
          <div className="volume-chart">
            {data.map((day) => {
              const height = (day.total / maxVolume) * 100;
              return (
                <div key={day.date} className="volume-bar-container" title={`${day.date}: ${day.total} questions`}>
                  <div
                    className="volume-bar"
                    style={{
                      height: `${Math.max(height, 2)}%`,
                      background: `linear-gradient(to top, var(--color-primary), var(--color-primary-dark))`,
                    }}
                  >
                    <span className="volume-count">{day.total}</span>
                  </div>
                  <div className="volume-date">
                    {new Date(day.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily Stats Table */}
        <div className="metrics-section">
          <h3>Daily Breakdown</h3>
          <div className="daily-stats-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Questions</th>
                  <th>Correct</th>
                  <th>Incorrect</th>
                  <th>Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {[...data].reverse().map((day) => (
                  <tr key={day.date}>
                    <td>
                      {new Date(day.timestamp).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td>{day.total}</td>
                    <td className="correct-cell">{day.correct}</td>
                    <td className="incorrect-cell">{day.incorrect}</td>
                    <td>
                      <div className="accuracy-bar-cell">
                        <div
                          className="accuracy-bar-fill"
                          style={{ width: `${day.accuracy}%` }}
                        ></div>
                        <span className="accuracy-text">{day.accuracy.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="metrics-view">
      <div className="metrics-header">
        <h2>Metrics</h2>
        <button onClick={onClose} className="close-button">✕</button>
      </div>

      {/* Tab Navigation */}
      <div className="metrics-tabs">
        <button
          className={view === 'analytics' ? 'active' : ''}
          onClick={() => setView('analytics')}
        >
          Analytics
        </button>
        <button
          className={view === 'overview' ? 'active' : ''}
          onClick={() => setView('overview')}
        >
          Overview
        </button>
        <button
          className={view === 'history' ? 'active' : ''}
          onClick={() => setView('history')}
        >
          History
        </button>
        <button
          className={view === 'questions' ? 'active' : ''}
          onClick={() => setView('questions')}
        >
          Questions
        </button>
      </div>

      {/* Analytics Tab */}
      {view === 'analytics' && renderAnalyticsTab()}

      {/* Overview Tab */}
      {view === 'overview' && (
        <div className="metrics-content">
          <div className="metrics-stats">
            <div className="stat-card">
              <div className="stat-value">{summary.totalAttempts}</div>
              <div className="stat-label">Total Attempts</div>
            </div>
            <div className="stat-card correct">
              <div className="stat-value">{summary.correctAttempts}</div>
              <div className="stat-label">Correct</div>
            </div>
            <div className="stat-card incorrect">
              <div className="stat-value">{summary.incorrectAttempts}</div>
              <div className="stat-label">Incorrect</div>
            </div>
            <div className="stat-card accuracy">
              <div className="stat-value">{summary.accuracy.toFixed(1)}%</div>
              <div className="stat-label">Accuracy</div>
            </div>
          </div>

          {/* Daily Chart */}
          <div className="metrics-section">
            <h3>Last 14 Days</h3>
            <div className="daily-chart">
              {dailyData.map((day) => {
                const total = day.correct + day.incorrect;
                const correctPercent = (day.correct / total) * 100;
                const maxHeight = Math.max(...dailyData.map((d) => d.correct + d.incorrect));
                return (
                  <div key={day.date} className="daily-bar-container">
                    <div className="daily-bar">
                      <div
                        className="daily-bar-correct"
                        style={{
                          height: `${(day.correct / maxHeight) * 100}%`,
                        }}
                        title={`${day.correct} correct`}
                      />
                      <div
                        className="daily-bar-incorrect"
                        style={{
                          height: `${(day.incorrect / maxHeight) * 100}%`,
                        }}
                        title={`${day.incorrect} incorrect`}
                      />
                    </div>
                    <div className="daily-label">
                      {new Date(day.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                    <div className="daily-stats">
                      {total} ({correctPercent.toFixed(0)}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* History Tab */}
      {view === 'history' && (
        <div className="metrics-content">
          <div className="metrics-section">
            <h3>Recent Attempts (Last 50)</h3>
            <div className="history-list">
              {summary.recentAttempts.map((attempt, index) => (
                <div key={index} className={`history-item ${attempt.correct ? 'correct' : 'incorrect'}`}>
                  <div className="history-icon">{attempt.correct ? '✓' : '✗'}</div>
                  <div className="history-details">
                    <div className="history-question">{attempt.questionText}</div>
                    <div className="history-meta">
                      {attempt.section} → {attempt.quiz} • {new Date(attempt.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Questions Tab */}
      {view === 'questions' && (
        <div className="metrics-content">
          <div className="metrics-section">
            <h3>Question Breakdown</h3>
            <div className="question-breakdown">
              {Object.entries(summary.questionBreakdown)
                .sort(([, a], [, b]) => (b.correct + b.incorrect) - (a.correct + a.incorrect))
                .slice(0, 50)
                .map(([questionId, data]) => {
                  const total = data.correct + data.incorrect;
                  const accuracy = (data.correct / total) * 100;
                  return (
                    <div key={questionId} className="question-item">
                      <div className="question-text">{data.questionText}</div>
                      <div className="question-stats">
                        <div className="question-bar">
                          <div
                            className="question-bar-correct"
                            style={{ width: `${accuracy}%` }}
                          />
                        </div>
                        <div className="question-numbers">
                          ✓ {data.correct} / ✗ {data.incorrect} ({accuracy.toFixed(0)}%)
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="metrics-actions">
        <button onClick={handleExportMetrics} className="export-button">
          Export Data
        </button>
        <button onClick={handleClearMetrics} className="clear-button">
          Clear All Data
        </button>
      </div>
    </div>
  );
}
