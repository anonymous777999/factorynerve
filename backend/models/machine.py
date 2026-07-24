from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from .base import Base

class Machine(Base):
    """Registry of all production machines.
    Used by downtime tracking, maintenance scheduling and reliability metrics.
    """

    __tablename__ = "machine"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    machine_type = Column(String, nullable=False)  # e.g. "press", "roller", "furnace"
    is_active = Column(Boolean, default=True, nullable=False)

    # Reliability metrics – populated by MTBF/MTTR services
    mtbf_hours = Column(Float, nullable=True)
    mttr_hours = Column(Float, nullable=True)

    # Maintenance scheduling fields
    maintenance_interval_hours = Column(Float, nullable=True)  # after how many operating hours maintenance is due
    next_maintenance_at = Column(DateTime, nullable=True)

    # Relationships
    downtimes = relationship(
        "MachineDowntime",
        back_populates="machine",
        cascade="all, delete-orphan",
    )
    maintenance_tasks = relationship(
        "MaintenanceTask",
        back_populates="machine",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Machine id={self.id} name={self.name}>"




