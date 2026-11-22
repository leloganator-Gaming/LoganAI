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
            return (
                "Je suis installé, mais mes poids ne sont pas encore entraînés. "
                "Depuis le dossier du projet, lancez « python -m loganai.training --steps 200 », "
                "puis recommencez avec « python -m loganai.training --steps 2000 --resume ». "
                "Le corpus initial est data/train_corpus.txt. "
                "Ce premier apprentissage valide le pipeline ; il ne suffit pas à créer un assistant généraliste."
            )
        prefix = "Utilisateur : " + prompt.strip() + "\nLoganAI :"
        ids = self.tokenizer.encode(prefix)[-CONFIG.block_size:]
        x = torch.tensor([ids], dtype=torch.long, device=self.device)
        output = self.model.generate(x, max_new_tokens=160)
        answer = self.tokenizer.decode(output[0].tolist()[len(ids):]).strip()
        # Évite d'afficher une éventuelle continuation sur le tour suivant.
        answer = answer.split("\nUtilisateur :", 1)[0].strip()
        return answer or "Je n'ai pas réussi à formuler une réponse. Pouvez-vous reformuler ?"
