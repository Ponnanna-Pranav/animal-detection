# backend/app/models_db.py

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean
from sqlalchemy.sql import func
from .database import Base

class Detection(Base):
    __tablename__ = "detections"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    animal = Column(String, index=True)
    confidence = Column(Float)
    x_min = Column(Float)
    y_min = Column(Float)
    x_max = Column(Float)
    y_max = Column(Float)

    # NEW FIELDS
    image_path = Column(String, nullable=True)   # where we saved the file
    is_dangerous = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
