import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { apiFetch } from '../hooks/useApi';
import { theme, badgeStyle } from '../styles';
import {
  Settings, Key, CreditCard, Trash2, AlertTriangle,
  Shield, Heart, Zap, Crown, Star, ExternalLink, Eye, EyeOff, Loader2,
} from 'lucide-react';

interface Props {
  dark?: boolean;
  onSwitchTab: (tab: string) => void;
}

export const SettingsPage: React.FC<Props> = ({ onSwitchTab }) => {
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const tier = user?.tier || 'free';

  if (!user) return null;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', animation: 'fadeIn 0.4s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.5rem' }}>
        <Settings size={20} color={theme.accent} />
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Configurações</h2>
      </div>

      {/* Profile info */}
      <Section title="Perfil">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: theme.accentBg, color: theme.accent, fontSize: '1.1rem', fontWeight: 700,
          }}>{(user.name || user.email).charAt(0).toUpperCase()}</div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{user.name || 'Sem nome'}</div>
            <div style={{ fontSize: '0.78rem', color: theme.textSecondary }}>{user.email}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <span style={badgeStyle(
                tier === 'quant' ? theme.yellow : tier === 'pro' ? theme.accent : theme.textMuted,
                tier === 'quant' ? theme.yellowBg : tier === 'pro' ? theme.accentBg : `${theme.textMuted}15`,
              )}>{tier.toUpperCase()}</span>
              {user.email_verified
                ? <span style={badgeStyle(theme.green, theme.greenBg)}>VERIFICADO</span>
                : <span style={badgeStyle(theme.yellow, theme.yellowBg)}>NÃO VERIFICADO</span>
              }
            </div>
          </div>
        </div>
      </Section>

      {/* Change password */}
      <Section title="Alterar senha" icon={<Key size={16} />}>
        <ChangePasswordForm />
      </Section>

      {/* Plan management */}
      <Section title="Plano e assinatura" icon={<CreditCard size={16} />}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              {tier === 'quant' ? <Crown size={16} color={theme.yellow} /> : tier === 'pro' ? <Zap size={16} color={theme.accent} /> : <Star size={16} color={theme.textMuted} />}
              Plano {tier.charAt(0).toUpperCase() + tier.slice(1)}
            </div>
            <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginTop: 4 }}>
              {tier === 'free' ? 'Faça upgrade para desbloquear todos os recursos.' : 'Gerencie sua assinatura pelo portal Stripe.'}
            </div>
          </div>
          {tier === 'free' ? (
            <button onClick={() => onSwitchTab('billing')} style={{
              padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
              background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
              color: '#fff', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
            }}>Fazer upgrade</button>
          ) : (
            <ManageSubscriptionButton />
          )}
        </div>
      </Section>

      {/* Cancel subscription (only for paid users) */}
      {tier !== 'free' && (
        <Section title="Cancelar assinatura" icon={<AlertTriangle size={16} color={theme.yellow} />}>
          <CancelSubscriptionFlow tier={tier} onSwitchTab={onSwitchTab} />
        </Section>
      )}

      {/* Delete account */}
      <Section title="Excluir conta" icon={<Trash2 size={16} color={theme.red} />} danger>
        <DeleteAccountFlow logout={logout} onSwitchTab={onSwitchTab} tier={tier} />
      </Section>
    </div>
  );
};

/* ── Section wrapper ── */
const Section: React.FC<{ title: string; icon?: React.ReactNode; danger?: boolean; children: React.ReactNode }> = ({ title, icon, danger, children }) => (
  <div style={{
    background: theme.card, border: `1px solid ${danger ? `${theme.red}20` : theme.border}`,
    borderRadius: 16, padding: '1.25rem', marginBottom: '1rem',
    transition: 'all 0.2s',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
      {icon}
      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: danger ? theme.red : theme.text }}>{title}</span>
    </div>
    {children}
  </div>
);

/* ── Change password ── */
const ChangePasswordForm: React.FC = () => {
  const [current, setCurrent] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const inp: React.CSSProperties = {
    width: '100%', padding: '0.6rem 0.85rem', borderRadius: 10,
    border: `1px solid ${theme.border}`, background: theme.bg,
    color: theme.text, fontSize: '0.82rem', outline: 'none', fontFamily: 'inherit',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPw !== confirm) { setError('As senhas não coincidem.'); return; }
    if (newPw.length < 8) { setError('Nova senha deve ter pelo menos 8 caracteres.'); return; }
    setLoading(true);
    try {
      const res = await apiFetch('/auth/change-password', {
        method: 'PUT', body: JSON.stringify({ current_password: current, new_password: newPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erro ao alterar senha');
      useToastStore.getState().addToast('Senha alterada com sucesso!', 'success');
      setCurrent(''); setNewPw(''); setConfirm('');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ position: 'relative' }}>
        <input type={showCurrent ? 'text' : 'password'} placeholder="Senha atual" value={current}
          onChange={e => setCurrent(e.target.value)} required style={{ ...inp, paddingRight: 40 }} />
        <button type="button" onClick={() => setShowCurrent(!showCurrent)} style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted,
        }}>{showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ position: 'relative' }}>
          <input type={showNew ? 'text' : 'password'} placeholder="Nova senha" value={newPw}
            onChange={e => setNewPw(e.target.value)} required minLength={8} style={{ ...inp, paddingRight: 40 }} />
          <button type="button" onClick={() => setShowNew(!showNew)} style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted,
          }}>{showNew ? <EyeOff size={15} /> : <Eye size={15} />}</button>
        </div>
        <input type="password" placeholder="Confirmar nova senha" value={confirm}
          onChange={e => setConfirm(e.target.value)} required style={inp} />
      </div>
      {error && <div style={{ fontSize: '0.75rem', color: theme.red }}>{error}</div>}
      <button type="submit" disabled={loading} style={{
        padding: '0.55rem 1.2rem', borderRadius: 8, border: 'none', alignSelf: 'flex-start',
        background: theme.accent, color: '#fff', fontWeight: 600, fontSize: '0.8rem',
        cursor: 'pointer', opacity: loading ? 0.7 : 1,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
        Alterar senha
      </button>
    </form>
  );
};

/* ── Manage subscription button ── */
const ManageSubscriptionButton: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const handleManage = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else useToastStore.getState().addToast(data.detail || 'Erro ao abrir portal.', 'error');
    } catch { useToastStore.getState().addToast('Erro ao conectar.', 'error'); }
    finally { setLoading(false); }
  };
  return (
    <button onClick={handleManage} disabled={loading} style={{
      padding: '0.5rem 1rem', borderRadius: 8, border: `1px solid ${theme.border}`,
      background: 'transparent', color: theme.textSecondary, fontWeight: 500, fontSize: '0.8rem',
      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <ExternalLink size={13} />}
      Gerenciar no Stripe
    </button>
  );
};

/* ── Cancel subscription flow (retention UX) ── */
const CancelSubscriptionFlow: React.FC<{ tier: string; onSwitchTab: (t: string) => void }> = ({ tier }) => {
  const [step, setStep] = useState<'idle' | 'reasons' | 'offer' | 'confirm'>('idle');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const reasons = [
    'Muito caro para mim',
    'Não estou usando o suficiente',
    'Não encontrei valor nos sinais',
    'Vou usar outra plataforma',
    'Problemas técnicos',
    'Outro motivo',
  ];

  const handleCancel = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { useToastStore.getState().addToast('Erro ao conectar.', 'error'); }
    finally { setLoading(false); }
  };

  if (step === 'idle') {
    return (
      <div>
        <p style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: 12, lineHeight: 1.6 }}>
          Ao cancelar, você perderá acesso aos recursos do plano {tier.toUpperCase()} no final do período de cobrança atual.
        </p>
        <button onClick={() => setStep('reasons')} style={{
          padding: '0.5rem 1rem', borderRadius: 8, border: `1px solid ${theme.yellow}30`,
          background: 'transparent', color: theme.yellow, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
        }}>Quero cancelar</button>
      </div>
    );
  }

  if (step === 'reasons') {
    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 10 }}>Sentimos muito! Pode nos dizer o motivo?</p>
        <p style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: 14 }}>Seu feedback nos ajuda a melhorar.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {reasons.map(r => (
            <label key={r} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '0.55rem 0.85rem',
              borderRadius: 10, border: `1px solid ${reason === r ? theme.accentBorder : theme.border}`,
              background: reason === r ? theme.accentBg : 'transparent',
              cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.15s',
            }}>
              <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)}
                style={{ accentColor: theme.accent }} />
              {r}
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setStep('idle')} style={{
            padding: '0.5rem 1rem', borderRadius: 8, border: `1px solid ${theme.border}`,
            background: 'transparent', color: theme.textSecondary, fontSize: '0.8rem', cursor: 'pointer',
          }}>Voltar</button>
          <button onClick={() => setStep(reason === 'Muito caro para mim' ? 'offer' : 'confirm')}
            disabled={!reason} style={{
            padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
            background: reason ? theme.yellow : theme.border, color: reason ? '#000' : theme.textMuted,
            fontWeight: 600, fontSize: '0.8rem', cursor: reason ? 'pointer' : 'default',
          }}>Continuar</button>
        </div>
      </div>
    );
  }

  if (step === 'offer') {
    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        <div style={{
          padding: '1.25rem', borderRadius: 14, marginBottom: 14,
          background: `linear-gradient(135deg, ${theme.accent}10, ${theme.purple}10)`,
          border: `1px solid ${theme.accentBorder}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Heart size={18} color={theme.accent} />
            <span style={{ fontSize: '0.92rem', fontWeight: 700 }}>Que tal um desconto?</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: theme.textSecondary, lineHeight: 1.6, marginBottom: 14 }}>
            Entendemos que o preço pode pesar. Que tal continuar com o plano Pro por
            <span style={{ color: theme.green, fontWeight: 700 }}> 50% de desconto no próximo mês</span>?
            Você mantém todos os recursos sem interrupção.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setStep('idle'); useToastStore.getState().addToast('Ótimo! Seu desconto será aplicado na próxima cobrança.', 'success'); }}
              style={{
                padding: '0.55rem 1.2rem', borderRadius: 8, border: 'none',
                background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
                color: '#fff', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
              }}>Aceitar desconto</button>
            <button onClick={() => setStep('confirm')} style={{
              padding: '0.55rem 1rem', borderRadius: 8, border: `1px solid ${theme.border}`,
              background: 'transparent', color: theme.textMuted, fontSize: '0.8rem', cursor: 'pointer',
            }}>Não, quero cancelar</button>
          </div>
        </div>
      </div>
    );
  }

  // confirm step
  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{
        padding: '1rem', borderRadius: 12, background: theme.yellowBg,
        border: `1px solid ${theme.yellow}20`, marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <AlertTriangle size={16} color={theme.yellow} />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: theme.yellow }}>Você vai perder acesso a:</span>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.78rem', color: theme.textSecondary }}>
          {tier === 'quant' && <li style={{ padding: '3px 0' }}>• Alertas de Smart Money e detecção de anomalias</li>}
          {tier === 'quant' && <li style={{ padding: '3px 0' }}>• Acesso à API e simulações Monte Carlo</li>}
          <li style={{ padding: '3px 0' }}>• Sinais de IA ilimitados</li>
          <li style={{ padding: '3px 0' }}>• Scanner de arbitragem cross-plataforma</li>
          <li style={{ padding: '3px 0' }}>• Análise de sentimento completa</li>
          <li style={{ padding: '3px 0' }}>• Alertas por email</li>
        </ul>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setStep('idle')} style={{
          padding: '0.55rem 1.2rem', borderRadius: 8, border: 'none',
          background: theme.accent, color: '#fff', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
        }}>Manter meu plano</button>
        <button onClick={handleCancel} disabled={loading} style={{
          padding: '0.55rem 1rem', borderRadius: 8, border: `1px solid ${theme.red}30`,
          background: 'transparent', color: theme.red, fontSize: '0.8rem', cursor: 'pointer',
          fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {loading && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
          Cancelar assinatura
        </button>
      </div>
    </div>
  );
};

/* ── Delete account flow (retention UX) ── */
const DeleteAccountFlow: React.FC<{ logout: () => void; onSwitchTab: (t: string) => void; tier: string }> = ({ logout, onSwitchTab, tier }) => {
  const [step, setStep] = useState<'idle' | 'warning' | 'confirm'>('idle');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== 'EXCLUIR') return;
    setLoading(true);
    try {
      const res = await apiFetch('/auth/delete-account', { method: 'DELETE' });
      if (res.ok) {
        useToastStore.getState().addToast('Conta excluída com sucesso. Sentiremos sua falta.', 'success', 5000);
        logout();
        onSwitchTab('landing');
      } else {
        const data = await res.json();
        useToastStore.getState().addToast(data.detail || 'Erro ao excluir conta.', 'error');
      }
    } catch { useToastStore.getState().addToast('Erro ao excluir conta.', 'error'); }
    finally { setLoading(false); }
  };

  if (step === 'idle') {
    return (
      <div>
        <p style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: 12, lineHeight: 1.6 }}>
          Esta ação é permanente e irreversível. Todos os seus dados, posições, tickets e histórico serão excluídos conforme a LGPD.
        </p>
        <button onClick={() => setStep('warning')} style={{
          padding: '0.5rem 1rem', borderRadius: 8, border: `1px solid ${theme.red}30`,
          background: 'transparent', color: theme.red, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
        }}>Quero excluir minha conta</button>
      </div>
    );
  }

  if (step === 'warning') {
    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        {tier !== 'free' && (
          <div style={{
            padding: '1rem', borderRadius: 12, marginBottom: 14,
            background: `linear-gradient(135deg, ${theme.accent}10, ${theme.purple}10)`,
            border: `1px solid ${theme.accentBorder}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Shield size={16} color={theme.accent} />
              <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>Você tem um plano ativo!</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6, marginBottom: 10 }}>
              Você está no plano <span style={{ color: theme.accent, fontWeight: 600 }}>{tier.toUpperCase()}</span>.
              Em vez de excluir sua conta, considere fazer downgrade para o plano gratuito.
              Seus dados ficam salvos e você pode voltar quando quiser.
            </p>
            <button onClick={() => { setStep('idle'); onSwitchTab('billing'); }} style={{
              padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
              background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple})`,
              color: '#fff', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
            }}>Ver planos</button>
          </div>
        )}

        <div style={{
          padding: '1rem', borderRadius: 12, background: theme.redBg,
          border: `1px solid ${theme.red}20`, marginBottom: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <AlertTriangle size={16} color={theme.red} />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: theme.red }}>Isso não pode ser desfeito</span>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.78rem', color: theme.textSecondary }}>
            <li style={{ padding: '3px 0' }}>• Todas as suas posições e portfólio serão excluídos</li>
            <li style={{ padding: '3px 0' }}>• Histórico de sinais e tickets de suporte serão removidos</li>
            <li style={{ padding: '3px 0' }}>• Sua assinatura será cancelada automaticamente</li>
            <li style={{ padding: '3px 0' }}>• Você não poderá recuperar nenhum dado</li>
          </ul>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setStep('idle')} style={{
            padding: '0.55rem 1.2rem', borderRadius: 8, border: 'none',
            background: theme.accent, color: '#fff', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
          }}>Manter minha conta</button>
          <button onClick={() => setStep('confirm')} style={{
            padding: '0.55rem 1rem', borderRadius: 8, border: `1px solid ${theme.red}30`,
            background: 'transparent', color: theme.red, fontSize: '0.8rem', cursor: 'pointer',
          }}>Continuar com exclusão</button>
        </div>
      </div>
    );
  }

  // Final confirm step — type EXCLUIR
  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>Última confirmação</p>
      <p style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: 14, lineHeight: 1.6 }}>
        Digite <span style={{ color: theme.red, fontWeight: 700, fontFamily: 'monospace', background: theme.redBg, padding: '1px 6px', borderRadius: 4 }}>EXCLUIR</span> para confirmar a exclusão permanente da sua conta.
      </p>
      <input value={confirmText} onChange={e => setConfirmText(e.target.value)}
        placeholder="Digite EXCLUIR"
        style={{
          width: '100%', padding: '0.6rem 0.85rem', borderRadius: 10, marginBottom: 12,
          border: `1px solid ${confirmText === 'EXCLUIR' ? theme.red : theme.border}`,
          background: theme.bg, color: theme.text, fontSize: '0.85rem', outline: 'none',
          fontFamily: 'monospace',
        }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => { setStep('idle'); setConfirmText(''); }} style={{
          padding: '0.55rem 1.2rem', borderRadius: 8, border: 'none',
          background: theme.accent, color: '#fff', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
        }}>Cancelar</button>
        <button onClick={handleDelete} disabled={confirmText !== 'EXCLUIR' || loading} style={{
          padding: '0.55rem 1rem', borderRadius: 8, border: 'none',
          background: confirmText === 'EXCLUIR' ? theme.red : theme.border,
          color: confirmText === 'EXCLUIR' ? '#fff' : theme.textMuted,
          fontWeight: 600, fontSize: '0.82rem',
          cursor: confirmText === 'EXCLUIR' ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {loading && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
          Excluir minha conta permanentemente
        </button>
      </div>
    </div>
  );
};
