"""Authentication response schemas."""

from __future__ import annotations

from pydantic import BaseModel

from backend.models.user import UserReadSchema


class PermissionsSchema(BaseModel):
    can_view_billing: bool
    can_manage_users: bool
    can_view_analytics: bool
    can_approve_entries: bool
    can_export_data: bool
    can_manage_billing: bool
    can_view_admin_panel: bool


class AuthMeResponse(UserReadSchema):
    permissions: PermissionsSchema
