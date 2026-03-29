import React from 'react';
import { useApi } from '../../hooks/useApi';
import { theme } from '../../styles';
import {
  Server, Cpu, HardDrive, Database, Wifi, Shield, CheckCircle2, XCircle, Activity,
} from 'lucide-react';

export const AdminInfraPage: React.FC<{ dark?: boolean }> = () => {
  const { data, loading } = useApi<any>('/admin/infra', 15000);

  if (loading && !data) {
    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem' }}>
          <Server size={20} color={theme.accent} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Infraestrutura</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{
              height: 100, borderRadius: 14, border: `1px solid ${theme.border}`,
              background: `linear-gradient(90deg, ${theme.card} 25%, ${theme.cardHover} 50%, ${theme.card} 75%)`,
              backgroundSize: '200% 100%', animation: `shimmer 1.5s infinite ${i * 0.15}s`,
            }} />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { server, cpu, memory, disk, network, database: db, api, python_processes } = data;

  const usageColor = (pct: number) => pct > 90 ? theme.red : pct > 70 ? theme.yellow : theme.green;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeIn 0.4s ease' }}>

      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Server size={20} color={theme.accent} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Infraestrutura</h2>
        </div>
        <p style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
          Status do servidor, recursos e configurações
        </p>
      </div>

      {/* Server info */}
      <div style={{
        background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14,
        padding: '1.25rem', borderLeft: `3px solid ${theme.accent}`,
        animation: 'fadeIn 0.3s ease 0.05s both',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: theme.accentBg, color: theme.accent,
          }}><Server size={18} /></div>
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>Servidor</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {[
            { label: 'Plataforma', value: server?.platform },
            { label: 'Python', value: server?.python },
            { label: 'Hostname', value: server?.hostname },
            { label: 'Uptime', value: `${server?.uptime_hours || 0}h` },
          ].map((s, i) => (
            <div key={s.label} style={{
              padding: '0.65rem', background: theme.bg, borderRadius: 10,
              border: `1px solid ${theme.border}`, transition: 'all 0.2s',
              animation: `fadeIn 0.3s ease ${0.1 + i * 0.04}s both`,
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = theme.borderHover}
            onMouseLeave={e => e.currentTarget.style.borderColor = theme.border}>
              <div style={{ fontSize: '0.62rem', color: theme.textSecondary, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{s.value || '—'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Resource gauges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        {/* CPU */}
        <div style={{
          background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14,
          padding: '1.25rem', borderLeft: `3px solid ${theme.blue}`,
          animation: 'fadeIn 0.3s ease 0.1s both', transition: 'all 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = theme.borderHover}
        onMouseLeave={e => e.currentTarget.style.borderColor = theme.border}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: theme.blueBg, color: theme.blue,
            }}><Cpu size={16} /></div>
            <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>CPU</span>
            <span style={{ fontSize: '0.68rem', color: theme.textMuted, marginLeft: 'auto' }}>{cpu?.cores || 0} cores</span>
          </div>
          <GaugeBar label="Uso" percent={cpu?.percent || 0} detail={`${cpu?.percent || 0}% utilizado`} />
        </div>

        {/* Memory */}
        <div style={{
          background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14,
          padding: '1.25rem', borderLeft: `3px solid ${theme.purple}`,
          animation: 'fadeIn 0.3s ease 0.15s both', transition: 'all 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = theme.borderHover}
        onMouseLeave={e => e.currentTarget.style.borderColor = theme.border}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: theme.purpleBg, color: theme.purple,
            }}><Activity size={16} /></div>
            <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>Memória</span>
          </div>
          <GaugeBar label="RAM" percent={memory?.percent || 0}
            detail={`${memory?.used_gb || 0} / ${memory?.total_gb || 0} GB`} />
        </div>

        {/* Disk */}
        <div style={{
          background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14,
          padding: '1.25rem', borderLeft: `3px solid ${theme.yellow}`,
          animation: 'fadeIn 0.3s ease 0.2s both', transition: 'all 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = theme.borderHover}
        onMouseLeave={e => e.currentTarget.style.borderColor = theme.border}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: theme.yellowBg, color: theme.yellow,
            }}><HardDrive size={16} /></div>
            <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>Disco</span>
          </div>
          <GaugeBar label="Armazenamento" percent={disk?.percent || 0}
            detail={`${disk?.used_gb || 0} / ${disk?.total_gb || 0} GB`} />
        </div>
      </div>

      {/* Network + DB + Config */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        {/* Network */}
        <div style={{
          background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14,
          padding: '1.25rem', borderLeft: `3px solid ${theme.cyan}`,
          animation: 'fadeIn 0.3s ease 0.25s both', transition: 'all 0.2s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `${theme.cyan}12`, color: theme.cyan,
            }}><Wifi size={16} /></div>
            <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>Rede</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ padding: '0.65rem', background: theme.bg, borderRadius: 10, border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: '0.62rem', color: theme.textSecondary, marginBottom: 4 }}>Enviado</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>{network?.bytes_sent_mb || 0} MB</div>
            </div>
            <div style={{ padding: '0.65rem', background: theme.bg, borderRadius: 10, border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: '0.62rem', color: theme.textSecondary, marginBottom: 4 }}>Recebido</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>{network?.bytes_recv_mb || 0} MB</div>
            </div>
          </div>
        </div>

        {/* Database */}
        <div style={{
          background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14,
          padding: '1.25rem', borderLeft: `3px solid ${theme.green}`,
          animation: 'fadeIn 0.3s ease 0.3s both', transition: 'all 0.2s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: theme.greenBg, color: theme.green,
            }}><Database size={16} /></div>
            <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>Banco de Dados</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: theme.textSecondary, marginBottom: 6 }}>{db?.path || '—'}</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{db?.size_mb || 0} MB</div>
        </div>

        {/* Config Health */}
        <div style={{
          background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14,
          padding: '1.25rem', borderLeft: `3px solid ${theme.red}`,
          animation: 'fadeIn 0.3s ease 0.35s both', transition: 'all 0.2s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: theme.redBg, color: theme.red,
            }}><Shield size={16} /></div>
            <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>Saúde da Config</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <StatusDot ok={api?.jwt_configured} label={`JWT Secret ${api?.jwt_configured ? '(seguro)' : '(fraco!)'}`} />
            <StatusDot ok={api?.stripe_configured} label={`Stripe ${api?.stripe_configured ? 'configurado' : 'não configurado'}`} />
            <StatusDot ok={api?.env === 'production'} label={`Ambiente: ${api?.env || 'desconhecido'}`} />
          </div>
        </div>
      </div>

      {/* Python processes */}
      {python_processes && python_processes.length > 0 && (
        <div style={{
          background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14,
          padding: '1.25rem', overflow: 'hidden',
          animation: 'fadeIn 0.4s ease 0.4s both',
        }}>
          <div style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '1rem' }}>Processos Python</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                {['PID', 'Nome', 'CPU %', 'Memória %'].map(h => (
                  <th key={h} style={{
                    padding: '0.55rem 0.65rem', textAlign: 'left', color: theme.textMuted,
                    fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {python_processes.map((p: any) => (
                <tr key={p.pid} style={{ borderBottom: `1px solid ${theme.border}`, transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = theme.cardHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '0.55rem 0.65rem', fontFamily: 'monospace', fontSize: '0.75rem', color: theme.textSecondary }}>{p.pid}</td>
                  <td style={{ padding: '0.55rem 0.65rem' }}>{p.name}</td>
                  <td style={{ padding: '0.55rem 0.65rem' }}>
                    <span style={{ color: usageColor(p.cpu_percent || 0), fontWeight: 600 }}>
                      {p.cpu_percent?.toFixed(1) || 0}%
                    </span>
                  </td>
                  <td style={{ padding: '0.55rem 0.65rem' }}>
                    <span style={{ color: usageColor(p.memory_percent || 0), fontWeight: 600 }}>
                      {p.memory_percent?.toFixed(1) || 0}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* ── Reusable components ── */

const GaugeBar: React.FC<{ label: string; percent: number; detail: string }> = ({ label, percent, detail }) => {
  const color = percent > 90 ? theme.red : percent > 70 ? theme.yellow : theme.green;
  return (
    <div style={{ padding: '0.75rem', background: theme.bg, borderRadius: 10, border: `1px solid ${theme.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: '0.78rem', fontWeight: 800, color }}>{percent}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: theme.border, overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min(percent, 100)}%`, height: '100%', borderRadius: 4,
          background: `linear-gradient(90deg, ${color}80, ${color})`,
          transition: 'width 0.8s ease',
          boxShadow: `0 0 6px ${color}30`,
        }} />
      </div>
      <div style={{ fontSize: '0.68rem', color: theme.textMuted, marginTop: 6 }}>{detail}</div>
    </div>
  );
};

const StatusDot: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.35rem 0' }}>
    {ok ? <CheckCircle2 size={15} color={theme.green} /> : <XCircle size={15} color={theme.red} />}
    <span style={{ fontSize: '0.78rem', color: ok ? theme.green : theme.red, fontWeight: 500 }}>{label}</span>
  </div>
);
