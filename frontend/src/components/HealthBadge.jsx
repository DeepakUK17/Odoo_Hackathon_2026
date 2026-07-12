export default function HealthBadge({ score, label, color }) {
  if (score === undefined || score === null) return null;
  
  let c = color;
  if (!c) {
    if (score >= 90) c = '#00D4AA';
    else if (score >= 70) c = '#6C63FF';
    else if (score >= 50) c = '#FF6B35';
    else c = '#FF4757';
  }

  return (
    <div className="health-badge">
      <div className="health-bar" title={label || `${score}/100`}>
        <div className="health-bar-fill" style={{ width: `${score}%`, backgroundColor: c }} />
      </div>
      <span style={{ color: c }}>{score}</span>
    </div>
  );
}
