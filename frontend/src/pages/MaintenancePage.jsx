import { useState, useEffect } from 'react';
import api from '../services/api';
import KanbanBoard from '../components/KanbanBoard';
import Modal from '../components/Modal';
import ExportButton from '../components/ExportButton';
import { useAuth } from '../store/AuthContext';
import { useSocket } from '../hooks/useSocket';

export default function MaintenancePage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({});
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);

  useSocket(user, (notif) => {
    if (notif.entity_type === 'maintenance') loadData(false);
  });

  const loadData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const res = await api.get('/maintenance');
      setRequests(res.data);
    } catch (err) {
      console.error(err);
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
    } catch (err) { alert('Failed to load data for maintenance modal'); }
  };

  const handleStatusChange = async (item, newStatus) => {
    try {
      await api.patch(`/maintenance/${item.id}`, { status: newStatus });
      loadData(false); // Refresh without full loading spinner
    } catch (err) {
      alert(err.error || 'Failed to update status');
      loadData(false); // Reset board
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (form.id) {
        await api.patch(`/maintenance/${form.id}`, form);
      } else {
        await api.post('/maintenance', form);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) { alert(err.error || 'Failed to save request'); }
  };

  return (
    <div>
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
            tag: r.asset_tag,
            priority: r.priority
          }))}
          onStatusChange={handleStatusChange}
          onCardClick={openModal}
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
            <button type="submit" className="btn btn-primary">Save Request</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
