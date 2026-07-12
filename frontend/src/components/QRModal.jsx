import Modal from './Modal';
import { useState, useEffect } from 'react';
import api from '../services/api';

export default function QRModal({ isOpen, onClose, assetId, assetTag }) {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && assetId) {
      setLoading(true);
      api.get(`/assets/${assetId}/qr`)
        .then(res => setQrData(res.data.qr))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isOpen, assetId]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Asset QR Code — ${assetTag}`}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0' }}>
        {loading ? (
          <div className="animate-spin" style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTop: '3px solid var(--accent)', borderRadius: '50%' }} />
        ) : qrData ? (
          <>
            <div style={{ background: 'white', padding: 20, borderRadius: 'var(--radius-md)', marginBottom: 20 }}>
              <img src={qrData} alt={`QR Code for ${assetTag}`} style={{ width: 200, height: 200, display: 'block' }} />
            </div>
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.875rem' }}>
              Scan this QR code to quickly access the asset details page or log a maintenance request.
            </p>
            <a href={qrData} download={`Asset_${assetTag}_QR.png`} className="btn btn-primary" style={{ marginTop: 20 }}>
              Download QR Image
            </a>
          </>
        ) : (
          <p>Failed to load QR code.</p>
        )}
      </div>
    </Modal>
  );
}
