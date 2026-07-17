from datasets import Dataset


def tokenize_dataset(
    dataset: Dataset,
    tokenizer,
    max_length: int = 2048
):
    """
    Tokenize the Hugging Face dataset.
    """

    def tokenize(example):
        return tokenizer(
            example["text"],
            truncation=True,
            max_length=max_length,
            padding="max_length"
        )

    return dataset.map(tokenize)