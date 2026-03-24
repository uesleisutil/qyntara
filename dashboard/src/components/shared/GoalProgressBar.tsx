import React, { useState } from 'react';
import { ProgressBar } from './ProgressBar';

interface Goal {
  id: string;
  metric: string;
  target: number;
  current: number;
  unit: string;
  deadline?: string;
  historicalAchievementRate?: number;
}

interface GoalProgressBarProps {
  goal: Goal;
  onEditTarget?: (goalId: string, newTarget: number) => void;
  editable?: boolean;
}

export const GoalProgressBar: React.FC<GoalProgressBarProps> = ({
  goal,
  onEditTarget,
  editable = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(goal.target.toString());

  const handleSave = () => {
    const newTarget = parseFloat(editValue);
    if (!isNaN(newTarget) && newTarget > 0) {
      onEditTarget?.(goal.id, newTarget);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditValue(goal.target.toString());
    setIsEditing(false);
  };

  const calculateTimeRemaining = () => {
    if (!goal.deadline) return null;
    
    const now = new Date();
    const deadline = new Date(goal.deadline);
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day';
    if (diffDays < 30) return `${diffDays} days`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months`;
    return `${Math.floor(diffDays / 365)} years`;
  };

  const timeRemaining = calculateTimeRemaining();

  return (
    <div className="goal-progress-bar" style={{ 
      padding: '1rem', 
      border: '1px solid #d4e5dc', 
      borderRadius: '8px',
      marginBottom: '1rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
            {goal.metric}
          </h4>
          {timeRemaining && (
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#5a7268' }}>
              {timeRemaining} remaining
            </p>
          )}
        </div>
        
        {editable && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
              background: '#e8f0ed',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              color: '#5a7268',
            }}
          >
            Edit Target
          </button>
        )}
      </div>

      {isEditing ? (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
          <label style={{ fontSize: '0.875rem' }}>Target:</label>
          <input
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            style={{
              padding: '0.25rem 0.5rem',
              border: '1px solid #b0c8bc',
              borderRadius: '4px',
              width: '100px',
            }}
          />
          <span style={{ fontSize: '0.875rem' }}>{goal.unit}</span>
          <button
            onClick={handleSave}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
              background: '#4ead8a',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
              background: '#e8f0ed',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              color: '#5a7268',
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}

      <ProgressBar
        value={goal.current}
        max={goal.target}
        target={goal.target}
        showPercentage={true}
        showValues={true}
        unit={goal.unit}
        color="auto"
        size="lg"
      />

      {goal.historicalAchievementRate !== undefined && (
        <div style={{ 
          marginTop: '0.5rem', 
          fontSize: '0.75rem', 
          color: '#5a7268',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>Historical Achievement Rate:</span>
          <span style={{ 
            fontWeight: 600,
            color: goal.historicalAchievementRate >= 80 ? '#4ead8a' : 
                   goal.historicalAchievementRate >= 60 ? '#d4a84b' : '#e07070',
          }}>
            {goal.historicalAchievementRate.toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
};
