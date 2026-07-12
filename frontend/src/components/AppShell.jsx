import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../store/AuthContext';
import { useSocket } from '../hooks/useSocket';
import api from '../services/api';

const NAV_ITEMS = [
  { path: '/dashboard',    label: 'Dashboard',       icon: '⊡', section: 'Main' },
  { path: '/ai-assistant', label: 'AI Assistant',    icon: '✦', section: 'Main', badge: 'AI' },
  { path: '/assets',       label: 'Assets',          icon: '◈', section: 'Management' },
  { path: '/allocation',   label: 'Allocation',      icon: '↗', section: 'Management' },
  { path: '/maintenance',  label: 'Maintenance',      icon: '⚙', section: 'Management' },
  { path: '/booking',      label: 'Booking',         icon: '⊟', section: 'Management' },
  { path: '/audit',        label: 'Audit',           icon: '✓', section: 'Management' },
  { path: '/reports',      label: 'Reports',         icon: '⊞', section: 'Analytics' },
  { path: '/notifications',label: 'Notifications',   icon: '🔔', section: 'Analytics' },
  { path: '/org-setup',    label: 'Organization',    icon: '◻', section: 'Settings' },
];

const SECTIONS = ['Main', 'Management', 'Analytics', 'Settings'];

export default function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const addToast = (notification) => {
    const id = Date.now();
    setToasts(prev => [...prev, { ...notification, id }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  useSocket(user, (notif) => {
    setUnreadCount(c => c + 1);
    addToast(notif);
  });

  useEffect(() => {
    if (user) {
      api.get('/notifications?is_read=false')
        .then(res => setUnreadCount(res.data.unreadCount || 0))
        .catch(() => {});
    }
  }, [user]);

  // Global search
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults(null); return; }
    const timeout = setTimeout(async () => {
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(res.data);
      } catch {}
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const isActive = (path) => location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path));

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">AF</div>
          {!collapsed && <span className="sidebar-logo-text">AssetFlow</span>}
        </div>
        <nav className="sidebar-nav">
          {SECTIONS.map(section => {
            const items = NAV_ITEMS.filter(n => n.section === section);
            return (
              <div key={section}>
                {!collapsed && <div className="sidebar-section-label">{section}</div>}
                {items.map(item => (
                  <div
                    key={item.path}
                    id={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                    className={`nav-item${isActive(item.path) ? ' active' : ''}`}
                    onClick={() => navigate(item.path)}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="nav-icon" style={{ fontSize: 16 }}>{item.icon}</span>
                    {!collapsed && <span>{item.label}</span>}
                    {!collapsed && item.badge === 'AI' && (
                      <span className="nav-badge" style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-green))', fontSize: '9px' }}>AI</span>
                    )}
                    {!collapsed && item.path === '/notifications' && unreadCount > 0 && (
                      <span className="nav-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </nav>
        {/* User card */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
          {!collapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent), var(--accent-green))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0
              }}>
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{user?.role}</div>
              </div>
              <button id="logout-btn" onClick={logout} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer' }} title="Logout">⏻</button>
            </div>
          ) : (
            <div onClick={logout} style={{ display:'flex', justifyContent:'center', color:'var(--text-muted)', cursor:'pointer' }}>⏻</div>
          )}
        </div>
        {/* Collapse toggle */}
        <button
          id="sidebar-toggle"
          onClick={() => setCollapsed(c => !c)}
          style={{
            position: 'absolute', right: -12, top: '50%', transform: 'translateY(-50%)',
            width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-card)',
            border: '1px solid var(--border)', color: 'var(--text-muted)',
            fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'var(--transition)',
          }}
        >{collapsed ? '›' : '‹'}</button>
      </aside>

      {/* Main area */}
      <div className={`main-content${collapsed ? ' sidebar-collapsed' : ''}`}>
        {/* Topbar */}
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="search-container">
              <span className="search-icon">🔍</span>
              <input
                id="global-search"
                className="input search-input"
                placeholder="Search assets, employees..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onBlur={() => setTimeout(() => { setSearchQuery(''); setSearchResults(null); }, 200)}
              />
              {searchResults && (
                <div className="search-results-dropdown">
                  {[
                    ...searchResults.assets.map(a => ({ type: 'asset', label: `${a.tag} — ${a.name}`, sub: a.status, id: a.id })),
                    ...searchResults.employees.map(e => ({ type: 'employee', label: e.name, sub: e.email, id: e.id })),
                    ...searchResults.departments.map(d => ({ type: 'dept', label: d.name, sub: 'Department', id: d.id })),
                  ].map((item, i) => (
                    <div key={i} className="search-result-item" onClick={() => {
                      if (item.type === 'asset') navigate(`/assets/${item.id}`);
                      setSearchQuery(''); setSearchResults(null);
                    }}>
                      <span style={{ fontSize: 18 }}>{item.type === 'asset' ? '◈' : item.type === 'employee' ? '👤' : '◻'}</span>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{item.label}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.type} • {item.sub}</div>
                      </div>
                    </div>
                  ))}
                  {!searchResults.assets.length && !searchResults.employees.length && !searchResults.departments.length && (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No results found</div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button id="notifications-btn" className="btn btn-secondary btn-icon" onClick={() => navigate('/notifications')} style={{ position: 'relative' }}>
              🔔
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  background: 'var(--accent-red)', color: 'white',
                  fontSize: 9, fontWeight: 700, padding: '1px 5px',
                  borderRadius: 'var(--radius-pill)', minWidth: 16
                }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="page-container animate-fadeIn">
          <Outlet />
        </div>
      </div>

      {/* Toast container */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.priority === 'high' ? 'error' : toast.priority === 'low' ? 'success' : 'warning'}`}>
            <span>🔔</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 2 }}>{toast.title}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{toast.message?.substring(0, 80)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
