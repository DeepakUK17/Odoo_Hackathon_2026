import { useEffect } from 'react';

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClass = size === 'lg' ? ' modal-lg' : size === 'xl' ? ' modal-xl' : '';

  return (
    <div className="modal-overlay" onClick={(e) => e.target.className.includes('modal-overlay') && onClose()}>
      <div className={`modal${sizeClass}`}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
