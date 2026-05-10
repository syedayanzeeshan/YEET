"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConsensusRound,
  ExecutionReceipt,
  MarketplaceTask,
  NodeReputation,
  SwarmLogEvent,
  SwarmMetrics,
  SwarmSocketSnapshot,
  YeetNode,
  YeetTaskInput
} from "@/app/types/yeet";

const emptyMetrics: SwarmMetrics = {
  connectedNodes: 0,
  heartbeatsPerMinute: 0,
  receiptsVerified: 0,
  invalidReceipts: 0,
  queuedTasks: 0,
  activeTasks: 0,
  completedTasks: 0,
  slashedNodes: 0
};

type ServerMessage =
  | { type: "snapshot"; payload: Partial<SwarmSocketSnapshot> }
  | { type: "round"; payload: ConsensusRound }
  | { type: "nodes"; payload: YeetNode[] }
  | { type: "receipts"; payload: ExecutionReceipt[] }
  | { type: "reputation"; payload: NodeReputation[] }
  | { type: "tasks"; payload: MarketplaceTask[] }
  | { type: "log"; payload: SwarmLogEvent }
  | { type: "metrics"; payload: SwarmMetrics };

const defaultCoordinatorWs =
  process.env.NEXT_PUBLIC_YEET_COORDINATOR_WS ?? "ws://localhost:8787";

export function useSwarmSocket(url = defaultCoordinatorWs) {
  const socketRef = useRef<WebSocket | null>(null);
  const [snapshot, setSnapshot] = useState<SwarmSocketSnapshot>({
    connected: false,
    nodes: [],
    assignedNodeIds: [],
    receipts: [],
    reputation: [],
    tasks: [],
    logs: [],
    metrics: emptyMetrics
  });

  useEffect(() => {
    let cancelled = false;
    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => {
      if (!cancelled) {
        setSnapshot((current) => ({
          ...current,
          connected: true,
          logs: pushLog(current.logs, "success", "websocket coordinator connected")
        }));
      }
    };

    socket.onclose = () => {
      if (!cancelled) {
        setSnapshot((current) => ({
          ...current,
          connected: false,
          logs: pushLog(current.logs, "warn", "websocket coordinator offline; using local simulation")
        }));
      }
    };

    socket.onerror = () => {
      if (!cancelled) {
        setSnapshot((current) => ({
          ...current,
          connected: false,
          logs: pushLog(current.logs, "warn", "live coordinator unavailable")
        }));
      }
    };

    socket.onmessage = (event) => {
      const parsed = parseMessage(event.data);
      if (!parsed || cancelled) return;
      setSnapshot((current) => reduceMessage(current, parsed));
    };

    return () => {
      cancelled = true;
      socket.close();
    };
  }, [url]);

  const dispatchTask = useCallback((task: YeetTaskInput) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ type: "dispatch_task", payload: task }));
    return true;
  }, []);

  return useMemo(() => ({ ...snapshot, dispatchTask }), [snapshot, dispatchTask]);
}

function reduceMessage(current: SwarmSocketSnapshot, message: ServerMessage): SwarmSocketSnapshot {
  switch (message.type) {
    case "snapshot":
      return {
        ...current,
        ...message.payload,
        connected: true,
        metrics: { ...current.metrics, ...message.payload.metrics },
        logs: message.payload.logs ?? current.logs
      };
    case "round":
      return { ...current, currentRound: message.payload };
    case "nodes":
      return { ...current, nodes: message.payload };
    case "receipts":
      return { ...current, receipts: message.payload };
    case "reputation":
      return { ...current, reputation: message.payload };
    case "tasks":
      return { ...current, tasks: message.payload };
    case "metrics":
      return { ...current, metrics: message.payload };
    case "log":
      return { ...current, logs: [message.payload, ...current.logs].slice(0, 42) };
    default:
      return current;
  }
}

function parseMessage(data: unknown): ServerMessage | null {
  if (typeof data !== "string") return null;
  try {
    return JSON.parse(data) as ServerMessage;
  } catch {
    return null;
  }
}

function pushLog(logs: SwarmLogEvent[], level: SwarmLogEvent["level"], message: string) {
  return [
    {
      id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ts: Date.now(),
      level,
      message
    },
    ...logs
  ].slice(0, 42);
}
