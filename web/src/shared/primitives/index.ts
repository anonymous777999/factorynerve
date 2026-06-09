/**
 * shared/primitives — atom-tier UI components.
 *
 * Stateless presentation only. No business logic, no API calls, no React Query.
 * These components must compose into any feature.
 *
 * Migration note: re-exports from the legacy `components/ui/` location.
 * New code should import from `@/shared/primitives`. As individual files
 * are physically moved, update the re-exports here — consumers don't change.
 */

export { Badge } from "@/components/ui/badge";
export { Button } from "@/components/ui/button";
export { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export { Input } from "@/components/ui/input";
export { Label } from "@/components/ui/label";
export { Select } from "@/components/ui/select";
export { Skeleton } from "@/components/ui/skeleton";
export { Textarea } from "@/components/ui/textarea";
export { TabNav } from "@/shared/primitives/tab-nav";
export { SafeText } from "@/components/ui/safe-text";
export { StatusBadge } from "@/components/ui/status-badge";
export { ConfidenceBadge } from "@/components/ui/confidence-badge";
