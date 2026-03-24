/**
 * CostsByServiceChart Component
 * 
 * Displays pie chart with cost distribution by AWS service.
 * 
 * Requirements: 12.4
 */

import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = {
  Lambda: '#8b5cf6',
  S3: '#10b981',
  SageMaker: '#f59e0b',
  CloudWatch: '#ef4444',
  Other: '#64748b'
};

const CostsByServiceChart = ({ data, isLoading }) => {
  const chartData = useMemo(() => {
    if (!data || !data.latest || !data.latest.costs_by_service) {
      return [];
    }

    const services = data.latest.costs_by_service;
    
    return Object.entries(services)
      .map(([name, value]) => ({
        name,
        value: value || 0,
        color: COLORS[name] || COLORS.Other
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [data]);

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Carregando distribuição de custos...
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Sem dados de distribuição de custos disponíveis
      </div>
    );
  }

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percentage = ((data.value / total) * 100).toFixed(1);
      
      return (
        <div style={{
          backgroundColor: 'white',
          padding: '0.75rem',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <p style={{ margin: '0 0 0.25rem 0', fontWeight: '600', color: '#1a1836' }}>
            {data.name}
          </p>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
            R$ {data.value.toFixed(2)} ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#1a1836' }}>
        Distribuição de Custos por Serviço AWS
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            formatter={(value, entry) => `${value}: R$ ${entry.payload.value.toFixed(2)}`}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Lista detalhada */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {chartData.map((item, idx) => {
          const percentage = ((item.value / total) * 100).toFixed(1);
          
          return (
            <div key={idx} style={{
              padding: '0.75rem',
              backgroundColor: '#f8fafc',
              borderRadius: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: item.color
                }} />
                <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#1a1836' }}>
                  {item.name}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: '600', color: '#1a1836' }}>
                  R$ {item.value.toFixed(2)}
                </p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                  {percentage}%
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CostsByServiceChart;
