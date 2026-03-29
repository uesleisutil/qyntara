import React from 'react';
import { useApi } from '../../hooks/useApi';
import {
  Server, Cpu, HardDrive, Database, Wifi, Shield, CheckCircle2, XCircle, Activity,
} from 'lucide-react';

export const AdminInfraPage: React.FC<{ dark: boolean }> = ({ dark }) => {
  const { data, loading } = useApi<any>('/admin/infra', 15000);

  const card = dark ? '#12141c' : '#fff';
  const border = dark ? '#1e2130' : '#e2e8f0';
  const textSec = dark ? '#8892a4' : '#64748b';

  if (loading && !data) return <div style={{ textAlign: 'center', padding: '3rem', color: textSec }}>Loading infra status...</div>;
  if (!data) return null;

  const { server, cpu, memory, disk, network, database, api, python_processes } = data;

  const usageColor = (pct: number) => pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#10b981';

  const GaugeBar: React.FC<{ label: string; percent: number; detail: string }> = ({ label, percent, detail }) => (
    <div style={{ padding: '0.75rem', background: dark ? '#0a0b0f' : '#f8fafc', borderRadius: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: usageColor(percent) }}>{percent}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: border, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(percent, 100)}%`, height: '100%', borderRadius: 3, background: usageColor(percent), transition: 'width 0.5s' }} />
      </div>
      <div style={{ fontSize: '0.65rem', color: textSec, marginTop: 4 }}>{detail}</div>
    </div>
  );

  const StatusDot: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.4rem 0' }}>
      {ok ? <CheckCircle2 size={14} color="#10b981" /> : <XCircle size={14} color="#ef4444" />}
      <span style={{ fontSize: '0.78rem', color: ok ? '#10b981' : '#ef4444' }}>{label}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Server info */}
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1rem', borderLeft: '3px solid #6366f1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
          <Server size={18} color="#6366f1" />
          <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>Server</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
          {[
            { label: 'Platform', value: server?.platform },
            { label: 'Python', value: server?.python },
            { label: 'Hostname', value: server?.hostname },
            { label: 'Uptime', value: `${server?.uptime_hours || 0}h` },
          ].map(s => (
            <div key={s.label} style={{ padding: '0.5rem', background: dark ? '#0a0b0f' : '#f8fafc', borderRadius: 6 }}>
              <div style={{ fontSize: '0.62rem', color: textSec }}>{s.label}</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 500 }}>{s.value || '—'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Resource gauges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 8 }}>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1rem', borderLeft: '3px solid #3b82f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.75rem' }}>
            <Cpu size={16} color="#3b82f6" />
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>CPU</span>
            <span style={{ fontSize: '0.68rem', color: textSec, marginLeft: 'auto' }}>{cpu?.cores || 0} cores</span>
          </div>
          <GaugeBar label="Usage" percent={cpu?.percent || 0} detail={`${cpu?.percent || 0}% utilized`} />
        </div>

        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1rem', borderLeft: '3px solid #8b5cf6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.75rem' }}>
            <Activity size={16} color="#8b5cf6" />
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Memory</span>
          </div>
          <GaugeBar label="RAM" percent={memory?.percent || 0}
            detail={`${memory?.used_gb || 0} / ${memory?.total_gb || 0} GB`} />
        </div>

        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1rem', borderLeft: '3px solid #f59e0b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.75rem' }}>
            <HardDrive size={16} color="#f59e0b" />
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Disk</span>
          </div>
          <GaugeBar label="Storage" percent={disk?.percent || 0}
            detail={`${disk?.used_gb || 0} / ${disk?.total_gb || 0} GB`} />
        </div>
      </div>

      {/* Network + DB + Config */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 8 }}>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1rem', borderLeft: '3px solid #06b6d4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.75rem' }}>
            <Wifi size={16} color="#06b6d4" />
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Network</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ padding: '0.5rem', background: dark ? '#0a0b0f' : '#f8fafc', borderRadius: 6 }}>
              <div style={{ fontSize: '0.62rem', color: textSec }}>Sent</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{network?.bytes_sent_mb || 0} MB</div>
            </div>
            <div style={{ padding: '0.5rem', background: dark ? '#0a0b0f' : '#f8fafc', borderRadius: 6 }}>
              <div style={{ fontSize: '0.62rem', color: textSec }}>Received</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{network?.bytes_recv_mb || 0} MB</div>
            </div>
          </div>
        </div>

        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1rem', borderLeft: '3px solid #10b981' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.75rem' }}>
            <Database size={16} color="#10b981" />
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Database</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: textSec }}>{database?.path || '—'}</div>
          <div style={{ fontSize: '0.88rem', fontWeight: 600, marginTop: 4 }}>{database?.size_mb || 0} MB</div>
        </div>

        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1rem', borderLeft: '3px solid #ef4444' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.75rem' }}>
            <Shield size={16} color="#ef4444" />
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Config Health</span>
          </div>
          <StatusDot ok={api?.jwt_configured} label={`JWT Secret ${api?.jwt_configured ? '(secure)' : '(weak!)'}`} />
          <StatusDot ok={api?.stripe_configured} label={`Stripe ${api?.stripe_configured ? 'configured' : 'not configured'}`} />
          <StatusDot ok={api?.env === 'production'} label={`Env: ${api?.env || 'unknown'}`} />
        </div>
      </div>

      {/* Python processes */}
      {python_processes && python_processes.length > 0 && (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '1rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.75rem' }}>Python Processes</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${border}` }}>
                {['PID', 'Name', 'CPU %', 'Memory %'].map(h => (
                  <th key={h} style={{ padding: '0.4rem 0.5rem', textAlign: 'left', color: textSec, fontSize: '0.68rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {python_processes.map((p: any) => (
                <tr key={p.pid} style={{ borderBottom: `1px solid ${border}` }}>
                  <td style={{ padding: '0.4rem 0.5rem', fontFamily: 'monospace' }}>{p.pid}</td>
                  <td style={{ padding: '0.4rem 0.5rem' }}>{p.name}</td>
                  <td style={{ padding: '0.4rem 0.5rem' }}>{p.cpu_percent?.toFixed(1) || 0}%</td>
                  <td style={{ padding: '0.4rem 0.5rem' }}>{p.memory_percent?.toFixed(1) || 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
