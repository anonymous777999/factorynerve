from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, Float, String, ForeignKey
from sqlalchemy.orm import relationship

from .base import Base

class MachineDowntime(Base):
    """A single downtime interval for a machine."""
    __tablename__ = "machine_downtime"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(Integer, ForeignKey("machine.id"), nullable=False, index=True)
    start_ts = Column(DateTime, nullable=False, default=datetime.utcnow)
    end_ts = Column(DateTime, nullable=True)                     # null → still open
    reason_code = Column(String, nullable=True)                  # optional enum-like free text
    duration_min = Column(Float, nullable=True)                  # populated on close

    machine = relationship("Machine", back_populates="downtimes")
