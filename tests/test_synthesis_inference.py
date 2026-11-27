import torch
from types import SimpleNamespace

from loganai.synthesis_inference import generate_summary
from loganai.synthesis_training import SYNTHESIS_CONFIG
from loganai.tokenizer import LoganTokenizer


class FakeModel:
    cfg = SYNTHESIS_CONFIG

    def parameters(self):
        yield torch.nn.Parameter(torch.zeros(1))

    def generate(self, input_ids, max_new_tokens, temperature, top_k):
        extra = torch.tensor(
            [LoganTokenizer().encode("Voici une synthèse fidèle.\nFin de synthèse. texte ignoré")],
            dtype=torch.long,
            device=input_ids.device,
        )
        return torch.cat((input_ids, extra), dim=1)


def test_inference_uses_model_and_stops_at_end_marker():
    result = generate_summary(FakeModel(), "Un document assez long à résumer.")
    assert result == "Voici une synthèse fidèle."


def test_inference_rejects_empty_documents():
    import pytest
    with pytest.raises(ValueError, match="vide"):
        generate_summary(FakeModel(), "   ")


def test_inference_trims_long_document_to_context():
    model = FakeModel()
    result = generate_summary(model, "Un document français important. " * 100)
    assert result == "Voici une synthèse fidèle."
