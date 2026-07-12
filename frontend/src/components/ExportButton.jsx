import { useState } from 'react';
import api from '../services/api';

export default function ExportButton({ module, filename = 'Export' }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await api.get(`/export/${module}`, { responseType: 'blob' });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed', err);
      alert('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  return (
    <button className="btn btn-secondary" onClick={handleExport} disabled={exporting}>
      {exporting ? 'Exporting...' : '↓ Export Excel'}
    </button>
  );
}
