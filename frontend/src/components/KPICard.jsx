export default function KPICard({ title, value, icon, color = 'accent' }) {
  return (
    <div className={`kpi-card ${color}`}>
      <div className="kpi-icon" style={{ background: `var(--glass)`, color: `var(--accent${color !== 'accent' ? `-${color}` : ''})` }}>
        {icon}
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{title}</div>
    </div>
  );
}
