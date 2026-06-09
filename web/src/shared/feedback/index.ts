/**
 * shared/feedback — mutation feedback surfaces.
 *
 * The unified system for telling the user what happened after they acted.
 * Recovery banners, success/error banners, toasts, notifications.
 */

export {
    FeedbackBanner,
    SuccessBanner,
    MutationErrorBanner,
} from "./feedback-banner";
export { RecoveryBanner } from "@/components/ui/recovery-banner";
