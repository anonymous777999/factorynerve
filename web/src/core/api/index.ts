/**
 * core/api — HTTP client and shared API plumbing.
 *
 * Every feature's `api/` folder uses this client. No business logic here.
 */

export {
    ApiError,
    API_BASE_URL,
    apiFetch,
    formatApiErrorMessage,
    preloadApiGet,
    primeApiCache,
    invalidateApiCache,
} from "@/lib/api";
