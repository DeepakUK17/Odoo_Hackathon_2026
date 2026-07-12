import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
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

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [conflictData, setConflictData] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/allocations');
      setAllocations(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load allocations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openAllocateModal = async () => {
    try {
      const [assRes, empRes] = await Promise.all([
        api.get('/assets'), // Fetch all assets, we will handle conflict if unavailable
        api.get('/employees')
      ]);
      setAssets(assRes.data);
      setEmployees(empRes.data);
      setAllocForm({});
      setConflictData(null);
      setIsAllocModalOpen(true);
    } catch (err) { toast.error('Failed to load data for allocation'); }
  };

  const handleAllocate = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setConflictData(null);
    try {
      await api.post('/allocations', allocForm);
      setIsAllocModalOpen(false);
      toast.success('Asset allocated successfully!');
      loadData();
    } catch (err) {
      if (err.currentHolder) {
        setConflictData(err.currentHolder);
        toast.error(err.message || 'Asset is already allocated.');
      } else {
        toast.error(err.error || 'Failed to allocate');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleReturn = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      await api.patch(`/allocations/${returnForm.id}/return`, returnForm);
      setIsReturnModalOpen(false);
      toast.success('Asset returned successfully!');
      loadData();
    } catch (err) { toast.error(err.error || 'Failed to return asset'); }
    finally { setFormSubmitting(false); }
  };

  const handleRequestTransfer = async () => {
    setFormSubmitting(true);
    try {
      await api.post('/transfers', {
        asset_id: allocForm.asset_id,
        from_employee_id: conflictData.id,
        to_employee_id: allocForm.employee_id,
        reason: 'Requested via conflict resolution'
      });
      setIsAllocModalOpen(false);
      setConflictData(null);
      toast.success('Transfer request submitted successfully!');
    } catch (err) {
      toast.error(err.error || 'Failed to request transfer');
    } finally {
      setFormSubmitting(false);
    }
  };

  const columns = [
    { key: 'asset_tag', label: 'Tag', render: r => <span className="table-tag">{r.asset_tag}</span> },
    { key: 'asset_name', label: 'Asset' },
    { key: 'employee_name', label: 'Employee' },
    { key: 'allocated_at', label: 'Allocated Date', render: r => new Date(r.allocated_at).toLocaleDateString() },
    { key: 'expected_return', label: 'Due Date', render: r => {
      if (!r.expected_return) return '-';
      const isOverdue = new Date(r.expected_return) < new Date() && r.status === 'active';
      return (
        <span style={{ color: isOverdue ? 'var(--accent-red)' : 'inherit', fontWeight: isOverdue ? 600 : 'normal' }}>
          {new Date(r.expected_return).toLocaleDateString()} {isOverdue && '⚠️'}
        </span>
      );
    }},
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
        {conflictData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: 16, background: 'rgba(255, 71, 87, 0.1)', color: 'var(--accent-red)', borderRadius: 8 }}>
              <strong>Allocation Conflict</strong><br/>
              This asset is currently held by <strong>{conflictData.name}</strong>.
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Would you like to submit a Transfer Request instead? The current holder or an Asset Manager will need to approve it.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setConflictData(null); setIsAllocModalOpen(false); }}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleRequestTransfer} disabled={formSubmitting}>
                {formSubmitting ? 'Requesting...' : 'Request Transfer'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleAllocate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Asset (Available)</label>
              <select className="input" required value={allocForm.asset_id || ''} onChange={e => setAllocForm({...allocForm, asset_id: e.target.value})}>
                <option value="">Select Asset...</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.tag} - {a.name} ({a.status})</option>)}
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
              <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
                {formSubmitting ? 'Allocating...' : 'Allocate'}
              </button>
            </div>
          </form>
        )}
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
            <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
              {formSubmitting ? 'Processing...' : 'Process Return'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
