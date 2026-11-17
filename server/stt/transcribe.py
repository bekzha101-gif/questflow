"""Расшифровка голосового сообщения Telegram (ogg/opus) через faster-whisper.

Вызов: python transcribe.py <файл> [--model medium] [--device cuda] [--language ru]
Ответ: одна строка JSON в stdout: {"text": "...", "language": "ru", "seconds": 3.2}
или {"text": "", "error": "..."} — сервер тогда просит написать текстом.
Модель берётся из кеша Hugging Face (~/.cache/huggingface); первый запуск скачивает её.
"""
import argparse
import json
import sys
import os
import time


def add_cuda_dlls() -> None:
    """cuBLAS/cuDNN из pip-пакетов nvidia-* лежат в site-packages/nvidia/*/bin — подключаем их."""
    try:
        import nvidia  # type: ignore
    except Exception:
        return
    for base in getattr(nvidia, "__path__", []):
        for name in os.listdir(base):
            for sub in ("bin", "lib"):
                d = os.path.join(base, name, sub)
                if os.path.isdir(d):
                    os.environ["PATH"] = d + os.pathsep + os.environ.get("PATH", "")
                    if hasattr(os, "add_dll_directory"):
                        try:
                            os.add_dll_directory(d)
                        except OSError:
                            pass


def load_audio(path: str):
    """Звук 16 кГц моно через ffmpeg (если есть): не зависит от версии PyAV в окружении."""
    import shutil
    import subprocess

    if not shutil.which("ffmpeg"):
        return path
    import numpy as np

    raw = subprocess.run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-i", path, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
        capture_output=True,
        check=True,
    ).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path")
    parser.add_argument("--model", default="medium")
    parser.add_argument("--device", default="cuda")
    parser.add_argument("--language", default="ru")
    args = parser.parse_args()

    started = time.time()
    add_cuda_dlls()
    try:
        from faster_whisper import WhisperModel
    except Exception as e:  # faster-whisper не установлен
        print(json.dumps({"text": "", "error": f"faster-whisper не установлен: {e}"}, ensure_ascii=False))
        return 2

    try:
        compute = "float16" if args.device == "cuda" else "int8"
        model = None
        # Сначала модель из кеша без сети (быстрее), потом с докачкой; без CUDA — на процессоре
        for device, ctype, local in ((args.device, compute, True), (args.device, compute, False), ("cpu", "int8", False)):
            try:
                model = WhisperModel(args.model, device=device, compute_type=ctype, local_files_only=local)
                break
            except Exception:
                continue
        if model is None:
            raise RuntimeError(f"модель {args.model} не загрузилась")
        segments, info = model.transcribe(load_audio(args.path), language=args.language or None, vad_filter=True, beam_size=5)
        text = " ".join(s.text.strip() for s in segments).strip()
        out = {"text": text, "language": info.language, "seconds": round(time.time() - started, 1)}
    except Exception as e:
        out = {"text": "", "error": str(e)[:300]}
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(out, ensure_ascii=False))
    return 0 if out.get("text") else 1


if __name__ == "__main__":
    sys.exit(main())
