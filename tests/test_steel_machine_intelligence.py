"""Tests for Steel Machine Intelligence — downtime events, maintenance tasks, and analytics.

Covers:
- Machine intelligence summary endpoint
- Downtime event CRUD (create, list)
- Maintenance task CRUD (create, list, status update)
- Permission gating (non-steel factory rejection)
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from http import HTTPStatus

from backend.database import SessionLocal, init_db
from backend.models.factory import Factory
from backend.models.steel_machine import SteelMachine
from backend.models.user import User
from tests.utils import register_user


def _promote_factory_to_steel(email: str) -> None:
    init_db()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        factory = (
            db.query(Factory)
            .filter(Factory.org_id == user.org_id, Factory.name == user.factory_name)
            .first()
        )
        assert factory is not None
        factory.industry_type = "steel"
        factory.workflow_template_key = "steel-core-pack"
        db.add(factory)
        db.commit()
    finally:
        db.close()


def _seed_production_line_and_machine(email: str) -> int:
    """Create a production line and machine for the user's factory. Returns machine_id."""
    init_db()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        factory = (
            db.query(Factory)
            .filter(Factory.org_id == user.org_id, Factory.name == user.factory_name)
            .first()
        )
        assert factory is not None

        from backend.models.steel_production_line import SteelProductionLine
        line = SteelProductionLine(
            org_id=factory.org_id,
            factory_id=factory.factory_id,
            code="LINE-01",
            name="Production Line 1",
        )
        db.add(line)
        db.flush()

        machine = SteelMachine(
            org_id=factory.org_id,
            factory_id=factory.factory_id,
            line_id=line.id,
            machine_code="MACH-01",
            name="Rolling Mill 1",
            machine_type="Rolling Mill",
            rated_capacity_per_hour=5000.0,
        )
        db.add(machine)
        db.flush()
        db.commit()
        return int(machine.id)
    finally:
        db.close()


def test_machine_intelligence_rejects_non_steel_factory(http_client):
    """Non-steel factories should get a 400 response."""
    user = register_user(http_client, role="admin")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    response = http_client.get("/steel/production/machine-intelligence", headers=headers)

    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert "steel factory" in response.text.lower()


def test_machine_intelligence_summary_with_no_data(http_client):
    """Intelligence summary returns machine list even with zero events."""
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    response = http_client.get("/steel/production/machine-intelligence", headers=headers)

    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()
    assert "machines" in payload
    assert "factory_summary" in payload
    assert "period_days" in payload
    assert payload["as_of"] is not None


def test_machine_intelligence_with_data(http_client):
    """Intelligence summary returns proper metrics after seeding a machine and events."""
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    machine_id = _seed_production_line_and_machine(user["email"])
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    # Create a downtime event
    now = datetime.now(timezone.utc)
    create_event = http_client.post(
        "/steel/production/machines/downtime-events",
        json={
            "machine_id": machine_id,
            "started_at": (now - timedelta(hours=2)).isoformat(),
            "ended_at": (now - timedelta(hours=1)).isoformat(),
            "duration_minutes": 60,
            "reason_category": "mechanical_failure",
            "reason_detail": "Belt snapped",
            "shift": "morning",
        },
        headers=headers,
    )
    assert create_event.status_code == HTTPStatus.OK, create_event.text

    # Get intelligence
    response = http_client.get(
        "/steel/production/machine-intelligence",
        headers=headers,
    )

    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()
    assert payload["machine_count"] >= 1

    machine_data = next(
        (m for m in payload["machines"] if m["machine_id"] == machine_id),
        None,
    )
    assert machine_data is not None
    assert machine_data["machine_code"] == "MACH-01"
    assert machine_data["downtime_minutes"] >= 60
    assert machine_data["uptime_percent"] is not None
    assert machine_data["failure_count"] >= 1
    assert len(machine_data["top_downtime_reasons"]) >= 1

    # Per-machine query
    per_machine = http_client.get(
        f"/steel/production/machine-intelligence?machine_id={machine_id}",
        headers=headers,
    )
    assert per_machine.status_code == HTTPStatus.OK, per_machine.text
    assert per_machine.json()["machine_count"] == 1


def test_create_and_list_downtime_events(http_client):
    """Full CRUD flow for downtime events: create, then list."""
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    machine_id = _seed_production_line_and_machine(user["email"])
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    now = datetime.now(timezone.utc)

    # Create
    create_resp = http_client.post(
        "/steel/production/machines/downtime-events",
        json={
            "machine_id": machine_id,
            "started_at": (now - timedelta(hours=3)).isoformat(),
            "ended_at": (now - timedelta(hours=2, minutes=30)).isoformat(),
            "reason_category": "power_outage",
            "shift": "evening",
            "notes": "Power cut from grid",
        },
        headers=headers,
    )
    assert create_resp.status_code == HTTPStatus.OK, create_resp.text
    event = create_resp.json()["event"]
    assert event["machine_id"] == machine_id
    assert event["reason_category"] == "power_outage"
    assert event["duration_minutes"] is not None

    # List all
    list_resp = http_client.get(
        "/steel/production/machines/downtime-events",
        headers=headers,
    )
    assert list_resp.status_code == HTTPStatus.OK, list_resp.text
    events = list_resp.json()["events"]
    assert len(events) >= 1
    assert any(e["id"] == event["id"] for e in events)

    # List by machine
    per_machine = http_client.get(
        f"/steel/production/machines/downtime-events?machine_id={machine_id}",
        headers=headers,
    )
    assert per_machine.status_code == HTTPStatus.OK, per_machine.text
    assert len(per_machine.json()["events"]) >= 1


def test_create_and_list_maintenance_tasks(http_client):
    """Full CRUD flow for maintenance tasks: create, list, update status."""
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    machine_id = _seed_production_line_and_machine(user["email"])
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    future = datetime.now(timezone.utc) + timedelta(days=7)

    # Create
    create_resp = http_client.post(
        "/steel/production/machines/maintenance-tasks",
        json={
            "machine_id": machine_id,
            "title": "Oil change and bearing inspection",
            "description": "Regular preventive maintenance",
            "maintenance_type": "preventive",
            "priority": "high",
            "scheduled_date": future.isoformat(),
            "notes": "Requires 2 technicians",
        },
        headers=headers,
    )
    assert create_resp.status_code == HTTPStatus.OK, create_resp.text
    task = create_resp.json()["task"]
    task_id = task["id"]
    assert task["title"] == "Oil change and bearing inspection"
    assert task["status"] == "scheduled"

    # List all
    list_resp = http_client.get(
        "/steel/production/machines/maintenance-tasks",
        headers=headers,
    )
    assert list_resp.status_code == HTTPStatus.OK, list_resp.text
    tasks = list_resp.json()["tasks"]
    assert len(tasks) >= 1
    assert any(t["id"] == task_id for t in tasks)

    # Update status to in_progress
    update_resp = http_client.patch(
        f"/steel/production/machines/maintenance-tasks/{task_id}/status",
        json={"status": "in_progress"},
        headers=headers,
    )
    assert update_resp.status_code == HTTPStatus.OK, update_resp.text
    assert update_resp.json()["task"]["status"] == "in_progress"

    # Complete the task
    complete_resp = http_client.patch(
        f"/steel/production/machines/maintenance-tasks/{task_id}/status",
        json={"status": "completed", "notes": "Maintenance completed successfully"},
        headers=headers,
    )
    assert complete_resp.status_code == HTTPStatus.OK, complete_resp.text
    assert complete_resp.json()["task"]["status"] == "completed"
    assert complete_resp.json()["task"]["completed_at"] is not None

    # Filter by status
    completed_list = http_client.get(
        "/steel/production/machines/maintenance-tasks?status=completed",
        headers=headers,
    )
    assert completed_list.status_code == HTTPStatus.OK, completed_list.text
    completed_tasks = completed_list.json()["tasks"]
    assert any(t["id"] == task_id for t in completed_tasks)


def test_machine_intelligence_with_maintenance_data(http_client):
    """Intelligence summary shows maintenance due status."""
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    machine_id = _seed_production_line_and_machine(user["email"])
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    now = datetime.now(timezone.utc)

    # Create overdue maintenance task
    http_client.post(
        "/steel/production/machines/maintenance-tasks",
        json={
            "machine_id": machine_id,
            "title": "Overdue inspection",
            "scheduled_date": (now - timedelta(days=2)).isoformat(),
            "priority": "critical",
        },
        headers=headers,
    )

    # Create upcoming maintenance
    http_client.post(
        "/steel/production/machines/maintenance-tasks",
        json={
            "machine_id": machine_id,
            "title": "Routine check",
            "scheduled_date": (now + timedelta(days=3)).isoformat(),
        },
        headers=headers,
    )

    # Intelligence summary
    response = http_client.get(
        "/steel/production/machine-intelligence",
        headers=headers,
    )
    assert response.status_code == HTTPStatus.OK, response.text
    payload = response.json()

    factory_summary = payload["factory_summary"]
    assert factory_summary["overdue_maintenance_count"] >= 1
    assert factory_summary["upcoming_maintenance_count"] >= 1

    machine_data = next(
        (m for m in payload["machines"] if m["machine_id"] == machine_id),
        None,
    )
    assert machine_data is not None
    assert machine_data["overdue_maintenance_count"] >= 1
    assert len(machine_data["maintenance_tasks"]) >= 2


def test_machine_endpoints_work_with_manager_role(http_client):
    """Manager role should have access to machine intelligence endpoints."""
    user = register_user(http_client, role="manager")
    _promote_factory_to_steel(user["email"])
    machine_id = _seed_production_line_and_machine(user["email"])
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    # Create a downtime event
    now = datetime.now(timezone.utc)
    create_event = http_client.post(
        "/steel/production/machines/downtime-events",
        json={
            "machine_id": machine_id,
            "started_at": (now - timedelta(hours=1)).isoformat(),
            "ended_at": now.isoformat(),
            "reason_category": "setup_change",
            "shift": "morning",
        },
        headers=headers,
    )
    assert create_event.status_code == HTTPStatus.OK, create_event.text

    # Intelligence
    intelligence = http_client.get(
        "/steel/production/machine-intelligence",
        headers=headers,
    )
    assert intelligence.status_code == HTTPStatus.OK, intelligence.text

    # List machines
    machines = http_client.get(
        "/steel/production/machines",
        headers=headers,
    )
    assert machines.status_code == HTTPStatus.OK, machines.text
    machine_list = machines.json()["machines"]
    assert any(m["id"] == machine_id for m in machine_list)


def test_update_maintenance_task_status_404_for_wrong_task(http_client):
    """Updating a non-existent maintenance task returns 404."""
    user = register_user(http_client, role="admin")
    _promote_factory_to_steel(user["email"])
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    response = http_client.patch(
        "/steel/production/machines/maintenance-tasks/99999/status",
        json={"status": "completed"},
        headers=headers,
    )
    assert response.status_code == HTTPStatus.NOT_FOUND
    assert "not found" in response.text.lower()
