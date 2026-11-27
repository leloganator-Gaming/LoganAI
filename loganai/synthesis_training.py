"""Entraînement supervisé du modèle de synthèse LoganAI, initialisé de zéro.

Données JSONL : chaque ligne contient {"document": "...", "summary": "..."}.
La perte est calculée uniquement sur la synthèse cible, jamais sur le document source.
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
    block_size=768,
    n_embd=64,
    n_head=4,
    n_layer=2,
    dropout=0.1,
)
DEFAULT_TRAIN = Path("data/synthesis_train.jsonl")
DEFAULT_VALIDATION = Path("data/synthesis_validation.jsonl")
DEFAULT_CHECKPOINT = Path("checkpoints/loganai_synthesis.pt")
PREFIX = "Tâche : résume fidèlement le document sans ajouter d'information.\nDocument :\n"
SEPARATOR = "\nSynthèse :\n"
SUFFIX = "\nFin de synthèse.\n"


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
        document, summary = item.get("document"), item.get("summary")
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


def prepare_example(example: dict[str, str], tokenizer=None):
    tokenizer = tokenizer or LoganTokenizer()
    target = example["summary"].strip() + SUFFIX
    target_ids = tokenizer.encode(target)
    fixed_prefix_ids = tokenizer.encode(PREFIX + SEPARATOR)
    document_ids = tokenizer.encode(example["document"].strip())
    available_document_bytes = (
        SYNTHESIS_CONFIG.block_size + 1
        - len(fixed_prefix_ids)
        - len(target_ids)
    )
    if available_document_bytes < 80:
        raise ValueError("La synthèse cible est trop longue pour le contexte du modèle.")
    if len(document_ids) > available_document_bytes:
        # Coupe à une frontière de mot, sans casser un caractère UTF-8.
        raw_document = bytes(document_ids[:available_document_bytes])
        shortened = raw_document.decode("utf-8", errors="ignore")
        shortened = shortened.rsplit(" ", 1)[0] if " " in shortened else shortened
        document_ids = tokenizer.encode(shortened)
    prefix_ids = fixed_prefix_ids[:-len(tokenizer.encode(SEPARATOR))] + document_ids + tokenizer.encode(SEPARATOR)
    all_ids = prefix_ids + target_ids
    if len(all_ids) < 2 or len(all_ids) > SYNTHESIS_CONFIG.block_size + 1:
        raise ValueError("Impossible de préparer cet exemple dans la fenêtre de contexte.")
    inputs = torch.tensor(all_ids[:-1], dtype=torch.long)
    labels = torch.tensor(all_ids[1:], dtype=torch.long)
    # Le modèle reçoit le document en contexte, mais n'est récompensé que
    # lorsqu'il prédit les octets de la synthèse et son marqueur de fin.
    labels[:len(prefix_ids) - 1] = -100
    return inputs, labels


def encode_examples(examples: list[dict[str, str]]):
    tokenizer = LoganTokenizer()
    return [prepare_example(item, tokenizer) for item in examples]


def get_batch(examples, batch_size: int, device: str):
    if not examples:
        raise ValueError("Aucun exemple pour former un lot.")
    selected = torch.randint(0, len(examples), (batch_size,)).tolist()
    batch = [examples[index] for index in selected]
    max_length = max(len(x) for x, _ in batch)
    x = torch.zeros((batch_size, max_length), dtype=torch.long)
    y = torch.full((batch_size, max_length), -100, dtype=torch.long)
    for row, (inputs, labels) in enumerate(batch):
        x[row, :len(inputs)] = inputs
        y[row, :len(labels)] = labels
    return x.to(device), y.to(device)


@torch.no_grad()
def evaluate(model, train_data, validation_data, batch_size, device, batches=4):
    model.eval()
    scores = {}
    for label, examples in (("train", train_data), ("validation", validation_data)):
        losses = []
        for _ in range(batches):
            x, y = get_batch(examples, batch_size, device)
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

    train_examples = encode_examples(load_examples(args.train))
    validation_examples = encode_examples(load_examples(args.validation))
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
    print("Objectif : prédire la synthèse cible uniquement, à partir du document fourni.")
    model.train()
    for step in range(start_step + 1, start_step + args.steps + 1):
        x, y = get_batch(train_examples, args.batch_size, device)
        _, loss = model(x, y)
        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        if step == 1 or step % args.eval_interval == 0:
            scores = evaluate(model, train_examples, validation_examples, args.batch_size, device)
            print(f"Étape {step} | perte train {scores['train']:.4f} | validation {scores['validation']:.4f}")

    args.checkpoint.parent.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), args.checkpoint)
    torch.save({"optimizer": optimizer.state_dict(), "step": start_step + args.steps}, state_path)
    print(f"Poids du modèle de synthèse sauvegardés : {args.checkpoint}")
    print("La perte ne suffit pas à valider la fidélité : des tests de synthèses réelles restent nécessaires.")


if __name__ == "__main__":
    main()
