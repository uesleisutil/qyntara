import React from 'react';
import { theme } from '../styles';
import { Check, X } from 'lucide-react';

interface Props { password: string; }

const RULES = [
  { label: 'Mín. 8 caracteres', test: (p: string) => p.length >= 8 },
  { label: 'Letra maiúscula', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Letra minúscula', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Número', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Caractere especial (!@#$...)', test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

export const PasswordStrength: React.FC<Props> = ({ password }) => {
  if (!password) return null;

  const passed = RULES.filter(r => r.test(password)).length;
  const total = RULES.length;
  const pct = (passed / total) * 100;
  const color = pct <= 40 ? theme.red : pct <= 60 ? theme.yellow : pct <= 80 ? theme.blue : theme.green;
  const label = pct <= 40 ? 'Fraca' : pct <= 60 ? 'Razoável' : pct <= 80 ? 'Boa' : 'Forte';

  return (
    <div style={{ marginTop: 8 }}>
      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ flex: 1, height: 4, borderRadius: 2, background: theme.border, overflow: 'hidden' }}>
          <div style={{
            width: `${pct}%`, height: '100%', borderRadius: 2,
            background: `linear-gradient(90deg, ${color}80, ${color})`,
            transition: 'width 0.3s ease, background 0.3s ease',
          }} />
        </div>
        <span style={{ fontSize: '0.65rem', fontWeight: 600, color, minWidth: 50 }}>{label}</span>
      </div>
      {/* Rules checklist */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
        {RULES.map(r => {
          const ok = r.test(password);
          return (
            <span key={r.label} style={{
              fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: 3,
              color: ok ? theme.green : theme.textMuted,
              transition: 'color 0.2s',
            }}>
              {ok ? <Check size={10} /> : <X size={10} />} {r.label}
            </span>
          );
        })}
      </div>
    </div>
  );
};
