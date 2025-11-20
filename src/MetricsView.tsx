import { useState, useEffect } from 'react';
import { getMetricsSummary, clearMetrics, exportMetrics, type MetricsSummary } from './metrics';

interface MetricsViewProps {
  onClose: () => void;
}

export function MetricsView({ onClose }: MetricsViewProps) {
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [view, setView] = useState<'overview' | 'history' | 'questions'>('overview');

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

  const dailyData = Object.entries(summary.attemptsByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14); // Last 14 days

  return (
    <div className="metrics-view">
      <div className="metrics-header">
        <h2>Metrics</h2>
        <button onClick={onClose} className="close-button">✕</button>
      </div>

      {/* Tab Navigation */}
      <div className="metrics-tabs">
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
              {dailyData.map(([date, data]) => {
                const total = data.correct + data.incorrect;
                const correctPercent = (data.correct / total) * 100;
                return (
                  <div key={date} className="daily-bar-container">
                    <div className="daily-bar">
                      <div
                        className="daily-bar-correct"
                        style={{ height: `${(data.correct / Math.max(...dailyData.map(([, d]) => d.correct + d.incorrect))) * 100}%` }}
                        title={`${data.correct} correct`}
                      />
                      <div
                        className="daily-bar-incorrect"
                        style={{ height: `${(data.incorrect / Math.max(...dailyData.map(([, d]) => d.correct + d.incorrect))) * 100}%` }}
                        title={`${data.incorrect} incorrect`}
                      />
                    </div>
                    <div className="daily-label">{new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
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
