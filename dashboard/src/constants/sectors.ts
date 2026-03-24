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
  MGLU3: { sector: 'Tecnologia', color: '#5a9e87', icon: '💻' },
  LWSA3: { sector: 'Tecnologia', color: '#5a9e87', icon: '💻' },
  PETZ3: { sector: 'Varejo', color: '#d4a84b', icon: '🛒' },
  VAMO3: { sector: 'Logística', color: '#2d7d9a', icon: '🚛' },
  RENT3: { sector: 'Logística', color: '#2d7d9a', icon: '🚛' },
  // Energia e Petróleo
  PETR4: { sector: 'Petróleo', color: '#2d7d9a', icon: '🛢️' },
  PETR3: { sector: 'Petróleo', color: '#2d7d9a', icon: '🛢️' },
  PRIO3: { sector: 'Petróleo', color: '#2d7d9a', icon: '🛢️' },
  RECV3: { sector: 'Petróleo', color: '#2d7d9a', icon: '🛢️' },
  RRRP3: { sector: 'Petróleo', color: '#2d7d9a', icon: '🛢️' },
  // Mineração e Siderurgia
  VALE3: { sector: 'Mineração', color: '#6a8a7c', icon: '⛏️' },
  CSNA3: { sector: 'Mineração', color: '#6a8a7c', icon: '⛏️' },
  GGBR4: { sector: 'Mineração', color: '#6a8a7c', icon: '⛏️' },
  USIM5: { sector: 'Mineração', color: '#6a8a7c', icon: '⛏️' },
  GOAU4: { sector: 'Mineração', color: '#6a8a7c', icon: '⛏️' },
  // Bancos e Financeiro
  ITUB4: { sector: 'Financeiro', color: '#d4944b', icon: '🏦' },
  BBDC4: { sector: 'Financeiro', color: '#d4944b', icon: '🏦' },
  BBAS3: { sector: 'Financeiro', color: '#d4944b', icon: '🏦' },
  SANB11: { sector: 'Financeiro', color: '#d4944b', icon: '🏦' },
  BPAC11: { sector: 'Financeiro', color: '#d4944b', icon: '🏦' },
  // Varejo e Consumo
  LREN3: { sector: 'Varejo', color: '#d4a84b', icon: '🛒' },
  ARZZ3: { sector: 'Varejo', color: '#d4a84b', icon: '🛒' },
  SOMA3: { sector: 'Varejo', color: '#d4a84b', icon: '🛒' },
  GUAR3: { sector: 'Varejo', color: '#d4a84b', icon: '🛒' },
  VIVA3: { sector: 'Varejo', color: '#d4a84b', icon: '🛒' },
  // Construção e Imobiliário
  MRVE3: { sector: 'Imobiliário', color: '#14b8a6', icon: '🏗️' },
  CYRE3: { sector: 'Imobiliário', color: '#14b8a6', icon: '🏗️' },
  EZTC3: { sector: 'Imobiliário', color: '#14b8a6', icon: '🏗️' },
  TEND3: { sector: 'Imobiliário', color: '#14b8a6', icon: '🏗️' },
  JHSF3: { sector: 'Imobiliário', color: '#14b8a6', icon: '🏗️' },
  // Utilities
  ELET3: { sector: 'Energia', color: '#d4a84b', icon: '⚡' },
  ELET6: { sector: 'Energia', color: '#d4a84b', icon: '⚡' },
  TAEE11: { sector: 'Energia', color: '#d4a84b', icon: '⚡' },
  CMIG4: { sector: 'Energia', color: '#d4a84b', icon: '⚡' },
  CPLE6: { sector: 'Energia', color: '#d4a84b', icon: '⚡' },
  // Saúde
  HAPV3: { sector: 'Saúde', color: '#d4a84b', icon: '🏥' },
  RDOR3: { sector: 'Saúde', color: '#d4a84b', icon: '🏥' },
  FLRY3: { sector: 'Saúde', color: '#d4a84b', icon: '🏥' },
  GNDI3: { sector: 'Saúde', color: '#d4a84b', icon: '🏥' },
  QUAL3: { sector: 'Saúde', color: '#d4a84b', icon: '🏥' },
  // Agronegócio
  SLCE3: { sector: 'Agro', color: '#4ead8a', icon: '🌾' },
  BEEF3: { sector: 'Agro', color: '#4ead8a', icon: '🌾' },
  JBSS3: { sector: 'Agro', color: '#4ead8a', icon: '🌾' },
  MRFG3: { sector: 'Agro', color: '#4ead8a', icon: '🌾' },
  BRFS3: { sector: 'Agro', color: '#4ead8a', icon: '🌾' },
  // Infraestrutura e Logística
  CCRO3: { sector: 'Logística', color: '#2d7d9a', icon: '🚛' },
  ECOR3: { sector: 'Logística', color: '#2d7d9a', icon: '🚛' },
  TIMS3: { sector: 'Telecom', color: '#5a9e87', icon: '📡' },
  VIVT3: { sector: 'Telecom', color: '#5a9e87', icon: '📡' },
  CSAN3: { sector: 'Energia', color: '#d4a84b', icon: '⚡' },
};

export const ALL_SECTORS = [...new Set(Object.values(SECTOR_MAP).map(s => s.sector))].sort();

export function getSector(ticker: string): SectorInfo {
  return SECTOR_MAP[ticker] || { sector: 'Outros', color: '#8fa89c', icon: '📊' };
}
