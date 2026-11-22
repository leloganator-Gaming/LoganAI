"""Entraînement causal du modèle LoganAI depuis une initialisation aléatoire.

Le corpus est un fichier texte UTF-8 composé de dialogues :
Utilisateur : ...
LoganAI : ...

Exemple :
python -m loganai.training --steps 200
python -m loganai.training --steps 2000 --resume
"""
import argparse
from pathlib import Path

import torch

from .config import CONFIG
from .model import LoganLanguageModel
from .tokenizer import LoganTokenizer

CORPUS = Path("data/train_corpus.txt")
OUT = Path("checkpoints/loganai.pt")
TRAIN_STATE = Path("checkpoints/loganai_training_state.pt")


def get_batch(source: torch.Tensor, batch_size: int, block_size: int, device: str):
    if len(source) <= block_size + 1:
        raise ValueError(
            f"Corpus trop court ({len(source)} octets). "
            f"Il faut plus de {block_size + 1} octets."
        )
    starts = torch.randint(0, len(source) - block_size - 1, (batch_size,))
    x = torch.stack([source[i:i + block_size] for i in starts]).to(device)
    y = torch.stack([source[i + 1:i + block_size + 1] for i in starts]).to(device)
    return x, y


@torch.no_grad()
def estimate_loss(model, train_data, val_data, batch_size, device, batches=5):
    model.eval()
    results = {}
    for name, source in (("train", train_data), ("validation", val_data)):
        losses = []
        for _ in range(batches):
            x, y = get_batch(source, batch_size, CONFIG.block_size, device)
            _, loss = model(x, y)
            losses.append(float(loss.item()))
        results[name] = sum(losses) / len(losses)
    model.train()
    return results


def main():
    parser = argparse.ArgumentParser(description="Entraîner la cervelle de LoganAI.")
    parser.add_argument("--steps", type=int, default=2000)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--lr", type=float, default=3e-4)
    parser.add_argument("--eval-interval", type=int, default=100)
    parser.add_argument("--save-interval", type=int, default=250)
    parser.add_argument("--resume", action="store_true", help="Reprendre le dernier entraînement.")
    parser.add_argument("--corpus", type=Path, default=CORPUS)
    args = parser.parse_args()

    if args.steps < 1 or args.batch_size < 1:
        raise SystemExit("--steps et --batch-size doivent être positifs.")
    if not args.corpus.exists():
        raise SystemExit(f"Corpus introuvable : {args.corpus}")

    text = args.corpus.read_text(encoding="utf-8").strip()
    if not text:
        raise SystemExit("Le corpus est vide.")

    torch.manual_seed(42)
    tokenizer = LoganTokenizer()
    tokens = torch.tensor(tokenizer.encode(text), dtype=torch.long)
    if len(tokens) < CONFIG.block_size * 2 + 2:
        raise SystemExit(
            f"Corpus trop petit : {len(tokens)} octets. "
            f"Ajoutez des dialogues (minimum conseillé : {CONFIG.block_size * 2 + 2})."
        )

    split_at = int(len(tokens) * 0.9)
    train_data = tokens[:split_at]
    val_data = tokens[split_at:]
    if len(val_data) <= CONFIG.block_size + 1:
        val_data = train_data

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Appareil : {device}")
    print(f"Corpus : {len(tokens):,} octets | entraînement : {len(train_data):,} | validation : {len(val_data):,}")
    print(f"Contexte : {CONFIG.block_size} octets | paramètres : {sum(p.numel() for p in LoganLanguageModel().parameters()):,}")

    model = LoganLanguageModel().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr)
    start_step = 0

    if args.resume and OUT.exists():
        model.load_state_dict(torch.load(OUT, map_location=device, weights_only=True))
        if TRAIN_STATE.exists():
            state = torch.load(TRAIN_STATE, map_location=device, weights_only=True)
            optimizer.load_state_dict(state["optimizer"])
            start_step = int(state.get("step", 0))
        print(f"Reprise à l'étape {start_step}.")

    model.train()
    for step in range(start_step + 1, start_step + args.steps + 1):
        x, y = get_batch(train_data, args.batch_size, CONFIG.block_size, device)
        _, loss = model(x, y)
        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()

        if step == 1 or step % args.eval_interval == 0:
            scores = estimate_loss(model, train_data, val_data, args.batch_size, device)
            print(
                f"Étape {step} | perte entraînement {scores['train']:.4f} "
                f"| validation {scores['validation']:.4f}"
            )

        if step % args.save_interval == 0:
            OUT.parent.mkdir(parents=True, exist_ok=True)
            torch.save(model.state_dict(), OUT)
            torch.save({"optimizer": optimizer.state_dict(), "step": step}, TRAIN_STATE)
            print(f"Checkpoint sauvegardé : {OUT}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), OUT)
    torch.save({"optimizer": optimizer.state_dict(), "step": start_step + args.steps}, TRAIN_STATE)
    print(f"Entraînement terminé. Poids sauvegardés dans {OUT}.")
    print("Important : la baisse de perte mesure l'apprentissage du corpus, pas une intelligence générale.")


if __name__ == "__main__":
    main()
