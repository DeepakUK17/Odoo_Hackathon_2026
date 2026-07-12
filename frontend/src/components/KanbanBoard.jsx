import { useState } from 'react';

const ALL_COLUMNS = [
  { id: 'pending',     label: 'Pending',     color: '#6B6B85' },
  { id: 'approved',   label: 'Approved',    color: '#3B82F6' },
  { id: 'assigned',   label: 'Assigned',    color: '#F59E0B' },
  { id: 'in_progress', label: 'In Progress', color: '#6C63FF' },
  { id: 'resolved',   label: 'Resolved',    color: '#00D4AA' },
];

// Employees only see: Assigned, In Progress, Resolved
const EMPLOYEE_COLUMNS = ALL_COLUMNS.filter(c => ['assigned', 'in_progress', 'resolved'].includes(c.id));

export default function KanbanBoard({ items, onStatusChange, onCardClick, employeeView = false }) {
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  const COLUMNS = employeeView ? EMPLOYEE_COLUMNS : ALL_COLUMNS;

  const handleDragStart = (e, item) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, colId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colId);
  };

  const handleDrop = (e, targetStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    if (draggedItem && draggedItem.status !== targetStatus) {
      onStatusChange(draggedItem, targetStatus);
    }
    setDraggedItem(null);
  };

  const handleDragLeave = () => setDragOverCol(null);

  const priorityColor = (p) => {
    if (p === 'critical') return 'var(--accent-red)';
    if (p === 'high') return 'var(--accent-orange)';
    if (p === 'medium') return 'var(--accent-yellow)';
    return 'var(--text-muted)';
  };

  return (
    <div className="kanban-board">
      {COLUMNS.map(col => {
        const colItems = items.filter(i => i.status === col.id);
        const isOver = dragOverCol === col.id;

        return (
          <div
            key={col.id}
            className="kanban-col"
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.id)}
            style={{ transition: 'background 0.2s', background: isOver ? 'rgba(108,99,255,0.08)' : undefined }}
          >
            <div className="kanban-col-header" style={{ borderTop: `3px solid ${col.color}` }}>
              <span>{col.label}</span>
              <span className="kanban-count" style={{ background: col.color + '22', color: col.color }}>{colItems.length}</span>
            </div>

            <div className="kanban-cards">
              {colItems.map(item => (
                <div
                  key={item.id}
                  className="kanban-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  onClick={() => onCardClick?.(item)}
                  style={{ cursor: onCardClick ? 'pointer' : 'grab', opacity: draggedItem?.id === item.id ? 0.5 : 1 }}
                >
                  {item.tag && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--accent)', fontFamily: 'monospace', marginBottom: 4 }}>
                      {item.tag}
                    </div>
                  )}
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 6, lineHeight: 1.3 }}>
                    {item.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                      color: priorityColor(item.priority),
                      background: priorityColor(item.priority) + '22',
                      padding: '2px 8px', borderRadius: '99px'
                    }}>
                      {item.priority}
                    </span>
                    {item.assigned_to_name && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>👤 {item.assigned_to_name}</span>
                    )}
                  </div>
                </div>
              ))}
              {colItems.length === 0 && (
                <div style={{
                  padding: '20px', textAlign: 'center', color: 'var(--text-muted)',
                  fontSize: '0.75rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)',
                  opacity: isOver ? 0.8 : 0.5
                }}>
                  {isOver ? '📥 Drop here' : 'Empty'}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
