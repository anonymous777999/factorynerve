"""Regression tests for IP-3 two-person separation of duties.

Guards the fix where a single checker could clear both L1 and L2 of a
sequential two-stage approval. The L1 approver is now recorded on the
instance, and the same user is blocked from completing L2.
"""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Import every model module so SQLAlchemy can resolve cross-model
# relationships (e.g. User -> Entry) before create_all/query.
import importlib
import pkgutil
import backend.models as _models_pkg
for _m in pkgutil.iter_modules(_models_pkg.__path__):
    try:
        importlib.import_module(f"backend.models.{_m.name}")
    except Exception:
        pass
from backend.models.approval_instance import ApprovalInstance, Base
from backend.services.approval_service import approval_service, ApprovalPattern, WORKFLOW_PATTERNS

# A workflow that is (still) two-stage after the Option-B downgrade.
IP3_WORKFLOW = "invoice.record.edit_post_dispatch"


@pytest.fixture()
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)  # all models imported above
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _initiate(db):
    decision = approval_service.initiate_approval(
        db,
        actor_user_id=100,          # maker
        subject_user_id=None,
        workflow_key=IP3_WORKFLOW,
        action_key=IP3_WORKFLOW,
        resource_type="Invoice",
        resource_id="inv-1",
    )
    assert decision.result == "approval_required"
    assert decision.current_approval_stage == "L1"
    return decision.instance_id


def test_selected_workflow_is_still_two_stage():
    assert WORKFLOW_PATTERNS[IP3_WORKFLOW] == ApprovalPattern.IP_3


def test_same_person_cannot_clear_both_stages(db):
    instance_id = _initiate(db)

    # Checker A clears L1.
    d1 = approval_service.advance_approval(
        db, instance_id, actor_user_id=200, action="approve"
    )
    assert d1.result == "approval_required"
    assert d1.current_approval_stage == "L2"

    # Same checker A tries to clear L2 -> must be denied.
    d2 = approval_service.advance_approval(
        db, instance_id, actor_user_id=200, action="approve"
    )
    assert d2.result == "denied"
    assert "L1 approver" in (d2.reason or "")


def test_two_different_people_complete_the_flow(db):
    instance_id = _initiate(db)

    approval_service.advance_approval(
        db, instance_id, actor_user_id=200, action="approve"
    )
    # A different checker B clears L2 -> approved.
    d2 = approval_service.advance_approval(
        db, instance_id, actor_user_id=300, action="approve"
    )
    assert d2.result == "approved"

    row = db.query(ApprovalInstance).filter_by(instance_id=instance_id).one()
    assert row.status == "approved"
    assert row.l1_approved_by_user_id == 200
    assert row.approved_by_user_id == 300


def test_downgraded_workflows_are_single_stage():
    for key in ("user.invite", "factory.create", "user.deactivate", "user.membership.assign"):
        assert WORKFLOW_PATTERNS[key] == ApprovalPattern.IP_2, key
