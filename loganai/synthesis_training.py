"""Entraînement indépendant du modèle de synthèse LoganAI.

Données JSONL : chaque ligne contient {"document": "...", "summary": "..."}.
Les poids et l'état d'optimisation sont séparés du modèle conversationnel.
Aucun checkpoint préentraîné ni service externe n'est utilisé.
"""
import argparse
import json
from pathlib import Path

import torch

from .config import ModelConfig
from .model import LoganLanguageModel
from .tokenizer import LoganTokenizer

SYNTHESIS_CONFIG = ModelConfig(
    vocab_size=256,
    block_size=512,
    n_embd=128,
    n_head=4,
    n_layer=4,
    dropout=0.1,
)
DEFAULT_TRAIN = Path("data/synthesis_train.jsonl")
DEFAULT_VALIDATION = Path("data/synthesis_validation.jsonl")
DEFAULT_CHECKPOINT = Path("checkpoints/loganai_synthesis.pt")
DEFAULT_STATE = Path("checkpoints/loganai_synthesis_state.pt")


def load_examples(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        raise FileNotFoundError(f"Fichier de données introuvable : {path}")
    examples = []
    for line_number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not raw.strip():
            continue
        try:
            item = json.loads(raw)
        except json.JSONDecodeError as error:
            raise ValueError(f"JSON invalide ligne {line_number} dans {path}: {error}") from error
        document = item.get("document")
        summary = item.get("summary")
        if not isinstance(document, str) or not isinstance(summary, str):
            raise ValueError(f"Champs document/summary manquants ligne {line_number}")
        document, summary = document.strip(), summary.strip()
        if len(document) < 80 or len(summary) < 25:
            raise ValueError(f"Exemple trop court ligne {line_number}")
        if len(document) > 6000 or len(summary) > 1200:
            raise ValueError(f"Exemple trop long ligne {line_number}")
        examples.append({"document": document, "summary": summary})
    if not examples:
        raise ValueError(f"Aucun exemple exploitable dans {path}")
    return examples


def format_example(example: dict[str, str]) -> str:
    return (
        "Tâche : produire une synthèse fidèle du document.\n"
        "Document :\n" + example["document"] +
        "\nSynthèse :\n" + example["summary"] + "\nFin de synthèse.\n\n"
    )


def encode_examples(examples: list[dict[str, str]]) -> torch.Tensor:
    tokenizer = LoganTokenizer()
    text = "".join(format_example(item) for item in examples)
    return torch.tensor(tokenizer.encode(text), dtype=torch.long)


def get_batch(source: torch.Tensor, batch_size: int, block_size: int, device: str):
    if len(source) <= block_size + 1:
        raise ValueError(
            f"Corpus de synthèse trop court ({len(source)} octets) "
            f"pour un contexte de {block_size}."
        )
    starts = torch.randint(0, len(source) - block_size - 1, (batch_size,))
    x = torch.stack([source[i:i + block_size] for i in starts]).to(device)
    y = torch.stack([source[i + 1:i + block_size + 1] for i in starts]).to(device)
    return x, y


@torch.no_grad()
def evaluate(model, train_data, validation_data, batch_size, device, batches=4):
    model.eval()
    scores = {}
    for label, source in (("train", train_data), ("validation", validation_data)):
        losses = []
        for _ in range(batches):
            x, y = get_batch(source, batch_size, SYNTHESIS_CONFIG.block_size, device)
            _, loss = model(x, y)
            losses.append(float(loss.item()))
        scores[label] = sum(losses) / len(losses)
    model.train()
    return scores


def main():
    parser = argparse.ArgumentParser(description="Entraîner le modèle de synthèse maison LoganAI.")
    parser.add_argument("--steps", type=int, default=1000)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--lr", type=float, default=3e-4)
    parser.add_argument("--eval-interval", type=int, default=50)
    parser.add_argument("--train", type=Path, default=DEFAULT_TRAIN)
    parser.add_argument("--validation", type=Path, default=DEFAULT_VALIDATION)
    parser.add_argument("--checkpoint", type=Path, default=DEFAULT_CHECKPOINT)
    parser.add_argument("--resume", action="store_true")
    args = parser.parse_args()
    if args.steps < 1 or args.batch_size < 1:
        raise SystemExit("--steps et --batch-size doivent être positifs.")

    train_examples = load_examples(args.train)
    validation_examples = load_examples(args.validation)
    train_data = encode_examples(train_examples)
    validation_data = encode_examples(validation_examples)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    torch.manual_seed(73)
    model = LoganLanguageModel(SYNTHESIS_CONFIG).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr)
    state_path = args.checkpoint.with_name(args.checkpoint.stem + "_state.pt")
    start_step = 0

    if args.resume and args.checkpoint.exists():
        model.load_state_dict(torch.load(args.checkpoint, map_location=device, weights_only=True))
        if state_path.exists():
            state = torch.load(state_path, map_location=device, weights_only=True)
            optimizer.load_state_dict(state["optimizer"])
            start_step = int(state.get("step", 0))

    print(f"Modèle de synthèse initialisé de zéro | appareil : {device}")
    print(f"Exemples : {len(train_examples)} entraînement / {len(validation_examples)} validation")
    print(f"Paramètres entraînables : {sum(p.numel() for p in model.parameters()):,}")
    model.train()
    for step in range(start_step + 1, start_step + args.steps + 1):
        x, y = get_batch(train_data, args.batch_size, SYNTHESIS_CONFIG.block_size, device)
        _, loss = model(x, y)
        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        if step == 1 or step % args.eval_interval == 0:
            scores = evaluate(model, train_data, validation_data, args.batch_size, device)
            print(f"Étape {step} | perte train {scores['train']:.4f} | validation {scores['validation']:.4f}")

    args.checkpoint.parent.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), args.checkpoint)
    torch.save({"optimizer": optimizer.state_dict(), "step": start_step + args.steps}, state_path)
    print(f"Poids du modèle de synthèse sauvegardés : {args.checkpoint}")
    print("La perte ne suffit pas à valider la fidélité des synthèses : des évaluations dédiées restent nécessaires.")


if __name__ == "__main__":
    main()
