import json
from pathlib import Path

import pytest
import torch

from loganai.synthesis_training import (
    PREFIX,
    SEPARATOR,
    encode_examples,
    get_batch,
    load_examples,
    prepare_example,
)
from loganai.tokenizer import LoganTokenizer


def sample():
    return {
        "document": (
            "Les panneaux solaires convertissent une partie de la lumière reçue "
            "en électricité grâce à des cellules photovoltaïques. Leur production "
            "varie selon l'ensoleillement, l'orientation et la saison."
        ),
        "summary": (
            "Les panneaux photovoltaïques transforment la lumière en électricité. "
            "Leur rendement dépend notamment de l'ensoleillement et de l'orientation."
        ),
    }


def test_jsonl_dataset_loads_and_validates(tmp_path):
    path = tmp_path / "examples.jsonl"
    path.write_text(json.dumps(sample(), ensure_ascii=False) + "\n", encoding="utf-8")
    assert load_examples(path) == [sample()]


def test_jsonl_rejects_malformed_and_short_examples(tmp_path):
    path = tmp_path / "bad.jsonl"
    path.write_text("{invalid json}\n", encoding="utf-8")
    with pytest.raises(ValueError, match="JSON invalide"):
        load_examples(path)
    path.write_text(json.dumps({"document": "trop court", "summary": "trop court"}), encoding="utf-8")
    with pytest.raises(ValueError, match="trop court"):
        load_examples(path)


def test_training_masks_document_and_learns_only_summary_tokens():
    inputs, labels = prepare_example(sample())
    tokenizer = LoganTokenizer()
    prefix_length = len(tokenizer.encode(PREFIX + sample()["document"] + SEPARATOR))
    assert inputs.dtype == torch.long
    assert labels.dtype == torch.long
    assert torch.all(labels[:prefix_length - 1] == -100)
    assert torch.any(labels[prefix_length - 1:] != -100)
    assert inputs.numel() == labels.numel()


def test_synthesis_corpus_encodes_as_independent_examples():
    encoded = encode_examples([sample(), sample()])
    assert len(encoded) == 2
    for inputs, labels in encoded:
        assert inputs.numel() > 100
        assert int(inputs.min()) >= 0 and int(inputs.max()) < 256
        assert torch.any(labels != -100)


def test_synthesis_batches_pad_without_training_on_padding():
    examples = encode_examples([sample(), sample()])
    x, y = get_batch(examples, batch_size=3, device="cpu")
    assert x.shape == y.shape
    assert x.shape[0] == 3
    assert torch.any(y != -100)
    assert torch.all(y >= -100)

def test_long_documents_are_trimmed_to_the_model_context():
    long_example = {
        "document": ("Un document français décrit un phénomène avec plusieurs détails. " * 40),
        "summary": sample()["summary"],
    }
    inputs, labels = prepare_example(long_example)
    from loganai.synthesis_training import SYNTHESIS_CONFIG
    assert inputs.numel() <= SYNTHESIS_CONFIG.block_size
    assert labels.numel() == inputs.numel()
    assert torch.any(labels != -100)


def test_checked_in_training_and_validation_corpora_fit_context():
    train = load_examples(Path("data/synthesis_train.jsonl"))
    validation = load_examples(Path("data/synthesis_validation.jsonl"))
    for inputs, labels in encode_examples(train + validation):
        from loganai.synthesis_training import SYNTHESIS_CONFIG
        assert inputs.numel() <= SYNTHESIS_CONFIG.block_size
        assert torch.any(labels != -100)


def test_training_and_validation_sets_are_disjoint_and_nonduplicated():
    train = load_examples(Path("data/synthesis_train.jsonl"))
    validation = load_examples(Path("data/synthesis_validation.jsonl"))
    normalize = lambda text: " ".join(text.lower().split())
    train_docs = [normalize(item["document"]) for item in train]
    validation_docs = [normalize(item["document"]) for item in validation]
    assert len(train_docs) == len(set(train_docs))
    assert len(validation_docs) == len(set(validation_docs))
    assert set(train_docs).isdisjoint(validation_docs)


def test_summaries_are_not_full_document_copies():
    examples = load_examples(Path("data/synthesis_train.jsonl")) + load_examples(Path("data/synthesis_validation.jsonl"))
    for item in examples:
        assert len(item["summary"]) < len(item["document"])
        assert item["summary"].strip() != item["document"].strip()
