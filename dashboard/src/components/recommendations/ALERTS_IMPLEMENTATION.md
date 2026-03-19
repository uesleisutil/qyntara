# Configurable Ticker Alerts Implementation

## Overview

This document describes the implementation of configurable ticker alerts for the B3 Tactical Ranking Dashboard, completing task 3.10 from the dashboard-complete-enhancement spec.

## Requirements Addressed

- **5.1**: Alert configuration interface for tickers
- **5.2**: Alert creation with ticker, condition type, and threshold
- **5.3**: Support for score change, return change, and rank change conditions
- **5.4**: Display notifications in notification center when triggered
- **5.5**: Persist alert configurations across user sessions (DynamoDB)
- **5.6**: Allow users to edit existing alerts
- **5.7**: Allow users to delete alerts
- **5.8**: Display active alerts in alerts management panel

## Architecture

### Frontend Components

#### 1. AlertConfigModal (`AlertConfigModal.jsx`)
- Modal for creating and editing alerts
- Form validation for ticker, condition type, and threshold
- Support for three condition types:
  - `score_change`: Alert when score changes by threshold amount
  - `return_change`: Alert when expected return changes by threshold percentage
  - `rank_change`: Alert when ranking position changes by threshold positions
- Edit and delete functionality for existing alerts

#### 2. AlertsPanel (`AlertsPanel.jsx`)
- Displays all configured alerts for the user
- Shows triggered alerts prominently at the top
- Allows editing and deleting alerts
- Integrates with API for DynamoDB persistence
- Falls back to localStorage if API is unavailable
- Refresh button to reload alerts from server

#### 3. NotificationCenter (`NotificationCenter.jsx`)
- Bell icon with unread count badge
- Dropdown panel showing all notifications
- Displays triggered alert notifications
- Mark as read functionality (individual and bulk)
- Delete notifications
- Timestamp formatting (relative time)
- Icon differentiation by notification type

### Backend API

#### 1. Alert Management (`ml/src/api/alerts_handler.py`)

Lambda handler for alert CRUD operations:

**Endpoints:**
- `GET /api/alerts` - Get all alerts for user
- `POST /api/alerts` - Create new alert
- `PUT /api/alerts/{alertId}` - Update alert
- `DELETE /api/alerts/{alertId}` - Delete alert
- `POST /api/alerts/check` - Check for triggered alerts

**DynamoDB Schema (Alerts Table):**
```python
{
  'userId': str,           # Partition key
  'alertId': str,          # Sort key (UUID)
  'ticker': str,           # Stock ticker symbol
  'conditionType': str,    # 'score_change', 'return_change', 'rank_change'
  'threshold': float,      # Threshold value for triggering
  'enabled': bool,         # Whether alert is active
  'createdAt': str,        # ISO timestamp
  'updatedAt': str,        # ISO timestamp
  'lastValue': float,      # Last observed value (for comparison)
  'triggered': bool        # Whether alert is currently triggered
}
```

**Features:**
- Input validation for all fields
- User authentication via Cognito
- Automatic notification creation when alerts trigger
- Condition checking logic for all three alert types

#### 2. Notification Management (`ml/src/api/notifications_handler.py`)

Lambda handler for notification operations:

**Endpoints:**
- `GET /api/notifications` - Get all notifications for user
- `PUT /api/notifications/{notificationId}/read` - Mark notification as read
- `PUT /api/notifications/read-all` - Mark all notifications as read
- `DELETE /api/notifications/{notificationId}` - Delete notification

**DynamoDB Schema (Notifications Table):**
```python
{
  'userId': str,              # Partition key
  'notificationId': str,      # Sort key (UUID)
  'type': str,                # 'info', 'warning', 'critical'
  'category': str,            # 'alert', 'drift', 'anomaly', 'cost', 'performance', 'system'
  'title': str,               # Notification title
  'message': str,             # Notification message
  'timestamp': str,           # ISO timestamp
  'read': bool,               # Whether notification has been read
  'alertId': str              # Optional: related alert ID
}
```

**Features:**
- Sorted by timestamp (newest first)
- Limited to last 100 notifications
- Bulk operations support
- Unread count calculation

### API Service Updates

Updated `dashboard/src/services/api.js` with new endpoints:

```javascript
api.alerts = {
  getAll: () => api.get('/api/alerts'),
  create: (alertData) => api.post('/api/alerts', alertData),
  update: (alertId, alertData) => api.put(`/api/alerts/${alertId}`, alertData),
  delete: (alertId) => api.delete(`/api/alerts/${alertId}`),
  checkTriggered: (recommendations) => api.post('/api/alerts/check', { recommendations })
};

api.notifications = {
  getAll: () => api.get('/api/notifications'),
  markAsRead: (notificationId) => api.put(`/api/notifications/${notificationId}/read`),
  markAllAsRead: () => api.put('/api/notifications/read-all'),
  delete: (notificationId) => api.delete(`/api/notifications/${notificationId}`)
};
```

## Data Flow

### Alert Creation Flow
1. User clicks "Novo Alerta" button in AlertsPanel
2. AlertConfigModal opens with empty form
3. User fills in ticker, condition type, and threshold
4. On save, frontend calls `api.alerts.create(alertData)`
5. Backend Lambda validates input and stores in DynamoDB
6. Frontend updates local state and closes modal
7. Alert appears in AlertsPanel list

### Alert Triggering Flow
1. RecommendationsPage loads new recommendations data
2. AlertsPanel receives recommendations as prop
3. AlertsPanel calls `api.alerts.checkTriggered(recommendations)`
4. Backend Lambda:
   - Retrieves user's alerts from DynamoDB
   - Compares current values with thresholds
   - Creates notifications for triggered alerts
   - Returns list of triggered alerts
5. Frontend displays triggered alerts prominently
6. NotificationCenter shows new notifications with badge

### Notification Display Flow
1. User clicks bell icon in NotificationCenter
2. Component calls `api.notifications.getAll()`
3. Backend retrieves notifications from DynamoDB
4. Frontend displays notifications in dropdown panel
5. User can mark as read or delete
6. Unread count updates in real-time

## Alert Condition Logic

### Score Change
```python
current_score = ticker.confidence_score
previous_score = alert.lastValue
diff = abs(current_score - previous_score)
triggered = diff >= alert.threshold
```

### Return Change
```python
current_return = ticker.expected_return * 100  # Convert to percentage
previous_return = alert.lastValue
diff = abs(current_return - previous_return)
triggered = diff >= alert.threshold
```

### Rank Change
```python
current_rank = ticker.rank
previous_rank = alert.lastValue
diff = abs(current_rank - previous_rank)
triggered = diff >= alert.threshold
```

## Fallback Strategy

The implementation includes graceful degradation:

1. **Primary**: DynamoDB via API Gateway + Lambda
2. **Fallback**: localStorage for client-side persistence
3. **Error Handling**: User-friendly error messages with retry options

If API calls fail:
- AlertsPanel loads from localStorage
- User can still create/edit/delete alerts locally
- Data syncs when API becomes available

## Integration Points

### RecommendationsPage
```jsx
<AlertsPanel recommendations={filteredRecommendations} />
```

### App Header (for NotificationCenter)
```jsx
import { NotificationCenter } from './components/shared';

// In header
<NotificationCenter />
```

## Testing Considerations

### Unit Tests
- Alert validation logic
- Condition checking algorithms
- API error handling
- localStorage fallback

### Integration Tests
- Alert creation flow
- Alert triggering with mock recommendations
- Notification display
- Mark as read functionality

### E2E Tests
- Complete alert lifecycle (create → trigger → notify → delete)
- Multiple alerts with different conditions
- Notification center interactions

## Deployment Requirements

### DynamoDB Tables

Create two tables:

**Alerts Table:**
```
Table Name: B3TacticalRanking-Alerts
Partition Key: userId (String)
Sort Key: alertId (String)
```

**Notifications Table:**
```
Table Name: B3TacticalRanking-Notifications
Partition Key: userId (String)
Sort Key: notificationId (String)
TTL Attribute: ttl (Number) - Optional, for auto-cleanup after 30 days
```

### Lambda Functions

Deploy two Lambda functions:

1. **AlertsHandler**
   - Runtime: Python 3.11
   - Handler: alerts_handler.lambda_handler
   - Environment Variables:
     - `ALERTS_TABLE`: B3TacticalRanking-Alerts
     - `NOTIFICATIONS_TABLE`: B3TacticalRanking-Notifications
   - IAM Permissions: DynamoDB read/write on both tables

2. **NotificationsHandler**
   - Runtime: Python 3.11
   - Handler: notifications_handler.lambda_handler
   - Environment Variables:
     - `NOTIFICATIONS_TABLE`: B3TacticalRanking-Notifications
   - IAM Permissions: DynamoDB read/write on notifications table

### API Gateway Routes

Add routes to existing API Gateway:

```
POST   /api/alerts
GET    /api/alerts
PUT    /api/alerts/{alertId}
DELETE /api/alerts/{alertId}
POST   /api/alerts/check

GET    /api/notifications
PUT    /api/notifications/{notificationId}/read
PUT    /api/notifications/read-all
DELETE /api/notifications/{notificationId}
```

All routes should:
- Use Cognito authorizer for authentication
- Enable CORS
- Integrate with respective Lambda functions

## Future Enhancements

1. **Email/SMS Notifications**: Integrate with SNS for external notifications
2. **Alert History**: Track when alerts were triggered historically
3. **Alert Templates**: Pre-configured alert templates for common scenarios
4. **Batch Operations**: Create multiple alerts at once
5. **Alert Groups**: Organize alerts by portfolio or strategy
6. **Advanced Conditions**: Support for complex conditions (AND/OR logic)
7. **Snooze Functionality**: Temporarily disable alerts
8. **Alert Analytics**: Dashboard showing alert effectiveness

## Conclusion

This implementation provides a complete, production-ready alert system that:
- ✅ Meets all requirements (5.1-5.8)
- ✅ Stores data persistently in DynamoDB
- ✅ Displays notifications in a dedicated notification center
- ✅ Supports all three condition types
- ✅ Includes comprehensive error handling
- ✅ Provides graceful degradation
- ✅ Follows AWS best practices
- ✅ Maintains clean separation of concerns

The system is ready for deployment pending infrastructure setup (DynamoDB tables and Lambda functions).
