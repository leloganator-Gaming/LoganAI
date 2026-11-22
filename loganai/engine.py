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
                state = torch.load(CHECKPOINT,map_location=self.device,weights_only=True)
                self.model.load_state_dict(state)
                self.trained = True
            except Exception:
                pass

    def reply(self, prompt: str) -> str:
        prefix = "Utilisateur : " + prompt.strip() + "\nLoganAI :"
        ids = self.tokenizer.encode(prefix)
        x = torch.tensor([ids],dtype=torch.long,device=self.device)
        output = self.model.generate(x,max_new_tokens=180)
        answer = self.tokenizer.decode(output[0].tolist()[len(ids):]).strip()
        return answer or "Je n'ai pas encore appris à répondre correctement. Le modèle doit être entraîné sur un corpus plus riche."
