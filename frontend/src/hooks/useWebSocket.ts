import { useEffect, useRef, useState } from 'react';
import { WS_BASE } from '../config';

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);

  useEffect(() => {
    const connect = () => {
      const socket = new WebSocket(`${WS_BASE}/ws`);
      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        setTimeout(connect, 3000);
      };
      socket.onmessage = (e) => {
        try { setLastMessage(JSON.parse(e.data)); } catch {}
      };
      ws.current = socket;
    };
    connect();
    return () => { ws.current?.close(); };
  }, []);

  return { connected, lastMessage };
}
