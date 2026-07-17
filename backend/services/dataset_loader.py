

import pandas as pd


def load_dataset(filepath: str):
    """
    Load dataset from disk.
    """

    extension = filepath.split(".")[-1].lower()

    if extension == "csv":
        return pd.read_csv(filepath)

    elif extension == "json":
        return pd.read_json(filepath)

    elif extension == "jsonl":
        return pd.read_json(filepath, lines=True)

    elif extension == "parquet":
        return pd.read_parquet(filepath)

    raise Exception("Unsupported dataset format.")