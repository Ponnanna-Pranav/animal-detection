# backend/app/schemas.py

from pydantic import BaseModel
from datetime import datetime

class DetectionOut(BaseModel):
    id: int
    filename: str
    animal: str
    confidence: float
    x_min: float
    y_min: float
    x_max: float
    y_max: float
    image_path: str | None = None
    is_dangerous: bool
    created_at: datetime

    class Config:
        orm_mode = True
