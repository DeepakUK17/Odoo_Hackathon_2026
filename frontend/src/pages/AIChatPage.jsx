import { useState, useRef, useEffect } from 'react';
import api from '../services/api';
import HealthBadge from '../components/HealthBadge';
import { Link } from 'react-router-dom';

export default function AIChatPage() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello! I am your AssetFlow AI Assistant powered by Gemini. You can ask me to find assets, summarize maintenance logs, generate reports, or provide predictive insights. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [predictions, setPredictions] = useState([]);
  const [risks, setRisks] = useState({ longHolders: [], excessiveMaintenance: [] });
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    api.get('/ai/predictions').then(res => setPredictions(res.data)).catch(console.error);
    api.get('/ai/risks').then(res => setRisks(res.data)).catch(console.error);
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] }));
      const res = await api.post('/ai/chat', { message: userText, history });
      setMessages(prev => [...prev, { role: 'assistant', text: res.data.response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, I encountered an error connecting to the AI engine.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid-3" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Chat Area */}
      <div className="card" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column' }}>
        <div className="card-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent-green))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>✨</div>
            <div>
              <h3 className="card-title" style={{ margin: 0, textTransform: 'none' }}>Gemini AI Assistant</h3>
              <p className="text-muted text-sm" style={{ margin: 0, textTransform: 'none' }}>Natural language queries and insights</p>
            </div>
          </div>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 16, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: m.role === 'user' ? 'var(--bg-input)' : 'linear-gradient(135deg, rgba(108,99,255,0.2), rgba(0,212,170,0.2))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                border: m.role === 'user' ? '1px solid var(--border)' : '1px solid var(--border-focus)'
              }}>
                {m.role === 'user' ? '👤' : '✨'}
              </div>
              <div style={{
                background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-input)',
                color: m.role === 'user' ? 'white' : 'var(--text-primary)',
                padding: '12px 18px', borderRadius: 'var(--radius-lg)',
                borderTopRightRadius: m.role === 'user' ? 4 : 'var(--radius-lg)',
                borderTopLeftRadius: m.role === 'assistant' ? 4 : 'var(--radius-lg)',
                maxWidth: '75%', fontSize: '0.95rem', whiteSpace: 'pre-wrap', lineHeight: 1.6
              }}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(108,99,255,0.2), rgba(0,212,170,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, border: '1px solid var(--border-focus)' }}>✨</div>
              <div style={{ background: 'var(--bg-input)', padding: '12px 18px', borderRadius: 'var(--radius-lg)', borderTopLeftRadius: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
                <div className="animate-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
                <div className="animate-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animationDelay: '0.2s' }} />
                <div className="animate-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animationDelay: '0.4s' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)' }}>
          <form onSubmit={handleSend} style={{ display: 'flex', gap: 12 }}>
            <input
              type="text" className="input" placeholder="Ask anything... e.g. 'Show me laptops assigned to Engineering'"
              value={input} onChange={e => setInput(e.target.value)} disabled={loading}
              style={{ flex: 1, padding: '14px 20px', borderRadius: 'var(--radius-pill)' }}
            />
            <button type="submit" className="btn btn-primary" style={{ borderRadius: 'var(--radius-pill)', padding: '0 24px' }} disabled={loading || !input.trim()}>
              Send ↗
            </button>
          </form>
        </div>
      </div>

      {/* AI Insights Sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
        <div className="card">
          <div className="card-header"><h3 className="card-title">Predictive Maintenance</h3></div>
          <div className="card-body">
            {predictions.length === 0 ? <p className="text-muted text-sm">No critical predictions.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {predictions.map(p => (
                  <Link key={p.assetId} to={`/assets/${p.assetId}`} style={{ display: 'block', background: 'rgba(255, 71, 87, 0.05)', border: '1px solid rgba(255, 71, 87, 0.2)', padding: 12, borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span className="font-bold">{p.tag}</span>
                      <HealthBadge score={p.healthScore} color="var(--accent-red)" />
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>{p.prediction.reason}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="card-title">Risk Detection</h3></div>
          <div className="card-body">
            <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Long Holders (&gt;180 days)</h4>
            {risks.longHolders.length === 0 ? <p className="text-muted text-sm mb-4">None found.</p> : (
              <ul style={{ paddingLeft: 20, margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                {risks.longHolders.map((r, i) => <li key={i}>{r.holder} holds {r.tag} for {r.days_held} days</li>)}
              </ul>
            )}

            <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Excessive Repairs (&gt;5 times)</h4>
            {risks.excessiveMaintenance.length === 0 ? <p className="text-muted text-sm">None found.</p> : (
              <ul style={{ paddingLeft: 20, margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                {risks.excessiveMaintenance.map((r, i) => <li key={i}>{r.tag} ({r.name}) has {r.repair_count} repairs</li>)}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
