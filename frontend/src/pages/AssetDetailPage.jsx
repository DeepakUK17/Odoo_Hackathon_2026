import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import HealthBadge from '../components/HealthBadge';
import Timeline from '../components/Timeline';
import QRModal from '../components/QRModal';

export default function AssetDetailPage() {
  const { id } = useParams();
  const [asset, setAsset] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isQrOpen, setIsQrOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/assets/${id}`),
      api.get(`/assets/${id}/timeline`)
    ])
    .then(([assetRes, timelineRes]) => {
      setAsset(assetRes.data);
      setHistory(timelineRes.data);
    })
    .catch(console.error)
    .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="skeleton" style={{ height: 400 }} />;
  if (!asset) return <div className="empty-state">Asset not found</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Link to="/assets" style={{ color: 'var(--text-muted)' }}>← Back</Link>
            <span className="table-tag">{asset.tag}</span>
            <StatusBadge status={asset.status} />
          </div>
          <h1 className="page-title">{asset.name}</h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => setIsQrOpen(true)}>Show QR Code</button>
          <Link to="/maintenance" className="btn btn-primary">Report Issue</Link>
        </div>
      </div>

      <div className="grid-3 mb-6">
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-header"><h3 className="card-title">Asset Details</h3></div>
          <div className="card-body">
            <div className="grid-2">
              <div>
                <div className="text-muted text-sm mb-4">Category</div>
                <div className="font-bold">{asset.category_name || 'N/A'}</div>
              </div>
              <div>
                <div className="text-muted text-sm mb-4">Serial Number</div>
                <div className="font-bold">{asset.serial_number || 'N/A'}</div>
              </div>
              <div className="mt-4">
                <div className="text-muted text-sm mb-4">Purchase Info</div>
                <div className="font-bold">
                  {asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : 'N/A'}
                  {asset.purchase_cost ? ` — $${asset.purchase_cost}` : ''}
                </div>
              </div>
              <div className="mt-4">
                <div className="text-muted text-sm mb-4">Location</div>
                <div className="font-bold">{asset.dept_name || asset.location || 'N/A'}</div>
              </div>
            </div>
            
            <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '24px 0' }} />
            
            <div className="grid-2">
              <div>
                <div className="text-muted text-sm mb-4">Current Health Score</div>
                <HealthBadge score={asset.health_score} />
              </div>
              <div>
                <div className="text-muted text-sm mb-4">Current Condition</div>
                <div className="font-bold" style={{ textTransform: 'capitalize' }}>{asset.condition}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Current Allocation</h3></div>
          <div className="card-body">
            {asset.current_holder_name ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ width: 64, height: 64, background: 'var(--bg-input)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 16px' }}>👤</div>
                <div className="font-bold" style={{ fontSize: '1.1rem' }}>{asset.current_holder_name}</div>
                <div className="text-muted text-sm mt-4">Allocated since: {new Date(asset.allocated_at).toLocaleDateString()}</div>
                {asset.expected_return && (
                  <div className="text-muted text-sm mt-4">Expected return: {new Date(asset.expected_return).toLocaleDateString()}</div>
                )}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '40px 0' }}>
                <div className="empty-state-title">Not Allocated</div>
                <div className="empty-state-desc">This asset is currently available.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3 className="card-title">Activity History</h3></div>
        <div className="card-body">
          <Timeline events={history.map(h => ({
            date: h.created_at,
            description: h.action === 'status_change' ? `Status changed to ${h.details.new_status}` :
                         h.action === 'condition_update' ? `Condition updated to ${h.details.condition} (Health: ${h.details.health_score})` :
                         h.action === 'allocated' ? `Allocated to employee #${h.details.employee_id}` :
                         h.action === 'returned' ? `Returned in ${h.details.condition} condition` : h.action,
            icon: h.action.includes('allocate') ? 'user-check' : h.action.includes('return') ? 'rotate-ccw' : 'check-circle'
          }))} />
        </div>
      </div>

      <QRModal isOpen={isQrOpen} onClose={() => setIsQrOpen(false)} assetId={asset.id} assetTag={asset.tag} />
    </div>
  );
}
