"""Entraînement causal depuis une initialisation aléatoire."""
import argparse
from pathlib import Path
import torch
from .model import LoganLanguageModel
from .tokenizer import LoganTokenizer
from .config import CONFIG

CORPUS = Path("data/demo_corpus.txt")
OUT = Path("checkpoints/loganai.pt")

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--steps",type=int,default=1000)
    parser.add_argument("--batch-size",type=int,default=16)
    parser.add_argument("--lr",type=float,default=3e-4)
    args=parser.parse_args()
    if args.steps < 1: raise SystemExit("--steps doit être positif")
    if not CORPUS.exists(): raise SystemExit("Corpus introuvable : data/demo_corpus.txt")
    torch.manual_seed(42)
    tokenizer=LoganTokenizer()
    data=torch.tensor(tokenizer.encode(CORPUS.read_text(encoding="utf-8")),dtype=torch.long)
    if len(data) < CONFIG.block_size + 2: data=data.repeat((CONFIG.block_size+2)//len(data)+1)
    device="cuda" if torch.cuda.is_available() else "cpu"
    model=LoganLanguageModel().to(device)
    optimizer=torch.optim.AdamW(model.parameters(),lr=args.lr)
    model.train()
    for step in range(args.steps):
        starts=torch.randint(0,len(data)-CONFIG.block_size-1,(args.batch_size,))
        x=torch.stack([data[i:i+CONFIG.block_size] for i in starts]).to(device)
        y=torch.stack([data[i+1:i+CONFIG.block_size+1] for i in starts]).to(device)
        _,loss=model(x,y)
        optimizer.zero_grad(set_to_none=True); loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(),1.0)
        optimizer.step()
        if (step+1)%50==0 or step==0: print(f"Étape {step+1}/{args.steps} — perte {loss.item():.4f}")
    OUT.parent.mkdir(parents=True,exist_ok=True)
    torch.save(model.state_dict(),OUT)
    print(f"Poids enregistrés dans {OUT}. Petit corpus de démonstration : ne pas interpréter comme une IA entraînée.")
if __name__=="__main__": main()
