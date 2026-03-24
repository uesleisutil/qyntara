import React, { useState } from 'react';
import { FileText, Loader } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../../config';
import { getSignal } from '../../../constants';
import { getSector } from '../../../constants/sectors';
import { getFollowedPositions } from './FollowButton';
import { useIsPro } from '../pro/ProGate';
import { fmt } from '../../../lib/formatters';

interface Props { darkMode: boolean; theme: Record<string, string>; }

const MonthlyReport: React.FC<Props> = ({ darkMode }) => {
  const isPro = useIsPro();
  const [generating, setGenerating] = useState(false);

  if (!isPro) return null;

  const generate = async () => {
    setGenerating(true);
    try {
      const headers = { 'x-api-key': API_KEY };
      const [latestRes, histRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/recommendations/latest`, { headers }),
        fetch(`${API_BASE_URL}/api/recommendations/history`, { headers }),
      ]);
      const latest = latestRes.ok ? await latestRes.json() : { recommendations: [], date: '' };
      const hist = histRes.ok ? await histRes.json() : { data: {} };
      const recs = latest.recommendations || [];
      const positions = getFollowedPositions();
      const prices: Record<string, number> = {};
      recs.forEach((r: any) => { prices[r.ticker] = r.last_close; });

      const now = new Date();
      const monthName = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

      const buys = recs.filter((r: any) => getSignal(r.score) === 'Compra');
      const sells = recs.filter((r: any) => getSignal(r.score) === 'Venda');

      // Build positions summary
      const posRows = positions.map(p => {
        const cur = prices[p.ticker] || p.entryPrice;
        const ret = ((cur - p.entryPrice) / p.entryPrice) * 100;
        return `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${p.ticker}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${getSector(p.ticker).sector}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">R$ ${fmt(p.entryPrice)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">R$ ${fmt(cur)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;color:${ret >= 0 ? '#10b981' : '#ef4444'};font-weight:600">${ret >= 0 ? '+' : ''}${fmt(ret, 1)}%</td>
        </tr>`;
      }).join('');

      // Build recommendations table
      const recRows = recs.slice(0, 20).map((r: any, i: number) => {
        const signal = getSignal(r.score);
        const sigColor = signal === 'Compra' ? '#10b981' : signal === 'Venda' ? '#ef4444' : '#6b7280';
        return `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${i + 1}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-weight:600">${r.ticker}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;color:${sigColor};font-weight:600">${signal}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${fmt(r.score, 2)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">R$ ${fmt(r.last_close)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;color:${r.exp_return_20 >= 0 ? '#10b981' : '#ef4444'}">${r.exp_return_20 >= 0 ? '+' : ''}${fmt(r.exp_return_20 * 100, 1)}%</td>
        </tr>`;
      }).join('');

      // Count history days
      const allDates = new Set<string>();
      Object.values(hist.data as Record<string, any[]>).forEach((entries: any[]) =>
        entries.forEach((e: any) => allDates.add(e.date))
      );

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Relatório Mensal - Qyntara</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; color: #0f1117; }
  h1 { color: #1a1d27; border-bottom: 2px solid #3b82f6; padding-bottom: 0.5rem; }
  h2 { color: #2a2e3a; margin-top: 2rem; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.85rem; }
  th { background: #f1f5f9; padding: 8px 10px; text-align: left; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
  .summary { display: flex; gap: 1rem; flex-wrap: wrap; margin: 1rem 0; }
  .summary-card { flex: 1; min-width: 120px; padding: 1rem; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; text-align: center; }
  .summary-card .label { font-size: 0.75rem; color: #64748b; }
  .summary-card .value { font-size: 1.3rem; font-weight: 700; margin-top: 0.25rem; }
  .footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; font-size: 0.75rem; color: #94a3b8; text-align: center; }
  @media print { body { padding: 0; } }
</style></head><body>
<h1>📊 Relatório Mensal — Qyntara</h1>
<p style="color:#64748b">${monthName} · Gerado em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>

<div class="summary">
  <div class="summary-card"><div class="label">Total Ações</div><div class="value">${recs.length}</div></div>
  <div class="summary-card"><div class="label">Compra</div><div class="value" style="color:#10b981">${buys.length}</div></div>
  <div class="summary-card"><div class="label">Venda</div><div class="value" style="color:#ef4444">${sells.length}</div></div>
  <div class="summary-card"><div class="label">Dias Analisados</div><div class="value">${allDates.size}</div></div>
  <div class="summary-card"><div class="label">Posições Seguidas</div><div class="value">${positions.length}</div></div>
</div>

${positions.length > 0 ? `<h2>📋 Minhas Posições</h2>
<table><thead><tr><th>Ticker</th><th>Setor</th><th>Entrada</th><th>Atual</th><th>Retorno</th></tr></thead>
<tbody>${posRows}</tbody></table>` : ''}

<h2>🏆 Top 20 Recomendações</h2>
<table><thead><tr><th>#</th><th>Ticker</th><th>Sinal</th><th>Score</th><th>Preço</th><th>Ret. Previsto</th></tr></thead>
<tbody>${recRows}</tbody></table>

<div class="footer">
  ⚠️ Este relatório é uma ferramenta de apoio à decisão. Não constitui recomendação de investimento.<br>
  Qyntara · ${now.getFullYear()}
</div>
</body></html>`;

      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_b3tactical_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ }
    finally { setGenerating(false); }
  };

  return (
    <button onClick={generate} disabled={generating} style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.45rem 0.75rem', borderRadius: 8, fontSize: '0.78rem', fontWeight: 500,
      border: `1px solid ${darkMode ? '#2a2e3a' : '#e2e8f0'}`,
      background: 'transparent',
      color: darkMode ? '#9ba1b0' : '#64748b',
      cursor: generating ? 'wait' : 'pointer', transition: 'all 0.15s',
      WebkitAppearance: 'none' as any, minHeight: 'auto',
    }}
      onMouseEnter={e => { if (!generating) { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6'; } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = darkMode ? '#2a2e3a' : '#e2e8f0'; e.currentTarget.style.color = darkMode ? '#9ba1b0' : '#64748b'; }}
    >
      {generating ? <Loader size={13} className="spin" /> : <FileText size={13} />}
      {generating ? 'Gerando...' : 'Relatório Mensal'}
    </button>
  );
};

export default MonthlyReport;
