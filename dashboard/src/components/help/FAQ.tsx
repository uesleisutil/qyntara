import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Mail } from 'lucide-react';

interface FAQEntry {
  id: string;
  question: string;
  answer: string;
  category: 'getting-started' | 'features' | 'troubleshooting' | 'data' | 'technical';
  relatedDocs?: string[];
  helpfulCount: number;
}

interface FAQProps {
  darkMode?: boolean;
}

const faqData: FAQEntry[] = [
  // Getting Started
  {
    id: 'gs-1',
    question: 'What is the B3 Tactical Ranking Dashboard?',
    answer: 'The B3 Tactical Ranking Dashboard is an MLOps monitoring platform for tracking machine learning model recommendations for Brazilian stock market (B3) trading. It provides real-time insights into model performance, data quality, and cost optimization.',
    category: 'getting-started',
    relatedDocs: ['User Guide', 'Quick Start'],
    helpfulCount: 45,
  },
  {
    id: 'gs-2',
    question: 'How do I navigate the dashboard?',
    answer: 'Use the tab navigation at the top to switch between different sections: Recommendations, Performance, Validation, Costs, Data Quality, Drift Detection, Explainability, and Backtesting. You can also use keyboard shortcuts (press ? to see all shortcuts).',
    category: 'getting-started',
    relatedDocs: ['Navigation Guide'],
    helpfulCount: 38,
  },
  {
    id: 'gs-3',
    question: 'How often is the data updated?',
    answer: 'The dashboard automatically refreshes data every 5 minutes. You can also manually refresh by clicking the refresh button in the header. Real-time updates are available for critical alerts and notifications.',
    category: 'getting-started',
    helpfulCount: 32,
  },
  {
    id: 'gs-4',
    question: 'Can I customize the dashboard layout?',
    answer: 'Yes! You can customize KPI card visibility, chart sizes, and save your preferred layout. Access layout settings from the settings menu in the top right corner.',
    category: 'getting-started',
    relatedDocs: ['Customization Guide'],
    helpfulCount: 28,
  },
  {
    id: 'gs-5',
    question: 'How do I export data?',
    answer: 'Click the export button on any tab to download data in CSV or Excel format. The export includes all visible data based on your current filters.',
    category: 'getting-started',
    helpfulCount: 41,
  },

  // Features
  {
    id: 'f-1',
    question: 'What are the recommendation scores?',
    answer: 'Recommendation scores range from 0 to 100 and indicate the model\'s confidence in a stock recommendation. Higher scores suggest stronger buy signals based on the ensemble model predictions.',
    category: 'features',
    relatedDocs: ['Glossary: Score', 'Model Documentation'],
    helpfulCount: 52,
  },
  {
    id: 'f-2',
    question: 'How do I filter recommendations?',
    answer: 'Use the filter controls at the top of the Recommendations tab to filter by sector, expected return range, and minimum score. Multiple filters can be applied simultaneously.',
    category: 'features',
    helpfulCount: 36,
  },
  {
    id: 'f-3',
    question: 'What is the comparison mode?',
    answer: 'Comparison mode allows you to select multiple tickers (up to 5) and view them side-by-side. Enable it by clicking the comparison toggle, select tickers using checkboxes, then click "Compare".',
    category: 'features',
    relatedDocs: ['Comparison Guide'],
    helpfulCount: 29,
  },
  {
    id: 'f-4',
    question: 'How do I set up alerts?',
    answer: 'Navigate to the alerts section in settings. You can configure alerts for specific tickers based on score changes, return changes, or rank changes. Alerts appear in the notification center.',
    category: 'features',
    relatedDocs: ['Alert Configuration'],
    helpfulCount: 44,
  },
  {
    id: 'f-5',
    question: 'What is temporal comparison?',
    answer: 'Temporal comparison shows how metrics have changed over time. Toggle it on to see current values alongside previous period values with percentage changes.',
    category: 'features',
    helpfulCount: 31,
  },
  {
    id: 'f-6',
    question: 'How do favorites work?',
    answer: 'Click the star icon next to any ticker to add it to your favorites. Access your favorites list from the favorites panel for quick monitoring of preferred stocks.',
    category: 'features',
    helpfulCount: 27,
  },
  {
    id: 'f-7',
    question: 'What is backtesting?',
    answer: 'Backtesting simulates portfolio performance using historical recommendations. Configure parameters like initial capital, position size, and rebalancing frequency to evaluate trading strategies.',
    category: 'features',
    relatedDocs: ['Backtesting Guide', 'Glossary: Backtesting'],
    helpfulCount: 48,
  },

  // Troubleshooting
  {
    id: 't-1',
    question: 'Why is data not loading?',
    answer: 'Check your internet connection and ensure you\'re not offline. If the issue persists, try refreshing the page. The dashboard will show cached data when offline with a staleness indicator.',
    category: 'troubleshooting',
    helpfulCount: 39,
  },
  {
    id: 't-2',
    question: 'Why are some charts empty?',
    answer: 'Empty charts typically indicate insufficient data for the selected time period or filters. Try adjusting your date range or removing filters. Some features require historical data that may not be available yet.',
    category: 'troubleshooting',
    helpfulCount: 33,
  },
  {
    id: 't-3',
    question: 'The dashboard is slow. What can I do?',
    answer: 'Try reducing the number of visible charts, clearing your browser cache, or using a shorter time range. The dashboard performs best with modern browsers (Chrome, Firefox, Safari, Edge).',
    category: 'troubleshooting',
    helpfulCount: 25,
  },
  {
    id: 't-4',
    question: 'Why am I not receiving notifications?',
    answer: 'Check your notification preferences in settings. Ensure browser notifications are enabled and you\'ve configured alert conditions. Some notifications may be suppressed during quiet hours.',
    category: 'troubleshooting',
    relatedDocs: ['Notification Settings'],
    helpfulCount: 22,
  },
  {
    id: 't-5',
    question: 'Export is failing. How do I fix it?',
    answer: 'Ensure pop-ups are not blocked in your browser. Try exporting a smaller dataset or different format. If the issue persists, check your browser\'s download settings.',
    category: 'troubleshooting',
    helpfulCount: 19,
  },

  // Data
  {
    id: 'd-1',
    question: 'What data sources does the dashboard use?',
    answer: 'The dashboard aggregates data from multiple sources including B3 market data, fundamental metrics, news feeds, and ML model predictions stored in AWS S3.',
    category: 'data',
    relatedDocs: ['Data Architecture'],
    helpfulCount: 35,
  },
  {
    id: 'd-2',
    question: 'How is data quality monitored?',
    answer: 'The Data Quality tab tracks completeness rates, detects anomalies (gaps and outliers), monitors data freshness, and calculates universe coverage. Issues are flagged automatically.',
    category: 'data',
    relatedDocs: ['Data Quality Guide', 'Glossary: Data Quality'],
    helpfulCount: 42,
  },
  {
    id: 'd-3',
    question: 'What is data drift?',
    answer: 'Data drift occurs when the statistical properties of input features change over time. The dashboard detects drift using Kolmogorov-Smirnov tests and flags features that deviate significantly from baseline distributions.',
    category: 'data',
    relatedDocs: ['Glossary: Data Drift', 'Drift Detection Guide'],
    helpfulCount: 46,
  },
  {
    id: 'd-4',
    question: 'What is concept drift?',
    answer: 'Concept drift happens when the relationship between features and target variables changes. The dashboard monitors correlation changes and alerts when model assumptions may no longer hold.',
    category: 'data',
    relatedDocs: ['Glossary: Concept Drift'],
    helpfulCount: 40,
  },
  {
    id: 'd-5',
    question: 'How often should models be retrained?',
    answer: 'The dashboard provides retraining recommendations based on drift detection and performance degradation. Typically, retrain when data drift affects >30% of features or performance degrades >20%.',
    category: 'data',
    relatedDocs: ['Retraining Guide'],
    helpfulCount: 37,
  },

  // Technical
  {
    id: 'tech-1',
    question: 'What metrics are used to evaluate model performance?',
    answer: 'Key metrics include MAPE (Mean Absolute Percentage Error), accuracy, Sharpe ratio, correlation, precision, recall, and alpha. Each metric provides different insights into model quality.',
    category: 'technical',
    relatedDocs: ['Glossary: MAPE', 'Glossary: Sharpe Ratio', 'Performance Metrics Guide'],
    helpfulCount: 50,
  },
  {
    id: 'tech-2',
    question: 'What is SHAP and how is it used?',
    answer: 'SHAP (SHapley Additive exPlanations) values explain individual predictions by showing each feature\'s contribution. View SHAP waterfall charts in the Explainability tab to understand why the model made specific recommendations.',
    category: 'technical',
    relatedDocs: ['Glossary: SHAP', 'Explainability Guide'],
    helpfulCount: 47,
  },
  {
    id: 'tech-3',
    question: 'How is the ensemble model structured?',
    answer: 'The ensemble combines multiple ML models (e.g., XGBoost, LightGBM, Neural Networks) with dynamic weighting. View individual model performance and ensemble weights in the Performance tab.',
    category: 'technical',
    relatedDocs: ['Model Architecture'],
    helpfulCount: 43,
  },
  {
    id: 'tech-4',
    question: 'What AWS services power the dashboard?',
    answer: 'The infrastructure uses Lambda for compute, S3 for storage, API Gateway for endpoints, ElastiCache for caching, DynamoDB for user data, and CloudWatch for monitoring.',
    category: 'technical',
    relatedDocs: ['Architecture Overview'],
    helpfulCount: 34,
  },
  {
    id: 'tech-5',
    question: 'How is cost per prediction calculated?',
    answer: 'Cost per prediction divides total daily AWS costs by the number of predictions generated. This metric helps track unit economics and identify optimization opportunities.',
    category: 'technical',
    relatedDocs: ['Glossary: Cost Per Prediction', 'Cost Optimization'],
    helpfulCount: 30,
  },
  {
    id: 'tech-6',
    question: 'What is the confusion matrix showing?',
    answer: 'The confusion matrix displays prediction accuracy for directional movements (up/down/neutral). It shows how often the model correctly predicts each direction and where it makes mistakes.',
    category: 'technical',
    relatedDocs: ['Glossary: Confusion Matrix'],
    helpfulCount: 38,
  },
  {
    id: 'tech-7',
    question: 'How are outliers detected?',
    answer: 'Outliers are predictions with errors exceeding 3 standard deviations from the mean. The dashboard flags these for investigation and displays common characteristics.',
    category: 'technical',
    relatedDocs: ['Glossary: Outlier'],
    helpfulCount: 26,
  },
  {
    id: 'tech-8',
    question: 'What browsers are supported?',
    answer: 'The dashboard works best on modern browsers: Chrome 90+, Firefox 88+, Safari 14+, and Edge 90+. Mobile browsers are supported with responsive design.',
    category: 'technical',
    helpfulCount: 21,
  },
];

const categoryLabels = {
  'getting-started': 'Getting Started',
  'features': 'Features',
  'troubleshooting': 'Troubleshooting',
  'data': 'Data',
  'technical': 'Technical',
};

export const FAQ: React.FC<FAQProps> = ({ darkMode = false }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [ratings, setRatings] = useState<Record<string, 'helpful' | 'not-helpful' | null>>({});

  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    hover: darkMode ? '#334155' : '#f8fafc',
    accent: '#3b82f6',
  };

  const filteredFAQs = useMemo(() => {
    let filtered = faqData;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(faq => faq.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        faq =>
          faq.question.toLowerCase().includes(query) ||
          faq.answer.toLowerCase().includes(query)
      );
    }

    // Sort by helpfulness
    return filtered.sort((a, b) => b.helpfulCount - a.helpfulCount);
  }, [searchQuery, selectedCategory]);

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleRating = (id: string, rating: 'helpful' | 'not-helpful') => {
    setRatings(prev => ({
      ...prev,
      [id]: prev[id] === rating ? null : rating,
    }));
  };

  return (
    <div style={{ backgroundColor: theme.bg, minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', fontWeight: '700', color: theme.text }}>
            Frequently Asked Questions
          </h1>
          <p style={{ margin: 0, color: theme.textSecondary, fontSize: '1rem' }}>
            Find answers to common questions about the B3 Tactical Ranking Dashboard
          </p>
        </div>

        {/* Search */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={20}
              style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: theme.textSecondary,
              }}
            />
            <input
              type="text"
              placeholder="Search FAQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.875rem 1rem 0.875rem 3rem',
                backgroundColor: theme.cardBg,
                border: `1px solid ${theme.border}`,
                borderRadius: '12px',
                fontSize: '1rem',
                color: theme.text,
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = theme.accent)}
              onBlur={(e) => (e.currentTarget.style.borderColor = theme.border)}
            />
          </div>
        </div>

        {/* Category Filter */}
        <div style={{ marginBottom: '2rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedCategory('all')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: selectedCategory === 'all' ? theme.accent : 'transparent',
              color: selectedCategory === 'all' ? 'white' : theme.text,
              border: `1px solid ${selectedCategory === 'all' ? theme.accent : theme.border}`,
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
              transition: 'all 0.2s',
            }}
          >
            All ({faqData.length})
          </button>
          {Object.entries(categoryLabels).map(([key, label]) => {
            const count = faqData.filter(faq => faq.category === key).length;
            return (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: selectedCategory === key ? theme.accent : 'transparent',
                  color: selectedCategory === key ? 'white' : theme.text,
                  border: `1px solid ${selectedCategory === key ? theme.accent : theme.border}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                }}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>

        {/* FAQ List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredFAQs.length === 0 ? (
            <div
              style={{
                backgroundColor: theme.cardBg,
                padding: '3rem 2rem',
                borderRadius: '12px',
                textAlign: 'center',
                border: `1px solid ${theme.border}`,
              }}
            >
              <p style={{ margin: 0, color: theme.textSecondary, fontSize: '1rem' }}>
                No FAQs found matching your search.
              </p>
            </div>
          ) : (
            filteredFAQs.map(faq => {
              const isExpanded = expandedIds.has(faq.id);
              const userRating = ratings[faq.id];

              return (
                <div
                  key={faq.id}
                  style={{
                    backgroundColor: theme.cardBg,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '12px',
                    overflow: 'hidden',
                    transition: 'box-shadow 0.2s',
                  }}
                >
                  {/* Question Header */}
                  <button
                    onClick={() => toggleExpanded(faq.id)}
                    style={{
                      width: '100%',
                      padding: '1.25rem 1.5rem',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                      textAlign: 'left',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.hover)}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: '600', color: theme.text }}>
                        {faq.question}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: theme.textSecondary,
                            padding: '0.125rem 0.5rem',
                            backgroundColor: darkMode ? '#334155' : '#f1f5f9',
                            borderRadius: '4px',
                          }}
                        >
                          {categoryLabels[faq.category]}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
                          {faq.helpfulCount} found helpful
                        </span>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={20} color={theme.textSecondary} />
                    ) : (
                      <ChevronDown size={20} color={theme.textSecondary} />
                    )}
                  </button>

                  {/* Answer Content */}
                  {isExpanded && (
                    <div style={{ padding: '0 1.5rem 1.25rem 1.5rem', borderTop: `1px solid ${theme.border}` }}>
                      <p style={{ margin: '1rem 0', color: theme.text, fontSize: '0.9375rem', lineHeight: '1.6' }}>
                        {faq.answer}
                      </p>

                      {/* Related Docs */}
                      {faq.relatedDocs && faq.relatedDocs.length > 0 && (
                        <div style={{ marginTop: '1rem' }}>
                          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '600', color: theme.text }}>
                            Related Documentation:
                          </p>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {faq.relatedDocs.map(doc => (
                              <span
                                key={doc}
                                style={{
                                  fontSize: '0.8125rem',
                                  color: theme.accent,
                                  padding: '0.25rem 0.75rem',
                                  backgroundColor: darkMode ? '#1e3a5f' : '#eff6ff',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                }}
                              >
                                {doc}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Rating */}
                      <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '0.875rem', color: theme.textSecondary }}>Was this helpful?</span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => handleRating(faq.id, 'helpful')}
                            style={{
                              padding: '0.5rem',
                              backgroundColor: userRating === 'helpful' ? '#10b981' : 'transparent',
                              border: `1px solid ${userRating === 'helpful' ? '#10b981' : theme.border}`,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              transition: 'all 0.2s',
                            }}
                          >
                            <ThumbsUp size={16} color={userRating === 'helpful' ? 'white' : theme.textSecondary} />
                          </button>
                          <button
                            onClick={() => handleRating(faq.id, 'not-helpful')}
                            style={{
                              padding: '0.5rem',
                              backgroundColor: userRating === 'not-helpful' ? '#ef4444' : 'transparent',
                              border: `1px solid ${userRating === 'not-helpful' ? '#ef4444' : theme.border}`,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              transition: 'all 0.2s',
                            }}
                          >
                            <ThumbsDown size={16} color={userRating === 'not-helpful' ? 'white' : theme.textSecondary} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Contact Support */}
        <div
          style={{
            marginTop: '2rem',
            padding: '1.5rem',
            backgroundColor: theme.cardBg,
            border: `1px solid ${theme.border}`,
            borderRadius: '12px',
            textAlign: 'center',
          }}
        >
          <Mail size={32} color={theme.accent} style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: '600', color: theme.text }}>
            Still need help?
          </h3>
          <p style={{ margin: '0 0 1rem 0', color: theme.textSecondary, fontSize: '0.9375rem' }}>
            Can't find the answer you're looking for? Contact our support team.
          </p>
          <button
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: theme.accent,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.9375rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
};

export default FAQ;
