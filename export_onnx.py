"""Export du modèle LoganAI entraîné vers ONNX pour ONNX Runtime Web."""
from pathlib import Path
import torch
from torch import nn
from loganai.config import CONFIG
from loganai.model import LoganLanguageModel

CHECKPOINT = Path("checkpoints/loganai.pt")
OUTPUT = Path("docs/model.onnx")

class ExportWrapper(nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model
    def forward(self, input_ids):
        logits, _ = self.model(input_ids)
        return logits

def main():
    if not CHECKPOINT.exists():
        raise SystemExit("Checkpoint absent : lancez d'abord l'entraînement.")
    model = LoganLanguageModel()
    state = torch.load(CHECKPOINT, map_location="cpu", weights_only=True)
    model.load_state_dict(state)
    model.eval()
    wrapper = ExportWrapper(model).eval()
    sample = torch.zeros((1, 64), dtype=torch.long)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    torch.onnx.export(
        wrapper, sample, str(OUTPUT),
        input_names=["input_ids"], output_names=["logits"],
        dynamic_axes={"input_ids": {0: "batch", 1: "sequence"},
                      "logits": {0: "batch", 1: "sequence"}},
        opset_version=17, do_constant_folding=True, dynamo=False,
    )
    print(f"Modèle ONNX exporté : {OUTPUT} ({OUTPUT.stat().st_size:,} octets)")

if __name__ == "__main__":
    main()
