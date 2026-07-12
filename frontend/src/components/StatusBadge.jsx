export default function StatusBadge({ status }) {
  if (!status) return null;
  const s = status.toLowerCase();
  let badgeClass = s;
  
  if (s === 'in_progress') badgeClass = 'allocated';
  if (s === 'confirmed') badgeClass = 'available';
  if (s === 'cancelled') badgeClass = 'retired';
  
  return (
    <span className={`badge badge-${badgeClass}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
