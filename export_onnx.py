"""Export des modèles LoganAI conversationnel et synthèse vers ONNX."""
from pathlib import Path
import torch
from torch import nn
from loganai.config import ModelConfig
from loganai.model import LoganLanguageModel
from loganai.synthesis_training import SYNTHESIS_CONFIG

class ExportWrapper(nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, input_ids):
        logits, _ = self.model(input_ids)
        return logits


def export_model(checkpoint: Path, output: Path, config: ModelConfig, sequence_length: int):
    if not checkpoint.exists():
        raise SystemExit(f"Checkpoint absent : {checkpoint}")
    model = LoganLanguageModel(config)
    model.load_state_dict(torch.load(checkpoint, map_location="cpu", weights_only=True))
    model.eval()
    wrapper = ExportWrapper(model).eval()
    sample = torch.zeros((1, sequence_length), dtype=torch.long)
    output.parent.mkdir(parents=True, exist_ok=True)
    torch.onnx.export(
        wrapper, sample, str(output),
        input_names=["input_ids"], output_names=["logits"],
        dynamic_axes={"input_ids": {0: "batch", 1: "sequence"},
                      "logits": {0: "batch", 1: "sequence"}},
        opset_version=17, do_constant_folding=True,
    )
    print(f"Modèle ONNX exporté : {output} ({output.stat().st_size:,} octets)")


def main():
    export_model(Path("checkpoints/loganai.pt"), Path("docs/model.onnx"), ModelConfig(), 64)
    synthesis_checkpoint = Path("checkpoints/loganai_synthesis.pt")
    if synthesis_checkpoint.exists():
        export_model(synthesis_checkpoint, Path("docs/synthesis-model.onnx"), SYNTHESIS_CONFIG, 32)
    else:
        print("Checkpoint de synthèse absent : seul le modèle conversationnel sera exporté.")


if __name__ == "__main__":
    main()
