import { useState, useEffect } from 'react';
import api from '../services/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

export default function ResourceBookingPage() {
  const [bookings, setBookings] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({});

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bookings');
      setBookings(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openModal = async () => {
    try {
      const res = await api.get('/resources');
      setResources(res.data);
      setForm({});
      setIsModalOpen(true);
    } catch (err) { alert('Failed to load resources'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/bookings', form);
      setIsModalOpen(false);
      loadData();
    } catch (err) { alert(err.error || 'Failed to book resource'); }
  };

  const columns = [
    { key: 'resource_name', label: 'Resource' },
    { key: 'resource_type', label: 'Type', render: r => <span style={{textTransform:'capitalize'}}>{r.resource_type}</span> },
    { key: 'employee_name', label: 'Booked By' },
    { key: 'start_time', label: 'Start Time', render: r => new Date(r.start_time).toLocaleString() },
    { key: 'end_time', label: 'End Time', render: r => new Date(r.end_time).toLocaleString() },
    { key: 'status', label: 'Status', render: r => <StatusBadge status={r.status} /> }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Resource Booking</h1>
          <p className="page-subtitle">Reserve conference rooms, vehicles, and shared equipment</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openModal}>+ Book Resource</button>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {loading ? <div className="skeleton" style={{ height: 400 }} /> : (
            <DataTable columns={columns} data={bookings} emptyText="No bookings found." />
          )}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Book a Resource">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Resource</label>
            <select className="input" required value={form.resource_id || ''} onChange={e => setForm({...form, resource_id: e.target.value})}>
              <option value="">Select Resource...</option>
              {resources.map(r => <option key={r.id} value={r.id}>{r.name} ({r.type})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Start Time</label>
            <input type="datetime-local" className="input" required value={form.start_time || ''} onChange={e => setForm({...form, start_time: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">End Time</label>
            <input type="datetime-local" className="input" required value={form.end_time || ''} onChange={e => setForm({...form, end_time: e.target.value})} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Confirm Booking</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
