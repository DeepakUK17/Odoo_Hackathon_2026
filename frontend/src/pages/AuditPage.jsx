import { useState, useEffect } from 'react';
import api from '../services/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../store/AuthContext';
import Modal from '../components/Modal';

export default function AuditPage() {
  const [audits, setAudits] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('audits'); // audits | logs
  const { user } = useAuth();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({});

  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === 'audits') {
        const res = await api.get('/audits');
        setAudits(res.data);
      } else {
        const res = await api.get('/audits/logs');
        setLogs(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [tab]);

  const handleCreateAudit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/audits', form);
      setIsModalOpen(false);
      loadData();
    } catch (err) { alert(err.error || 'Failed to schedule audit'); }
  };

  const columnsAudits = [
    { key: 'title', label: 'Audit Title' },
    { key: 'auditor_name', label: 'Assigned Auditor' },
    { key: 'scheduled_date', label: 'Scheduled Date', render: r => new Date(r.scheduled_date).toLocaleDateString() },
    { key: 'status', label: 'Status', render: r => <StatusBadge status={r.status} /> },
  ];

  const columnsLogs = [
    { key: 'created_at', label: 'Timestamp', render: r => new Date(r.created_at).toLocaleString() },
    { key: 'user_name', label: 'User' },
    { key: 'action', label: 'Action', render: r => <span style={{fontFamily:'monospace', color:'var(--accent-light)'}}>{r.action}</span> },
    { key: 'entity_type', label: 'Entity Type' },
    { key: 'entity_id', label: 'Entity ID' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Compliance & Auditing</h1>
          <p className="page-subtitle">Schedule audits and view system activity logs</p>
        </div>
        <div className="page-actions">
          {tab === 'audits' && user?.role === 'admin' && (
            <button className="btn btn-primary" onClick={() => { setForm({}); setIsModalOpen(true); }}>+ Schedule Audit</button>
          )}
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
          <button onClick={() => setTab('audits')} style={{ background: 'none', border: 'none', padding: '16px 20px', color: tab === 'audits' ? 'var(--accent-light)' : 'var(--text-muted)', fontWeight: 600, borderBottom: tab === 'audits' ? '2px solid var(--accent-light)' : '2px solid transparent' }}>Scheduled Audits</button>
          <button onClick={() => setTab('logs')} style={{ background: 'none', border: 'none', padding: '16px 20px', color: tab === 'logs' ? 'var(--accent-light)' : 'var(--text-muted)', fontWeight: 600, borderBottom: tab === 'logs' ? '2px solid var(--accent-light)' : '2px solid transparent' }}>Activity Logs</button>
        </div>
        <div className="card-body">
          {loading ? <div className="skeleton" style={{ height: 400 }} /> : (
            <DataTable 
              columns={tab === 'audits' ? columnsAudits : columnsLogs} 
              data={tab === 'audits' ? audits : logs} 
              emptyText={`No ${tab} found.`} 
            />
          )}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Schedule New Audit">
        <form onSubmit={handleCreateAudit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Audit Title</label>
            <input className="input" required value={form.title || ''} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Q3 IT Assets Audit" />
          </div>
          <div className="form-group">
            <label className="form-label">Scheduled Date</label>
            <input type="date" className="input" required value={form.scheduled_date || ''} onChange={e => setForm({...form, scheduled_date: e.target.value})} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Schedule Audit</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
