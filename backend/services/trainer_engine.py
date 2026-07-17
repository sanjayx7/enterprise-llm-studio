import os
import time
import torch
from sqlalchemy.sql import func
from transformers import TrainingArguments, TrainerCallback
from trl import SFTTrainer

from database.connection import SessionLocal
from database.models import TrainingJob


class TerminalProgressCallback(TrainerCallback):
    def __init__(self, job_id=None):
        self.job_id = job_id
        self.start_time = None

    def on_train_begin(self, args, state, control, **kwargs):
        self.start_time = time.time()
        print(f"\n[Trainer] Training started. Total steps: {state.max_steps}", flush=True)
        if self.job_id is not None:
            db = SessionLocal()
            try:
                job = db.query(TrainingJob).filter(TrainingJob.id == self.job_id).first()
                if job:
                    job.status = "RUNNING"
                    db.commit()
            except Exception as e:
                print(f"Error updating job start: {e}", flush=True)
            finally:
                db.close()

    def on_log(self, args, state, control, logs=None, **kwargs):
        if logs is None:
            logs = {}
        
        step = state.global_step
        max_steps = state.max_steps
        epoch = getattr(state, "epoch", 0.0)
        
        if max_steps > 0:
            percent = (step / max_steps) * 100
            
            # Calculate elapsed time and ETA
            elapsed = time.time() - (self.start_time or time.time())
            if step > 0:
                steps_per_sec = step / elapsed
                eta_seconds = (max_steps - step) / steps_per_sec
                
                # Format ETA
                if eta_seconds > 60:
                    eta_str = f"{int(eta_seconds // 60)}m {int(eta_seconds % 60)}s"
                else:
                    eta_str = f"{int(eta_seconds)}s"
            else:
                eta_str = "Calculating..."
            
            loss = logs.get("loss", "N/A")
            if isinstance(loss, float):
                loss_str = f"{loss:.4f}"
                loss_val = loss
            else:
                loss_str = str(loss)
                loss_val = 0.0
                
            print(f"-> Step {step}/{max_steps} ({percent:.1f}%) | Loss: {loss_str} | ETA: {eta_str}", flush=True)

            if self.job_id is not None:
                db = SessionLocal()
                try:
                    job = db.query(TrainingJob).filter(TrainingJob.id == self.job_id).first()
                    if job:
                        job.current_step = step
                        job.current_epoch = int(epoch)
                        job.progress = percent
                        job.loss = float(loss_val)
                        
                        log_line = f"Step {step}/{max_steps} (Epoch {epoch:.2f}) | Loss: {loss_str} | ETA: {eta_str}\n"
                        job.logs = (job.logs or "") + log_line
                        db.commit()
                except Exception as e:
                    print(f"Error updating job progress: {e}", flush=True)
                finally:
                    db.close()

    def on_train_end(self, args, state, control, **kwargs):
        print(f"\n[Trainer] Training completed successfully.", flush=True)
        if self.job_id is not None:
            db = SessionLocal()
            try:
                job = db.query(TrainingJob).filter(TrainingJob.id == self.job_id).first()
                if job:
                    job.status = "COMPLETED"
                    job.progress = 100.0
                    job.completed_at = func.now()
                    db.commit()
            except Exception as e:
                print(f"Error updating job completion: {e}", flush=True)
            finally:
                db.close()


def create_trainer(
    model,
    tokenizer,
    train_dataset,
    config,
    job_id=None
):
    has_gpu = torch.cuda.is_available()
    use_bf16 = has_gpu and torch.cuda.is_bf16_supported()
    use_fp16 = has_gpu and not use_bf16

    if not has_gpu:
        # Limit CPU threads to avoid consuming 100% of all cores and freezing the host system.
        # We use a maximum of 4 threads or half the available CPU cores.
        cpu_count = os.cpu_count() or 1
        num_threads = max(1, min(4, cpu_count // 2))
        torch.set_num_threads(num_threads)
        
        # Set environment variables for libraries that initialize thread pools later
        os.environ["OMP_NUM_THREADS"] = str(num_threads)
        os.environ["MKL_NUM_THREADS"] = str(num_threads)
        os.environ["OPENBLAS_NUM_THREADS"] = str(num_threads)

    training_args = TrainingArguments(
        output_dir=f"trained_models/config_{config.id}",
        num_train_epochs=config.epochs,
        per_device_train_batch_size=config.batch_size,
        learning_rate=config.learning_rate,
        logging_steps=1,
        save_strategy="no",
        report_to="none",
        remove_unused_columns=False,
        fp16=use_fp16,
        bf16=use_bf16,
        dataloader_pin_memory=has_gpu,
        use_cpu=not has_gpu,
        disable_tqdm=True,
        gradient_checkpointing=has_gpu,
        optim="paged_adamw_32bit" if has_gpu else "adamw_torch"
    )

    trainer = SFTTrainer(

        model=model,

        args=training_args,

        train_dataset=train_dataset,

        processing_class=tokenizer,
        
        callbacks=[TerminalProgressCallback(job_id=job_id)]
    )

    return trainer