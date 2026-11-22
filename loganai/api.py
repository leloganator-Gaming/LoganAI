import base64
import hmac
import io
import os
from pathlib import Path

import torch
from PIL import Image
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .engine import LoganEngine
from .memory import MemoryStore
from .vision import LoganDenoiser

app = FastAPI(title="LoganAI", version="0.1.0")
engine = LoganEngine()
memory = MemoryStore()
WEB = Path(__file__).resolve().parent.parent / "web"
VISION_CHECKPOINT = Path("checkpoints/loganai_vision.pt")


@app.middleware("http")
async def require_deployment_password(request: Request, call_next):
    # Public hosting is password-protected by default. Set this secret in the
    # hosting provider's environment settings; never commit it to Git.
    if request.url.path == "/healthz":
        return await call_next(request)

    expected_password = os.environ.get("LOGANAI_ACCESS_PASSWORD", "")
    if not expected_password:
        return JSONResponse(
            status_code=503,
            content={"detail": "Déploiement non configuré : définissez LOGANAI_ACCESS_PASSWORD."},
        )

    authorization = request.headers.get("authorization", "")
    try:
        scheme, encoded = authorization.split(" ", 1)
        if scheme.lower() != "basic":
            raise ValueError("Invalid auth scheme")
        decoded = base64.b64decode(encoded, validate=True).decode("utf-8")
        username, password = decoded.split(":", 1)
    except (ValueError, UnicodeDecodeError):
        username, password = "", ""

    valid_user = hmac.compare_digest(username, "loganai")
    valid_password = hmac.compare_digest(password, expected_password)
    if not (valid_user and valid_password):
        return JSONResponse(
            status_code=401,
            headers={"WWW-Authenticate": 'Basic realm="LoganAI", charset="UTF-8"'},
            content={"detail": "Authentification requise."},
        )
    return await call_next(request)


app.mount("/static", StaticFiles(directory=WEB), name="static")


class ChatInput(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class MemoryInput(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.get("/", response_class=HTMLResponse)
def home():
    return (WEB / "index.html").read_text(encoding="utf-8")


@app.get("/api/status")
def status():
    return {
        "name": "LoganAI", "version": "0.1.0",
        "trained_checkpoint": engine.trained,
        "vision_checkpoint": VISION_CHECKPOINT.exists(),
        "device": engine.device, "memory_count": len(memory.list()),
        "warning": "Prototype expérimental ; qualité limitée."
    }


@app.get("/api/history")
def get_history():
    return {"messages": memory.history()}


@app.delete("/api/history")
def clear_history():
    memory.clear_history()
    return {"ok": True}


@app.post("/api/chat")
def chat(payload: ChatInput):
    try:
        prompt = payload.message.strip()
        saved = memory.list()
        context = "\n".join(item["content"] for item in reversed(saved))
        full_prompt = (f"Souvenirs explicitement enregistrés :\n{context}\n\n" if context else "") + prompt
        answer = engine.reply(full_prompt)
        memory.add_message("user", prompt)
        memory.add_message("assistant", answer)
        return {"answer": answer, "trained_checkpoint": engine.trained}
    except Exception as exc:
        raise HTTPException(500, detail=f"Erreur du moteur : {type(exc).__name__}")


@app.get("/api/vision/status")
def vision_status():
    return {"trained": VISION_CHECKPOINT.exists(), "mode": "unconditional" if VISION_CHECKPOINT.exists() else "not_trained"}


@app.post("/api/vision/generate")
def vision_generate():
    if not VISION_CHECKPOINT.exists():
        raise HTTPException(409, "Vision n'est pas entraîné. Ajoutez des images autorisées dans data/images/ puis lancez python -m loganai.vision_training.")
    device = engine.device
    model = LoganDenoiser().to(device)
    try:
        model.load_state_dict(torch.load(VISION_CHECKPOINT, map_location=device, weights_only=True))
    except Exception:
        raise HTTPException(500, "Checkpoint Vision incompatible.")
    model.eval()
    steps = 100
    beta = torch.linspace(1e-4, .02, steps, device=device)
    alpha = 1 - beta
    alpha_bar = torch.cumprod(alpha, dim=0)
    with torch.no_grad():
        image = torch.randn(1, 3, 64, 64, device=device)
        for i in reversed(range(steps)):
            t = torch.tensor([i], device=device)
            predicted_noise = model(image, t)
            mean = (image - beta[i] / torch.sqrt(1 - alpha_bar[i]) * predicted_noise) / torch.sqrt(alpha[i])
            if i:
                image = mean + torch.sqrt(beta[i]) * torch.randn_like(image)
            else:
                image = mean
    pixels = ((image[0].clamp(-1, 1) + 1) * 127.5).byte().permute(1, 2, 0).cpu().numpy()
    buffer = io.BytesIO()
    Image.fromarray(pixels).save(buffer, format="PNG")
    return {"image": "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii"), "mode": "unconditional", "note": "Image expérimentale sans conditionnement texte."}


@app.get("/api/memories")
def get_memories():
    return {"memories": memory.list()}


@app.post("/api/memories")
def add_memory(payload: MemoryInput):
    try:
        return {"id": memory.add(payload.content)}
    except ValueError as exc:
        raise HTTPException(400, str(exc))


@app.delete("/api/memories/{memory_id}")
def delete_memory(memory_id: int):
    if not memory.delete(memory_id):
        raise HTTPException(404, "Souvenir introuvable")
    return {"ok": True}
