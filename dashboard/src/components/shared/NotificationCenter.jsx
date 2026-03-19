/**
 * NotificationCenter Component
 * 
 * Displays notifications including triggered alerts:
 * - Shows unread notifications with badge
 * - Allows marking notifications as read
 * - Displays alert notifications when conditions are met
 * - Supports notification deletion
 * 
 * Requirements: 5.4
 */

import React, { useState, useEffect } from 'react';
import { Bell, X, Check, AlertCircle, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import api from '../../services/api';

const NotificationCenter = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load notifications
  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const loadNotifications = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await api.notifications.getAll();
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setError('Falha ao carregar notificações');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await api.notifications.markAsRead(notificationId);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.notifications.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await api.notifications.delete(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type, category) => {
    if (category === 'alert') {
      return <AlertCircle size={20} color="#dc2626" />;
    }
    
    switch (type) {
      case 'critical':
        return <AlertCircle size={20} color="#dc2626" />;
      case 'warning':
        return <AlertCircle size={20} color="#f59e0b" />;
      default:
        return <Bell size={20} color="#3b82f6" />;
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}m atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          padding: '0.5rem',
          backgroundColor: isOpen ? '#eff6ff' : 'transparent',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background-color 0.2s'
        }}
        aria-label="Notificações"
      >
        <Bell size={20} color={isOpen ? '#3b82f6' : '#64748b'} />
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '0.25rem',
            right: '0.25rem',
            backgroundColor: '#dc2626',
            color: 'white',
            fontSize: '0.625rem',
            fontWeight: 'bold',
            borderRadius: '9999px',
            minWidth: '1rem',
            height: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 0.25rem'
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999
            }}
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 0.5rem)',
            right: 0,
            width: '400px',
            maxWidth: '90vw',
            maxHeight: '500px',
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ 
                margin: 0, 
                fontSize: '1rem', 
                fontWeight: '600', 
                color: '#1e293b' 
              }}>
                Notificações
                {unreadCount > 0 && (
                  <span style={{ 
                    marginLeft: '0.5rem', 
                    color: '#64748b', 
                    fontSize: '0.875rem',
                    fontWeight: 'normal'
                  }}>
                    ({unreadCount} não lidas)
                  </span>
                )}
              </h3>
              
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: 'transparent',
                    color: '#3b82f6',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>

            {/* Content */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '0.5rem'
            }}>
              {loading && (
                <div style={{ 
                  padding: '2rem', 
                  textAlign: 'center', 
                  color: '#64748b',
                  fontSize: '0.875rem'
                }}>
                  Carregando...
                </div>
              )}

              {error && (
                <div style={{ 
                  padding: '1rem', 
                  margin: '0.5rem',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  color: '#dc2626',
                  fontSize: '0.875rem'
                }}>
                  {error}
                </div>
              )}

              {!loading && !error && notifications.length === 0 && (
                <div style={{ 
                  padding: '2rem', 
                  textAlign: 'center', 
                  color: '#64748b',
                  fontSize: '0.875rem'
                }}>
                  Nenhuma notificação
                </div>
              )}

              {!loading && !error && notifications.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {notifications.map(notification => (
                    <div
                      key={notification.id}
                      style={{
                        padding: '0.75rem',
                        backgroundColor: notification.read ? 'white' : '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      onClick={() => !notification.read && handleMarkAsRead(notification.id)}
                    >
                      <div style={{ 
                        display: 'flex', 
                        gap: '0.75rem',
                        alignItems: 'flex-start'
                      }}>
                        {/* Icon */}
                        <div style={{ flexShrink: 0, marginTop: '0.125rem' }}>
                          {getNotificationIcon(notification.type, notification.category)}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '0.25rem'
                          }}>
                            <h4 style={{ 
                              margin: 0, 
                              fontSize: '0.875rem', 
                              fontWeight: '600',
                              color: '#1e293b'
                            }}>
                              {notification.title}
                            </h4>
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(notification.id);
                              }}
                              style={{
                                padding: '0.25rem',
                                backgroundColor: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#94a3b8',
                                flexShrink: 0
                              }}
                              aria-label="Excluir notificação"
                            >
                              <X size={14} />
                            </button>
                          </div>

                          <p style={{ 
                            margin: '0 0 0.5rem 0', 
                            fontSize: '0.75rem', 
                            color: '#64748b',
                            lineHeight: '1.4'
                          }}>
                            {notification.message}
                          </p>

                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <span style={{ 
                              fontSize: '0.625rem', 
                              color: '#94a3b8' 
                            }}>
                              {formatTimestamp(notification.timestamp)}
                            </span>

                            {!notification.read && (
                              <span style={{
                                width: '6px',
                                height: '6px',
                                backgroundColor: '#3b82f6',
                                borderRadius: '9999px'
                              }} />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;
