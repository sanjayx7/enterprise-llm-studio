from peft import LoraConfig, get_peft_model


def prepare_lora(
    model,
    rank: int,
    alpha: int,
    dropout: float
):
    """
    Configure and apply LoRA to the model.
    """

    lora_config = LoraConfig(
        r=rank,
        lora_alpha=alpha,
        lora_dropout=dropout,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=[
            "q_proj",
            "k_proj",
            "v_proj",
            "o_proj",
            "gate_proj",
            "up_proj",
            "down_proj"
        ]
    )

    model = get_peft_model(
        model,
        lora_config
    )

    return model
