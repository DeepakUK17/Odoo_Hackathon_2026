import { useState, useEffect } from 'react';
import api from '../services/api';
import KPICard from '../components/KPICard';
import Timeline from '../components/Timeline';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import { Link } from 'react-router-dom';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/dashboard')
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="skeleton" style={{ height: 400 }} />;
  if (!data) return <div className="empty-state">Failed to load dashboard data</div>;

  const { assets, maintenance, bookings, overdueCount, pendingTransfers, recentAllocations } = data;

  const pieData = {
    labels: ['Available', 'Allocated', 'Maintenance', 'Retired'],
    datasets: [{
      data: [assets.available, assets.allocated, assets.in_maintenance, assets.retired],
      backgroundColor: ['#00D4AA', '#6C63FF', '#FF6B35', '#6B6B85'],
      borderWidth: 0,
    }]
  };

  const pieOptions = {
    plugins: { legend: { position: 'bottom', labels: { color: '#B8B8CC', usePointStyle: true } } },
    cutout: '70%',
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your enterprise assets</p>
        </div>
        <Link to="/ai-assistant" className="btn btn-primary">✦ Ask AI Assistant</Link>
      </div>

      <div className="kpi-grid">
        <KPICard title="Total Assets" value={assets.total} icon="◈" color="accent" />
        <KPICard title="Available" value={assets.available} icon="✓" color="green" />
        <KPICard title="In Maintenance" value={assets.in_maintenance} icon="🔧" color="orange" />
        <KPICard title="Avg Health Score" value={`${Math.round(assets.avg_health || 0)}%`} icon="❤️" color={assets.avg_health > 70 ? 'green' : 'red'} />
      </div>

      <div className="grid-3 mb-6">
        <div className="card" style={{ gridColumn: 'span 1' }}>
          <div className="card-header"><h3 className="card-title">Asset Status</h3></div>
          <div className="card-body" style={{ height: 300, display: 'flex', justifyContent: 'center' }}>
            <Pie data={pieData} options={pieOptions} />
          </div>
        </div>

        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-header"><h3 className="card-title">Action Items</h3></div>
          <div className="card-body">
            <div className="grid-2">
              <div style={{ background: 'rgba(255, 71, 87, 0.1)', border: '1px solid rgba(255, 71, 87, 0.2)', padding: 20, borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent-red)' }}>{overdueCount}</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Overdue Returns</div>
                <Link to="/allocation" style={{ fontSize: '0.75rem', marginTop: 8, display: 'inline-block' }}>View Allocations →</Link>
              </div>
              <div style={{ background: 'rgba(255, 211, 42, 0.1)', border: '1px solid rgba(255, 211, 42, 0.2)', padding: 20, borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent-yellow)' }}>{maintenance.open_count}</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Open Maintenance Requests</div>
                <Link to="/maintenance" style={{ fontSize: '0.75rem', marginTop: 8, display: 'inline-block' }}>View Board →</Link>
              </div>
              <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: 20, borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent-blue)' }}>{pendingTransfers}</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Pending Transfers</div>
                <Link to="/allocation" style={{ fontSize: '0.75rem', marginTop: 8, display: 'inline-block' }}>Review Transfers →</Link>
              </div>
              <div style={{ background: 'rgba(0, 212, 170, 0.1)', border: '1px solid rgba(0, 212, 170, 0.2)', padding: 20, borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent-green)' }}>{bookings.active}</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Active Resource Bookings</div>
                <Link to="/booking" style={{ fontSize: '0.75rem', marginTop: 8, display: 'inline-block' }}>View Calendar →</Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3 className="card-title">Recent Allocations</h3></div>
        <div className="card-body">
          <Timeline events={recentAllocations.map(a => ({
            date: a.allocated_at,
            description: `${a.asset_name} (${a.tag}) was allocated to ${a.employee_name} (${a.dept_name || 'No Dept'})`,
            icon: 'user-check'
          }))} />
        </div>
      </div>
    </div>
  );
}
