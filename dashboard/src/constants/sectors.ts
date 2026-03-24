/**
 * Sector mapping for B3 universe tickers.
 * Used for filtering recommendations by sector/industry.
 */

export interface SectorInfo {
  sector: string;
  color: string;
  icon: string;
}

export const SECTOR_MAP: Record<string, SectorInfo> = {
  // Tecnologia e E-commerce
  MGLU3: { sector: 'Tecnologia', color: '#3b82f6', icon: '💻' },
  LWSA3: { sector: 'Tecnologia', color: '#3b82f6', icon: '💻' },
  PETZ3: { sector: 'Varejo', color: '#f59e0b', icon: '🛒' },
  VAMO3: { sector: 'Logística', color: '#3b82f6', icon: '🚛' },
  RENT3: { sector: 'Logística', color: '#3b82f6', icon: '🚛' },
  // Energia e Petróleo
  PETR4: { sector: 'Petróleo', color: '#0ea5e9', icon: '🛢️' },
  PETR3: { sector: 'Petróleo', color: '#0ea5e9', icon: '🛢️' },
  PRIO3: { sector: 'Petróleo', color: '#0ea5e9', icon: '🛢️' },
  RECV3: { sector: 'Petróleo', color: '#0ea5e9', icon: '🛢️' },
  RRRP3: { sector: 'Petróleo', color: '#0ea5e9', icon: '🛢️' },
  // Mineração e Siderurgia
  VALE3: { sector: 'Mineração', color: '#78716c', icon: '⛏️' },
  CSNA3: { sector: 'Mineração', color: '#78716c', icon: '⛏️' },
  GGBR4: { sector: 'Mineração', color: '#78716c', icon: '⛏️' },
  USIM5: { sector: 'Mineração', color: '#78716c', icon: '⛏️' },
  GOAU4: { sector: 'Mineração', color: '#78716c', icon: '⛏️' },
  // Bancos e Financeiro
  ITUB4: { sector: 'Financeiro', color: '#f97316', icon: '🏦' },
  BBDC4: { sector: 'Financeiro', color: '#f97316', icon: '🏦' },
  BBAS3: { sector: 'Financeiro', color: '#f97316', icon: '🏦' },
  SANB11: { sector: 'Financeiro', color: '#f97316', icon: '🏦' },
  BPAC11: { sector: 'Financeiro', color: '#f97316', icon: '🏦' },
  // Varejo e Consumo
  LREN3: { sector: 'Varejo', color: '#f59e0b', icon: '🛒' },
  ARZZ3: { sector: 'Varejo', color: '#f59e0b', icon: '🛒' },
  SOMA3: { sector: 'Varejo', color: '#f59e0b', icon: '🛒' },
  GUAR3: { sector: 'Varejo', color: '#f59e0b', icon: '🛒' },
  VIVA3: { sector: 'Varejo', color: '#f59e0b', icon: '🛒' },
  // Construção e Imobiliário
  MRVE3: { sector: 'Imobiliário', color: '#14b8a6', icon: '🏗️' },
  CYRE3: { sector: 'Imobiliário', color: '#14b8a6', icon: '🏗️' },
  EZTC3: { sector: 'Imobiliário', color: '#14b8a6', icon: '🏗️' },
  TEND3: { sector: 'Imobiliário', color: '#14b8a6', icon: '🏗️' },
  JHSF3: { sector: 'Imobiliário', color: '#14b8a6', icon: '🏗️' },
  // Utilities
  ELET3: { sector: 'Energia', color: '#eab308', icon: '⚡' },
  ELET6: { sector: 'Energia', color: '#eab308', icon: '⚡' },
  TAEE11: { sector: 'Energia', color: '#eab308', icon: '⚡' },
  CMIG4: { sector: 'Energia', color: '#eab308', icon: '⚡' },
  CPLE6: { sector: 'Energia', color: '#eab308', icon: '⚡' },
  // Saúde
  HAPV3: { sector: 'Saúde', color: '#ec4899', icon: '🏥' },
  RDOR3: { sector: 'Saúde', color: '#ec4899', icon: '🏥' },
  FLRY3: { sector: 'Saúde', color: '#ec4899', icon: '🏥' },
  GNDI3: { sector: 'Saúde', color: '#ec4899', icon: '🏥' },
  QUAL3: { sector: 'Saúde', color: '#ec4899', icon: '🏥' },
  // Agronegócio
  SLCE3: { sector: 'Agro', color: '#22c55e', icon: '🌾' },
  BEEF3: { sector: 'Agro', color: '#22c55e', icon: '🌾' },
  JBSS3: { sector: 'Agro', color: '#22c55e', icon: '🌾' },
  MRFG3: { sector: 'Agro', color: '#22c55e', icon: '🌾' },
  BRFS3: { sector: 'Agro', color: '#22c55e', icon: '🌾' },
  // Infraestrutura e Logística
  CCRO3: { sector: 'Logística', color: '#3b82f6', icon: '🚛' },
  ECOR3: { sector: 'Logística', color: '#3b82f6', icon: '🚛' },
  TIMS3: { sector: 'Telecom', color: '#a855f7', icon: '📡' },
  VIVT3: { sector: 'Telecom', color: '#a855f7', icon: '📡' },
  CSAN3: { sector: 'Energia', color: '#eab308', icon: '⚡' },
};

export const ALL_SECTORS = [...new Set(Object.values(SECTOR_MAP).map(s => s.sector))].sort();

export function getSector(ticker: string): SectorInfo {
  return SECTOR_MAP[ticker] || { sector: 'Outros', color: '#94a3b8', icon: '📊' };
}
