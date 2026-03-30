import React from 'react';
import { useApi } from '../../hooks/useApi';
import { theme } from '../../styles';
import { Server, Cpu, HardDrive, Database, Wifi, Shield, CheckCircle2, XCircle, Activity, Zap, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const AdminInfraPage: React.FC<{ dark?: boolean }> = () => {
  const { data, loading } = useApi<any>('/admin/infra', 15000);
  const { data: metrics } = useApi<any>('/admin/metrics', 60000);
  const { data: health } = useApi<any>('/admin/health', 30000);

  if (loading && !data) {
    return (
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: '1.5rem' }}>Infraestrutura</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ height: 90, borderRadius: 12, border: `1px solid ${theme.border}`, background: `linear-gradient(90deg, ${theme.card} 25%, ${theme.cardHover} 50%, ${theme.card} 75%)`, backgroundSize: '200% 100%', animation: `shimmer 1.5s infinite ${i * 0.1}s` }} />
          ))}
        </div>
      </div>
    );
  }
  if (!data) return null;

  const { server, cpu, memory, disk, network, api: apiConfig } = data;
  const lm = metrics?.lambda || {};
  const barColor = (pct: number) => pct > 90 ? theme.red : pct > 70 ? theme.yellow : theme.green;

  // Format CloudWatch chart data
  const fmtTime = (t: string) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const invocations = (lm.invocations || []).map((p: any) => ({ t: fmtTime(p.t), v: p.v }));
  const errors = (lm.errors || []).map((p: any) => ({ t: fmtTime(p.t), v: p.v }));
  const duration = (lm.duration || []).map((p: any) => ({ t: fmtTime(p.t), v: Math.round(p.v) }));
  const totals = lm.totals || {};

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4 }}>Infraestrutura</h2>
        <p style={{ fontSize: '0.75rem', color: theme.textMuted }}>Monitoria em tempo real</p>
      </div>

      {/* Service health */}
      {health && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: '1.5rem' }}>
          {Object.entries(health).map(([name, info]: [string, any]) => (
            <div key={name} style={{
              padding: '0.75rem', borderRadius: 10, background: theme.card,
              borderLeft: `3px solid ${info.status === 'up' ? theme.green : info.status === 'degraded' ? theme.yellow : theme.red}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                {info.status === 'up' ? <CheckCircle2 size={12} color={theme.green} /> : info.status === 'degraded' ? <AlertTriangle size={12} color={theme.yellow} /> : <XCircle size={12} color={theme.red} />}
                <span style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'capitalize' }}>{name}</span>
              </div>
              <div style={{ fontSize: '0.62rem', color: theme.textMuted }}>
                {info.status === 'up' ? `${info.latency_ms}ms` : info.status}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lambda totals */}
      {totals.invocations_24h != null && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: '1.5rem' }}>
          {[
            { l: 'Requests 24h', v: totals.invocations_24h, c: theme.accent, ic: <Zap size={13} /> },
            { l: 'Erros 24h', v: totals.errors_24h, c: totals.errors_24h > 0 ? theme.red : theme.green, ic: <AlertTriangle size={13} /> },
            { l: 'Taxa de erro', v: `${totals.error_rate}%`, c: totals.error_rate > 1 ? theme.red : theme.green, ic: <Shield size={13} /> },
            { l: 'Duração média', v: `${totals.avg_duration_ms}ms`, c: totals.avg_duration_ms > 5000 ? theme.yellow : theme.green, ic: <Clock size={13} /> },
          ].map(s => (
            <div key={s.l} style={{ padding: '0.75rem', borderRadius: 10, borderLeft: `3px solid ${s.c}`, background: theme.card }}>
              <div style={{ fontSize: '0.6rem', color: theme.textMuted, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <span style={{ color: s.c }}>{s.ic}</span> {s.l}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{s.v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10, marginBottom: '1.5rem' }}>
        {/* Invocations chart */}
        {invocations.length > 1 && (
          <div style={{ padding: '1rem', borderRadius: 12, background: theme.card }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 8 }}>Requests/hora (24h)</div>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={invocations}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                <XAxis dataKey="t" tick={{ fontSize: 8, fill: theme.textMuted }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 8, fill: theme.textMuted }} width={30} />
                <Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: '0.7rem' }} />
                <Area type="monotone" dataKey="v" name="Requests" stroke={theme.accent} fill={`${theme.accent}15`} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Duration chart */}
        {duration.length > 1 && (
          <div style={{ padding: '1rem', borderRadius: 12, background: theme.card }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 8 }}>Latência média (ms)</div>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={duration}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                <XAxis dataKey="t" tick={{ fontSize: 8, fill: theme.textMuted }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 8, fill: theme.textMuted }} width={35} unit="ms" />
                <Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: '0.7rem' }} />
                <Area type="monotone" dataKey="v" name="Duração" stroke={theme.yellow} fill={`${theme.yellow}15`} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Errors chart */}
        {errors.length > 1 && (
          <div style={{ padding: '1rem', borderRadius: 12, background: theme.card }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 8 }}>Erros/hora (24h)</div>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={errors}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                <XAxis dataKey="t" tick={{ fontSize: 8, fill: theme.textMuted }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 8, fill: theme.textMuted }} width={25} />
                <Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: '0.7rem' }} />
                <Area type="monotone" dataKey="v" name="Erros" stroke={theme.red} fill={`${theme.red}15`} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Server + Resources */}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: '1rem' }}>
        {[
          { label: 'CPU', icon: <Cpu size={14} />, color: theme.blue, pct: cpu?.percent || 0, detail: `${cpu?.cores || 0} cores` },
          { label: 'Memória', icon: <Activity size={14} />, color: theme.purple, pct: memory?.percent || 0, detail: `${memory?.used_gb || 0}/${memory?.total_gb || 0} GB` },
          { label: 'Disco', icon: <HardDrive size={14} />, color: theme.yellow, pct: disk?.percent || 0, detail: `${disk?.used_gb || 0}/${disk?.total_gb || 0} GB` },
        ].map(r => (
          <div key={r.label} style={{ padding: '1rem', borderRadius: 12, borderLeft: `3px solid ${r.color}`, background: theme.card }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ color: r.color }}>{r.icon}</span>
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{r.label}</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: barColor(r.pct), marginLeft: 'auto' }}>{r.pct}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: theme.border, overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ width: `${Math.min(r.pct, 100)}%`, height: '100%', borderRadius: 3, background: barColor(r.pct), transition: 'width 0.5s' }} />
            </div>
            <div style={{ fontSize: '0.62rem', color: theme.textMuted }}>{r.detail}</div>
          </div>
        ))}
      </div>

      {/* Network + Config */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        <div style={{ padding: '1rem', borderRadius: 12, borderLeft: `3px solid ${theme.cyan}`, background: theme.card }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Wifi size={14} color={theme.cyan} />
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Rede</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div style={{ padding: '0.5rem', borderRadius: 8, background: theme.bg, border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: '0.58rem', color: theme.textMuted }}>Enviado</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{network?.bytes_sent_mb || 0} MB</div>
            </div>
            <div style={{ padding: '0.5rem', borderRadius: 8, background: theme.bg, border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: '0.58rem', color: theme.textMuted }}>Recebido</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{network?.bytes_recv_mb || 0} MB</div>
            </div>
          </div>
        </div>

        <div style={{ padding: '1rem', borderRadius: 12, borderLeft: `3px solid ${theme.green}`, background: theme.card }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Database size={14} color={theme.green} />
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>DynamoDB</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: theme.textMuted }}>5 tabelas · Pay-per-request</div>
        </div>

        <div style={{ padding: '1rem', borderRadius: 12, borderLeft: `3px solid ${theme.red}`, background: theme.card }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Shield size={14} color={theme.red} />
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Config</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[
              { ok: apiConfig?.jwt_configured, l: 'JWT' },
              { ok: apiConfig?.stripe_configured, l: 'Stripe' },
              { ok: apiConfig?.smtp_configured, l: 'SMTP' },
              { ok: apiConfig?.env === 'production', l: `Env: ${apiConfig?.env || '?'}` },
            ].map(s => (
              <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', color: s.ok ? theme.green : theme.red }}>
                {s.ok ? <CheckCircle2 size={10} /> : <XCircle size={10} />} {s.l}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const Clock: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
