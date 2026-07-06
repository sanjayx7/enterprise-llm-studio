from services.model_loader import load_model
from services.dataset_loader import load_dataset
from services.dataset_formatter import format_dataset
from services.tokenizer import tokenize_dataset
from services.lora import prepare_lora


def prepare_training(
    model_id: str,
    dataset_path: str,
    max_length: int,
    rank: int,
    alpha: int,
    dropout: float
):

    model, tokenizer = load_model(model_id)

    dataframe = load_dataset(dataset_path)

    formatted_dataset = format_dataset(dataframe)

    tokenized_dataset = tokenize_dataset(
        formatted_dataset,
        tokenizer,
        max_length
    )

    model = prepare_lora(
        model,
        rank,
        alpha,
        dropout
    )

    return model, tokenizer, tokenized_dataset