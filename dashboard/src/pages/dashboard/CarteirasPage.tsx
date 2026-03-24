import React from 'react';
import { useOutletContext } from 'react-router-dom';
import CarteirasTab from '../../components/carteiras/CarteirasTab';

interface DashboardContext { darkMode: boolean; theme: Record<string, string>; }

const CarteirasPage: React.FC = () => {
  const { darkMode } = useOutletContext<DashboardContext>();
  return (
    <div style={{ overflow: 'hidden' }}>
      <CarteirasTab darkMode={darkMode} />
    </div>
  );
};

export default CarteirasPage;
