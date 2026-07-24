from __future__ import annotations

import importlib.util
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from backend.models.subscription import Subscription
from backend.services import billing_manager


def _load_migration_module():
    migration_path = (
        Path(__file__).resolve().parents[2]
        / "alembic"
        / "versions"
        / "20260517_03_subscription_org_id.py"
    )
    spec = importlib.util.spec_from_file_location("subscription_org_id_migration", migration_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.asyncio
async def test_subscription_resolves_by_org_id(monkeypatch):
    monkeypatch.setattr(billing_manager, "resolve_factory_id", lambda db, user: None)
    monkeypatch.setattr(billing_manager, "AuditLog", lambda **kwargs: SimpleNamespace(**kwargs))

    future = datetime.now(timezone.utc) + timedelta(days=30)
    active_sub = SimpleNamespace(
        id=1,
        org_id="org-123",
        user_id=42,
        plan="pilot",
        status="active",
        provider=None,
        current_period_end_at=future,
        trial_end_at=None,
        pending_plan=None,
        pending_plan_effective_at=None,
        created_at=None,
        updated_at=None,
        grace_period_end_at=None,
    )
    apply_sub = SimpleNamespace(
        id=2,
        org_id="org-123",
        user_id=42,
        plan="pilot",
        status="trialing",
        provider=None,
        current_period_end_at=None,
        trial_end_at=None,
        pending_plan="operations",
        pending_plan_effective_at=None,
        created_at=None,
        updated_at=None,
        grace_period_end_at=None,
    )
    scheduled_sub = SimpleNamespace(
        id=3,
        org_id="org-123",
        user_id=42,
        plan="operator",
        status="active",
        provider="razorpay",
        current_period_end_at=None,
        trial_end_at=None,
        pending_plan=None,
        pending_plan_effective_at=None,
        created_at=None,
        updated_at=None,
        grace_period_end_at=None,
    )
    due_sub = SimpleNamespace(
        id=4,
        org_id="org-123",
        user_id=42,
        plan="operations",
        status="active",
        provider="razorpay",
        current_period_end_at=None,
        trial_end_at=None,
        pending_plan="pilot",
        pending_plan_effective_at=datetime.now(timezone.utc) - timedelta(days=1),
        created_at=None,
        updated_at=None,
        grace_period_end_at=None,
    )
    # Monkeypatch _resolve_subscription_org_id so it returns "org-123"
    # without needing db.query(User) — this avoids a fragile side_effect
    # chain for the two _resolve calls inside apply_plan_change.
    monkeypatch.setattr(
        billing_manager, "_resolve_subscription_org_id",
        lambda db, **kwargs: "org-123",
    )

    user = SimpleNamespace(id=42, org_id="org-123")
    org = SimpleNamespace(org_id="org-123", plan="pilot", plan_expires_at=None)
    plan_row = SimpleNamespace(user_id=42, plan="pilot", updated_at=None)

    active_query = MagicMock()
    active_query.filter.return_value.limit.return_value.all.return_value = [active_sub]

    apply_query = MagicMock()
    apply_query.filter.return_value.limit.return_value.all.return_value = [apply_sub]
    apply_query2 = MagicMock()
    apply_query2.filter.return_value.limit.return_value.all.return_value = [apply_sub]
    plan_apply_query = MagicMock()
    plan_apply_query.filter.return_value.first.return_value = plan_row
    audit_user_apply_query = MagicMock()
    audit_user_apply_query.filter.return_value.first.return_value = user
    org_apply_query = MagicMock()
    org_apply_query.filter.return_value.first.return_value = org

    schedule_query = MagicMock()
    schedule_query.filter.return_value.limit.return_value.all.return_value = [scheduled_sub]

    cancel_query = MagicMock()
    cancel_query.filter.return_value.limit.return_value.all.return_value = [scheduled_sub]

    due_query = MagicMock()
    due_query.filter.return_value = due_query
    due_query.all.return_value = [due_sub]

    due_apply_query = MagicMock()
    due_apply_query.filter.return_value.limit.return_value.all.return_value = [due_sub]
    due_apply_query2 = MagicMock()
    due_apply_query2.filter.return_value.limit.return_value.all.return_value = [due_sub]
    plan_due_apply_query = MagicMock()
    plan_due_apply_query.filter.return_value.first.return_value = plan_row
    audit_user_due_apply_query = MagicMock()
    audit_user_due_apply_query.filter.return_value.first.return_value = user
    org_due_apply_query = MagicMock()
    org_due_apply_query.filter.return_value.first.return_value = org

    db = MagicMock()
    db.query.side_effect = [
        active_query,
        apply_query,
        apply_query2,
        plan_apply_query,
        audit_user_apply_query,
        org_apply_query,
        schedule_query,
        cancel_query,
        due_query,
        due_apply_query,
        due_apply_query2,
        org_due_apply_query,
        plan_due_apply_query,
        audit_user_due_apply_query,
    ]

    assert billing_manager.get_active_subscription(db, "org-123") is active_sub
    billing_manager.apply_plan_change(db, user_id=42, plan="operator")
    assert billing_manager.schedule_downgrade(db, user_id=42, plan="pilot") is scheduled_sub
    billing_manager.cancel_scheduled_downgrade(db, user_id=42)
    assert billing_manager.apply_due_downgrades(db, user_id=42) == 1

    direct_subscription_filters = [
        active_query.filter.call_args.args,
        apply_query.filter.call_args.args,
        schedule_query.filter.call_args.args,
        cancel_query.filter.call_args.args,
        due_apply_query.filter.call_args.args,
    ]
    rendered_direct_filters = [" ".join(str(arg) for arg in args) for args in direct_subscription_filters]
    assert all("subscriptions.org_id" in rendered for rendered in rendered_direct_filters)
    assert all("subscriptions.user_id" not in rendered for rendered in rendered_direct_filters)

    due_filters = [" ".join(str(arg) for arg in call.args) for call in due_query.filter.call_args_list]
    assert any("subscriptions.org_id" in rendered for rendered in due_filters)
    assert all("subscriptions.user_id" not in rendered for rendered in due_filters)
    assert apply_sub.plan == "operator"
    assert apply_sub.status == "active"
    assert apply_sub.pending_plan is None
    assert scheduled_sub.pending_plan is None
    assert due_sub.plan == "pilot"
    assert due_sub.status == "active"
    assert due_sub.pending_plan is None


@pytest.mark.asyncio
async def test_no_duplicate_active_subscription_per_org():
    index = next(index for index in Subscription.__table__.indexes if index.name == "uq_subscriptions_active_org_id")
    assert index.unique is True
    assert "status = 'active'" in str(index.dialect_options["postgresql"]["where"])


@pytest.mark.asyncio
async def test_orphan_detection_returns_correct_ids():
    orphan_query = MagicMock()
    orphan_query.join.return_value = orphan_query
    orphan_query.outerjoin.return_value = orphan_query
    orphan_query.filter.return_value = orphan_query
    orphan_query.all.return_value = [(101,), (202,)]

    db = MagicMock()
    db.query.return_value = orphan_query

    assert billing_manager.detect_orphaned_subscriptions(db) == [101, 202]


@pytest.mark.asyncio
async def test_migration_backfill_correctness(monkeypatch):
    module = _load_migration_module()

    inspector = MagicMock()
    inspector.get_table_names.return_value = ["subscriptions", "users", "organizations"]
    inspector.get_columns.return_value = [{"name": "id"}, {"name": "user_id"}, {"name": "status"}]
    inspector.get_indexes.return_value = []

    bind_mock = MagicMock(name="bind")
    bind_mock.dialect.name = "postgresql"
    bind_mock.execute.return_value.scalar.return_value = 0
    bind_mock.execute.return_value.fetchall.return_value = []

    op = MagicMock()
    op.get_bind.return_value = bind_mock

    monkeypatch.setattr(module.sa, "inspect", lambda bind: inspector)
    monkeypatch.setattr(module, "op", op)

    module.upgrade()

    # Migration uses op.batch_alter_table() context manager, so schema
    # changes go through batch_op, not op directly.
    batch_op = op.batch_alter_table.return_value.__enter__.return_value

    assert batch_op.add_column.call_count == 1
    added_column = batch_op.add_column.call_args.args[0]
    assert added_column.name == "org_id"
    assert added_column.nullable is True
    assert any(
        "SET org_id" in str(call.args[0])
        and "users.org_id" in str(call.args[0])
        and "users.id = subscriptions.user_id" in str(call.args[0])
        for call in bind_mock.execute.call_args_list
    )
    assert batch_op.alter_column.call_args.kwargs["nullable"] is False
    assert any(
        call.args[0] == "uq_subscriptions_active_org_id"
        and call.kwargs.get("unique") is True
        and "status = 'active'" in str(call.kwargs.get("postgresql_where"))
        for call in op.create_index.call_args_list
    )

    inspector.get_columns.return_value = [{"name": "id"}, {"name": "user_id"}, {"name": "org_id"}]
    inspector.get_indexes.return_value = [
        {"name": "ix_subscriptions_org_id"},
        {"name": "uq_subscriptions_active_org_id"},
    ]

    module.downgrade()

    assert op.drop_index.call_count == 2
    assert batch_op.drop_column.call_args.args == ("org_id",)
