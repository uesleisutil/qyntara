/**
 * API Key Management Component
 * 
 * Implements:
 * - Requirement 65.2: API key management UI
 * - Create, list, revoke, and rotate API keys
 * - Display API key details and usage statistics
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle, Copy, Eye, EyeOff, Key, Plus, RefreshCw, Trash2, Check } from 'lucide-react';

interface APIKey {
  apiKeyHash: string;
  name: string;
  createdAt: string;
  expiresAt: string;
  lastUsed: string | null;
  enabled: boolean;
  requestCount: number;
}

interface APIKeyManagementProps {
  apiEndpoint: string;
  authToken: string;
}

const APIKeyManagement: React.FC<APIKeyManagementProps> = ({ apiEndpoint, authToken }) => {
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyExpireDays, setNewKeyExpireDays] = useState(90);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showCreatedKey, setShowCreatedKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${apiEndpoint}/api/keys`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch API keys');
      }

      const data = await response.json();
      setKeys(data.keys || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const createKey = async () => {
    try {
      setError(null);

      const response = await fetch(`${apiEndpoint}/api/keys`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newKeyName,
          expiresDays: newKeyExpireDays
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create API key');
      }

      const data = await response.json();
      setCreatedKey(data.apiKey);
      setShowCreatedKey(true);
      setShowCreateModal(false);
      setNewKeyName('');
      setNewKeyExpireDays(90);

      // Refresh keys list
      await fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const revokeKey = async (keyHash: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    try {
      setError(null);

      const response = await fetch(`${apiEndpoint}/api/keys/${keyHash}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to revoke API key');
      }

      // Refresh keys list
      await fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const rotateKey = async (keyHash: string, name: string) => {
    if (!confirm('Are you sure you want to rotate this API key? The old key will be revoked.')) {
      return;
    }

    try {
      setError(null);

      const response = await fetch(`${apiEndpoint}/api/keys/${keyHash}/rotate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: `${name} (Rotated)` })
      });

      if (!response.ok) {
        throw new Error('Failed to rotate API key');
      }

      const data = await response.json();
      setCreatedKey(data.apiKey);
      setShowCreatedKey(true);

      // Refresh keys list
      await fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const daysUntilExpiry = (expiresAt: string) => {
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="api-key-management">
      <div className="header">
        <div>
          <h2>API Keys</h2>
          <p className="subtitle">Manage API keys for programmatic access to dashboard data</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
          aria-label="Create new API key"
        >
          <Plus size={16} />
          Create API Key
        </button>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {createdKey && (
        <div className="alert alert-success">
          <div className="alert-header">
            <Key size={16} />
            <strong>API Key Created Successfully</strong>
          </div>
          <p className="alert-message">
            Make sure to copy your API key now. You won't be able to see it again!
          </p>
          <div className="api-key-display">
            <code className="api-key-value">
              {showCreatedKey ? createdKey : '•'.repeat(50)}
            </code>
            <div className="api-key-actions">
              <button
                className="btn btn-icon"
                onClick={() => setShowCreatedKey(!showCreatedKey)}
                aria-label={showCreatedKey ? 'Hide API key' : 'Show API key'}
              >
                {showCreatedKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                className="btn btn-icon"
                onClick={() => copyToClipboard(createdKey)}
                aria-label="Copy API key"
              >
                {copiedKey ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setCreatedKey(null)}
          >
            I've saved my API key
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading API keys...</div>
      ) : keys.length === 0 ? (
        <div className="empty-state">
          <Key size={48} />
          <h3>No API Keys</h3>
          <p>Create your first API key to start accessing the API</p>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            Create API Key
          </button>
        </div>
      ) : (
        <div className="keys-list">
          {keys.map((key) => {
            const expired = isExpired(key.expiresAt);
            const daysLeft = daysUntilExpiry(key.expiresAt);
            const expiringSoon = daysLeft <= 7 && daysLeft > 0;

            return (
              <div
                key={key.apiKeyHash}
                className={`key-card ${!key.enabled || expired ? 'disabled' : ''}`}
              >
                <div className="key-header">
                  <div className="key-info">
                    <h3>{key.name}</h3>
                    <div className="key-meta">
                      <span className="key-hash">
                        {key.apiKeyHash.substring(0, 8)}...
                      </span>
                      {!key.enabled && (
                        <span className="badge badge-error">Revoked</span>
                      )}
                      {expired && (
                        <span className="badge badge-error">Expired</span>
                      )}
                      {expiringSoon && key.enabled && (
                        <span className="badge badge-warning">
                          Expires in {daysLeft} days
                        </span>
                      )}
                    </div>
                  </div>
                  {key.enabled && !expired && (
                    <div className="key-actions">
                      <button
                        className="btn btn-icon"
                        onClick={() => rotateKey(key.apiKeyHash, key.name)}
                        aria-label="Rotate API key"
                        title="Rotate API key"
                      >
                        <RefreshCw size={16} />
                      </button>
                      <button
                        className="btn btn-icon btn-danger"
                        onClick={() => revokeKey(key.apiKeyHash)}
                        aria-label="Revoke API key"
                        title="Revoke API key"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="key-details">
                  <div className="detail-item">
                    <span className="detail-label">Created:</span>
                    <span className="detail-value">{formatDate(key.createdAt)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Expires:</span>
                    <span className="detail-value">{formatDate(key.expiresAt)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Last Used:</span>
                    <span className="detail-value">
                      {key.lastUsed ? formatDate(key.lastUsed) : 'Never'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Requests:</span>
                    <span className="detail-value">{key.requestCount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create API Key</h3>
              <button
                className="btn btn-icon"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="key-name">
                  Name
                  <span className="required">*</span>
                </label>
                <input
                  id="key-name"
                  type="text"
                  className="form-control"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., Production API Key"
                  required
                />
                <small className="form-text">
                  A friendly name to help you identify this key
                </small>
              </div>

              <div className="form-group">
                <label htmlFor="expire-days">Expiration (days)</label>
                <select
                  id="expire-days"
                  className="form-control"
                  value={newKeyExpireDays}
                  onChange={(e) => setNewKeyExpireDays(Number(e.target.value))}
                >
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days (recommended)</option>
                  <option value={180}>180 days</option>
                  <option value={365}>1 year</option>
                </select>
                <small className="form-text">
                  API keys automatically expire after this period for security
                </small>
              </div>

              <div className="info-box">
                <AlertCircle size={16} />
                <div>
                  <strong>Important:</strong> You'll only see the API key once after creation.
                  Make sure to copy and store it securely.
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={createKey}
                disabled={!newKeyName.trim()}
              >
                Create API Key
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .api-key-management {
          padding: 24px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }

        h2 {
          margin: 0 0 8px 0;
          font-size: 24px;
          font-weight: 600;
        }

        .subtitle {
          margin: 0;
          color: #666;
          font-size: 14px;
        }

        .alert {
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .alert-error {
          background: #fee;
          color: #c00;
          border: 1px solid #fcc;
        }

        .alert-success {
          background: #efe;
          color: #060;
          border: 1px solid #cfc;
        }

        .alert-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .alert-message {
          margin: 0;
          font-size: 14px;
        }

        .api-key-display {
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          padding: 12px;
          border-radius: 6px;
          border: 1px solid #ddd;
        }

        .api-key-value {
          flex: 1;
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 13px;
          word-break: break-all;
        }

        .api-key-actions {
          display: flex;
          gap: 4px;
        }

        .empty-state {
          text-align: center;
          padding: 64px 24px;
          color: #666;
        }

        .empty-state svg {
          color: #ccc;
          margin-bottom: 16px;
        }

        .empty-state h3 {
          margin: 0 0 8px 0;
          font-size: 18px;
          color: #333;
        }

        .empty-state p {
          margin: 0 0 24px 0;
        }

        .keys-list {
          display: grid;
          gap: 16px;
        }

        .key-card {
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 20px;
        }

        .key-card.disabled {
          opacity: 0.6;
          background: #f6faf8;
        }

        .key-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .key-info h3 {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 600;
        }

        .key-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #666;
        }

        .key-hash {
          font-family: 'Monaco', 'Courier New', monospace;
        }

        .badge {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .badge-error {
          background: #fee;
          color: #c00;
        }

        .badge-warning {
          background: #ffc;
          color: #960;
        }

        .key-actions {
          display: flex;
          gap: 8px;
        }

        .key-details {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .detail-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .detail-value {
          font-size: 14px;
          font-weight: 500;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #3a7a60;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2a5a48;
        }

        .btn-secondary {
          background: #edf5f1;
          color: #333;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #d4e5dc;
        }

        .btn-icon {
          padding: 8px;
          background: transparent;
          color: #666;
        }

        .btn-icon:hover {
          background: #edf5f1;
          color: #333;
        }

        .btn-danger:hover {
          background: #fee;
          color: #c00;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 13px;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: white;
          border-radius: 12px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow: auto;
        }

        .modal-header {
          padding: 20px;
          border-bottom: 1px solid #eee;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 18px;
        }

        .modal-body {
          padding: 20px;
        }

        .modal-footer {
          padding: 20px;
          border-top: 1px solid #eee;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          font-size: 14px;
        }

        .required {
          color: #c00;
          margin-left: 4px;
        }

        .form-control {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
        }

        .form-control:focus {
          outline: none;
          border-color: #3a7a60;
          box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
        }

        .form-text {
          display: block;
          margin-top: 6px;
          font-size: 12px;
          color: #666;
        }

        .info-box {
          display: flex;
          gap: 12px;
          padding: 12px;
          background: #edf5f1;
          border: 1px solid #c8ede0;
          border-radius: 6px;
          font-size: 13px;
          color: #1a4038;
        }

        .loading {
          text-align: center;
          padding: 48px;
          color: #666;
        }
      `}</style>
    </div>
  );
};

export default APIKeyManagement;
