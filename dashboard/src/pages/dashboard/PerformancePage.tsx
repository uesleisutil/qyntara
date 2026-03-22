import React from 'react';
import { useOutletContext } from 'react-router-dom';
import ProGate from '../../components/shared/ProGate';
import PerformanceTab from '../../components/performance/PerformanceTab';

const PerformancePage: React.FC = () => {
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  return (
    <ProGate feature="O Histórico de Performance" darkMode={darkMode}>
      <PerformanceTab darkMode={darkMode} />
    </ProGate>
  );
};

export default PerformancePage;
