import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig


def load_model(model_id: str):
    """
    Load Hugging Face model and tokenizer.
    """

    tokenizer = AutoTokenizer.from_pretrained(model_id)

    kwargs = {}
    if torch.cuda.is_available():
        # Check if the GPU supports bfloat16 (Ampere or newer, e.g., RTX 30xx/40xx)
        use_bf16 = torch.cuda.is_bf16_supported()
        compute_dtype = torch.bfloat16 if use_bf16 else torch.float16

        # Use 4-bit quantization for GPU to fit within low VRAM (e.g. 4GB)
        quantization_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=compute_dtype
        )
        kwargs["quantization_config"] = quantization_config
        kwargs["device_map"] = "auto"
        kwargs["torch_dtype"] = compute_dtype

    model = AutoModelForCausalLM.from_pretrained(
        model_id,
        **kwargs
    )

    return model, tokenizer

