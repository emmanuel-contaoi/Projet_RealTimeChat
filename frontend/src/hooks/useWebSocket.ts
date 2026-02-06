import { useEffect, useRef, useCallback, useState } from "react";

type ServerEvent = {
  type: string;
  [key: string]: unknown;
};

type UseWebSocketOptions = {
  onMessage?: (event: ServerEvent) => void;
  onOpen?: () => void;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const WS_URL = API_URL.replace(/^http/, "ws") + "/ws";
const RECONNECT_DELAY = 3000;

export default function useWebSocket(options?: UseWebSocketOptions) {
  const onMessage = options?.onMessage;
  const onOpen = options?.onOpen;
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const [isConnected, setIsConnected] = useState(false);

  onMessageRef.current = onMessage;
  onOpenRef.current = onOpen;

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("token");
    if (!token) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = new WebSocket(`${WS_URL}?token=${token}`);

    ws.onopen = () => {
      console.log("[WS] Connected");
      setIsConnected(true);
      onOpenRef.current?.();
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as ServerEvent;
        onMessageRef.current?.(data);
      } catch {
        // ignore non-JSON frames
      }
    };

    ws.onclose = () => {
      console.log("[WS] Disconnected");
      wsRef.current = null;
      setIsConnected(false);
      if (mountedRef.current) {
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const sendMessage = useCallback(
    (channelId: string, content: string) => {
      send({ type: "message_send", channel_id: channelId, content });
    },
    [send]
  );

  const joinChannel = useCallback(
    (channelId: string) => {
      send({ type: "join_channel", channel_id: channelId });
    },
    [send]
  );

  const leaveChannel = useCallback(
    (channelId: string) => {
      send({ type: "leave_channel", channel_id: channelId });
    },
    [send]
  );

  return { sendMessage, joinChannel, leaveChannel, isConnected };
}
