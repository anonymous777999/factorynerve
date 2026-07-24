import { apiFetch } from "@/lib/api";

export type NotificationItem = {
  id: number;
  user_id: number;
  org_id: string | null;
  notification_type: string;
  title: string;
  body: string | null;
  metadata_json: string | null;
  is_read: boolean;
  created_at: string;
};

export type UnreadCount = {
  count: number;
};

export type PaginatedNotifications = {
  items: NotificationItem[];
  total: number;
  page: number;
  page_size: number;
};

export type NotificationListParams = {
  page?: number;
  page_size?: number;
  notification_type?: string;
  is_read?: boolean;
};

/** Fetch the current user's unread notification count (polled for badge). */
export async function fetchUnreadNotificationCount(): Promise<number> {
  try {
    const result = await apiFetch<UnreadCount>("/notifications/unread-count", undefined, {
      cacheTtlMs: 15000,
    });
    return result.count;
  } catch {
    return 0;
  }
}

/** Fetch unread notifications for the dropdown list (bell dropdown). */
export async function fetchUnreadNotifications(limit = 20): Promise<NotificationItem[]> {
  try {
    const result = await apiFetch<NotificationItem[]>(`/notifications/unread?limit=${limit}`, undefined, {
      cacheTtlMs: 10000,
    });
    return result;
  } catch {
    return [];
  }
}

/** Fetch notifications with pagination and optional filters for the full-page view. */
export async function fetchNotifications(
  params: NotificationListParams = {},
): Promise<PaginatedNotifications> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", String(params.page));
  if (params.page_size) searchParams.set("page_size", String(params.page_size));
  if (params.notification_type) searchParams.set("notification_type", params.notification_type);
  if (params.is_read !== undefined) searchParams.set("is_read", String(params.is_read));

  const qs = searchParams.toString();
  const path = `/notifications${qs ? `?${qs}` : ""}`;

  return apiFetch<PaginatedNotifications>(path, undefined, { cacheTtlMs: 10000 });
}

/** Fetch a single notification by ID. */
export async function fetchNotificationById(id: number): Promise<NotificationItem> {
  return apiFetch<NotificationItem>(`/notifications/${id}`);
}

/** Mark a single notification as read. */
export async function markNotificationRead(id: number): Promise<void> {
  await apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
}

/** Mark all unread notifications as read. */
export async function markAllNotificationsRead(): Promise<{ count: number }> {
  return apiFetch<{ count: number }>("/notifications/read-all", { method: "PATCH" });
}
