import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Send, ChevronLeft, RefreshCw, AlertTriangle,
  MessageSquare, ListTodo,
  Zap, ChevronDown, ChevronUp,
} from 'lucide-react';
import { API_BASE_URL } from '../../config';
import InfoTooltip from '../../components/shared/ui/InfoTooltip';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

interface AgentTask {
  title: string;
  priority: string;
  description: string;
}

interface AgentAnalysis {
  insights: string[];
  tasks: AgentTask[];
  kpis: Record<string, string | number>;
  status: string;
  risk_level: string;
  last_directive?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
}

interface Agent {
  id: string;
  name: string;
  emoji: string;
  color: string;
  focus: string;
  description: string;
  analysis: AgentAnalysis;
  chat: ChatMessage[];
  last_directive: string;
  updatedAt: string;
}

const AdminAgentsPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  const getToken = () => localStorage.getItem('authToken') || '';

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/agents`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Falha ao carregar agentes');
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agents, selectedAgent]);

  const sendMessage = async () => {
    if (!chatInput.trim() || !selectedAgent || sending) return;
    const msg = chatInput.trim();
    setChatInput('');
    setSending(true);

    // Optimistic update
    setAgents(prev => prev.map(a => a.id === selectedAgent ? {
      ...a, chat: [...a.chat, { id: Date.now().toString(), role: 'user' as const, content: msg, timestamp: new Date().toISOString() }]
    } : a));

    try {
      const res = await fetch(`${API_BASE_URL}/admin/agents/${selectedAgent}/chat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      if (!res.ok) throw new Error('Erro ao enviar mensagem');
      const data = await res.json();

      // Add agent response
      setAgents(prev => prev.map(a => a.id === selectedAgent ? {
        ...a,
        chat: [...a.chat, { id: (Date.now() + 1).toString(), role: 'agent' as const, content: data.response, timestamp: new Date().toISOString() }],
        analysis: data.analysis || a.analysis,
        last_directive: msg,
      } : a));
    } catch (err: any) {
      setAgents(prev => prev.map(a => a.id === selectedAgent ? {
        ...a, chat: [...a.chat, { id: (Date.now() + 1).toString(), role: 'agent' as const, content: `❌ Erro: ${err.message}`, timestamp: new Date().toISOString() }]
      } : a));
    } finally {
      setSending(false);
    }
  };

  const currentAgent = agents.find(a => a.id === selectedAgent);

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1a1d27' : '#fff'),
    border: `1px solid ${theme.border}`, borderRadius: 12, padding: '1rem',
  };

  const getRiskBadge = (level: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      low: { bg: 'rgba(16,185,129,0.15)', text: '#10b981', label: 'Baixo' },
      medium: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', label: 'Médio' },
      high: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', label: 'Alto' },
    };
    const r = map[level] || map.low;
    return (
      <span style={{ padding: '0.15rem 0.5rem', borderRadius: 10, fontSize: '0.68rem', fontWeight: 600, background: r.bg, color: r.text }}>
        {level === 'high' && <AlertTriangle size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />}
        Risco {r.label}
      </span>
    );
  };

  const getPriorityColor = (p: string) => {
    if (p === 'crítica') return '#ef4444';
    if (p === 'alta') return '#f59e0b';
    if (p === 'média') return '#3b82f6';
    return '#6b7280';
  };

  // Shimmer loading
  if (loading) {
    const pulse: React.CSSProperties = {
      background: `linear-gradient(90deg, ${darkMode ? '#1a1d27' : '#e2e8f0'} 25%, ${darkMode ? '#2a2e3a' : '#f1f5f9'} 50%, ${darkMode ? '#1a1d27' : '#e2e8f0'} 75%)`,
      backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 8,
    };
    return (
      <div>
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <div style={{ ...pulse, height: 28, width: 250, marginBottom: 8 }} />
        <div style={{ ...pulse, height: 16, width: 350, marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {[1,2,3,4,5,6].map(i => <div key={i} style={{ ...pulse, height: 200 }} />)}
        </div>
      </div>
    );
  }

  // Agent detail view
  if (selectedAgent && currentAgent) {
    return (
      <div>
        <button onClick={() => setSelectedAgent(null)} style={{
          display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none', border: 'none',
          color: '#3b82f6', cursor: 'pointer', fontSize: '0.85rem', marginBottom: '1rem', padding: 0,
          WebkitAppearance: 'none' as any,
        }}>
          <ChevronLeft size={16} /> Voltar aos Agentes
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '2rem' }}>{currentAgent.emoji}</span>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: theme.text, margin: 0 }}>{currentAgent.name}</h1>
            <p style={{ fontSize: '0.78rem', color: theme.textSecondary, margin: 0 }}>{currentAgent.focus}</p>
          </div>
          {getRiskBadge(currentAgent.analysis.risk_level)}
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          {Object.entries(currentAgent.analysis.kpis).map(([k, v]) => (
            <div key={k} style={cardStyle}>
              <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: '0.2rem' }}>{k}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: currentAgent.color }}>{String(v)}</div>
            </div>
          ))}
        </div>

        <div className="agents-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          {/* Insights */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
              <Zap size={16} color={currentAgent.color} />
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: theme.text }}>Insights</span>
            </div>
            {currentAgent.analysis.insights.map((ins, i) => (
              <div key={i} style={{ fontSize: '0.8rem', color: theme.textSecondary, marginBottom: '0.5rem', lineHeight: 1.5, paddingLeft: '0.5rem', borderLeft: `2px solid ${currentAgent.color}30` }}>
                {ins}
              </div>
            ))}
          </div>

          {/* Tasks */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
              <ListTodo size={16} color={currentAgent.color} />
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: theme.text }}>Plano de Ação</span>
              <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: 8, background: `${currentAgent.color}20`, color: currentAgent.color, fontWeight: 600 }}>
                {currentAgent.analysis.tasks.length}
              </span>
            </div>
            {currentAgent.analysis.tasks.map((task, i) => (
              <div key={i} style={{
                padding: '0.5rem 0.6rem', borderRadius: 8, marginBottom: '0.4rem',
                border: `1px solid ${theme.border}`, cursor: 'pointer',
              }}
                onClick={() => setExpandedTasks(prev => ({ ...prev, [`${selectedAgent}-${i}`]: !prev[`${selectedAgent}-${i}`] }))}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: getPriorityColor(task.priority), flexShrink: 0 }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: theme.text, flex: 1 }}>{task.title}</span>
                  <span style={{ fontSize: '0.65rem', color: getPriorityColor(task.priority), fontWeight: 600, textTransform: 'uppercase' }}>{task.priority}</span>
                  {expandedTasks[`${selectedAgent}-${i}`] ? <ChevronUp size={12} color={theme.textSecondary} /> : <ChevronDown size={12} color={theme.textSecondary} />}
                </div>
                {expandedTasks[`${selectedAgent}-${i}`] && (
                  <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginTop: '0.4rem', lineHeight: 1.5 }}>
                    {task.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Chat */}
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', height: 400 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem', flexShrink: 0 }}>
            <MessageSquare size={16} color={currentAgent.color} />
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: theme.text }}>Chat com {currentAgent.id}</span>
            <InfoTooltip text="Envie diretivas e perguntas para o agente. Ele responde com base nos dados reais do sistema." darkMode={darkMode} size={12} />
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {currentAgent.chat.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: theme.textSecondary, fontSize: '0.82rem' }}>
                {currentAgent.emoji} Envie uma diretiva para o {currentAgent.id}. Exemplo: "Quero aumentar a conversão para 10% este mês"
              </div>
            )}
            {currentAgent.chat.map(msg => (
              <div key={msg.id} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%', padding: '0.6rem 0.8rem', borderRadius: 10,
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, #2563eb, #3b82f6)'
                  : (darkMode ? '#0f1117' : '#f1f5f9'),
                color: msg.role === 'user' ? 'white' : theme.text,
                fontSize: '0.8rem', lineHeight: 1.5, whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
                <div style={{ fontSize: '0.65rem', opacity: 0.6, marginTop: '0.3rem', textAlign: 'right' }}>
                  {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
            {sending && (
              <div style={{ alignSelf: 'flex-start', padding: '0.6rem 0.8rem', borderRadius: 10, background: darkMode ? '#0f1117' : '#f1f5f9', fontSize: '0.8rem', color: theme.textSecondary }}>
                {currentAgent.emoji} Analisando...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <input
              type="text" value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
              placeholder={`Envie uma diretiva para o ${currentAgent.id}...`}
              style={{
                flex: 1, padding: '0.6rem 0.8rem', borderRadius: 8,
                border: `1px solid ${theme.border}`, background: darkMode ? '#0f1117' : '#f8fafc',
                color: theme.text, fontSize: '0.85rem', outline: 'none',
              }}
            />
            <button onClick={sendMessage} disabled={!chatInput.trim() || sending}
              style={{
                padding: '0.6rem 1rem', borderRadius: 8, border: 'none',
                background: chatInput.trim() ? currentAgent.color : (darkMode ? '#2a2e3a' : '#e2e8f0'),
                color: chatInput.trim() ? 'white' : theme.textSecondary,
                cursor: chatInput.trim() ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600,
                WebkitAppearance: 'none' as any,
              }}>
              <Send size={14} /> Enviar
            </button>
          </div>
        </div>

      </div>
    );
  }

  // Agent grid view (main)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>
            Agentes Executivos
          </h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.8rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            Governança com IA — 6 agentes especializados analisando dados reais
            <InfoTooltip text="Cada agente analisa métricas reais do sistema (usuários, custos, pipelines, segurança) e gera insights, planos e recomendações na sua área de expertise. Envie diretivas para guiar suas ações." darkMode={darkMode} />
          </p>
        </div>
        <button onClick={fetchAgents} style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem',
          borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
          color: 'white', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
          WebkitAppearance: 'none' as any,
        }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {error && (
        <div style={{ ...cardStyle, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', marginBottom: '1rem', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* How it works */}
      <div style={{
        ...cardStyle, marginBottom: '1rem', padding: '0.75rem 1rem',
        background: darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)',
        borderColor: darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)',
      }}>
        <div style={{ fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
          🤖 <strong style={{ color: theme.text }}>Como funciona:</strong> Cada agente analisa dados reais do sistema (DynamoDB, S3, métricas) e gera insights na sua área. Clique em um agente para ver detalhes, plano de ação e conversar com ele. Envie diretivas como CEO para guiar as prioridades.
        </div>
      </div>

      {/* Summary KPIs */}
      {agents.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={cardStyle}>
            <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: '0.2rem' }}>Agentes Ativos</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#3b82f6' }}>{agents.length}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: '0.2rem' }}>Tarefas Totais</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f59e0b' }}>
              {agents.reduce((s, a) => s + (a.analysis?.tasks?.length || 0), 0)}
            </div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: '0.2rem' }}>Risco Alto</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#ef4444' }}>
              {agents.filter(a => a.analysis?.risk_level === 'high').length}
            </div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: '0.2rem' }}>Diretivas Ativas</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#10b981' }}>
              {agents.filter(a => a.last_directive).length}
            </div>
          </div>
        </div>
      )}

      {/* Agent Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '1rem' }}>
        {agents.map(agent => (
          <div key={agent.id} onClick={() => setSelectedAgent(agent.id)}
            style={{
              ...cardStyle, cursor: 'pointer', transition: 'all 0.2s',
              borderLeft: `3px solid ${agent.color}`,
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 12px ${agent.color}20`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '1.5rem' }}>{agent.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: theme.text }}>{agent.id}</div>
                <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>{agent.focus}</div>
              </div>
              {getRiskBadge(agent.analysis.risk_level)}
            </div>

            {/* Mini KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.6rem' }}>
              {Object.entries(agent.analysis.kpis).slice(0, 4).map(([k, v]) => (
                <div key={k} style={{ fontSize: '0.7rem' }}>
                  <span style={{ color: theme.textSecondary }}>{k}: </span>
                  <strong style={{ color: agent.color }}>{String(v)}</strong>
                </div>
              ))}
            </div>

            {/* Top insight */}
            {agent.analysis.insights[0] && (
              <div style={{ fontSize: '0.75rem', color: theme.textSecondary, lineHeight: 1.4, marginBottom: '0.5rem',
                overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                {agent.analysis.insights[0]}
              </div>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: `1px solid ${theme.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', color: theme.textSecondary }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <ListTodo size={11} /> {agent.analysis.tasks.length} tarefas
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <MessageSquare size={11} /> {agent.chat.length} msgs
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: agent.color, fontWeight: 600 }}>
                Abrir →
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminAgentsPage;
