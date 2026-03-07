import { useState } from 'react';
import Plot from 'react-plotly.js';
import PropTypes from 'prop-types';

/**
 * Interactive Candlestick Chart with Technical Indicators
 * 
 * Features:
 * - Candlestick chart with volume
 * - Technical indicators: RSI, MACD, Bollinger Bands
 * - Zoom, pan, crosshair
 * - Buy/sell signals
 */
const InteractiveCandlestickChart = ({ ticker, data, indicators }) => {
  const [selectedIndicators, setSelectedIndicators] = useState(['volume', 'rsi']);
  const [timeframe, setTimeframe] = useState('1M');

  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        <p>Carregando dados do gráfico...</p>
      </div>
    );
  }

  // Prepare candlestick data
  const candlestickTrace = {
    x: data.map(d => d.date),
    open: data.map(d => d.open),
    high: data.map(d => d.high),
    low: data.map(d => d.low),
    close: data.map(d => d.close),
    type: 'candlestick',
    name: ticker,
    increasing: { line: { color: '#10b981' } },
    decreasing: { line: { color: '#ef4444' } },
    xaxis: 'x',
    yaxis: 'y'
  };

  // Volume trace
  const volumeTrace = {
    x: data.map(d => d.date),
    y: data.map(d => d.volume),
    type: 'bar',
    name: 'Volume',
    marker: {
      color: data.map(d => d.close > d.open ? '#10b98180' : '#ef444480')
    },
    xaxis: 'x',
    yaxis: 'y2'
  };

  // RSI trace
  const rsiTrace = indicators?.rsi ? {
    x: data.map(d => d.date),
    y: indicators.rsi,
    type: 'scatter',
    mode: 'lines',
    name: 'RSI',
    line: { color: '#3b82f6', width: 2 },
    xaxis: 'x',
    yaxis: 'y3'
  } : null;

  // RSI overbought/oversold lines
  const rsiOverbought = {
    x: data.map(d => d.date),
    y: Array(data.length).fill(70),
    type: 'scatter',
    mode: 'lines',
    name: 'Overbought',
    line: { color: '#ef4444', width: 1, dash: 'dash' },
    xaxis: 'x',
    yaxis: 'y3',
    showlegend: false
  };

  const rsiOversold = {
    x: data.map(d => d.date),
    y: Array(data.length).fill(30),
    type: 'scatter',
    mode: 'lines',
    name: 'Oversold',
    line: { color: '#10b981', width: 1, dash: 'dash' },
    xaxis: 'x',
    yaxis: 'y3',
    showlegend: false
  };

  // MACD traces
  const macdTrace = indicators?.macd ? {
    x: data.map(d => d.date),
    y: indicators.macd,
    type: 'scatter',
    mode: 'lines',
    name: 'MACD',
    line: { color: '#3b82f6', width: 2 },
    xaxis: 'x',
    yaxis: 'y4'
  } : null;

  const macdSignalTrace = indicators?.macd_signal ? {
    x: data.map(d => d.date),
    y: indicators.macd_signal,
    type: 'scatter',
    mode: 'lines',
    name: 'Signal',
    line: { color: '#f59e0b', width: 2 },
    xaxis: 'x',
    yaxis: 'y4'
  } : null;

  const macdHistogramTrace = indicators?.macd_histogram ? {
    x: data.map(d => d.date),
    y: indicators.macd_histogram,
    type: 'bar',
    name: 'Histogram',
    marker: {
      color: indicators.macd_histogram.map(v => v >= 0 ? '#10b98180' : '#ef444480')
    },
    xaxis: 'x',
    yaxis: 'y4'
  } : null;

  // Bollinger Bands
  const bollingerUpper = indicators?.bollinger_upper ? {
    x: data.map(d => d.date),
    y: indicators.bollinger_upper,
    type: 'scatter',
    mode: 'lines',
    name: 'BB Upper',
    line: { color: '#94a3b8', width: 1, dash: 'dot' },
    xaxis: 'x',
    yaxis: 'y'
  } : null;

  const bollingerMiddle = indicators?.bollinger_middle ? {
    x: data.map(d => d.date),
    y: indicators.bollinger_middle,
    type: 'scatter',
    mode: 'lines',
    name: 'BB Middle',
    line: { color: '#64748b', width: 1 },
    xaxis: 'x',
    yaxis: 'y'
  } : null;

  const bollingerLower = indicators?.bollinger_lower ? {
    x: data.map(d => d.date),
    y: indicators.bollinger_lower,
    type: 'scatter',
    mode: 'lines',
    name: 'BB Lower',
    line: { color: '#94a3b8', width: 1, dash: 'dot' },
    xaxis: 'x',
    yaxis: 'y'
  } : null;

  // Buy/Sell signals
  const buySignals = indicators?.buy_signals ? {
    x: indicators.buy_signals.map(s => s.date),
    y: indicators.buy_signals.map(s => s.price),
    type: 'scatter',
    mode: 'markers',
    name: 'Compra',
    marker: {
      color: '#10b981',
      size: 12,
      symbol: 'triangle-up'
    },
    xaxis: 'x',
    yaxis: 'y'
  } : null;

  const sellSignals = indicators?.sell_signals ? {
    x: indicators.sell_signals.map(s => s.date),
    y: indicators.sell_signals.map(s => s.price),
    type: 'scatter',
    mode: 'markers',
    name: 'Venda',
    marker: {
      color: '#ef4444',
      size: 12,
      symbol: 'triangle-down'
    },
    xaxis: 'x',
    yaxis: 'y'
  } : null;

  // Combine all traces
  const traces = [
    candlestickTrace,
    bollingerUpper,
    bollingerMiddle,
    bollingerLower,
    buySignals,
    sellSignals
  ].filter(Boolean);

  if (selectedIndicators.includes('volume')) {
    traces.push(volumeTrace);
  }

  if (selectedIndicators.includes('rsi') && rsiTrace) {
    traces.push(rsiTrace, rsiOverbought, rsiOversold);
  }

  if (selectedIndicators.includes('macd') && macdTrace) {
    traces.push(macdTrace, macdSignalTrace, macdHistogramTrace);
  }

  // Layout configuration
  const layout = {
    title: {
      text: `${ticker} - Análise Técnica`,
      font: { size: 18, color: '#1e293b' }
    },
    xaxis: {
      rangeslider: { visible: false },
      type: 'date',
      showgrid: true,
      gridcolor: '#e2e8f0'
    },
    yaxis: {
      title: 'Preço (R$)',
      domain: selectedIndicators.includes('volume') ? [0.4, 1] : [0.3, 1],
      showgrid: true,
      gridcolor: '#e2e8f0'
    },
    yaxis2: selectedIndicators.includes('volume') ? {
      title: 'Volume',
      domain: [0.25, 0.38],
      showgrid: false
    } : undefined,
    yaxis3: selectedIndicators.includes('rsi') ? {
      title: 'RSI',
      domain: [0.12, 0.23],
      range: [0, 100],
      showgrid: true,
      gridcolor: '#e2e8f0'
    } : undefined,
    yaxis4: selectedIndicators.includes('macd') ? {
      title: 'MACD',
      domain: [0, 0.10],
      showgrid: true,
      gridcolor: '#e2e8f0'
    } : undefined,
    hovermode: 'x unified',
    showlegend: true,
    legend: {
      orientation: 'h',
      y: -0.15,
      x: 0
    },
    margin: { t: 50, b: 100, l: 60, r: 40 },
    plot_bgcolor: '#ffffff',
    paper_bgcolor: '#ffffff',
    font: { family: 'Inter, sans-serif', color: '#1e293b' }
  };

  const config = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    toImageButtonOptions: {
      format: 'png',
      filename: `${ticker}_chart`,
      height: 800,
      width: 1200,
      scale: 2
    }
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        {/* Timeframe selector */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['1W', '1M', '3M', '6M', '1Y', 'ALL'].map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              style={{
                padding: '0.5rem 1rem',
                background: timeframe === tf ? '#3b82f6' : '#f1f5f9',
                color: timeframe === tf ? 'white' : '#64748b',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: timeframe === tf ? 'bold' : 'normal'
              }}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Indicator toggles */}
        <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
          {['volume', 'rsi', 'macd', 'bollinger'].map(ind => (
            <label key={ind} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedIndicators.includes(ind)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedIndicators([...selectedIndicators, ind]);
                  } else {
                    setSelectedIndicators(selectedIndicators.filter(i => i !== ind));
                  }
                }}
              />
              <span style={{ fontSize: '0.875rem', textTransform: 'uppercase' }}>{ind}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Chart */}
      <Plot
        data={traces}
        layout={layout}
        config={config}
        style={{ width: '100%', height: '600px' }}
        useResizeHandler={true}
      />

      {/* Legend */}
      <div style={{
        marginTop: '1rem',
        padding: '1rem',
        background: '#f8fafc',
        borderRadius: '8px',
        fontSize: '0.875rem',
        color: '#64748b'
      }}>
        <strong>Indicadores:</strong>
        <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
          <li><strong>RSI</strong>: Índice de Força Relativa (sobrecompra &gt;70, sobrevenda &lt;30)</li>
          <li><strong>MACD</strong>: Convergência/Divergência de Médias Móveis</li>
          <li><strong>Bollinger Bands</strong>: Bandas de volatilidade</li>
          <li><strong>Volume</strong>: Volume de negociação</li>
        </ul>
      </div>
    </div>
  );
};

InteractiveCandlestickChart.propTypes = {
  ticker: PropTypes.string.isRequired,
  data: PropTypes.arrayOf(PropTypes.shape({
    date: PropTypes.string.isRequired,
    open: PropTypes.number.isRequired,
    high: PropTypes.number.isRequired,
    low: PropTypes.number.isRequired,
    close: PropTypes.number.isRequired,
    volume: PropTypes.number.isRequired
  })).isRequired,
  indicators: PropTypes.shape({
    rsi: PropTypes.arrayOf(PropTypes.number),
    macd: PropTypes.arrayOf(PropTypes.number),
    macd_signal: PropTypes.arrayOf(PropTypes.number),
    macd_histogram: PropTypes.arrayOf(PropTypes.number),
    bollinger_upper: PropTypes.arrayOf(PropTypes.number),
    bollinger_middle: PropTypes.arrayOf(PropTypes.number),
    bollinger_lower: PropTypes.arrayOf(PropTypes.number),
    buy_signals: PropTypes.arrayOf(PropTypes.object),
    sell_signals: PropTypes.arrayOf(PropTypes.object)
  })
};

export default InteractiveCandlestickChart;
