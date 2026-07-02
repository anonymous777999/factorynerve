from datetime import date
from sqlalchemy import Column, Integer, Date, Float, ForeignKey
from sqlalchemy.orm import relationship

from .base import Base

class MachineFeatureSnapshot(Base):
    """Denormalized daily snapshot used by the failure‑prediction model."""
    __tablename__ = "machine_feature_snapshot"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(Integer, ForeignKey("machine.id"), nullable=False, index=True)
    snapshot_date = Column(Date, nullable=False, index=True)

    # Operational metrics (all nullable – may be missing for a given day)
    downtime_min = Column(Float, nullable=True)
    produced_qty_kg = Column(Float, nullable=True)
    temperature_avg = Column(Float, nullable=True)
    vibration_avg = Column(Float, nullable=True)

    machine = relationship("Machine")
