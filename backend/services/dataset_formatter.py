from datasets import Dataset


def format_dataset(df):
    """
    Convert an instruction dataset into
    Hugging Face Dataset format.
    """

    required_columns = {
        "instruction",
        "input",
        "output"
    }

    if not required_columns.issubset(df.columns):
        raise Exception(
            "Dataset must contain instruction, input and output columns."
        )

    formatted_data = []

    for _, row in df.iterrows():

        instruction = str(row["instruction"]).strip()
        input_text = str(row["input"]).strip()
        output = str(row["output"]).strip()

        if input_text:

            text = (
                f"### Instruction:\n{instruction}\n\n"
                f"### Input:\n{input_text}\n\n"
                f"### Response:\n{output}"
            )

        else:

            text = (
                f"### Instruction:\n{instruction}\n\n"
                f"### Response:\n{output}"
            )

        formatted_data.append(
            {
                "text": text
            }
        )

    return Dataset.from_list(formatted_data)