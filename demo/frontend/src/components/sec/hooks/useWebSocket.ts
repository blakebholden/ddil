import { useEffect, useRef, useState, useCallback } from "react";

interface Options {
  url: string;
  onMessage?: (data: unknown) => void;
  autoConnect?: boolean;
}

export function useWebSocket({ url, onMessage, autoConnect = false }: Options) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= 1) return;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onMessageRef.current?.(data);
      } catch { /* ignore */ }
    };
  }, [url]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => {
    if (autoConnect) connect();
    return () => { wsRef.current?.close(); };
  }, [autoConnect, connect]);

  return { connected, connect, disconnect };
}
