import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  TextField,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  Tooltip,
  Switch,
  Tabs,
  Tab
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  PlayArrow as TestIcon,
  Refresh as RefreshIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

interface Webhook {
  webhook_id: string;
  url: string;
  events: string[];
  enabled: boolean;
  created_at: string;
  total_deliveries?: number;
  successful_deliveries?: number;
  failed_deliveries?: number;
  consecutive_failures?: number;
}

interface WebhookStatistics {
  webhook_id: string;
  total_deliveries: number;
  successful_deliveries: number;
  failed_deliveries: number;
  success_rate: number;
  consecutive_failures: number;
  last_failure_at: string | null;
  recent_success_rate: number;
  avg_response_time_ms: number;
  enabled: boolean;
}

interface DeliveryLog {
  webhook_id: string;
  event_type: string;
  timestamp: string;
  success: boolean;
  attempts: number;
  status_code?: number;
  response_time_ms?: number;
  error?: string;
  is_test: boolean;
}

const SUPPORTED_EVENTS = [
  { id: 'drift.data_drift_detected', label: 'Data Drift Detected', category: 'Drift Detection' },
  { id: 'drift.concept_drift_detected', label: 'Concept Drift Detected', category: 'Drift Detection' },
  { id: 'performance.degradation_detected', label: 'Performance Degradation', category: 'Performance' },
  { id: 'performance.accuracy_below_threshold', label: 'Accuracy Below Threshold', category: 'Performance' },
  { id: 'cost.budget_exceeded', label: 'Budget Exceeded', category: 'Cost Alerts' },
  { id: 'cost.spike_detected', label: 'Cost Spike Detected', category: 'Cost Alerts' },
  { id: 'data_quality.completeness_below_threshold', label: 'Completeness Below Threshold', category: 'Data Quality' },
  { id: 'data_quality.anomaly_detected', label: 'Anomaly Detected', category: 'Data Quality' },
  { id: 'data_quality.freshness_warning', label: 'Data Freshness Warning', category: 'Data Quality' }
];

const WebhookManagement: React.FC = () => {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState<Webhook | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [statistics, setStatistics] = useState<WebhookStatistics | null>(null);
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [activeTab, setActiveTab] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    url: '',
    events: [] as string[],
    enabled: true
  });

  useEffect(() => {
    loadWebhooks();
  }, []);

  const loadWebhooks = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/webhooks', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load webhooks');
      }

      const data = await response.json();
      setWebhooks(data.data.webhooks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (webhook?: Webhook) => {
    if (webhook) {
      setEditingWebhook(webhook);
      setFormData({
        url: webhook.url,
        events: webhook.events,
        enabled: webhook.enabled
      });
    } else {
      setEditingWebhook(null);
      setFormData({
        url: '',
        events: [],
        enabled: true
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingWebhook(null);
    setFormData({
      url: '',
      events: [],
      enabled: true
    });
  };

  const handleSaveWebhook = async () => {
    try {
      const url = editingWebhook
        ? `/api/webhooks/${editingWebhook.webhook_id}`
        : '/api/webhooks';
      
      const method = editingWebhook ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to save webhook');
      }

      await loadWebhooks();
      handleCloseDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save webhook');
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!window.confirm('Are you sure you want to delete this webhook?')) {
      return;
    }

    try {
      const response = await fetch(`/api/webhooks/${webhookId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete webhook');
      }

      await loadWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete webhook');
    }
  };

  const handleToggleWebhook = async (webhook: Webhook) => {
    try {
      const response = await fetch(`/api/webhooks/${webhook.webhook_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          enabled: !webhook.enabled
        })
      });

      if (!response.ok) {
        throw new Error('Failed to toggle webhook');
      }

      await loadWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle webhook');
    }
  };

  const handleTestWebhook = async (webhook: Webhook) => {
    setTestingWebhook(webhook);
    setTestResult(null);
    setTestDialogOpen(true);

    try {
      const response = await fetch(`/api/webhooks/${webhook.webhook_id}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({})
      });

      const data = await response.json();
      setTestResult(data.data);
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Test failed'
      });
    }
  };

  const handleViewDetails = async (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setActiveTab(0);

    // Load statistics
    try {
      const statsResponse = await fetch(`/api/webhooks/${webhook.webhook_id}/statistics`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const statsData = await statsResponse.json();
      setStatistics(statsData.data);
    } catch (err) {
      console.error('Failed to load statistics:', err);
    }

    // Load logs
    try {
      const logsResponse = await fetch(`/api/webhooks/${webhook.webhook_id}/logs`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const logsData = await logsResponse.json();
      setLogs(logsData.data.logs || []);
    } catch (err) {
      console.error('Failed to load logs:', err);
    }
  };

  const handleEventToggle = (eventId: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter(e => e !== eventId)
        : [...prev.events, eventId]
    }));
  };

  const groupEventsByCategory = () => {
    const grouped: Record<string, typeof SUPPORTED_EVENTS> = {};
    SUPPORTED_EVENTS.forEach(event => {
      if (!grouped[event.category]) {
        grouped[event.category] = [];
      }
      grouped[event.category].push(event);
    });
    return grouped;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Webhook Management</Typography>
        <Box>
          <Button
            startIcon={<RefreshIcon />}
            onClick={loadWebhooks}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Webhook
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>URL</TableCell>
              <TableCell>Events</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Deliveries</TableCell>
              <TableCell>Success Rate</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {webhooks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="textSecondary">
                    No webhooks configured. Click "Add Webhook" to create one.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              webhooks.map((webhook) => {
                const successRate = webhook.total_deliveries
                  ? ((webhook.successful_deliveries || 0) / webhook.total_deliveries * 100).toFixed(1)
                  : 'N/A';

                return (
                  <TableRow key={webhook.webhook_id}>
                    <TableCell>
                      <Tooltip title={webhook.url}>
                        <Typography noWrap sx={{ maxWidth: 200 }}>
                          {webhook.url}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {webhook.events.slice(0, 2).map(event => (
                          <Chip
                            key={event}
                            label={SUPPORTED_EVENTS.find(e => e.id === event)?.label || event}
                            size="small"
                          />
                        ))}
                        {webhook.events.length > 2 && (
                          <Chip
                            label={`+${webhook.events.length - 2} more`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Switch
                          checked={webhook.enabled}
                          onChange={() => handleToggleWebhook(webhook)}
                          size="small"
                        />
                        {webhook.enabled ? (
                          <Chip label="Enabled" color="success" size="small" />
                        ) : (
                          <Chip label="Disabled" color="default" size="small" />
                        )}
                        {webhook.consecutive_failures && webhook.consecutive_failures > 0 && (
                          <Tooltip title={`${webhook.consecutive_failures} consecutive failures`}>
                            <WarningIcon color="warning" fontSize="small" aria-label={`${webhook.consecutive_failures} consecutive failures`} />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>{webhook.total_deliveries || 0}</TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        {successRate}%
                        {successRate !== 'N/A' && parseFloat(successRate) >= 95 && (
                          <SuccessIcon color="success" fontSize="small" />
                        )}
                        {successRate !== 'N/A' && parseFloat(successRate) < 80 && (
                          <ErrorIcon color="error" fontSize="small" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={1}>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            aria-label="View Details"
                            onClick={() => handleViewDetails(webhook)}
                          >
                            <RefreshIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Test Webhook">
                          <IconButton
                            size="small"
                            aria-label="Test Webhook"
                            onClick={() => handleTestWebhook(webhook)}
                          >
                            <TestIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            aria-label="Edit"
                            onClick={() => handleOpenDialog(webhook)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            aria-label="Delete"
                            onClick={() => handleDeleteWebhook(webhook.webhook_id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingWebhook ? 'Edit Webhook' : 'Create Webhook'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Webhook URL"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://example.com/webhook"
              helperText="The URL where webhook events will be sent"
              sx={{ mb: 3 }}
            />

            <FormControl component="fieldset" fullWidth>
              <FormLabel component="legend">Select Events</FormLabel>
              <Typography variant="caption" color="textSecondary" sx={{ mb: 2 }}>
                Choose which events should trigger this webhook
              </Typography>
              {Object.entries(groupEventsByCategory()).map(([category, events]) => (
                <Box key={category} sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                    {category}
                  </Typography>
                  <FormGroup>
                    {events.map(event => (
                      <FormControlLabel
                        key={event.id}
                        control={
                          <Checkbox
                            checked={formData.events.includes(event.id)}
                            onChange={() => handleEventToggle(event.id)}
                          />
                        }
                        label={event.label}
                      />
                    ))}
                  </FormGroup>
                </Box>
              ))}
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                />
              }
              label="Enable webhook"
              sx={{ mt: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSaveWebhook}
            variant="contained"
            disabled={!formData.url || formData.events.length === 0}
          >
            {editingWebhook ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test Dialog */}
      <Dialog open={testDialogOpen} onClose={() => setTestDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Test Webhook</DialogTitle>
        <DialogContent>
          {testingWebhook && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Testing webhook: {testingWebhook.url}
              </Typography>
              {testResult ? (
                <Box sx={{ mt: 2 }}>
                  {testResult.success ? (
                    <Alert severity="success">
                      <Typography variant="subtitle2">Test successful!</Typography>
                      <Typography variant="body2">
                        Status Code: {testResult.status_code}
                      </Typography>
                      <Typography variant="body2">
                        Response Time: {testResult.response_time_ms}ms
                      </Typography>
                    </Alert>
                  ) : (
                    <Alert severity="error">
                      <Typography variant="subtitle2">Test failed</Typography>
                      <Typography variant="body2">
                        {testResult.error || 'Unknown error'}
                      </Typography>
                    </Alert>
                  )}
                </Box>
              ) : (
                <Box display="flex" justifyContent="center" sx={{ mt: 2 }}>
                  <CircularProgress />
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Details Dialog */}
      <Dialog
        open={selectedWebhook !== null}
        onClose={() => setSelectedWebhook(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Webhook Details</DialogTitle>
        <DialogContent>
          {selectedWebhook && (
            <Box sx={{ pt: 2 }}>
              <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
                <Tab label="Statistics" />
                <Tab label="Delivery Logs" />
              </Tabs>

              {activeTab === 0 && statistics && (
                <Box sx={{ mt: 3 }}>
                  <Card sx={{ mb: 2 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Delivery Statistics
                      </Typography>
                      <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" gap={2}>
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            Total Deliveries
                          </Typography>
                          <Typography variant="h4">
                            {statistics.total_deliveries}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            Success Rate
                          </Typography>
                          <Typography variant="h4" color={statistics.success_rate >= 95 ? 'success.main' : 'error.main'}>
                            {statistics.success_rate.toFixed(1)}%
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            Avg Response Time
                          </Typography>
                          <Typography variant="h4">
                            {statistics.avg_response_time_ms}ms
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            Consecutive Failures
                          </Typography>
                          <Typography variant="h4" color={statistics.consecutive_failures > 0 ? 'warning.main' : 'inherit'}>
                            {statistics.consecutive_failures}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              )}

              {activeTab === 1 && (
                <Box sx={{ mt: 3 }}>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Timestamp</TableCell>
                          <TableCell>Event Type</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Attempts</TableCell>
                          <TableCell>Response Time</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {logs.map((log, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              {new Date(log.timestamp).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={log.event_type}
                                size="small"
                                color={log.is_test ? 'default' : 'primary'}
                              />
                            </TableCell>
                            <TableCell>
                              {log.success ? (
                                <Chip label="Success" color="success" size="small" icon={<SuccessIcon />} />
                              ) : (
                                <Tooltip title={log.error || 'Unknown error'}>
                                  <Chip label="Failed" color="error" size="small" icon={<ErrorIcon />} />
                                </Tooltip>
                              )}
                            </TableCell>
                            <TableCell>{log.attempts}</TableCell>
                            <TableCell>
                              {log.response_time_ms ? `${log.response_time_ms}ms` : 'N/A'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedWebhook(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WebhookManagement;
