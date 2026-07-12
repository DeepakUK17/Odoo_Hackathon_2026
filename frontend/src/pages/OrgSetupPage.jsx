import { useState, useEffect } from 'react';
import api from '../services/api';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import ExportButton from '../components/ExportButton';
import { useAuth } from '../store/AuthContext';

export default function OrgSetupPage() {
  const [tab, setTab] = useState('employees');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({});

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/${tab}`);
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [tab]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (form.id) await api.patch(`/${tab}/${form.id}`, form);
      else await api.post(`/${tab}`, form);
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      alert(err.error || 'Failed to save');
    }
  };

  const columns = {
    employees: [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role', render: r => <span style={{textTransform:'capitalize'}}>{r.role}</span> },
      { key: 'dept_name', label: 'Department' },
      { key: 'status', label: 'Status', render: r => <StatusBadge status={r.status} /> }
    ],
    departments: [
      { key: 'name', label: 'Department Name' },
      { key: 'head_name', label: 'Head' },
      { key: 'parent_name', label: 'Parent Dept' },
      { key: 'status', label: 'Status', render: r => <StatusBadge status={r.status} /> }
    ],
    categories: [
      { key: 'name', label: 'Category' },
      { key: 'icon', label: 'Icon', render: r => <span style={{fontSize: 20}}>{r.icon}</span> },
      { key: 'color', label: 'Color', render: r => <div style={{width: 16, height: 16, borderRadius: '50%', background: r.color}} /> },
      { key: 'asset_count', label: 'Assets' }
    ]
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Organization Setup</h1>
          <p className="page-subtitle">Manage employees, departments, and categories</p>
        </div>
        <div className="page-actions">
          {tab === 'employees' && <ExportButton module="employees" filename="Employees" />}
          {user?.role !== 'employee' && (
            <button className="btn btn-primary" onClick={() => { setForm({}); setIsModalOpen(true); }}>
              + Add {tab === 'employees' ? 'Employee' : tab === 'departments' ? 'Department' : 'Category'}
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
          {['employees', 'departments', 'categories'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: 'none', border: 'none', padding: '16px 20px',
                color: tab === t ? 'var(--accent-light)' : 'var(--text-muted)',
                fontWeight: 600, textTransform: 'capitalize',
                borderBottom: tab === t ? '2px solid var(--accent-light)' : '2px solid transparent',
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="card-body">
          {loading ? <div className="skeleton" style={{ height: 300 }} /> : (
            <DataTable columns={columns[tab]} data={data} onRowClick={(row) => {
              if (user?.role !== 'employee') { setForm(row); setIsModalOpen(true); }
            }} />
          )}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`${form.id ? 'Edit' : 'Add'} ${tab.slice(0,-1)}`}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="input" required value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} />
          </div>
          
          {tab === 'employees' && (
            <>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="input" required value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} disabled={!!form.id} />
              </div>
              {!form.id && (
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input type="password" className="input" required value={form.password || ''} onChange={e => setForm({...form, password: e.target.value})} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="input" value={form.role || 'employee'} onChange={e => setForm({...form, role: e.target.value})}>
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  {user?.role === 'admin' && <option value="admin">Admin</option>}
                </select>
              </div>
            </>
          )}

          {tab === 'categories' && (
            <>
              <div className="form-group">
                <label className="form-label">Icon (Emoji)</label>
                <input className="input" value={form.icon || '◈'} onChange={e => setForm({...form, icon: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Color Hex</label>
                <input type="color" style={{width: '100%', height: 40, background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: 2}} value={form.color || '#6C63FF'} onChange={e => setForm({...form, color: e.target.value})} />
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
