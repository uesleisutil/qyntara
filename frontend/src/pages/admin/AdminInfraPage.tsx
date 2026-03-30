import React from 'react';
import { useApi } from '../../hooks/useApi';
import { theme } from '../../styles';
import { Server, Cpu, HardDrive, Database, Wifi, Shield, CheckCircle2, XCircle, Activity } from 'lucide-react';

export const AdminInfraPage: React.FC<{ dark?: boolean }> = () => {
  const { data, loading } = useApi<any>('/admin/infra', 15000);

  if (loading && !data) {
    return (
      <div>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4 }}>Infraestrutura</h2>
          <p style={{ fontSize: '0.75rem', color: theme.textMuted }}>Carregando...</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 90, borderRadius: 12, border: `1px solid ${theme.border}`, background: `linear-gradient(90deg, ${theme.card} 25%, ${theme.cardHover} 50%, ${theme.card} 75%)`, backgroundSize: '200% 100%', animation: `shimmer 1.5s infinite ${i * 0.1}s` }} />
          ))}
        </div>
      </div>
    );
  }
  if (!data) return null;

  const { server, cpu, memory, disk, network, database: db, api, python_processes } = data;
  const barColor = (pct: number) => pct > 90 ? theme.red : pct > 70 ? theme.yellow : theme.green;

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4 }}>Infraestrutura</h2>
        <p style={{ fontSize: '0.75rem', color: theme.textMuted }}>Status do servidor e recursos</p>
      </div>

      {/* Server info */}
      <div style={{ padding: '1rem', borderRadius: 12, borderLeft: `3px solid ${theme.accent}`, background: theme.card, marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
          <Server size={16} color={theme.accent} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Servidor</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
          {[
            { l: 'Plataforma', v: server?.platform },
            { l: 'Python', v: server?.python },
            { l: 'Hostname', v: server?.hostname },
            { l: 'Uptime', v: `${server?.uptime_hours || 0}h` },
          ].map(s => (
            <div key={s.l} style={{ padding: '0.5rem', borderRadius: 8, background: theme.bg, border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: '0.58rem', color: theme.textMuted, marginBottom: 3 }}>{s.l}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 500 }}>{s.v || '—'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Resource gauges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginBottom: '1rem' }}>
        {[
          { label: 'CPU', icon: <Cpu size={14} />, color: theme.blue, pct: cpu?.percent || 0, detail: `${cpu?.cores || 0} cores · ${cpu?.percent || 0}%` },
          { label: 'Memória', icon: <Activity size={14} />, color: theme.purple, pct: memory?.percent || 0, detail: `${memory?.used_gb || 0} / ${memory?.total_gb || 0} GB` },
          { label: 'Disco', icon: <HardDrive size={14} />, color: theme.yellow, pct: disk?.percent || 0, detail: `${disk?.used_gb || 0} / ${disk?.total_gb || 0} GB` },
        ].map(r => (
          <div key={r.label} style={{ padding: '1rem', borderRadius: 12, borderLeft: `3px solid ${r.color}`, background: theme.card }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.75rem' }}>
              <span style={{ color: r.color }}>{r.icon}</span>
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{r.label}</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: barColor(r.pct), marginLeft: 'auto' }}>{r.pct}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: theme.border, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ width: `${Math.min(r.pct, 100)}%`, height: '100%', borderRadius: 3, background: barColor(r.pct), transition: 'width 0.5s' }} />
            </div>
            <div style={{ fontSize: '0.62rem', color: theme.textMuted }}>{r.detail}</div>
          </div>
        ))}
      </div>

      {/* Network + DB + Config */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginBottom: '1rem' }}>
        {/* Network */}
        <div style={{ padding: '1rem', borderRadius: 12, borderLeft: `3px solid ${theme.cyan}`, background: theme.card }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.75rem' }}>
            <Wifi size={14} color={theme.cyan} />
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Rede</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div style={{ padding: '0.5rem', borderRadius: 8, background: theme.bg, border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: '0.58rem', color: theme.textMuted, marginBottom: 3 }}>Enviado</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{network?.bytes_sent_mb || 0} MB</div>
            </div>
            <div style={{ padding: '0.5rem', borderRadius: 8, background: theme.bg, border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: '0.58rem', color: theme.textMuted, marginBottom: 3 }}>Recebido</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{network?.bytes_recv_mb || 0} MB</div>
            </div>
          </div>
        </div>

        {/* Database */}
        <div style={{ padding: '1rem', borderRadius: 12, borderLeft: `3px solid ${theme.green}`, background: theme.card }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.75rem' }}>
            <Database size={14} color={theme.green} />
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Banco de Dados</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: theme.textMuted, marginBottom: 4 }}>{db?.path || '—'}</div>
          <div style={{ fontSize: '1rem', fontWeight: 800 }}>{db?.size_mb || 0} MB</div>
        </div>

        {/* Config health */}
        <div style={{ padding: '1rem', borderRadius: 12, borderLeft: `3px solid ${theme.red}`, background: theme.card }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.75rem' }}>
            <Shield size={14} color={theme.red} />
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Saúde da Config</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              { ok: api?.jwt_configured, l: `JWT ${api?.jwt_configured ? '(seguro)' : '(fraco!)'}` },
              { ok: api?.stripe_configured, l: `Stripe ${api?.stripe_configured ? 'ok' : 'não configurado'}` },
              { ok: api?.env === 'production', l: `Env: ${api?.env || '?'}` },
            ].map(s => (
              <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: s.ok ? theme.green : theme.red }}>
                {s.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />} {s.l}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Python processes */}
      {python_processes && python_processes.length > 0 && (
        <div style={{ background: theme.card, borderRadius: 12, padding: '1rem', overflow: 'hidden' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.75rem' }}>Processos Python</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                {['PID', 'Nome', 'CPU %', 'Memória %'].map(h => (
                  <th key={h} style={{ padding: '0.4rem 0.5rem', textAlign: 'left', color: theme.textMuted, fontSize: '0.62rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {python_processes.map((p: any) => (
                <tr key={p.pid} style={{ borderBottom: `1px solid ${theme.border}` }}>
                  <td style={{ padding: '0.4rem 0.5rem', fontFamily: 'monospace', fontSize: '0.7rem', color: theme.textMuted }}>{p.pid}</td>
                  <td style={{ padding: '0.4rem 0.5rem' }}>{p.name}</td>
                  <td style={{ padding: '0.4rem 0.5rem', color: barColor(p.cpu_percent || 0), fontWeight: 600 }}>{p.cpu_percent?.toFixed(1) || 0}%</td>
                  <td style={{ padding: '0.4rem 0.5rem', color: barColor(p.memory_percent || 0), fontWeight: 600 }}>{p.memory_percent?.toFixed(1) || 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
