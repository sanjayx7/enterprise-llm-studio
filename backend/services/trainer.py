from services.model_loader import load_model
from services.dataset_loader import load_dataset
from services.dataset_formatter import format_dataset


def prepare_training(model_id: str, dataset_path: str):
    """
    Prepare model and dataset for training.
    """

    model, tokenizer = load_model(model_id)

    dataframe = load_dataset(dataset_path)

    train_dataset = format_dataset(dataframe)

    return model, tokenizer, train_dataset