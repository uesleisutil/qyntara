import React from 'react';
import { useOutletContext } from 'react-router-dom';
import ProGate from '../../components/shared/ProGate';
import TrackingTab from '../../components/tracking/TrackingTab';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

const TrackingPage: React.FC = () => {
  const { darkMode } = useOutletContext<DashboardContext>();
  return (
    <ProGate feature="O Acompanhamento por Safra" darkMode={darkMode}>
      <div style={{ overflow: 'hidden' }}>
        <TrackingTab darkMode={darkMode} />
      </div>
    </ProGate>
  );
};

export default TrackingPage;
