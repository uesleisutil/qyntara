import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import { Crown, CheckCircle, Briefcase, LineChart, Shield, Target, Zap, ArrowLeft, CreditCard, Loader2, Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { API_BASE_URL } from '../../config';
import { PRO_PRICE, PRO_PRICE_LABEL, UNIVERSE_SIZE_FALLBACK } from '../../constants';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

const UpgradePage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const { user, refreshPlan } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPro = user?.plan === 'pro';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [billingLoading, setBillingLoading] = useState(false);

  // Handle return from Stripe checkout
  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'success') {
      setSuccessMsg('Pagamento confirmado! Ativando seu plano Pro...');
      // Poll for plan update (webhook may take a few seconds)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          await refreshPlan();
        } catch { /* ignore */ }
        if (attempts >= 10) clearInterval(poll);
      }, 2000);
      return () => clearInterval(poll);
    }
    if (status === 'cancelled') {
      setError('Pagamento cancelado. Você pode tentar novamente quando quiser.');
    }
  }, [searchParams, refreshPlan]);

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1a1d27' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12,
  };
  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
    width: '100%', padding: '0.85rem', borderRadius: 10, border: 'none', cursor: 'pointer',
    fontSize: '1rem', fontWeight: 700, textDecoration: 'none',
    WebkitAppearance: 'none' as any, transition: 'transform 0.15s, opacity 0.15s',
  };

  const handleCheckout = async () => {
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/auth/create-checkout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro ao iniciar pagamento');
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao iniciar pagamento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setBillingLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/auth/manage-billing`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      if (data.portalUrl) window.location.href = data.portalUrl;
    } catch (err: any) {
      setError(err.message || 'Erro ao abrir portal.');
    } finally {
      setBillingLoading(false);
    }
  };

  // Already Pro view
  if (isPro) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '2rem 1rem', textAlign: 'center' }}>
        {successMsg && (
          <div style={{ ...cardStyle, padding: '1rem', marginBottom: '1rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontSize: '0.85rem' }}>
            🎉 {successMsg}
          </div>
        )}
        <Crown size={48} color="#f59e0b" style={{ marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: theme.text, marginBottom: '0.5rem' }}>
          Você é Pro!
        </h2>
        <p style={{ color: theme.textSecondary, marginBottom: '1.5rem', fontSize: '0.85rem' }}>
          Todos os recursos exclusivos estão desbloqueados.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/dashboard')} style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.6rem 1.2rem', borderRadius: 8, border: `1px solid ${theme.border}`,
            background: 'transparent', color: theme.text, cursor: 'pointer', fontSize: '0.85rem',
            WebkitAppearance: 'none' as any,
          }}>
            <ArrowLeft size={16} /> Voltar ao Dashboard
          </button>
          <button onClick={handleManageBilling} disabled={billingLoading} style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.6rem 1.2rem', borderRadius: 8, border: `1px solid ${theme.border}`,
            background: 'transparent', color: theme.text, cursor: 'pointer', fontSize: '0.85rem',
            WebkitAppearance: 'none' as any, opacity: billingLoading ? 0.6 : 1,
          }}>
            {billingLoading ? <Loader2 size={16} className="spin" /> : <Settings size={16} />}
            Gerenciar Assinatura
          </button>
        </div>
        {error && <div style={{ marginTop: '0.75rem', color: '#ef4444', fontSize: '0.8rem' }}>{error}</div>}
        <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const proFeatures = [
    { icon: <Zap size={20} />, title: `Todas as ${UNIVERSE_SIZE_FALLBACK} ações`, desc: 'Acesso completo a todas as recomendações diárias' },
    { icon: <Target size={20} />, title: 'Confiança, Stop-Loss & Take-Profit', desc: 'Colunas exclusivas desbloqueadas sem blur' },
    { icon: <Briefcase size={20} />, title: 'Carteira Modelo', desc: 'Top 5 ações com alocação otimizada por risco' },
    { icon: <LineChart size={20} />, title: 'Tracking por Safra', desc: 'Acompanhe o progresso diário de cada safra' },
    { icon: <Shield size={20} />, title: 'Portfólio Otimizado', desc: 'Alocação inteligente com Markowitz e análise de risco' },
  ];

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '1rem 0' }}>
      {/* Success message */}
      {successMsg && (
        <div style={{ ...cardStyle, padding: '1rem', marginBottom: '1rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontSize: '0.85rem', textAlign: 'center' }}>
          <Loader2 size={16} className="spin" style={{ verticalAlign: 'middle', marginRight: 6 }} />
          {successMsg}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div style={{ ...cardStyle, padding: '1rem', marginBottom: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '0.85rem', textAlign: 'center' }}>
          {error}
        </div>
      )}

      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1rem', boxShadow: '0 4px 20px rgba(245,158,11,0.3)',
        }}>
          <Crown size={32} color="white" />
        </div>
        <h1 style={{ fontSize: 'clamp(1.3rem, 4vw, 1.6rem)', fontWeight: 800, color: theme.text, marginBottom: '0.5rem' }}>
          Upgrade para Pro
        </h1>
        <p style={{ color: theme.textSecondary, fontSize: '0.9rem', lineHeight: 1.5 }}>
          Desbloqueie recursos avançados e tome decisões mais informadas.
        </p>
      </div>

      {/* Features */}
      <div style={{ ...cardStyle, padding: '1.25rem', marginBottom: '1.25rem' }}>
        {proFeatures.map((f, i) => (
          <div key={i} style={{
            display: 'flex', gap: '0.75rem', padding: '0.65rem 0',
            borderBottom: i < proFeatures.length - 1 ? `1px solid ${theme.border}` : 'none',
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{f.icon}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text }}>{f.title}</div>
              <div style={{ fontSize: '0.73rem', color: theme.textSecondary }}>{f.desc}</div>
            </div>
            <CheckCircle size={18} color="#10b981" style={{ marginLeft: 'auto', flexShrink: 0, alignSelf: 'center' }} />
          </div>
        ))}
      </div>

      {/* Price + CTA */}
      <div style={{
        ...cardStyle, padding: '1.5rem', textAlign: 'center', marginBottom: '1.25rem',
        background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(217,119,6,0.05))',
        border: '1px solid rgba(245,158,11,0.2)',
      }}>
        <div style={{ fontSize: '0.8rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>Plano Pro</div>
        <div style={{ marginBottom: '0.5rem' }}>
          <span style={{ fontSize: 'clamp(2rem, 5vw, 2.5rem)', fontWeight: 800, color: theme.text }}>{PRO_PRICE}</span>
          <span style={{ color: theme.textSecondary, fontSize: '0.9rem' }}>/mês</span>
        </div>

        {/* Guarantee badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
          padding: '0.3rem 0.75rem', borderRadius: 20, marginBottom: '1rem',
          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
          fontSize: '0.72rem', color: '#10b981', fontWeight: 600,
        }}>
          <Shield size={12} /> 7 dias de garantia — não gostou, devolvemos
        </div>

        {/* Stripe Checkout CTA — primary */}
        <button onClick={handleCheckout} disabled={loading}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
          style={{
            ...btnBase,
            background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white',
            boxShadow: '0 4px 14px rgba(245,158,11,0.3)',
            opacity: loading ? 0.7 : 1,
          }}>
          {loading ? <Loader2 size={20} className="spin" /> : <CreditCard size={20} />}
          {loading ? 'Redirecionando...' : `Assinar Pro — ${PRO_PRICE_LABEL}`}
        </button>

        <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
          <Shield size={10} /> Pagamento seguro via Stripe · Cancele quando quiser
        </div>
      </div>

      {/* Free vs Pro comparison */}
      <div style={{ ...cardStyle, padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: theme.text, marginBottom: '0.75rem' }}>Free vs Pro</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${theme.border}` }}>
              <th style={{ padding: '0.5rem', textAlign: 'left', color: theme.textSecondary, fontWeight: 600 }}>Recurso</th>
              <th style={{ padding: '0.5rem', textAlign: 'center', color: theme.textSecondary, fontWeight: 600 }}>Free</th>
              <th style={{ padding: '0.5rem', textAlign: 'center', color: '#f59e0b', fontWeight: 600 }}>Pro</th>
            </tr>
          </thead>
          <tbody>
            {[
              { feature: `Recomendações diárias (${UNIVERSE_SIZE_FALLBACK} ações)`, free: true, pro: true },
              { feature: 'Explicabilidade (SHAP)', free: true, pro: true },
              { feature: 'Backtesting com dados reais', free: true, pro: true },
              { feature: 'Performance acumulada', free: true, pro: true },
              { feature: 'Confiança do modelo', free: false, pro: true },
              { feature: 'Stop-Loss e Take-Profit', free: false, pro: true },
              { feature: 'Tracking por Safra', free: false, pro: true },
              { feature: 'Carteira Modelo otimizada', free: false, pro: true },
              { feature: 'Portfólio com perfis de risco', free: false, pro: true },
              { feature: 'Ranking de confiança', free: false, pro: true },
            ].map((row, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${theme.border}` }}>
                <td style={{ padding: '0.45rem 0.5rem', color: theme.text }}>{row.feature}</td>
                <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center' }}>
                  {row.free
                    ? <span style={{ color: '#10b981' }}>✓</span>
                    : <span style={{ color: theme.textSecondary, opacity: 0.4 }}>✗</span>
                  }
                </td>
                <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center' }}>
                  <span style={{ color: '#10b981' }}>✓</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FAQ */}
      <div style={{ ...cardStyle, padding: '1.25rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: theme.text, marginBottom: '0.75rem' }}>Perguntas Frequentes</div>
        {[
          { q: 'Posso cancelar a qualquer momento?', a: 'Sim, sem fidelidade. Cancele direto pelo portal de pagamento a qualquer momento.' },
          { q: 'E se eu não gostar?', a: 'Você tem 7 dias de garantia. Se não ficar satisfeito, devolvemos 100% do valor.' },
          { q: 'Como funciona a ativação?', a: 'Ativação instantânea após a confirmação do pagamento.' },
          { q: 'Quais formas de pagamento?', a: 'Cartão de crédito ou débito, processado com segurança via Stripe.' },
        ].map((faq, i) => (
          <div key={i} style={{ marginBottom: i < 3 ? '0.75rem' : 0, paddingBottom: i < 3 ? '0.75rem' : 0, borderBottom: i < 3 ? `1px solid ${theme.border}` : 'none' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: theme.text, marginBottom: '0.2rem' }}>{faq.q}</div>
            <div style={{ fontSize: '0.75rem', color: theme.textSecondary, lineHeight: 1.5 }}>{faq.a}</div>
          </div>
        ))}
      </div>

      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default UpgradePage;
