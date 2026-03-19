# RetrainingRecommendations Component - Visual Examples

## Example 1: No Retraining Required (Healthy State)

```tsx
<RetrainingRecommendations
  driftedFeaturesPercentage={15}
  conceptDriftDetected={false}
  performanceDegradationDays={0}
  daysSinceLastTraining={30}
/>
```

**Visual Output:**
```
┌─────────────────────────────────────────────┐
│  ✓  No Retraining Required                  │
│                                             │
│  Model performance is stable. No            │
│  significant drift or degradation detected. │
│                                             │
│  Last trained: 30 days ago                  │
└─────────────────────────────────────────────┘
```

---

## Example 2: Medium Priority - Data Drift (30-40%)

```tsx
<RetrainingRecommendations
  driftedFeaturesPercentage={35}
  conceptDriftDetected={false}
  performanceDegradationDays={0}
  daysSinceLastTraining={45}
/>
```

**Visual Output:**
```
┌─────────────────────────────────────────────────────────────┐
│  ⚠  Model Retraining Recommended          [MEDIUM]          │
│                                                             │
│  Model retraining recommended due to:                       │
│  35.0% of features have drifted.                           │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Expected     │  │ Last         │  │ Active       │    │
│  │ Improvement  │  │ Training     │  │ Triggers     │    │
│  │   +10.5%     │  │     45       │  │      1       │    │
│  │ Estimated    │  │ 45 days ago  │  │ Retraining   │    │
│  │ performance  │  │              │  │ conditions   │    │
│  │ gain         │  │              │  │ met          │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
│  RETRAINING TRIGGERS                                        │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ [MEDIUM] Data Drift                                  │  │
│  │ 35.0% of features show significant distribution drift│  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  📋 Retraining Checklist                    0 / 8      0%   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  (Click to expand checklist)                                │
└─────────────────────────────────────────────────────────────┘
```

---

## Example 3: High Priority - Concept Drift

```tsx
<RetrainingRecommendations
  driftedFeaturesPercentage={0}
  conceptDriftDetected={true}
  performanceDegradationDays={0}
  daysSinceLastTraining={60}
/>
```

**Visual Output:**
```
┌─────────────────────────────────────────────────────────────┐
│  ⚠  Model Retraining Recommended           [HIGH]           │
│                                                             │
│  Model retraining recommended due to:                       │
│  concept drift detected.                                    │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Expected     │  │ Last         │  │ Active       │    │
│  │ Improvement  │  │ Training     │  │ Triggers     │    │
│  │   +10.0%     │  │     60       │  │      1       │    │
│  │ Estimated    │  │ 2 months ago │  │ Retraining   │    │
│  │ performance  │  │              │  │ conditions   │    │
│  │ gain         │  │              │  │ met          │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
│  RETRAINING TRIGGERS                                        │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ [HIGH] Concept Drift                                 │  │
│  │ Feature-target relationships have changed            │  │
│  │ significantly                                        │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  📋 Retraining Checklist                    0 / 9      0%   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  (Note: 9 items due to concept drift requiring             │
│   architecture review)                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Example 4: Critical Priority - Multiple Triggers

```tsx
<RetrainingRecommendations
  driftedFeaturesPercentage={55}
  conceptDriftDetected={true}
  performanceDegradationDays={15}
  daysSinceLastTraining={90}
/>
```

**Visual Output:**
```
┌─────────────────────────────────────────────────────────────┐
│  🚨 Model Retraining Recommended        [CRITICAL]          │
│                                                             │
│  Model retraining recommended due to:                       │
│  55.0% of features have drifted, concept drift detected,    │
│  performance degraded for 15 days.                          │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Expected     │  │ Last         │  │ Active       │    │
│  │ Improvement  │  │ Training     │  │ Triggers     │    │
│  │   +25.0%     │  │     90       │  │      3       │    │
│  │ Estimated    │  │ 3 months ago │  │ Retraining   │    │
│  │ performance  │  │              │  │ conditions   │    │
│  │ gain         │  │              │  │ met          │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
│  RETRAINING TRIGGERS                                        │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ [CRITICAL] Data Drift                                │  │
│  │ 55.0% of features show significant distribution drift│  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ [HIGH] Concept Drift                                 │  │
│  │ Feature-target relationships have changed            │  │
│  │ significantly                                        │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ [CRITICAL] Performance Degradation                   │  │
│  │ Performance degradation has persisted for 15 days    │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  📋 Retraining Checklist                    0 / 9      0%   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  ▼ (Expanded)                                               │
│                                                             │
│  ○ Review drift analysis and identify affected features    │
│     Analyze which features have drifted and understand     │
│     the root causes                                        │
│                                                             │
│  ○ Collect and validate new training data                  │
│     Ensure data quality and completeness for the           │
│     retraining period                                      │
│                                                             │
│  ○ Update feature engineering pipeline if needed           │
│     Adjust feature transformations based on drift patterns │
│                                                             │
│  ○ Review and update model architecture if needed          │
│     Consider model changes to capture new relationships    │
│                                                             │
│  ○ Retrain models with updated data                        │
│     Execute training pipeline with new data and            │
│     hyperparameters                                        │
│                                                             │
│  ○ Validate model performance on holdout set               │
│     Ensure new model meets performance thresholds          │
│                                                             │
│  ○ Run backtesting on recent historical data               │
│     Verify model performance on recent market conditions   │
│                                                             │
│  ○ Deploy new model to staging environment                 │
│     Test model in staging before production deployment     │
│                                                             │
│  ○ Monitor model performance post-deployment               │
│     Track metrics closely after deployment to production   │
│                                                             │
│  Note: This checklist provides a recommended workflow      │
│  for model retraining. Adjust steps based on your          │
│  specific requirements and organizational processes.       │
└─────────────────────────────────────────────────────────────┘
```

---

## Example 5: Checklist Interaction

When a user clicks on a checklist item, it toggles completion:

**Before Click:**
```
○ Review drift analysis and identify affected features
```

**After Click:**
```
✓ Review drift analysis and identify affected features
```

**Progress Updates:**
```
Before: 📋 Retraining Checklist    0 / 9    0%
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After:  📋 Retraining Checklist    1 / 9    11%
        ████━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After:  📋 Retraining Checklist    5 / 9    56%
        ████████████████████████████━━━━━━━━━━━━━━━━━━━━━━━━━━

After:  📋 Retraining Checklist    9 / 9    100%
        ████████████████████████████████████████████████████████
```

---

## Color Coding Reference

### Priority Colors

**Critical (Red)**
- Background: Light red (#fef2f2 light, #7f1d1d dark)
- Border: Red (#fecaca light, #991b1b dark)
- Text: Dark red (#dc2626 light, #fca5a5 dark)

**High (Orange)**
- Background: Light orange (#fff7ed light, #7c2d12 dark)
- Border: Orange (#fed7aa light, #9a3412 dark)
- Text: Dark orange (#ea580c light, #fdba74 dark)

**Medium (Yellow)**
- Background: Light yellow (#fefce8 light, #713f12 dark)
- Border: Yellow (#fef08a light, #854d0e dark)
- Text: Dark yellow (#ca8a04 light, #fde047 dark)

**Low (Blue)**
- Background: Light blue (#eff6ff light, #1e3a8a dark)
- Border: Blue (#bfdbfe light, #1e40af dark)
- Text: Dark blue (#2563eb light, #93c5fd dark)

### Status Colors

- **Success/Complete**: Green (#10b981)
- **Warning**: Yellow/Orange (based on priority)
- **Error/Critical**: Red (#dc2626)
- **Info**: Blue (#3b82f6)

---

## Responsive Behavior

### Desktop (> 768px)
- Three-column metrics grid
- Full-width triggers list
- Expanded checklist items with descriptions

### Mobile (≤ 768px)
- Single-column metrics grid
- Stacked triggers
- Compact checklist items
- Smaller font sizes
- Touch-friendly tap targets

---

## Dark Mode Comparison

### Light Mode
- White backgrounds (#ffffff)
- Dark text (#0f172a)
- Light borders (#e2e8f0)
- Subtle shadows

### Dark Mode
- Dark backgrounds (#1e293b, #0f172a)
- Light text (#f1f5f9)
- Dark borders (#334155)
- Darker priority backgrounds with transparency
