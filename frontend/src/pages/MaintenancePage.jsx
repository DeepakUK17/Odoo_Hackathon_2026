import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import KanbanBoard from '../components/KanbanBoard';
import Modal from '../components/Modal';
import ExportButton from '../components/ExportButton';
import { useAuth } from '../store/AuthContext';
import { useSocket } from '../hooks/useSocket';

export default function MaintenancePage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({});
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [formSubmitting, setFormSubmitting] = useState(false);

  useSocket(user, (notif) => {
    if (notif.entity_type === 'maintenance') loadData(false);
  });

  const loadData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const res = await api.get('/maintenance');
      // Role-based filtering: Employee only sees tasks assigned to them
      const filtered = user?.role === 'employee' 
        ? res.data.filter(r => r.assigned_to === user.id)
        : res.data;
      setRequests(filtered);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load maintenance requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openModal = async (item = null) => {
    try {
      const [assRes, empRes] = await Promise.all([
        api.get('/assets'),
        api.get('/employees')
      ]);
      setAssets(assRes.data);
      setEmployees(empRes.data);
      setForm(item ? { ...item } : { priority: 'medium' });
      setIsModalOpen(true);
    } catch (err) { toast.error('Failed to load data for maintenance modal'); }
  };

  const handleStatusChange = async (item, newStatus) => {
    const isEmployee = user?.role === 'employee';
    const allowedForEmployee = ['in_progress', 'resolved'];

    // Kanban constraint: employees can only move to in_progress or resolved
    if (isEmployee && !allowedForEmployee.includes(newStatus)) {
      toast.error('You can only move tasks to In Progress or Resolved.');
      return;
    }

    // Prevent backward moves for resolved tasks
    if (item.status === 'resolved' && newStatus !== 'resolved') {
      toast.error('Cannot reopen a resolved task.');
      return;
    }

    // Optimistic UI Update for instant feedback
    const originalRequests = [...requests];
    setRequests(requests.map(r => r.id === item.id ? { ...r, status: newStatus } : r));

    try {
      // Use dedicated /status endpoint for employees (no requireManager middleware)
      if (isEmployee) {
        await api.patch(`/maintenance/${item.id}/status`, { status: newStatus });
      } else {
        await api.patch(`/maintenance/${item.id}`, { status: newStatus });
      }
      loadData(false);
    } catch (err) {
      toast.error(err.error || 'Failed to update status');
      setRequests(originalRequests); // Revert on failure
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      if (form.id) {
        await api.patch(`/maintenance/${form.id}`, form);
      } else {
        await api.post('/maintenance', form);
      }
      setIsModalOpen(false);
      toast.success('Maintenance request saved successfully!');
      loadData();
    } catch (err) { toast.error(err.error || 'Failed to save request'); }
    finally { setFormSubmitting(false); }
  };

  return (
    <div>
      {error && (
        <div style={{ padding: '12px 16px', background: 'var(--accent-red)', color: 'white', borderRadius: 'var(--radius)', marginBottom: 16, fontWeight: 500 }}>
          ⚠️ {error}
        </div>
      )}
      <div className="page-header">
        <div>
          <h1 className="page-title">Maintenance Board</h1>
          <p className="page-subtitle">Track and manage asset repairs and service requests</p>
        </div>
        <div className="page-actions">
          <ExportButton module="maintenance" filename="MaintenanceReport" />
          <button className="btn btn-primary" onClick={() => openModal()}>+ New Request</button>
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 600 }} />
      ) : (
        <KanbanBoard 
          items={requests.map(r => ({
            ...r, 
            title: r.title,
            tag: r.asset_tag || r.tag,
            priority: r.priority
          }))}
          onStatusChange={handleStatusChange}
          onCardClick={user?.role !== 'employee' ? openModal : undefined}
          employeeView={user?.role === 'employee'}
        />
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`${form.id ? 'Edit' : 'New'} Maintenance Request`}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Asset</label>
            <select className="input" required value={form.asset_id || ''} onChange={e => setForm({...form, asset_id: e.target.value})} disabled={!!form.id}>
              <option value="">Select Asset...</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.tag} - {a.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Title / Issue Summary</label>
            <input className="input" required value={form.title || ''} onChange={e => setForm({...form, title: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="input" rows="3" required value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="input" required value={form.priority || 'medium'} onChange={e => setForm({...form, priority: e.target.value})}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            {user?.role !== 'employee' && (
              <div className="form-group">
                <label className="form-label">Assign To (Optional)</label>
                <select className="input" value={form.assigned_to || ''} onChange={e => setForm({...form, assigned_to: e.target.value})}>
                  <option value="">Select Tech...</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            )}
          </div>
          
          {form.id && user?.role !== 'employee' && (
            <div className="form-group">
              <label className="form-label">Actual Cost ($) - Optional</label>
              <input type="number" className="input" value={form.actual_cost || ''} onChange={e => setForm({...form, actual_cost: e.target.value})} />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
              {formSubmitting ? 'Saving...' : 'Save Request'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
