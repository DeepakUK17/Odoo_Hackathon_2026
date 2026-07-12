import { useState, useEffect } from 'react';
import api from '../services/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import ExportButton from '../components/ExportButton';
import { useAuth } from '../store/AuthContext';

export default function AllocationPage() {
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const [isAllocModalOpen, setIsAllocModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  
  const [allocForm, setAllocForm] = useState({});
  const [returnForm, setReturnForm] = useState({});
  
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/allocations');
      setAllocations(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openAllocateModal = async () => {
    try {
      const [assRes, empRes] = await Promise.all([
        api.get('/assets?status=available'),
        api.get('/employees')
      ]);
      setAssets(assRes.data);
      setEmployees(empRes.data);
      setAllocForm({});
      setIsAllocModalOpen(true);
    } catch (err) { alert('Failed to load data for allocation'); }
  };

  const handleAllocate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/allocations', allocForm);
      setIsAllocModalOpen(false);
      loadData();
    } catch (err) { alert(err.error || 'Failed to allocate'); }
  };

  const handleReturn = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/allocations/${returnForm.id}/return`, returnForm);
      setIsReturnModalOpen(false);
      loadData();
    } catch (err) { alert(err.error || 'Failed to return asset'); }
  };

  const columns = [
    { key: 'asset_tag', label: 'Tag', render: r => <span className="table-tag">{r.asset_tag}</span> },
    { key: 'asset_name', label: 'Asset' },
    { key: 'employee_name', label: 'Employee' },
    { key: 'allocated_at', label: 'Allocated Date', render: r => new Date(r.allocated_at).toLocaleDateString() },
    { key: 'expected_return', label: 'Due Date', render: r => r.expected_return ? new Date(r.expected_return).toLocaleDateString() : '-' },
    { key: 'status', label: 'Status', render: r => <StatusBadge status={r.status} /> },
    { key: 'actions', label: '', sortable: false, render: r => (
      r.status === 'active' && (user?.role === 'admin' || user?.id === r.employee_id) && (
        <button className="btn btn-sm btn-secondary" onClick={() => { setReturnForm({ id: r.id, return_condition: 'good' }); setIsReturnModalOpen(true); }}>
          Return
        </button>
      )
    )}
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Asset Allocation</h1>
          <p className="page-subtitle">Assign and track assets given to employees</p>
        </div>
        <div className="page-actions">
          <ExportButton module="allocations" filename="AllocationHistory" />
          {user?.role !== 'employee' && (
            <button className="btn btn-primary" onClick={openAllocateModal}>+ Allocate Asset</button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {loading ? <div className="skeleton" style={{ height: 400 }} /> : (
            <DataTable columns={columns} data={allocations} emptyText="No allocations found." />
          )}
        </div>
      </div>

      {/* Allocate Modal */}
      <Modal isOpen={isAllocModalOpen} onClose={() => setIsAllocModalOpen(false)} title="Allocate Asset">
        <form onSubmit={handleAllocate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Asset (Available)</label>
            <select className="input" required value={allocForm.asset_id || ''} onChange={e => setAllocForm({...allocForm, asset_id: e.target.value})}>
              <option value="">Select Asset...</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.tag} - {a.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Employee</label>
            <select className="input" required value={allocForm.employee_id || ''} onChange={e => setAllocForm({...allocForm, employee_id: e.target.value})}>
              <option value="">Select Employee...</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.email})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Expected Return Date (Optional)</label>
            <input type="date" className="input" value={allocForm.expected_return || ''} onChange={e => setAllocForm({...allocForm, expected_return: e.target.value})} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsAllocModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Allocate</button>
          </div>
        </form>
      </Modal>

      {/* Return Modal */}
      <Modal isOpen={isReturnModalOpen} onClose={() => setIsReturnModalOpen(false)} title="Return Asset">
        <form onSubmit={handleReturn} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Return Condition</label>
            <select className="input" required value={returnForm.return_condition || ''} onChange={e => setReturnForm({...returnForm, return_condition: e.target.value})}>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
              <option value="broken">Broken</option>
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsReturnModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Process Return</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
