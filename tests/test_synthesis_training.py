import json

import pytest
import torch

from loganai.synthesis_training import (
    encode_examples,
    format_example,
    get_batch,
    load_examples,
)


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


def test_format_keeps_document_and_target_separated():
    text = format_example(sample())
    assert "Document :" in text
    assert "Synthèse :" in text
    assert "cellules photovoltaïques" in text


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


def test_synthesis_corpus_encodes_as_independent_byte_stream():
    encoded = encode_examples([sample()])
    assert encoded.dtype == torch.long
    assert encoded.numel() > 100
    assert int(encoded.min()) >= 0 and int(encoded.max()) < 256


def test_synthesis_batches_have_next_byte_targets():
    source = torch.arange(1200, dtype=torch.long) % 256
    x, y = get_batch(source, batch_size=2, block_size=32, device="cpu")
    assert x.shape == (2, 32)
    assert torch.equal(y[:, :-1], x[:, 1:])
