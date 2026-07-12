import { useState, useEffect } from 'react';
import api from '../services/api';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import ExportButton from '../components/ExportButton';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

export default function ReportsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/analytics')
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="skeleton" style={{ height: 600 }} />;
  if (!data) return <div className="empty-state">Failed to load reports</div>;

  const costByCategory = data.costByCategory || [];
  const conditionBreakdown = data.conditionBreakdown || [];

  const costData = {
    labels: costByCategory.map(c => c.category),
    datasets: [{
      label: 'Total Asset Cost ($)',
      data: costByCategory.map(c => parseFloat(c.total_cost)),
      backgroundColor: 'rgba(108, 99, 255, 0.8)',
      borderRadius: 4,
    }]
  };

  const condData = {
    labels: conditionBreakdown.map(c => c.condition),
    datasets: [{
      data: conditionBreakdown.map(c => parseInt(c.count)),
      backgroundColor: ['#00D4AA', '#6C63FF', '#FFD32A', '#FF6B35', '#FF4757'],
      borderWidth: 0,
    }]
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics & Reports</h1>
          <p className="page-subtitle">Visualize asset value, distribution, and health metrics</p>
        </div>
      </div>

      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header"><h3 className="card-title">Value by Category</h3></div>
          <div className="card-body" style={{ height: 350 }}>
            <Bar data={costData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } } }} />
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Overall Condition</h3></div>
          <div className="card-body" style={{ height: 350, display: 'flex', justifyContent: 'center' }}>
            <Pie data={condData} options={{ plugins: { legend: { position: 'bottom', labels: { color: '#B8B8CC' } } }, cutout: '60%' }} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3 className="card-title">Data Exports</h3></div>
        <div className="card-body">
          <p className="text-muted mb-6">Download complete tabular data for external reporting or auditing.</p>
          <div className="grid-4">
            <ExportButton module="assets" filename="Asset_Registry" label="Export Assets" />
            <ExportButton module="allocations" filename="Allocation_History" label="Export Allocations" />
            <ExportButton module="maintenance" filename="Maintenance_Logs" label="Export Maintenance" />
            <ExportButton module="employees" filename="Employee_Directory" label="Export Employees" />
          </div>
        </div>
      </div>
    </div>
  );
}
