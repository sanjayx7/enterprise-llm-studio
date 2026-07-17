import gc
import json
import os
import requests
from threading import Thread
import torch
from transformers import TextIteratorStreamer
from peft import PeftModel

from services.model_loader import load_model

class LocalChatEngine:
    def __init__(self):
        self.current_model = None
        self.current_tokenizer = None
        self.current_model_id = None
        self.current_adapter_path = None

    def unload_model(self):
        if self.current_model is not None:
            print("[ChatEngine] Unloading active model...", flush=True)
            self.current_model = None
            self.current_tokenizer = None
            self.current_model_id = None
            self.current_adapter_path = None
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

    def load_model_and_adapter(self, model_id: str, adapter_path: str = None):
        # If already loaded, return it
        if (self.current_model_id == model_id and 
            self.current_adapter_path == adapter_path and 
            self.current_model is not None):
            return self.current_model, self.current_tokenizer

        # Unload previous model to free VRAM
        self.unload_model()

        print(f"[ChatEngine] Loading base model: {model_id}...", flush=True)
        model, tokenizer = load_model(model_id)

        if adapter_path:
            print(f"[ChatEngine] Applying PEFT LoRA adapter: {adapter_path}...", flush=True)
            model = PeftModel.from_pretrained(model, adapter_path)

        model.eval()
        self.current_model = model
        self.current_tokenizer = tokenizer
        self.current_model_id = model_id
        self.current_adapter_path = adapter_path

        return model, tokenizer

    def generate_local_stream(self, model_id: str, adapter_path: str, history_messages, prompt: str):
        try:
            # Ensure model is loaded
            model, tokenizer = self.load_model_and_adapter(model_id, adapter_path)

            # Format chat message history
            formatted_messages = []
            for msg in history_messages:
                formatted_messages.append({"role": msg["role"], "content": msg["content"]})
            formatted_messages.append({"role": "user", "content": prompt})

            # Check if tokenizer has chat template, fallback if not
            try:
                prompt_text = tokenizer.apply_chat_template(
                    formatted_messages, 
                    tokenize=False, 
                    add_generation_prompt=True
                )
            except Exception:
                prompt_text = ""
                for msg in formatted_messages:
                    prompt_text += f"<|im_start|>{msg['role']}\n{msg['content']}<|im_end|>\n"
                prompt_text += "<|im_start|>assistant\n"

            inputs = tokenizer(prompt_text, return_tensors="pt")
            
            # Put inputs on GPU if model is on GPU
            device = "cuda" if torch.cuda.is_available() else "cpu"
            inputs = {k: v.to(device) for k, v in inputs.items()}

            streamer = TextIteratorStreamer(
                tokenizer, 
                skip_prompt=True, 
                skip_special_tokens=True,
                clean_up_tokenization_spaces=True
            )

            generation_kwargs = dict(
                **inputs,
                streamer=streamer,
                max_new_tokens=512,
                do_sample=True,
                temperature=0.7,
                top_p=0.9
            )

            # Run generation in background thread
            thread = Thread(target=model.generate, kwargs=generation_kwargs)
            thread.start()

            for token_text in streamer:
                chunk = {
                    "choices": [
                        {
                            "delta": {
                                "content": token_text
                            }
                        }
                    ]
                }
                yield f"data: {json.dumps(chunk)}\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
            err_chunk = {
                "error": str(e)
            }
            yield f"data: {json.dumps(err_chunk)}\n\n"


# Singleton instance of local chat engine
chat_engine = LocalChatEngine()



