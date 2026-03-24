/**
 * CostsEvolutionChart Component
 * 
 * Displays line chart with daily cost evolution (last 30 days).
 * 
 * Requirements: 12.5
 */

import React, { useMemo } from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, ComposedChart } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CostsEvolutionChart = ({ data, isLoading }) => {
  const chartData = useMemo(() => {
    if (!data || !data.time_series || !data.time_series.daily_costs) {
      return [];
    }

    return data.time_series.daily_costs.map(item => ({
      date: item.date,
      cost: item.total_brl || 0
    }));
  }, [data]);

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#5a7268' }}>
        Carregando evolução de custos...
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#5a7268' }}>
        Sem dados de evolução de custos disponíveis
      </div>
    );
  }

  // Calcular média móvel de 7 dias
  const chartDataWithMA = chartData.map((item, idx) => {
    const start = Math.max(0, idx - 6);
    const slice = chartData.slice(start, idx + 1);
    const avg = slice.reduce((sum, d) => sum + d.cost, 0) / slice.length;
    
    return {
      ...item,
      movingAverage: avg
    };
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'white',
          padding: '0.75rem',
          border: '1px solid #d4e5dc',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600', color: '#1a2626' }}>
            {format(parseISO(label), 'dd/MM/yyyy', { locale: ptBR })}
          </p>
          {payload.map((entry, idx) => (
            <p key={idx} style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: entry.color }}>
              {entry.name}: R$ {entry.value.toFixed(2)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#1a2626' }}>
        Evolução Diária de Custos (Últimos 30 dias)
      </h3>

      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={chartDataWithMA}>
          <defs>
            <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#5a9e87" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#5a9e87" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#d4e5dc" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            tickFormatter={(date) => format(parseISO(date), 'dd/MM', { locale: ptBR })}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            label={{ value: 'Custo (R$)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Area
            type="monotone"
            dataKey="cost"
            fill="url(#colorCost)"
            stroke="#5a9e87"
            strokeWidth={2}
            name="Custo Diário"
          />
          <Line 
            type="monotone" 
            dataKey="movingAverage" 
            stroke="#4ead8a" 
            strokeWidth={2}
            strokeDasharray="5 5"
            name="Média Móvel (7 dias)"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Estatísticas */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
        gap: '1rem',
        padding: '1rem',
        backgroundColor: '#f6faf8',
        borderRadius: '8px'
      }}>
        <div>
          <p style={{ fontSize: '0.75rem', color: '#5a7268', margin: '0 0 0.25rem 0' }}>Custo Mínimo</p>
          <p style={{ fontSize: '1.125rem', fontWeight: '600', color: '#4ead8a', margin: 0 }}>
            R$ {Math.min(...chartData.map(d => d.cost)).toFixed(2)}
          </p>
        </div>
        <div>
          <p style={{ fontSize: '0.75rem', color: '#5a7268', margin: '0 0 0.25rem 0' }}>Custo Máximo</p>
          <p style={{ fontSize: '1.125rem', fontWeight: '600', color: '#e07070', margin: 0 }}>
            R$ {Math.max(...chartData.map(d => d.cost)).toFixed(2)}
          </p>
        </div>
        <div>
          <p style={{ fontSize: '0.75rem', color: '#5a7268', margin: '0 0 0.25rem 0' }}>Custo Médio</p>
          <p style={{ fontSize: '1.125rem', fontWeight: '600', color: '#5a9e87', margin: 0 }}>
            R$ {(chartData.reduce((sum, d) => sum + d.cost, 0) / chartData.length).toFixed(2)}
          </p>
        </div>
        <div>
          <p style={{ fontSize: '0.75rem', color: '#5a7268', margin: '0 0 0.25rem 0' }}>Custo Total</p>
          <p style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1a2626', margin: 0 }}>
            R$ {chartData.reduce((sum, d) => sum + d.cost, 0).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CostsEvolutionChart;
