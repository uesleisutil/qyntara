import React from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Crown, CheckCircle, Briefcase, LineChart, Shield, Target, Zap, ArrowLeft, MessageCircle, Mail, Clock, Star } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

const UpgradePage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isPro = user?.plan === 'pro' || user?.role === 'admin';

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1e293b' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12,
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
          WebkitAppearance: 'none' as any, appearance: 'none' as any,
        }}>
          <ArrowLeft size={16} /> Voltar ao Dashboard
        </button>
      </div>
    );
  }

  const proFeatures = [
    { icon: <Zap size={20} />, title: 'Todas as 46 ações', desc: 'Acesso completo a todas as recomendações diárias' },
    { icon: <Target size={20} />, title: 'Confiança, Stop-Loss & Take-Profit', desc: 'Colunas exclusivas desbloqueadas sem blur' },
    { icon: <Briefcase size={20} />, title: 'Carteira Modelo', desc: 'Top 5 ações com alocação otimizada por risco' },
    { icon: <LineChart size={20} />, title: 'Tracking por Safra', desc: 'Acompanhe o progresso diário de cada safra' },
    { icon: <Shield size={20} />, title: 'Portfólio Otimizado', desc: 'Alocação inteligente com Markowitz e análise de risco' },
  ];

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '1rem 0' }}>
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
          <span style={{ fontSize: 'clamp(2rem, 5vw, 2.5rem)', fontWeight: 800, color: theme.text }}>R$ 49</span>
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

        {/* WhatsApp CTA — primary */}
        <a href="https://wa.me/5548999999999?text=Ol%C3%A1!%20Quero%20assinar%20o%20plano%20Pro%20do%20B3%20Tactical%20Ranking."
          target="_blank" rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            width: '100%', padding: '0.85rem', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #25d366, #128c7e)', color: 'white',
            fontSize: '1rem', fontWeight: 700, textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(37,211,102,0.3)',
            WebkitAppearance: 'none' as any, transition: 'transform 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <MessageCircle size={20} /> Assinar via WhatsApp
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.75rem 0', color: theme.textSecondary, fontSize: '0.75rem' }}>
          <div style={{ flex: 1, height: 1, background: theme.border }} />
          ou
          <div style={{ flex: 1, height: 1, background: theme.border }} />
        </div>

        {/* Email CTA — secondary */}
        <a href="mailto:ueslei@outlook.com?subject=Quero%20assinar%20o%20Pro%20-%20B3%20Tactical%20Ranking"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            width: '100%', padding: '0.7rem', borderRadius: 10, textDecoration: 'none',
            border: `1px solid ${theme.border}`, background: 'transparent', color: theme.text,
            fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
            WebkitAppearance: 'none' as any,
          }}
        >
          <Mail size={16} /> ueslei@outlook.com
        </a>
      </div>

      {/* Pix payment info */}
      <div style={{ ...cardStyle, padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Star size={16} color="#f59e0b" />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: theme.text }}>Pagamento via Pix</span>
        </div>
        <div style={{ fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.7 }}>
          <div style={{ marginBottom: '0.5rem' }}>
            1. Envie <strong style={{ color: theme.text }}>R$ 49,00</strong> via Pix para:
          </div>
          <div style={{
            padding: '0.6rem 0.75rem', borderRadius: 8, marginBottom: '0.5rem',
            background: darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)',
            border: `1px solid ${darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)'}`,
            fontFamily: 'monospace', fontSize: '0.82rem', color: theme.text, wordBreak: 'break-all',
          }}>
            ueslei@outlook.com
          </div>
          <div>2. Envie o comprovante pelo WhatsApp ou e-mail</div>
          <div>3. Seu plano será ativado em até 1h</div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.75rem',
          padding: '0.4rem 0.6rem', borderRadius: 8,
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)',
          fontSize: '0.72rem', color: '#f59e0b',
        }}>
          <Clock size={12} /> Ative em até 1h após pagamento
        </div>
      </div>

      {/* FAQ */}
      <div style={{ ...cardStyle, padding: '1.25rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: theme.text, marginBottom: '0.75rem' }}>Perguntas Frequentes</div>
        {[
          { q: 'Posso cancelar a qualquer momento?', a: 'Sim, sem fidelidade. Basta avisar pelo WhatsApp ou e-mail.' },
          { q: 'E se eu não gostar?', a: 'Você tem 7 dias de garantia. Se não ficar satisfeito, devolvemos 100% do valor.' },
          { q: 'Como funciona a ativação?', a: 'Após o pagamento, enviamos a confirmação e seu plano é ativado em até 1 hora.' },
        ].map((faq, i) => (
          <div key={i} style={{ marginBottom: i < 2 ? '0.75rem' : 0, paddingBottom: i < 2 ? '0.75rem' : 0, borderBottom: i < 2 ? `1px solid ${theme.border}` : 'none' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: theme.text, marginBottom: '0.2rem' }}>{faq.q}</div>
            <div style={{ fontSize: '0.75rem', color: theme.textSecondary, lineHeight: 1.5 }}>{faq.a}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UpgradePage;
