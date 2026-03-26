import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Singleton WebSocket manager.
 * Uma única conexão compartilhada por todos os hooks.
 * Cada hook se inscreve nos tópicos que precisa.
 */
type Listener = (data: any) => void;

class WsManager {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private url: string;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private connecting = false;

  constructor(url: string) {
    this.url = url;
    if (url) this.connect();
  }

  private connect() {
    if (this.connecting || !this.url) return;
    this.connecting = true;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectDelay = 1000;
        this.connecting = false;
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const topic = msg.topic as string;
          const listeners = this.listeners.get(topic);
          if (listeners) {
            listeners.forEach((fn) => fn(msg.data));
          }
        } catch { /* ignore malformed */ }
      };

      this.ws.onclose = () => {
        this.connecting = false;
        setTimeout(() => this.connect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      };

      this.ws.onerror = () => {
        this.connecting = false;
        this.ws?.close();
      };
    } catch {
      this.connecting = false;
      setTimeout(() => this.connect(), this.reconnectDelay);
    }
  }

  subscribe(topic: string, fn: Listener) {
    if (!this.listeners.has(topic)) this.listeners.set(topic, new Set());
    this.listeners.get(topic)!.add(fn);
    return () => { this.listeners.get(topic)?.delete(fn); };
  }
}

// Lazy singleton — criado uma vez quando o primeiro hook monta
let manager: WsManager | null = null;

function getManager(): WsManager | null {
  if (manager) return manager;
  const url = (window as any).__B3TR_WS_URL__
    || import.meta.env.VITE_WS_URL
    || '';
  if (!url) return null;
  manager = new WsManager(url);
  return manager;
}

/**
 * Hook que busca dados uma vez e depois ouve por atualizações via WebSocket.
 *
 * - Faz fetch inicial no mount.
 * - Se inscreve no tópico WebSocket — quando o server envia dado novo, atualiza.
 * - Sem polling. Sem timers. Push-based real.
 * - Se WS não estiver configurado, funciona como fetch-once + refresh manual.
 *
 * @param fetchFn   Função async que busca os dados da API REST
 * @param wsTopic   Tópico WebSocket para ouvir (ex: "recommendations", "performance")
 */
export function useLiveData<T>(
  fetchFn: () => Promise<T | null>,
  wsTopic?: string,
) {
  const [data, setData] = useState<T | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);

  const doFetch = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const result = await fetchFn();
      if (!mountedRef.current) return;
      setData(result);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      if (mountedRef.current) setError(err.message || 'Fetch error');
    } finally {
      if (mountedRef.current) setInitialLoading(false);
      fetchingRef.current = false;
    }
  }, [fetchFn]);

  // Fetch inicial (uma vez)
  useEffect(() => {
    mountedRef.current = true;
    doFetch();
    return () => { mountedRef.current = false; };
  }, [doFetch]);

  // Ouvir WebSocket — quando chega dado novo, refetch
  useEffect(() => {
    if (!wsTopic) return;
    const mgr = getManager();
    if (!mgr) return;

    const unsub = mgr.subscribe(wsTopic, () => {
      // Dado novo chegou no tópico — refetch pra pegar dados completos
      doFetch();
    });

    return unsub;
  }, [wsTopic, doFetch]);

  const refresh = useCallback(() => { doFetch(); }, [doFetch]);

  return { data, initialLoading, lastUpdated, error, refresh };
}
