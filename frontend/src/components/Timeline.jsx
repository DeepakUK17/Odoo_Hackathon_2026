export default function Timeline({ events }) {
  if (!events || events.length === 0) {
    return <div className="text-muted text-sm">No timeline events available.</div>;
  }

  const getIcon = (iconStr) => {
    switch(iconStr) {
      case 'plus-circle': return '➕';
      case 'user-check': return '👤';
      case 'rotate-ccw': return '↩️';
      case 'arrow-right': return '➡️';
      case 'tool': return '🔧';
      case 'check-circle': return '✅';
      default: return '◈';
    }
  };

  return (
    <div className="timeline">
      {events.map((event, idx) => (
        <div key={idx} className="timeline-item">
          <div className="timeline-line">
            <div className="timeline-dot">{getIcon(event.icon)}</div>
            {idx < events.length - 1 && <div className="timeline-connector" />}
          </div>
          <div className="timeline-content">
            <div className="timeline-date">{new Date(event.date).toLocaleString()}</div>
            <div className="timeline-desc">{event.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
