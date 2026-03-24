/**
 * ReturnDistributionChart Component
 * 
 * Displays histogram of expected return distribution using Recharts.
 * 
 * Requirements: 10.6
 */

import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const ReturnDistributionChart = ({ recommendations }) => {
  const chartData = useMemo(() => {
    if (!recommendations || recommendations.length === 0) {
      return [];
    }

    // Criar bins para o histograma
    const returns = recommendations.map(rec => 
      (rec.expected_return || rec.exp_return_20 || 0) * 100
    );

    // Definir bins: -10 a +30 em intervalos de 2%
    const bins = [];
    const binSize = 2;
    const minReturn = -10;
    const maxReturn = 30;

    for (let i = minReturn; i < maxReturn; i += binSize) {
      const binStart = i;
      const binEnd = i + binSize;
      const count = returns.filter(r => r >= binStart && r < binEnd).length;
      
      bins.push({
        range: `${binStart.toFixed(0)}% a ${binEnd.toFixed(0)}%`,
        count,
        binStart
      });
    }

    return bins;
  }, [recommendations]);

  if (chartData.length === 0) {
    return <p style={{ textAlign: 'center', padding: '2rem', color: '#5a7268' }}>Sem dados disponíveis</p>;
  }

  return (
    <div style={{ width: '100%', height: '300px' }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d4e5dc" />
          <XAxis 
            dataKey="range" 
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            label={{ value: 'Número de Ações', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #d4e5dc',
              borderRadius: '8px',
              padding: '8px'
            }}
            formatter={(value) => [`${value} ações`, 'Quantidade']}
          />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.binStart >= 0 ? '#4ead8a' : '#e07070'} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ReturnDistributionChart;
