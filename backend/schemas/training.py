from pydantic import BaseModel, Field


class TrainingConfigCreate(BaseModel):

    dataset_id: int

    model_id: str

    epochs: int = Field(default=3, ge=1)

    batch_size: int = Field(default=4, ge=1)

    learning_rate: float = Field(default=2e-4, gt=0)

    lora_rank: int = Field(default=16, ge=1)

    lora_alpha: int = Field(default=32, ge=1)

    lora_dropout: float = Field(default=0.05, ge=0, le=1)

    max_sequence_length: int = Field(default=2048, ge=128)