import React from 'react';
import { useOutletContext } from 'react-router-dom';
import ProGate from '../../components/shared/ProGate';
import PortfolioTab from '../../components/portfolio/PortfolioTab';

const PortfolioPage: React.FC = () => {
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  return (
    <ProGate feature="A Carteira Modelo" darkMode={darkMode}>
      <PortfolioTab darkMode={darkMode} />
    </ProGate>
  );
};

export default PortfolioPage;
