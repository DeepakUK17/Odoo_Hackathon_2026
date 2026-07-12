import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../store/AuthContext';
import { useSocket } from '../hooks/useSocket';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useSocket(user, (notif) => {
    setNotifications(prev => [notif, ...prev]);
  });

  useEffect(() => {
    api.get('/notifications')
      .then(res => setNotifications(res.data.notifications || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) { toast.error('Failed to mark as read'); }
  };

  const getIcon = (type) => {
    switch(type) {
      case 'overdue': return '⚠️';
      case 'warranty': return '🛡️';
      case 'allocation': return '📦';
      case 'maintenance': return '🔧';
      default: return '🔔';
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">Alerts, updates, and reminders</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={markAllRead}>Mark all as read</button>
        </div>
      </div>

      <div className="card">
        {loading ? <div className="skeleton" style={{ height: 400 }} /> : notifications.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">No notifications</div>
            <div className="empty-state-desc">You're all caught up!</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {notifications.map(n => (
              <div key={n.id} style={{
                display: 'flex', gap: 16, padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                background: n.is_read ? 'transparent' : 'var(--glass-hover)',
                transition: 'var(--transition)'
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: n.priority === 'high' ? 'rgba(255, 71, 87, 0.1)' : n.priority === 'medium' ? 'rgba(255, 107, 53, 0.1)' : 'rgba(108, 99, 255, 0.1)',
                  color: n.priority === 'high' ? 'var(--accent-red)' : n.priority === 'medium' ? 'var(--accent-orange)' : 'var(--accent-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0
                }}>
                  {getIcon(n.type)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: n.is_read ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{n.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(n.created_at).toLocaleString()}</div>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{n.message}</div>
                </div>
                {!n.is_read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', alignSelf: 'center' }} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
