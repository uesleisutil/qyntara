import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import { PRO_PRICE_LABEL } from '../constants';

const PrivacyPolicyPage: React.FC = () => {
  const navigate = useNavigate();

  const sectionStyle: React.CSSProperties = { marginBottom: '1.5rem' };
  const h2Style: React.CSSProperties = { fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.5rem' };
  const pStyle: React.CSSProperties = { color: '#6b7280', fontSize: '0.88rem', lineHeight: 1.7, margin: '0.3rem 0' };
  const liStyle: React.CSSProperties = { color: '#6b7280', fontSize: '0.88rem', lineHeight: 1.7, marginLeft: '1.2rem' };

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', padding: '2rem' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 4, minHeight: 'auto' }}>
            <ArrowLeft size={20} />
          </button>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #2563eb, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 800, color: '#fff' }}>Q</div>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9' }}>Qyntara</span>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #2a2e3a', borderRadius: 16, padding: 'clamp(1.5rem, 4vw, 2.5rem)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <Shield size={22} color="#3b82f6" />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Política de Privacidade</h1>
          </div>
          <p style={{ ...pStyle, marginBottom: '1.5rem' }}>Última atualização: 22 de março de 2026</p>

          <div style={sectionStyle}>
            <h2 style={h2Style}>1. Dados Coletados</h2>
            <p style={pStyle}>Coletamos apenas os dados estritamente necessários para o funcionamento do serviço:</p>
            <ul style={{ listStyle: 'disc', paddingLeft: '1rem' }}>
              <li style={liStyle}>Email (para autenticação e comunicação)</li>
              <li style={liStyle}>Nome (para personalização da experiência)</li>
              <li style={liStyle}>Senha (armazenada com hash PBKDF2-SHA256, 600k iterações — nunca em texto puro)</li>
              <li style={liStyle}>Endereço IP (para segurança e prevenção de fraude)</li>
              <li style={liStyle}>Dados de uso (páginas visitadas, funcionalidades utilizadas)</li>
            </ul>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>2. Finalidade do Tratamento</h2>
            <p style={pStyle}>Seus dados são utilizados exclusivamente para:</p>
            <ul style={{ listStyle: 'disc', paddingLeft: '1rem' }}>
              <li style={liStyle}>Autenticação e controle de acesso à plataforma</li>
              <li style={liStyle}>Geração e entrega de recomendações de investimento baseadas em Deep Learning</li>
              <li style={liStyle}>Processamento de pagamentos via Stripe (não armazenamos dados de cartão)</li>
              <li style={liStyle}>Comunicação sobre o serviço (verificação de email, notificações)</li>
              <li style={liStyle}>Segurança (detecção de acessos suspeitos, rate limiting)</li>
            </ul>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>3. Base Legal (LGPD Art. 7)</h2>
            <p style={pStyle}>
              O tratamento de dados é realizado com base no consentimento do titular (ao criar a conta) e na execução de contrato
              (prestação do serviço contratado). Dados de segurança são tratados com base no legítimo interesse do controlador.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>4. Compartilhamento de Dados</h2>
            <p style={pStyle}>Seus dados podem ser compartilhados apenas com:</p>
            <ul style={{ listStyle: 'disc', paddingLeft: '1rem' }}>
              <li style={liStyle}>Stripe Inc. — processamento de pagamentos (sujeito à política de privacidade do Stripe)</li>
              <li style={liStyle}>Amazon Web Services (AWS) — infraestrutura de hospedagem (dados armazenados em us-east-1)</li>
            </ul>
            <p style={pStyle}>Não vendemos, alugamos ou compartilhamos seus dados com terceiros para fins de marketing.</p>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>5. Retenção de Dados</h2>
            <p style={pStyle}>
              Seus dados são mantidos enquanto sua conta estiver ativa. Logs de autenticação são retidos por 90 dias.
              Após exclusão da conta, todos os dados pessoais são removidos em até 30 dias.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>6. Direitos do Titular (LGPD Art. 18)</h2>
            <p style={pStyle}>Você tem direito a:</p>
            <ul style={{ listStyle: 'disc', paddingLeft: '1rem' }}>
              <li style={liStyle}>Acessar seus dados pessoais (disponível em Configurações)</li>
              <li style={liStyle}>Corrigir dados incompletos ou desatualizados</li>
              <li style={liStyle}>Solicitar a exclusão total dos seus dados (disponível em Configurações → Excluir Conta)</li>
              <li style={liStyle}>Revogar o consentimento a qualquer momento</li>
              <li style={liStyle}>Solicitar portabilidade dos dados</li>
            </ul>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>7. Segurança</h2>
            <p style={pStyle}>Implementamos medidas técnicas e organizacionais para proteger seus dados:</p>
            <ul style={{ listStyle: 'disc', paddingLeft: '1rem' }}>
              <li style={liStyle}>Criptografia em trânsito (HTTPS/TLS) e em repouso (AWS KMS)</li>
              <li style={liStyle}>Hash de senhas com PBKDF2-SHA256 (600.000 iterações)</li>
              <li style={liStyle}>Rate limiting e bloqueio de conta após tentativas falhas</li>
              <li style={liStyle}>JWT com expiração de 24 horas</li>
              <li style={liStyle}>Content Security Policy (CSP) para prevenção de XSS</li>
              <li style={liStyle}>AWS WAF para proteção contra ataques web</li>
            </ul>
          </div>

          <div style={sectionStyle}>
            <h2 style={h2Style}>8. Contato do Encarregado (DPO)</h2>
            <p style={pStyle}>
              Para exercer seus direitos ou esclarecer dúvidas sobre o tratamento de dados, entre em contato pelo
              canal de suporte dentro da plataforma ou pelo email do administrador.
            </p>
          </div>

          <div style={{ ...sectionStyle, borderTop: '1px solid #2a2e3a', paddingTop: '1rem' }}>
            <h2 style={h2Style}>9. Termos de Uso</h2>
            <p style={pStyle}>Ao criar uma conta no Qyntara, você concorda com os seguintes termos:</p>
            <ul style={{ listStyle: 'disc', paddingLeft: '1rem' }}>
              <li style={liStyle}>O serviço é uma ferramenta de apoio à decisão e não constitui recomendação de investimento.</li>
              <li style={liStyle}>Resultados passados não garantem resultados futuros.</li>
              <li style={liStyle}>O plano Pro ({PRO_PRICE_LABEL}) é cobrado via Stripe com renovação automática mensal.</li>
              <li style={liStyle}>O cancelamento pode ser feito a qualquer momento em Configurações → Gerenciar Assinatura. O acesso Pro permanece até o fim do período pago.</li>
              <li style={liStyle}>Você é responsável por manter a segurança da sua conta e senha.</li>
              <li style={liStyle}>Reservamo-nos o direito de suspender contas que violem estes termos ou utilizem o serviço de forma abusiva.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
