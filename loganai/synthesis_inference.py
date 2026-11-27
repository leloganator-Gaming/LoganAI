"""Inférence locale du modèle de synthèse LoganAI."""
import argparse
from pathlib import Path

import torch

from .config import ModelConfig
from .model import LoganLanguageModel
from .synthesis_training import DEFAULT_CHECKPOINT, PREFIX, SEPARATOR, SYNTHESIS_CONFIG
from .tokenizer import LoganTokenizer


def generate_summary(model, document: str, max_new_tokens: int = 220,
                     temperature: float = 0.7, tokenizer=None) -> str:
    if not isinstance(document, str) or not document.strip():
        raise ValueError("Le document à résumer est vide.")
    tokenizer = tokenizer or LoganTokenizer()
    fixed = tokenizer.encode(PREFIX + SEPARATOR)
    doc_ids = tokenizer.encode(document.strip())
    available = model.cfg.block_size - len(fixed)
    if available < 40:
        raise ValueError("Fenêtre de contexte trop petite.")
    if len(doc_ids) > available:
        raw = bytes(doc_ids[:available]).decode("utf-8", errors="ignore")
        raw = raw.rsplit(" ", 1)[0] if " " in raw else raw
        doc_ids = tokenizer.encode(raw)
    prompt = tokenizer.encode(PREFIX) + doc_ids + tokenizer.encode(SEPARATOR)
    if len(prompt) > model.cfg.block_size:
        raise ValueError("Le document dépasse la fenêtre de contexte.")
    device = next(model.parameters()).device
    input_ids = torch.tensor([prompt], dtype=torch.long, device=device)
    with torch.no_grad():
        output = model.generate(
            input_ids,
            max_new_tokens=max(1, min(int(max_new_tokens), model.cfg.block_size)),
            temperature=temperature,
            top_k=30,
        )
    generated = tokenizer.decode(output[0, len(prompt):].tolist())
    end_marker = "Fin de synthèse."
    if end_marker in generated:
        generated = generated.split(end_marker, 1)[0]
    return generated.strip()


def main():
    parser = argparse.ArgumentParser(description="Générer une synthèse avec les poids LoganAI locaux.")
    parser.add_argument("document", help="Texte du document à résumer.")
    parser.add_argument("--checkpoint", type=Path, default=DEFAULT_CHECKPOINT)
    parser.add_argument("--max-new-tokens", type=int, default=220)
    args = parser.parse_args()
    if not args.checkpoint.exists():
        raise SystemExit(
            f"Checkpoint absent : {args.checkpoint}. Lancez d'abord "
            "'python -m loganai.synthesis_training'."
        )
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = LoganLanguageModel(SYNTHESIS_CONFIG).to(device)
    model.load_state_dict(torch.load(args.checkpoint, map_location=device, weights_only=True))
    model.eval()
    print(generate_summary(model, args.document, max_new_tokens=args.max_new_tokens))


if __name__ == "__main__":
    main()
