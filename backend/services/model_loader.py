from transformers import AutoModelForCausalLM, AutoTokenizer


def load_model(model_id: str):
    """
    Load Hugging Face model and tokenizer.
    """

    tokenizer = AutoTokenizer.from_pretrained(model_id)

    model = AutoModelForCausalLM.from_pretrained(
        model_id
    )

    return model, tokenizer

