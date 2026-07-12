import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', password: '', orgName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(form.email, form.password);
      } else {
        await register(form);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
      <div className="card-glass animate-slideUp" style={{ width: '100%', maxWidth: 420, padding: 40 }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{ width: 48, height: 48, background: 'linear-gradient(135deg, var(--accent), var(--accent-green))', borderRadius: 12, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 20 }}>
            AF
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>AssetFlow</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Enterprise Asset Intelligence</p>
        </div>

        {error && <div style={{ padding: 12, background: 'rgba(255, 71, 87, 0.1)', color: 'var(--accent-red)', borderRadius: 8, marginBottom: 20, fontSize: '0.875rem' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input type="text" className="input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="input" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="input" required value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
          </div>
          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Organization Name (Optional)</label>
              <input type="text" className="input" placeholder="Leave blank to join demo org" value={form.orgName} onChange={e => setForm({...form, orgName: e.target.value})} />
            </div>
          )}
          
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        {isLogin && (
          <div style={{ marginTop: 24, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--accent-light)', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🚀</span> Quick Demo Login
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { role: 'Business Owner (Admin)', email: 'admin@demo.com', pass: 'demo123' },
                { role: 'IT Manager', email: 'manager@demo.com', pass: 'demo123' },
                { role: 'Employee', email: 'employee@demo.com', pass: 'demo123' }
              ].map(demo => (
                <button
                  key={demo.email}
                  type="button"
                  onClick={() => setForm({ ...form, email: demo.email, password: demo.pass })}
                  style={{
                    display: 'flex', justifyContent: 'space-between', padding: '8px 12px',
                    background: 'var(--bg-input)', border: '1px solid transparent', borderRadius: 6,
                    cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)',
                    transition: 'var(--transition)'
                  }}
                  onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent-light)'}
                  onMouseOut={e => e.currentTarget.style.borderColor = 'transparent'}
                >
                  <span style={{ fontWeight: 500, color: 'var(--accent-light)' }}>{demo.role}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{demo.email}</span>
                </button>
              ))}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 12 }}>
              Click a role to auto-fill credentials
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: '0.875rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
          </span>
          <button type="button" onClick={() => setIsLogin(!isLogin)} style={{ background: 'none', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', fontWeight: 600 }}>
            {isLogin ? 'Register' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
