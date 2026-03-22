import React from 'react';
import { useOutletContext } from 'react-router-dom';
import PerformanceTab from '../../components/performance/PerformanceTab';

const PerformancePage: React.FC = () => {
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  return <PerformanceTab darkMode={darkMode} />;
};

export default PerformancePage;
