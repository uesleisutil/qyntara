import React, { useState, useMemo } from 'react';
import { Search, BookOpen, TrendingUp, Code, DollarSign, Cpu } from 'lucide-react';
import { glossaryData } from './glossaryData';

interface GlossaryProps {
  darkMode?: boolean;
  onTermClick?: (termId: string) => void;
}

const categoryIcons = {
  metric: TrendingUp,
  technical: Code,
  financial: DollarSign,
  dl: Cpu,
  infrastructure: Code,
};

const categoryLabels = {
  metric: 'Metrics',
  technical: 'Technical',
  financial: 'Financial',
  dl: 'Deep Learning',
  infrastructure: 'Infrastructure',
};

export const Glossary: React.FC<GlossaryProps> = ({ darkMode = false, onTermClick }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLetter, setSelectedLetter] = useState<string>('all');

  const theme = {
    bg: darkMode ? '#0f1117' : '#f8f9fb',
    cardBg: darkMode ? '#1a1d27' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f1117',
    textSecondary: darkMode ? '#9ba1b0' : '#5f6577',
    border: darkMode ? '#2a2e3a' : '#e0e2e8',
    hover: darkMode ? '#2a2e3a' : '#f1f2f6',
    accent: '#3b82f6',
  };

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const filteredEntries = useMemo(() => {
    let filtered = glossaryData;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(entry => entry.category === selectedCategory);
    }

    // Filter by letter
    if (selectedLetter !== 'all') {
      filtered = filtered.filter(entry => entry.term.toUpperCase().startsWith(selectedLetter));
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        entry =>
          entry.term.toLowerCase().includes(query) ||
          entry.definition.toLowerCase().includes(query)
      );
    }

    // Sort alphabetically
    return filtered.sort((a, b) => a.term.localeCompare(b.term));
  }, [searchQuery, selectedCategory, selectedLetter]);

  const handleTermClick = (termId: string) => {
    if (onTermClick) {
      onTermClick(termId);
    }
  };

  return (
    <div style={{ backgroundColor: theme.bg, minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <BookOpen size={32} color={theme.accent} />
            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '700', color: theme.text }}>
              Technical Glossary
            </h1>
          </div>
          <p style={{ margin: 0, color: theme.textSecondary, fontSize: '1rem' }}>
            Comprehensive definitions for metrics, technical terms, and concepts used in the dashboard
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
              placeholder="Search terms and definitions..."
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
        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            All ({glossaryData.length})
          </button>
          {Object.entries(categoryLabels).map(([key, label]) => {
            const count = glossaryData.filter(entry => entry.category === key).length;
            const Icon = categoryIcons[key as keyof typeof categoryIcons];
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <Icon size={16} />
                {label} ({count})
              </button>
            );
          })}
        </div>

        {/* Alphabet Filter */}
        <div
          style={{
            marginBottom: '2rem',
            padding: '1rem',
            backgroundColor: theme.cardBg,
            border: `1px solid ${theme.border}`,
            borderRadius: '12px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            justifyContent: 'center',
          }}
        >
          <button
            onClick={() => setSelectedLetter('all')}
            style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: selectedLetter === 'all' ? theme.accent : 'transparent',
              color: selectedLetter === 'all' ? 'white' : theme.text,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
              transition: 'all 0.2s',
            }}
          >
            All
          </button>
          {alphabet.map(letter => {
            const hasEntries = glossaryData.some(entry => entry.term.toUpperCase().startsWith(letter));
            return (
              <button
                key={letter}
                onClick={() => setSelectedLetter(letter)}
                disabled={!hasEntries}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: selectedLetter === letter ? theme.accent : 'transparent',
                  color: selectedLetter === letter ? 'white' : hasEntries ? theme.text : theme.textSecondary,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: hasEntries ? 'pointer' : 'not-allowed',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                  opacity: hasEntries ? 1 : 0.4,
                }}
              >
                {letter}
              </button>
            );
          })}
        </div>

        {/* Results Count */}
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ margin: 0, color: theme.textSecondary, fontSize: '0.875rem' }}>
            Showing {filteredEntries.length} {filteredEntries.length === 1 ? 'term' : 'terms'}
          </p>
        </div>

        {/* Glossary Entries */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1rem' }}>
          {filteredEntries.length === 0 ? (
            <div
              style={{
                gridColumn: '1 / -1',
                backgroundColor: theme.cardBg,
                padding: '3rem 2rem',
                borderRadius: '12px',
                textAlign: 'center',
                border: `1px solid ${theme.border}`,
              }}
            >
              <p style={{ margin: 0, color: theme.textSecondary, fontSize: '1rem' }}>
                No terms found matching your search.
              </p>
            </div>
          ) : (
            filteredEntries.map(entry => {
              const Icon = categoryIcons[entry.category];
              return (
                <div
                  key={entry.id}
                  style={{
                    backgroundColor: theme.cardBg,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '12px',
                    padding: '1.25rem',
                    transition: 'box-shadow 0.2s, transform 0.2s',
                    cursor: onTermClick ? 'pointer' : 'default',
                  }}
                  onClick={() => handleTermClick(entry.id)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = darkMode
                      ? '0 4px 12px rgba(0,0,0,0.4)'
                      : '0 4px 12px rgba(0,0,0,0.1)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.125rem', fontWeight: '700', color: theme.text }}>
                        {entry.term}
                      </h3>
                      {entry.pronunciation && (
                        <p style={{ margin: 0, fontSize: '0.75rem', color: theme.textSecondary, fontStyle: 'italic' }}>
                          /{entry.pronunciation}/
                        </p>
                      )}
                    </div>
                    <Icon size={20} color={theme.accent} style={{ flexShrink: 0 }} />
                  </div>

                  {/* Definition */}
                  <p style={{ margin: '0 0 0.75rem 0', color: theme.text, fontSize: '0.875rem', lineHeight: '1.5' }}>
                    {entry.definition}
                  </p>

                  {/* Formula */}
                  {entry.formula && (
                    <div
                      style={{
                        marginBottom: '0.75rem',
                        padding: '0.75rem',
                        backgroundColor: darkMode ? '#0f1117' : '#f8f9fb',
                        borderRadius: '8px',
                        border: `1px solid ${theme.border}`,
                      }}
                    >
                      <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.75rem', fontWeight: '600', color: theme.textSecondary }}>
                        Formula:
                      </p>
                      <code style={{ fontSize: '0.8125rem', color: theme.text, fontFamily: 'monospace' }}>
                        {entry.formula}
                      </code>
                    </div>
                  )}

                  {/* Example */}
                  {entry.example && (
                    <div
                      style={{
                        marginBottom: '0.75rem',
                        padding: '0.75rem',
                        backgroundColor: darkMode ? '#1e3a5f' : '#eff6ff',
                        borderRadius: '8px',
                        borderLeft: `3px solid ${theme.accent}`,
                      }}
                    >
                      <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.75rem', fontWeight: '600', color: theme.accent }}>
                        Example:
                      </p>
                      <p style={{ margin: 0, fontSize: '0.8125rem', color: theme.text, lineHeight: '1.4' }}>
                        {entry.example}
                      </p>
                    </div>
                  )}

                  {/* Related Terms */}
                  {entry.relatedTerms && entry.relatedTerms.length > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', fontWeight: '600', color: theme.textSecondary }}>
                        Related:
                      </p>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {entry.relatedTerms.map(term => (
                          <span
                            key={term}
                            style={{
                              fontSize: '0.75rem',
                              color: theme.accent,
                              padding: '0.25rem 0.5rem',
                              backgroundColor: darkMode ? '#1e3a5f' : '#eff6ff',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            {term}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Category Badge */}
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: `1px solid ${theme.border}` }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: theme.textSecondary,
                        padding: '0.25rem 0.5rem',
                        backgroundColor: darkMode ? '#2a2e3a' : '#f1f2f6',
                        borderRadius: '4px',
                      }}
                    >
                      {categoryLabels[entry.category]}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Glossary;
