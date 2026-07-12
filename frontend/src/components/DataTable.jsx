import { useState } from 'react';

export default function DataTable({ columns, data, onRowClick, emptyText = 'No records found' }) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDesc, setSortDesc] = useState(false);

  const handleSort = (key) => {
    if (sortCol === key) setSortDesc(!sortDesc);
    else { setSortCol(key); setSortDesc(false); }
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortCol) return 0;
    let valA = a[sortCol];
    let valB = b[sortCol];
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    
    if (valA < valB) return sortDesc ? 1 : -1;
    if (valA > valB) return sortDesc ? -1 : 1;
    return 0;
  });

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} onClick={() => col.sortable !== false && handleSort(col.key)} style={{ cursor: col.sortable !== false ? 'pointer' : 'default' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {col.label}
                  {col.sortable !== false && (
                    <span style={{ opacity: sortCol === col.key ? 1 : 0.3, fontSize: 10 }}>
                      {sortCol === col.key ? (sortDesc ? '▼' : '▲') : '↕'}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                {emptyText}
              </td>
            </tr>
          ) : (
            sortedData.map((row, i) => (
              <tr key={row.id || i} onClick={() => onRowClick?.(row)} style={{ cursor: onRowClick ? 'pointer' : 'default' }}>
                {columns.map(col => (
                  <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
