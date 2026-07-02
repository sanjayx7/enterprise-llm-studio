from transformers import AutoModelForCausalLM, AutoTokenizer
import pandas as pd


def load_model(model_id: str):
    """
    Load Hugging Face model and tokenizer.
    """

    tokenizer = AutoTokenizer.from_pretrained(model_id)

    model = AutoModelForCausalLM.from_pretrained(
        model_id
    )

    return model, tokenizer



def load_dataset(filepath: str):

    extension = filepath.split(".")[-1].lower()

    if extension == "csv":
        return pd.read_csv(filepath)

    elif extension == "json":
        return pd.read_json(filepath)

    elif extension == "jsonl":
        return pd.read_json(filepath, lines=True)

    elif extension == "parquet":
        return pd.read_parquet(filepath)

    raise Exception("Unsupported dataset")
    