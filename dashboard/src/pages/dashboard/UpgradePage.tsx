import React from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Crown, CheckCircle, Briefcase, LineChart, Shield, Target, Zap, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const UpgradePage: React.FC = () => {
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isPro = user?.plan === 'pro' || user?.role === 'admin';

  const theme = {
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    cardBg: darkMode ? '#1e293b' : 'white',
  };

  if (isPro) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <Crown size={48} color="#f59e0b" style={{ marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: theme.text, marginBottom: '0.5rem' }}>
          Você já é Pro!
        </h2>
        <p style={{ color: theme.textSecondary, marginBottom: '1.5rem' }}>
          Todos os recursos exclusivos estão desbloqueados.
        </p>
        <button onClick={() => navigate('/dashboard')} style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.6rem 1.2rem', borderRadius: 8, border: `1px solid ${theme.border}`,
          background: 'transparent', color: theme.text, cursor: 'pointer', fontSize: '0.85rem',
          WebkitAppearance: 'none', appearance: 'none',
        }}>
          <ArrowLeft size={16} /> Voltar ao Dashboard
        </button>
      </div>
    );
  }

  const proFeatures = [
    { icon: <Briefcase size={20} />, title: 'Carteira Modelo', desc: 'Top 5 ações com alocação otimizada por risco' },
    { icon: <LineChart size={20} />, title: 'Performance Acumulada', desc: 'Retorno histórico dos sinais vs Ibovespa' },
    { icon: <Shield size={20} />, title: 'Stop-Loss & Take-Profit', desc: 'Níveis automáticos de proteção e alvo' },
    { icon: <Target size={20} />, title: 'Ranking de Confiança', desc: 'Score de confiança por ação (0-100%)' },
    { icon: <Zap size={20} />, title: 'Todas as 46 ações', desc: 'Acesso completo a todas as recomendações' },
  ];

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '1rem 0' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
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
      <div style={{
        background: theme.cardBg, border: `1px solid ${theme.border}`,
        borderRadius: 16, padding: '1.5rem', marginBottom: '1.5rem',
      }}>
        {proFeatures.map((f, i) => (
          <div key={i} style={{
            display: 'flex', gap: '0.75rem', padding: '0.75rem 0',
            borderBottom: i < proFeatures.length - 1 ? `1px solid ${theme.border}` : 'none',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{f.icon}</div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text }}>{f.title}</div>
              <div style={{ fontSize: '0.75rem', color: theme.textSecondary }}>{f.desc}</div>
            </div>
            <CheckCircle size={18} color="#10b981" style={{ marginLeft: 'auto', flexShrink: 0, alignSelf: 'center' }} />
          </div>
        ))}
      </div>

      {/* Price */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(217,119,6,0.05))',
        border: '1px solid rgba(245,158,11,0.2)', borderRadius: 16,
        padding: '1.5rem', textAlign: 'center', marginBottom: '1.5rem',
      }}>
        <div style={{ fontSize: '0.8rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>Plano Pro</div>
        <div style={{ marginBottom: '0.75rem' }}>
          <span style={{ fontSize: 'clamp(2rem, 5vw, 2.5rem)', fontWeight: 800, color: theme.text }}>R$ 49</span>
          <span style={{ color: theme.textSecondary, fontSize: '0.9rem' }}>/mês</span>
        </div>
        <button onClick={() => alert('Integração com gateway de pagamento em breve! Entre em contato: ueslei@outlook.com')} style={{
          width: '100%', padding: '0.85rem', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white',
          fontSize: '1rem', fontWeight: 700, boxShadow: '0 4px 14px rgba(245,158,11,0.3)',
          WebkitAppearance: 'none', appearance: 'none',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          Assinar Pro
        </button>
        <p style={{ fontSize: '0.7rem', color: theme.textSecondary, marginTop: '0.5rem' }}>
          Cancele quando quiser · Sem fidelidade
        </p>
      </div>
    </div>
  );
};

export default UpgradePage;
