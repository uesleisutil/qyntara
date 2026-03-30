import React from 'react';
import { theme } from '../styles';

export const PrivacyPage: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div style={{ maxWidth: 700, margin: '0 auto', padding: '2rem clamp(1rem, 4vw, 2rem)' }}>
    <button onClick={onBack} style={{ background: 'none', border: 'none', color: theme.accent, cursor: 'pointer', fontSize: '0.78rem', marginBottom: '1.5rem' }}>← Voltar</button>
    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: '0.5rem' }}>Política de Privacidade</h1>
    <p style={{ fontSize: '0.72rem', color: theme.textMuted, marginBottom: '2rem' }}>Última atualização: 29 de março de 2026</p>

    <div style={{ fontSize: '0.82rem', color: theme.textSecondary, lineHeight: 1.8 }}>
      <Section t="1. Dados que Coletamos">
        Coletamos: nome, email, telefone (opcional), país (opcional) fornecidos no cadastro. Dados de uso: páginas acessadas, mercados visualizados, posições do portfólio. Dados técnicos: IP, navegador, dispositivo.
      </Section>
      <Section t="2. Como Usamos seus Dados">
        Seus dados são usados para: (a) fornecer e melhorar o serviço; (b) processar pagamentos; (c) enviar notificações e alertas que você autorizou; (d) suporte ao cliente. Seus dados NÃO são usados para treinar modelos de inteligência artificial. Os modelos do Qyntara são treinados exclusivamente com dados públicos de mercados.
      </Section>
      <Section t="3. Compartilhamento">
        Não vendemos seus dados. Compartilhamos apenas com: Stripe (pagamentos), Locaweb (emails transacionais), AWS (infraestrutura). Todos os parceiros seguem padrões de segurança adequados.
      </Section>
      <Section t="4. Segurança">
        Senhas são criptografadas com bcrypt. Tokens JWT com rotação automática. Dados sensíveis armazenados no AWS Secrets Manager. Comunicação via HTTPS. Acesso ao banco de dados restrito por IAM.
      </Section>
      <Section t="5. Seus Direitos (LGPD)">
        Conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018), você tem direito a: (a) acessar seus dados; (b) corrigir dados incorretos; (c) solicitar a exclusão de todos os seus dados; (d) revogar consentimento; (e) portabilidade dos dados. Para exercer esses direitos, acesse Configurações ou entre em contato: suporte@qyntara.tech
      </Section>
      <Section t="6. Exclusão de Dados">
        Você pode excluir sua conta e todos os dados a qualquer momento em Configurações. A exclusão é permanente e irreversível. Removemos: dados de perfil, posições, tickets de suporte, notificações e tokens de acesso.
      </Section>
      <Section t="7. Cookies">
        Usamos apenas cookies essenciais para autenticação (token JWT armazenado em localStorage). Não usamos cookies de rastreamento, analytics de terceiros ou publicidade.
      </Section>
      <Section t="8. Retenção">
        Dados de conta são mantidos enquanto a conta estiver ativa. Após exclusão, todos os dados são removidos em até 24 horas. Logs de auditoria são mantidos por 30 dias para segurança.
      </Section>
      <Section t="9. Alterações">
        Podemos atualizar esta política. Alterações significativas serão comunicadas por email.
      </Section>
      <Section t="10. Contato">
        Encarregado de dados (DPO): suporte@qyntara.tech
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
