"""Helpers for consistent acceptance-first invitation emails."""

from __future__ import annotations

from html import escape

from backend.models.user import UserRole


ROLE_LABELS: dict[UserRole, str] = {
    UserRole.ATTENDANCE: "Attendance Operator",
    UserRole.OPERATOR: "Operations Operator",
    UserRole.SUPERVISOR: "Supervisor",
    UserRole.ACCOUNTANT: "Accountant",
    UserRole.MANAGER: "Manager",
    UserRole.ADMIN: "Administrator",
    UserRole.OWNER: "Owner",
}

ROLE_SUMMARIES: dict[UserRole, str] = {
    UserRole.ATTENDANCE: "Track attendance and shift presence for the assigned factory.",
    UserRole.OPERATOR: "Capture daily production entries and keep floor activity current.",
    UserRole.SUPERVISOR: "Review queues, verify records, and resolve trust blockers.",
    UserRole.ACCOUNTANT: "Work on reports, summaries, and finance-facing export flows.",
    UserRole.MANAGER: "Oversee workflow health, reporting, and factory-level coordination.",
    UserRole.ADMIN: "Manage factory settings, users, access, and operating controls.",
    UserRole.OWNER: "View and control organization-wide operations across factories.",
}


def role_label(role: UserRole) -> str:
    return ROLE_LABELS.get(role, role.value.replace("_", " ").title())


def role_summary(role: UserRole) -> str:
    return ROLE_SUMMARIES.get(role, "Access is determined by the role assigned in DPR.ai.")


def build_invite_email_payload(
    *,
    recipient_name: str,
    invited_email: str,
    role: UserRole,
    organization_name: str,
    factory_name: str,
    factory_location: str | None,
    company_code: str | None,
    inviter_name: str,
    custom_note: str | None,
    verification_link: str | None,
    expires_in_hours: int,
) -> dict[str, object]:
    safe_recipient_name = recipient_name.strip() or "Teammate"
    safe_note = (custom_note or "").strip() or None
    safe_location = (factory_location or "").strip() or None
    safe_code = (company_code or "").strip() or None
    safe_link = (verification_link or "").strip() or None
    assigned_role_label = role_label(role)
    assigned_role_summary = role_summary(role)

    details: list[tuple[str, str]] = [
        ("Assigned role", assigned_role_label),
        ("Organization", organization_name),
        ("Factory", factory_name),
    ]
    if safe_location:
        details.append(("Factory location", safe_location))
    if safe_code:
        details.append(("Company code", safe_code))
    details.extend(
        [
            ("Invited by", inviter_name),
            ("Invite email", invited_email),
        ]
    )

    text_lines = [
        f"{safe_recipient_name},",
        "",
        f"{inviter_name} invited you to join DPR.ai for {factory_name}.",
        "",
        f"Assigned role: {assigned_role_label}",
        assigned_role_summary,
        "",
        f"Organization: {organization_name}",
        f"Factory: {factory_name}",
    ]
    if safe_location:
        text_lines.append(f"Factory location: {safe_location}")
    if safe_code:
        text_lines.append(f"Company code: {safe_code}")
    text_lines.extend(
        [
            "",
            "Next steps:",
            "1. Open the secure acceptance link.",
            "2. Confirm the company and role details.",
            "3. Set your password and accept the invitation.",
            "",
        ]
    )
    if safe_link:
        text_lines.extend(
            [
                f"Acceptance link (valid {expires_in_hours} hours):",
                safe_link,
                "",
            ]
        )
    else:
        text_lines.extend(
            [
                f"A secure acceptance link will be added when the invite is sent. It will stay valid for {expires_in_hours} hours.",
                "",
            ]
        )
    if safe_note:
        text_lines.extend(
            [
                "Admin note:",
                safe_note,
                "",
            ]
        )
    text_lines.append("No DPR.ai account will be created until you accept this invitation.")
    text_body = "\n".join(text_lines)

    html_sections = [
        f"<p>{escape(safe_recipient_name)},</p>",
        f"<p><strong>{escape(inviter_name)}</strong> invited you to join DPR.ai for <strong>{escape(factory_name)}</strong>.</p>",
        (
            "<div>"
            f"<p><strong>Assigned role:</strong> {escape(assigned_role_label)}</p>"
            f"<p>{escape(assigned_role_summary)}</p>"
            "</div>"
        ),
        "<ul>"
        + "".join(f"<li><strong>{escape(label)}:</strong> {escape(value)}</li>" for label, value in details)
        + "</ul>",
        (
            "<ol>"
            "<li>Open the secure acceptance link.</li>"
            "<li>Confirm the company and role details.</li>"
            "<li>Set your password and accept the invitation.</li>"
            "</ol>"
        ),
        (
            f"<p><strong>Acceptance link (valid {expires_in_hours} hours):</strong><br>"
            f"{escape(safe_link)}</p>"
            if safe_link
            else f"<p><strong>Acceptance link:</strong> A secure link will be generated when the invite is sent. It will stay valid for {expires_in_hours} hours.</p>"
        ),
    ]
    if safe_note:
        html_sections.append(
            "<div>"
            "<p><strong>Admin note</strong></p>"
            f"<p>{escape(safe_note)}</p>"
            "</div>"
        )
    html_sections.append("<p><strong>No DPR.ai account will be created until you accept this invitation.</strong></p>")

    return {
        "subject": f"You've been invited to DPR.ai for {factory_name}",
        "text_body": text_body,
        "html_body": "".join(html_sections),
        "summary": {
            "recipient_name": safe_recipient_name,
            "email": invited_email,
            "role": role.value,
            "role_label": assigned_role_label,
            "role_summary": assigned_role_summary,
            "organization_name": organization_name,
            "factory_name": factory_name,
            "factory_location": safe_location,
            "company_code": safe_code,
            "inviter_name": inviter_name,
            "custom_note": safe_note,
            "verification_link": safe_link,
            "expires_in_hours": expires_in_hours,
        },
        "sections": {
            "details": [{"label": label, "value": value} for label, value in details],
            "next_steps": [
                "Open the secure acceptance link.",
                "Confirm the company and role details.",
                "Set your password and accept the invitation.",
            ],
            "custom_note": safe_note,
        },
    }
