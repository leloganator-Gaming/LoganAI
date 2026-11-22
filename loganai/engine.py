import torch
from pathlib import Path
from .model import LoganLanguageModel
from .tokenizer import LoganTokenizer
from .config import CONFIG

CHECKPOINT = Path("checkpoints/loganai.pt")

class LoganEngine:
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tokenizer = LoganTokenizer()
        self.model = LoganLanguageModel().to(self.device)
        self.trained = False
        if CHECKPOINT.exists():
            try:
                state = torch.load(CHECKPOINT, map_location=self.device, weights_only=True)
                self.model.load_state_dict(state)
                self.trained = True
            except (RuntimeError, OSError, ValueError):
                # Un checkpoint incompatible ne doit pas empêcher le serveur de démarrer.
                self.trained = False

    def reply(self, prompt: str) -> str:
        if not self.trained:
            return ("Je suis installé, mais mes poids ne sont pas encore entraînés. "
                    "Lancez « python -m loganai.training --steps 1000 » puis redémarrez le serveur. "
                    "Le petit corpus de démonstration ne suffira pas à créer un assistant généraliste.")
        prefix = "Utilisateur : " + prompt.strip() + "\nLoganAI :"
        ids = self.tokenizer.encode(prefix)[-CONFIG.block_size:]
        x = torch.tensor([ids], dtype=torch.long, device=self.device)
        output = self.model.generate(x, max_new_tokens=160)
        answer = self.tokenizer.decode(output[0].tolist()[len(ids):]).strip()
        return answer or "Je n'ai pas réussi à formuler une réponse. Pouvez-vous reformuler ?"
