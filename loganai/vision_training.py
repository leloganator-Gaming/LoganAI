"""Entraîne LoganAI Vision sur des images locales dans data/images/."""
import argparse
from pathlib import Path
import torch
from torch.nn import functional as F
from torch.utils.data import Dataset, DataLoader
from PIL import Image
from torchvision import transforms
from .vision import LoganDenoiser

class ImageFolder(Dataset):
    def __init__(self, root):
        self.files = [p for p in Path(root).rglob("*") if p.suffix.lower() in {".png",".jpg",".jpeg",".webp"}]
        self.transform = transforms.Compose([transforms.Resize((64,64)), transforms.ToTensor(), transforms.Normalize((.5,.5,.5),(.5,.5,.5))])
    def __len__(self): return len(self.files)
    def __getitem__(self, i):
        with Image.open(self.files[i]) as im: return self.transform(im.convert("RGB"))

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--data",default="data/images")
    p.add_argument("--steps",type=int,default=2000)
    p.add_argument("--batch-size",type=int,default=16)
    a=p.parse_args()
    ds=ImageFolder(a.data)
    if not len(ds): raise SystemExit("Ajoutez des images autorisées dans data/images/ avant l'entraînement.")
    loader=DataLoader(ds,batch_size=a.batch_size,shuffle=True,drop_last=True)
    device="cuda" if torch.cuda.is_available() else "cpu"
    model=LoganDenoiser().to(device); opt=torch.optim.AdamW(model.parameters(),lr=2e-4)
    steps=100; beta=torch.linspace(1e-4,.02,steps,device=device); alpha=1-beta; abar=torch.cumprod(alpha,0)
    step=0; model.train()
    while step<a.steps:
        for clean in loader:
            clean=clean.to(device); b=clean.size(0)
            t=torch.randint(0,steps,(b,),device=device); noise=torch.randn_like(clean)
            noisy=abar[t].view(b,1,1,1).sqrt()*clean+(1-abar[t]).view(b,1,1,1).sqrt()*noise
            loss=F.mse_loss(model(noisy,t),noise)
            opt.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(),1.0); opt.step()
            step+=1
            if step%100==0: print(f"Étape {step}/{a.steps} perte={loss.item():.4f}")
            if step>=a.steps: break
    out=Path("checkpoints"); out.mkdir(exist_ok=True); torch.save(model.state_dict(),out/"loganai_vision.pt")
    print("Poids Vision sauvegardés. La génération reste non conditionnelle (pas de prompt texte).")

if __name__=="__main__": main()
