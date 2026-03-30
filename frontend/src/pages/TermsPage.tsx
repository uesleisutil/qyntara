import React from 'react';
import { theme } from '../styles';

export const TermsPage: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div style={{ maxWidth: 700, margin: '0 auto', padding: '2rem clamp(1rem, 4vw, 2rem)' }}>
    <button onClick={onBack} style={{ background: 'none', border: 'none', color: theme.accent, cursor: 'pointer', fontSize: '0.78rem', marginBottom: '1.5rem' }}>← Voltar</button>
    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: '0.5rem' }}>Termos de Uso</h1>
    <p style={{ fontSize: '0.72rem', color: theme.textMuted, marginBottom: '2rem' }}>Última atualização: 29 de março de 2026</p>

    <div style={{ fontSize: '0.82rem', color: theme.textSecondary, lineHeight: 1.8 }}>
      <Section t="1. Aceitação dos Termos">
        Ao acessar ou usar o Qyntara ("Plataforma"), você concorda com estes Termos de Uso. Se não concordar, não use a Plataforma.
      </Section>
      <Section t="2. Descrição do Serviço">
        O Qyntara é uma plataforma de inteligência para mercados de predição que agrega dados de plataformas como Polymarket e Kalshi, fornecendo análises, sinais de IA, detecção de arbitragem e ferramentas de gestão de portfólio. O Qyntara NÃO é uma plataforma de apostas ou trading. Não executamos operações em nome dos usuários.
      </Section>
      <Section t="3. Cadastro e Conta">
        Você deve fornecer informações verdadeiras ao se cadastrar. Você é responsável pela segurança da sua conta e senha. O Qyntara pode suspender ou encerrar contas que violem estes termos.
      </Section>
      <Section t="4. Planos e Pagamentos">
        O Qyntara oferece planos gratuitos e pagos (Pro e Quant). Pagamentos são processados pelo Stripe. Assinaturas são renovadas automaticamente. Você pode cancelar a qualquer momento nas Configurações. Não há reembolso proporcional ao período não utilizado.
      </Section>
      <Section t="5. Uso Aceitável">
        Você concorda em não: (a) usar a Plataforma para atividades ilegais; (b) tentar acessar dados de outros usuários; (c) fazer scraping ou uso automatizado sem autorização (exceto via API do plano Quant); (d) revender ou redistribuir dados da Plataforma.
      </Section>
      <Section t="6. Isenção de Responsabilidade">
        Os sinais, análises e dados fornecidos pelo Qyntara são apenas informativos e NÃO constituem aconselhamento financeiro, de investimento ou de apostas. Decisões de trading são de responsabilidade exclusiva do usuário. O Qyntara não garante a acurácia dos modelos de IA nem resultados financeiros.
      </Section>
      <Section t="7. Propriedade Intelectual">
        Todo o conteúdo, código, modelos e design do Qyntara são propriedade da Qyntara. Você recebe uma licença limitada e não exclusiva para uso pessoal.
      </Section>
      <Section t="8. Limitação de Responsabilidade">
        O Qyntara não se responsabiliza por perdas financeiras, danos diretos ou indiretos decorrentes do uso da Plataforma. O serviço é fornecido "como está" sem garantias de disponibilidade ou precisão.
      </Section>
      <Section t="9. Alterações">
        Podemos alterar estes termos a qualquer momento. Alterações significativas serão comunicadas por email ou na Plataforma.
      </Section>
      <Section t="10. Contato">
        Para dúvidas sobre estes termos: suporte@qyntara.tech
      </Section>
    </div>
  </div>
);

const Section: React.FC<{ t: string; children: React.ReactNode }> = ({ t, children }) => (
  <div style={{ marginBottom: '1.5rem' }}>
    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: theme.text, marginBottom: '0.5rem' }}>{t}</h3>
    <p style={{ margin: 0 }}>{children}</p>
  </div>
);
