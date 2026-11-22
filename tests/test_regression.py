"""Tests de régression du noyau LoganAI.

Ces tests vérifient les contrats essentiels sans lancer un entraînement long
ni dépendre d'un checkpoint pré-entraîné.
"""
import torch
import pytest

from loganai.config import ModelConfig
from loganai.model import LoganLanguageModel
from loganai.tokenizer import LoganTokenizer
from loganai.training import get_batch
from loganai.memory import MemoryStore


def tiny_config():
    return ModelConfig(
        vocab_size=256,
        block_size=16,
        n_embd=16,
        n_head=4,
        n_layer=1,
        dropout=0.0,
    )


def test_tokenizer_round_trip_french_and_emoji():
    tokenizer = LoganTokenizer()
    original = "Bonjour, LoganAI ! éàç — 🤖"
    assert tokenizer.decode(tokenizer.encode(original)) == original


def test_tokenizer_is_byte_level_and_handles_invalid_utf8():
    tokenizer = LoganTokenizer()
    assert tokenizer.encode("A") == [65]
    assert tokenizer.decode([65, 0xFF]) == "A�"


def test_tokenizer_clamps_out_of_range_tokens_on_decode():
    assert LoganTokenizer().decode([-10, 256, 65]) == "��A"


def test_model_returns_expected_logits_and_loss():
    model = LoganLanguageModel(tiny_config())
    tokens = torch.randint(0, 256, (2, 8), dtype=torch.long)
    logits, loss = model(tokens, tokens)
    assert logits.shape == (2, 8, 256)
    assert loss is not None
    assert torch.isfinite(loss)


def test_model_truncates_context_to_block_size():
    model = LoganLanguageModel(tiny_config())
    tokens = torch.randint(0, 256, (1, 24), dtype=torch.long)
    logits, _ = model(tokens)
    assert logits.shape == (1, 16, 256)


def test_causal_attention_does_not_leak_future_tokens():
    torch.manual_seed(7)
    model = LoganLanguageModel(tiny_config()).eval()
    first = torch.tensor([[1, 2, 3, 4]], dtype=torch.long)
    changed_future = torch.tensor([[1, 2, 99, 100]], dtype=torch.long)
    with torch.no_grad():
        logits_a, _ = model(first)
        logits_b, _ = model(changed_future)
    assert torch.allclose(logits_a[:, :2], logits_b[:, :2], atol=1e-6)


def test_training_batch_has_shifted_targets():
    source = torch.arange(100, dtype=torch.long)
    x, y = get_batch(source, batch_size=3, block_size=8, device="cpu")
    assert x.shape == (3, 8)
    assert y.shape == (3, 8)
    assert torch.equal(y[:, :-1], x[:, 1:])
    assert torch.all(y[:, -1] == x[:, -1] + 1)


def test_training_batch_rejects_too_short_corpus():
    with pytest.raises(ValueError, match="Corpus trop court"):
        get_batch(torch.arange(9), batch_size=1, block_size=8, device="cpu")


def test_memory_add_list_delete_and_isolation(tmp_path):
    store = MemoryStore(tmp_path / "memory.sqlite3")
    memory_id = store.add("  Préférence de test  ")
    items = store.list()
    assert len(items) == 1
    assert items[0]["id"] == memory_id
    assert items[0]["content"] == "Préférence de test"
    assert store.delete(memory_id) is True
    assert store.delete(memory_id) is False
    assert store.list() == []


@pytest.mark.parametrize("content", ["", "   ", "x" * 2001])
def test_memory_rejects_empty_or_oversized_content(tmp_path, content):
    store = MemoryStore(tmp_path / "memory.sqlite3")
    with pytest.raises(ValueError):
        store.add(content)


def test_memory_history_limit_order_and_clear(tmp_path):
    store = MemoryStore(tmp_path / "memory.sqlite3")
    for index in range(5):
        store.add_message("user", f"message-{index}")
    assert [m["content"] for m in store.history(limit=2)] == [
        "message-3", "message-4"
    ]
    store.clear_history()
    assert store.history() == []


def test_chat_and_memory_api_contracts(monkeypatch, tmp_path):
    # Import tardif pour ne pas charger l'application serveur dans les autres tests.
    from loganai import api

    class FakeEngine:
        trained = False
        device = "cpu"

        def reply(self, prompt):
            assert "Question de test" in prompt
            return "Réponse de test"

    isolated_memory = MemoryStore(tmp_path / "api.sqlite3")
    monkeypatch.setattr(api, "engine", FakeEngine())
    monkeypatch.setattr(api, "memory", isolated_memory)

    response = api.chat(api.ChatInput(message="Question de test"))
    assert response == {
        "answer": "Réponse de test",
        "trained_checkpoint": False,
    }
    assert [m["role"] for m in isolated_memory.history()] == [
        "user", "assistant"
    ]

    created = api.add_memory(api.MemoryInput(content="Souvenir API"))
    assert isolated_memory.list()[0]["id"] == created["id"]
    assert api.delete_memory(created["id"]) == {"ok": True}
    with pytest.raises(api.HTTPException) as error:
        api.delete_memory(created["id"])
    assert error.value.status_code == 404
