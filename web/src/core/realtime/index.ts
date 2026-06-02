/**
 * core/realtime — workflow-sync bus.
 *
 * Today: BroadcastChannel for cross-tab.
 * Future: WebSocket / SSE — same interface, swap the transport.
 */

export {
    signalWorkflowRefresh,
    subscribeToWorkflowRefresh,
} from "@/lib/workflow-sync";
