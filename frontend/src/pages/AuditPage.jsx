import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { useAuth } from '../store/AuthContext';

const STATUS_COLORS = {
  pending:  { bg: 'rgba(255,211,42,0.1)',  color: '#FFD32A', label: '⏳ Pending'  },
  verified: { bg: 'rgba(0,212,170,0.1)',   color: '#00D4AA', label: '✅ Verified' },
  missing:  { bg: 'rgba(255,71,87,0.1)',   color: '#FF4757', label: '❌ Missing'  },
  damaged:  { bg: 'rgba(255,107,53,0.1)',  color: '#FF6B35', label: '⚠️ Damaged'  },
};

export default function AuditPage() {
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';

  const [audits, setAudits] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('audits');

  const [expandedAudit, setExpandedAudit] = useState(null);
  const [auditItems, setAuditItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [form, setForm] = useState({});
  const [departments, setDepartments] = useState([]);

  const loadAudits = async () => {
    setLoading(true);
    try {
      const [auditRes, logRes] = await Promise.all([
        api.get('/audits'),
        isEmployee ? Promise.resolve({ data: [] }) : api.get('/activity-logs?entity_type=audit'),
      ]);
      setAudits(auditRes.data);
      setLogs(logRes.data);
    } catch (err) {
      toast.error('Failed to load audit data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAudits(); }, []);

  const openAuditItems = async (audit) => {
    if (expandedAudit?.id === audit.id) { setExpandedAudit(null); setAuditItems([]); return; }
    setExpandedAudit(audit);
    setItemsLoading(true);
    try {
      const res = await api.get(`/audits/${audit.id}/items`);
      setAuditItems(res.data);
    } catch (err) {
      toast.error('Failed to load audit items');
    } finally {
      setItemsLoading(false);
    }
  };

  const handleVerifyItem = async (auditId, itemId, status, notes = '') => {
    try {
      await api.patch(`/audits/${auditId}/items/${itemId}`, { verification_status: status, notes });
      toast.success(`Marked as ${status}`);
      // Refresh items
      const res = await api.get(`/audits/${auditId}/items`);
      setAuditItems(res.data);
      // Refresh audit counts
      loadAudits();
    } catch (err) {
      toast.error(err.error || 'Failed to update item');
    }
  };

  const openCreateModal = async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data);
      setForm({});
      setIsModalOpen(true);
    } catch { setIsModalOpen(true); }
  };

  const handleCreateAudit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      await api.post('/audits', form);
      setIsModalOpen(false);
      toast.success('Audit scheduled and assets auto-populated!');
      loadAudits();
    } catch (err) { toast.error(err.error || 'Failed to schedule audit'); }
    finally { setFormSubmitting(false); }
  };

  const handleCloseAudit = async (auditId) => {
    try {
      await api.patch(`/audits/${auditId}/close`);
      toast.success('Audit closed successfully');
      loadAudits();
    } catch (err) { toast.error('Failed to close audit'); }
  };

  const progressPct = (audit) => {
    const total = parseInt(audit.total_items) || 0;
    const done = parseInt(audit.verified_count) + parseInt(audit.missing_count) + parseInt(audit.damaged_count) || 0;
    return total > 0 ? Math.round((done / total) * 100) : 0;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isEmployee ? 'My Asset Audits' : 'Compliance & Auditing'}</h1>
          <p className="page-subtitle">
            {isEmployee
              ? 'Verify the assets currently assigned to you'
              : 'Schedule audit cycles and track asset verification across the organization'}
          </p>
        </div>
        {!isEmployee && (
          <div className="page-actions">
            {tab === 'audits' && (
              <button className="btn btn-primary" onClick={openCreateModal}>+ Schedule Audit</button>
            )}
          </div>
        )}
      </div>

      {/* Tab bar — only managers see Activity Logs tab */}
      {!isEmployee && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
            {['audits', 'logs'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                background: 'none', border: 'none', padding: '14px 20px',
                color: tab === t ? 'var(--accent-light)' : 'var(--text-muted)',
                fontWeight: 600, textTransform: 'capitalize', cursor: 'pointer',
                borderBottom: tab === t ? '2px solid var(--accent-light)' : '2px solid transparent',
              }}>
                {t === 'audits' ? '📋 Scheduled Audits' : '📜 Activity Logs'}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="skeleton" style={{ height: 400 }} />
      ) : tab === 'audits' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {audits.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 8 }}>
                {isEmployee ? 'No audits assigned to your assets yet' : 'No audits scheduled yet'}
              </div>
              <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
                {isEmployee
                  ? 'When an audit is scheduled for your assets, it will appear here.'
                  : 'Create an audit cycle to start verifying your organization\'s assets.'}
              </p>
              {!isEmployee && (
                <button className="btn btn-primary" onClick={openCreateModal}>+ Schedule First Audit</button>
              )}
            </div>
          ) : (
            audits.map(audit => {
              const pct = progressPct(audit);
              const isExpanded = expandedAudit?.id === audit.id;
              const total = parseInt(audit.total_items) || 0;
              const verified = parseInt(audit.verified_count) || 0;
              const missing = parseInt(audit.missing_count) || 0;
              const damaged = parseInt(audit.damaged_count) || 0;

              return (
                <div key={audit.id} className="card">
                  {/* Audit Header */}
                  <div
                    style={{ padding: '20px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16 }}
                    onClick={() => openAuditItems(audit)}
                  >
                    <div style={{
                      width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                      background: audit.status === 'closed' ? 'rgba(0,212,170,0.1)' : 'rgba(108,99,255,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                    }}>
                      {audit.status === 'closed' ? '✅' : '📋'}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{audit.name}</div>
                        <StatusBadge status={audit.status} />
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {audit.start_date && <span>📅 {new Date(audit.start_date).toLocaleDateString()}</span>}
                        {audit.dept_name && <span>🏢 {audit.dept_name}</span>}
                        <span>📦 {total} assets</span>
                        {!isEmployee && audit.created_by_name && <span>👤 By {audit.created_by_name}</span>}
                      </div>

                      {/* Progress bar */}
                      {total > 0 && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4, color: 'var(--text-muted)' }}>
                            <span>
                              <span style={{ color: '#00D4AA' }}>✅ {verified} verified</span>
                              {missing > 0 && <span style={{ color: '#FF4757', marginLeft: 12 }}>❌ {missing} missing</span>}
                              {damaged > 0 && <span style={{ color: '#FF6B35', marginLeft: 12 }}>⚠️ {damaged} damaged</span>}
                            </span>
                            <span style={{ fontWeight: 700, color: pct === 100 ? '#00D4AA' : 'var(--text-muted)' }}>{pct}%</span>
                          </div>
                          <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${pct}%`, borderRadius: 99, transition: 'width 0.5s ease',
                              background: pct === 100 ? '#00D4AA' : 'linear-gradient(90deg, var(--accent), var(--accent-light))',
                            }} />
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      {audit.status === 'active' && !isEmployee && (
                        <button className="btn btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); handleCloseAudit(audit.id); }}>
                          Close Audit
                        </button>
                      )}
                      <span style={{ color: 'var(--text-muted)', fontSize: 18, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                        ▼
                      </span>
                    </div>
                  </div>

                  {/* Audit Items (expanded) */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border)', padding: '0 24px 20px' }}>
                      {itemsLoading ? (
                        <div className="skeleton" style={{ height: 120, margin: '16px 0' }} />
                      ) : auditItems.length === 0 ? (
                        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No assets in this audit yet.
                        </div>
                      ) : (
                        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {auditItems.map(item => {
                            const statusInfo = STATUS_COLORS[item.verification_status] || STATUS_COLORS.pending;
                            return (
                              <div key={item.id} style={{
                                display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px',
                                background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
                                border: `1px solid ${item.verification_status !== 'pending' ? statusInfo.color + '33' : 'var(--border)'}`,
                              }}>
                                {/* Asset info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent-light)', background: 'rgba(108,99,255,0.1)', padding: '2px 8px', borderRadius: 6 }}>
                                      {item.tag}
                                    </span>
                                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.asset_name}</span>
                                  </div>
                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                    📍 Expected: {item.expected_location || 'N/A'}
                                    {item.actual_location && <span style={{ marginLeft: 12 }}>→ Actual: {item.actual_location}</span>}
                                    {item.holder_name && <span style={{ marginLeft: 12 }}>👤 {item.holder_name}</span>}
                                    {item.notes && <span style={{ marginLeft: 12 }}>📝 {item.notes}</span>}
                                  </div>
                                </div>

                                {/* Status badge */}
                                <span style={{
                                  fontSize: '0.75rem', fontWeight: 700, padding: '4px 12px', borderRadius: 99,
                                  background: statusInfo.bg, color: statusInfo.color, whiteSpace: 'nowrap', flexShrink: 0
                                }}>
                                  {statusInfo.label}
                                </span>

                                {/* Action buttons — only if audit is active and not yet verified */}
                                {audit.status === 'active' && item.verification_status === 'pending' && (
                                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                    <button
                                      className="btn btn-sm"
                                      style={{ background: 'rgba(0,212,170,0.15)', color: '#00D4AA', border: '1px solid rgba(0,212,170,0.3)' }}
                                      onClick={() => handleVerifyItem(audit.id, item.id, 'verified')}
                                    >
                                      ✅ Verified
                                    </button>
                                    {!isEmployee && (
                                      <>
                                        <button
                                          className="btn btn-sm"
                                          style={{ background: 'rgba(255,71,87,0.12)', color: '#FF4757', border: '1px solid rgba(255,71,87,0.3)' }}
                                          onClick={() => handleVerifyItem(audit.id, item.id, 'missing')}
                                        >
                                          ❌ Missing
                                        </button>
                                        <button
                                          className="btn btn-sm"
                                          style={{ background: 'rgba(255,107,53,0.12)', color: '#FF6B35', border: '1px solid rgba(255,107,53,0.3)' }}
                                          onClick={() => handleVerifyItem(audit.id, item.id, 'damaged')}
                                        >
                                          ⚠️ Damaged
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                                {item.verification_status !== 'pending' && item.verified_by_name && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                                    by {item.verified_by_name}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        // Activity Logs tab (managers only)
        <div className="card">
          <div className="card-header"><h3 className="card-title">Audit Activity Log</h3></div>
          <div className="card-body">
            {logs.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No audit activity logged yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {logs.slice(0, 50).map((log, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', whiteSpace: 'nowrap', paddingTop: 2 }}>
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{log.actor_name || 'System'}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent-light)', marginLeft: 10, background: 'rgba(108,99,255,0.1)', padding: '1px 8px', borderRadius: 4 }}>{log.action}</span>
                      {log.description && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{log.description}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Schedule Audit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Schedule New Audit">
        <form onSubmit={handleCreateAudit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Audit Name *</label>
            <input className="input" required placeholder="e.g. Q3 IT Assets Audit"
              value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Department (Optional — leave blank to audit all assets)</label>
            <select className="input" value={form.dept_id || ''} onChange={e => setForm({ ...form, dept_id: e.target.value || null })}>
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input type="date" className="input" value={form.start_date || ''}
                onChange={e => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input type="date" className="input" value={form.end_date || ''}
                onChange={e => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description (Optional)</label>
            <textarea className="input" rows={2} placeholder="Purpose of this audit..."
              value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div style={{ padding: '12px 16px', background: 'rgba(108,99,255,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(108,99,255,0.2)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            💡 All active assets (for the selected department or all departments) will be automatically added to this audit for verification.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
              {formSubmitting ? 'Scheduling...' : '📋 Schedule Audit'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
