import { useState } from 'react';

const COLUMNS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'resolved', label: 'Resolved' },
];

export default function KanbanBoard({ items, onStatusChange, onCardClick }) {
  const [draggedItem, setDraggedItem] = useState(null);

  const handleDragStart = (e, item) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetStatus) => {
    e.preventDefault();
    if (draggedItem && draggedItem.status !== targetStatus) {
      onStatusChange(draggedItem, targetStatus);
    }
    setDraggedItem(null);
  };

  return (
    <div className="kanban-board">
      {COLUMNS.map(col => {
        const colItems = items.filter(i => i.status === col.id);
        
        return (
          <div
            key={col.id}
            className="kanban-col"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <div className="kanban-col-header">
              {col.label}
              <span className="kanban-count">{colItems.length}</span>
            </div>
            
            <div className="kanban-cards">
              {colItems.map(item => (
                <div
                  key={item.id}
                  className="kanban-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  onClick={() => onCardClick?.(item)}
                >
                  <div style={{ fontSize: '0.72rem', color: 'var(--accent)', fontFamily: 'monospace', marginBottom: 4 }}>
                    {item.tag}
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 4 }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Priority: <span style={{ 
                      color: item.priority === 'critical' ? 'var(--accent-red)' : 
                             item.priority === 'high' ? 'var(--accent-orange)' : 'var(--text-muted)'
                    }}>{item.priority}</span>
                  </div>
                </div>
              ))}
              {colItems.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
                  Drop here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
