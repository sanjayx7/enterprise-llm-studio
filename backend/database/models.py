from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from database.connection import Base


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)

    original_filename = Column(String(255), nullable=False)

    stored_filename = Column(String(255), unique=True, nullable=False)

    filepath = Column(String(500), nullable=False)

    file_type = Column(String(20), nullable=False)

    file_size = Column(Integer, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )