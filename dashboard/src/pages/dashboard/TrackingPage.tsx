import React from 'react';
import { useOutletContext } from 'react-router-dom';
import TrackingTab from '../../components/tracking/TrackingTab';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

const TrackingPage: React.FC = () => {
  const { darkMode } = useOutletContext<DashboardContext>();
  return <TrackingTab darkMode={darkMode} />;
};

export default TrackingPage;
