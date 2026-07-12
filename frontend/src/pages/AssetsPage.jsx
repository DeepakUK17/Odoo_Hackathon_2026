import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import HealthBadge from '../components/HealthBadge';
import ExportButton from '../components/ExportButton';
import Modal from '../components/Modal';
import { useAuth } from '../store/AuthContext';

export default function AssetsPage() {
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [form, setForm] = useState({});
  const { user } = useAuth();
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    try {
      const [assRes, catRes, depRes] = await Promise.all([
        api.get(`/assets${filterStatus ? `?status=${filterStatus}` : ''}`),
        api.get('/categories'),
        api.get('/departments')
      ]);
      setAssets(assRes.data);
      setCategories(catRes.data);
      setDepartments(depRes.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load assets data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [filterStatus]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      await api.post('/assets', form);
      setIsModalOpen(false);
      setForm({});
      toast.success('Asset registered successfully!');
      loadData();
    } catch (err) { toast.error(err.error || 'Failed to add asset'); }
    finally { setFormSubmitting(false); }
  };

  const columns = [
    { key: 'tag', label: 'Asset Tag', render: r => <span className="table-tag">{r.tag}</span> },
    { key: 'name', label: 'Name' },
    { key: 'category_name', label: 'Category' },
    { key: 'status', label: 'Status', render: r => <StatusBadge status={r.status} /> },
    { key: 'health_score', label: 'Health', render: r => <HealthBadge score={r.health_score} /> },
    { key: 'current_holder_name', label: 'Holder', render: r => r.current_holder_name || '-' },
    { key: 'next_audit_date', label: 'Next Audit', render: r => {
      if (!r.next_audit_date) return '-';
      const days = Math.ceil((new Date(r.next_audit_date) - new Date()) / (1000 * 60 * 60 * 24));
      return (
        <span style={{ color: days < 0 ? 'var(--accent-red)' : days <= 3 ? 'var(--accent-orange)' : 'inherit' }}>
          {days > 0 ? `In ${days} days` : days === 0 ? 'Today' : `${Math.abs(days)} days overdue`}
        </span>
      );
    }}
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Asset Directory</h1>
          <p className="page-subtitle">Manage and track all company assets</p>
        </div>
        <div className="page-actions">
          <ExportButton module="assets" filename="AssetDirectory" />
          {user?.role !== 'employee' && (
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>+ Register Asset</button>
          )}
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <select className="input" style={{ width: 200 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="available">Available</option>
              <option value="allocated">Allocated</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        </div>
        <div className="card-body">
          {loading ? <div className="skeleton" style={{ height: 400 }} /> : (
            <DataTable 
              columns={columns} 
              data={assets} 
              onRowClick={(row) => navigate(`/assets/${row.id}`)}
              emptyText="No assets found."
            />
          )}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Register New Asset" size="lg">
        <form onSubmit={handleSubmit} className="grid-2">
          <div className="form-group">
            <label className="form-label">Asset Name</label>
            <input className="input" required value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="input" value={form.category_id || ''} onChange={e => setForm({...form, category_id: e.target.value})}>
              <option value="">Select...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Serial Number</label>
            <input className="input" value={form.serial_number || ''} onChange={e => setForm({...form, serial_number: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Location / Department</label>
            <select className="input" value={form.dept_id || ''} onChange={e => setForm({...form, dept_id: e.target.value})}>
              <option value="">Select Dept...</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Purchase Date</label>
            <input type="date" className="input" value={form.purchase_date || ''} onChange={e => setForm({...form, purchase_date: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Cost ($)</label>
            <input type="number" className="input" value={form.purchase_cost || ''} onChange={e => setForm({...form, purchase_cost: e.target.value})} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Notes</label>
            <textarea className="input" rows="3" value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} />
          </div>
          <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
              {formSubmitting ? 'Registering...' : 'Register Asset'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
