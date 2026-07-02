from sqlalchemy import Column, Integer, String, DateTime, Float, Text
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



class TrainingConfig(Base):
    __tablename__ = "training_configs"

    id = Column(Integer, primary_key=True, index=True)

    dataset_id = Column(Integer, nullable=False)

    model_id = Column(String(255), nullable=False)

    epochs = Column(Integer, nullable=False)

    batch_size = Column(Integer, nullable=False)

    learning_rate = Column(Float, nullable=False)

    lora_rank = Column(Integer, nullable=False)

    lora_alpha = Column(Integer, nullable=False)

    lora_dropout = Column(Float, nullable=False)

    max_sequence_length = Column(Integer, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )



class TrainingJob(Base):
    __tablename__ = "training_jobs"

    id = Column(Integer, primary_key=True, index=True)

    config_id = Column(Integer, nullable=False)

    status = Column(
        String(20),
        default="PENDING"
    )

    current_epoch = Column(
        Integer,
        default=0
    )

    current_step = Column(
        Integer,
        default=0
    )

    loss = Column(
        Float,
        default=0.0
    )

    progress = Column(
        Float,
        default=0
    )

    adapter_path = Column(
        String(500),
        nullable=True
    )

    logs = Column(
        Text,
        nullable=True
    )

    started_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    completed_at = Column(
        DateTime(timezone=True),
        nullable=True
    )