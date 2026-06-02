/**
 * core/session — current user, factory, role.
 *
 * Single source of truth for "who is using this and what can they see".
 */

export { useSession, useAuth } from "@/lib/use-session";
export {
    getSessionSnapshot,
    primeSession,
    clearSession,
    invalidateSession,
    hydrateSessionFromStorage,
    subscribeSession,
} from "@/lib/session-store";
export type { CurrentUser } from "@/lib/auth";
