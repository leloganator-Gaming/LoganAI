from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from pathlib import Path
from .engine import LoganEngine
from .memory import MemoryStore

app=FastAPI(title="LoganAI",version="0.1.0")
engine=LoganEngine()
memory=MemoryStore()
WEB=Path(__file__).resolve().parent.parent/"web"
app.mount("/static",StaticFiles(directory=WEB),name="static")

class ChatInput(BaseModel):
    message: str = Field(min_length=1,max_length=4000)
class MemoryInput(BaseModel):
    content: str = Field(min_length=1,max_length=2000)

@app.get("/",response_class=HTMLResponse)
def home(): return (WEB/"index.html").read_text(encoding="utf-8")

@app.get("/api/status")
def status():
    return {"name":"LoganAI","version":"0.1.0","trained_checkpoint":engine.trained,"device":engine.device,"memory_count":len(memory.list()),"warning":"Modèle expérimental ; qualité très limitée."}

@app.get("/api/history")
def get_history(): return {"messages":memory.history()}

@app.delete("/api/history")
def clear_history(): memory.clear_history(); return {"ok":True}

@app.post("/api/chat")
def chat(payload:ChatInput):
    try:
        prompt=payload.message.strip()
        memory.add_message("user",prompt)
        answer=engine.reply(prompt)
        memory.add_message("assistant",answer)
        return {"answer":answer,"trained_checkpoint":engine.trained}
    except Exception as exc:
        raise HTTPException(500,detail=f"Erreur du moteur : {type(exc).__name__}")

@app.get("/api/memories")
def get_memories(): return {"memories":memory.list()}

@app.post("/api/memories")
def add_memory(payload:MemoryInput):
    try: return {"id":memory.add(payload.content)}
    except ValueError as exc: raise HTTPException(400,str(exc))

@app.delete("/api/memories/{memory_id}")
def delete_memory(memory_id:int):
    if not memory.delete(memory_id): raise HTTPException(404,"Souvenir introuvable")
    return {"ok":True}
