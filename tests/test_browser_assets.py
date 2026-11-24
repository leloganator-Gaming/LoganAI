"""Contrôles statiques des fichiers de l'application GitHub Pages."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"


def test_github_pages_entrypoint_and_assets_exist():
    assert (DOCS / "index.html").is_file()
    assert (DOCS / "app.js").is_file()
    assert (DOCS / "style.css").is_file()


def test_entrypoint_loads_onnx_runtime_and_application_script():
    html = (DOCS / "index.html").read_text(encoding="utf-8")
    assert "onnxruntime-web@1.20.1" in html
    assert 'src="./app.js"' in html
    assert 'id="prompt"' in html
    assert 'id="modelState"' in html


def test_browser_runtime_uses_expected_onnx_contract():
    app = (DOCS / "app.js").read_text(encoding="utf-8")
    assert 'InferenceSession.create("./model.onnx"' in app
    assert 'ort.Tensor("int64"' in app
    assert "input_ids" in app
    assert "result.logits" in app
    assert "executionProviders: [\"wasm\"]" in app


def test_browser_memory_and_chat_history_are_local_and_bounded():
    app = (DOCS / "app.js").read_text(encoding="utf-8")
    assert 'localStorage.getItem(STORE_KEY)' in app
    assert 'localStorage.setItem(STORE_KEY' in app
    assert "data.messages.slice(-80)" in app
    assert "memoryStore.list()" in app
    memory = (DOCS / "core" / "memory-engine.js").read_text(encoding="utf-8")
    assert "data.memories" in memory


def test_mobile_layout_has_responsive_rules():
    css = (DOCS / "style.css").read_text(encoding="utf-8")
    assert "@media" in css


def test_french_corpus_is_expanded_and_published_for_retrieval():
    corpus = (ROOT / "data" / "train_corpus.txt").read_text(encoding="utf-8")
    questions = [line for line in corpus.splitlines() if line.startswith("Utilisateur :")]
    assert len(questions) >= 200
    assert "Bonjour" in corpus
    workflow = (ROOT / ".github" / "workflows" / "pages.yml").read_text(encoding="utf-8")
    assert "cp data/train_corpus.txt docs/knowledge.txt" in workflow
    assert "--steps 800" in workflow


def test_browser_prefers_known_french_answers_before_neural_generation():
    app = (DOCS / "app.js").read_text(encoding="utf-8")
    assert 'fetch("./knowledge.txt"' in app
    assert "knowledgeEngine.respond(message)" in app
    assert 'registerEngine("conversation"' in app
    assert 'registerEngine("knowledge"' in app
    html = (DOCS / "index.html").read_text(encoding="utf-8")
    assert 'src="./core/knowledge-engine.js"' in html
    assert 'src="./core/conversation-engine.js"' in html


def test_browser_rejects_unreadable_neural_output_with_french_fallback():
    app = (DOCS / "app.js").read_text(encoding="utf-8")
    assert "function isReadableFrench(text)" in app
    assert "return isReadableFrench(answer) ? answer : unknownAnswer();" in app
    assert "function unknownAnswer()" in app
    assert "Je n'ai pas encore appris à répondre correctement" in app


def test_knowledge_parser_uses_flexible_french_dialogue_labels():
    app = (DOCS / "app.js").read_text(encoding="utf-8")
    assert r"line.match(/^Utilisateur\s*:\s*(.+)$/i)" in app
    assert r"line.match(/^LoganAI\s*:\s*(.+)$/i)" in app
    html = (DOCS / "index.html").read_text(encoding="utf-8")
    assert 'src="./core/conversation-engine.js"' in html
    conversation = (DOCS / "core" / "conversation-engine.js").read_text(encoding="utf-8")
    assert "Bonjour ! Que souhaitez-vous savoir ou faire aujourd'hui ?" in conversation


def test_structured_memory_module_and_controls_are_wired():
    html = (DOCS / "index.html").read_text(encoding="utf-8")
    app = (DOCS / "app.js").read_text(encoding="utf-8")
    memory = (DOCS / "core" / "memory-engine.js").read_text(encoding="utf-8")
    assert 'src="./core/memory-engine.js"' in html
    assert 'id="memoryType"' in html
    assert 'id="clearMemory"' in html
    assert "createMemoryStore(readStore, writeStore)" in app
    assert "memoryStore.respond(message)" in app
    assert "function createMemoryStore" in memory


def test_personal_memory_is_not_injected_into_neural_prompts_automatically():
    app = (DOCS / "app.js").read_text(encoding="utf-8")
    generation = app.split("async function generateReply(message)", 1)[1].split("async function loadModel()", 1)[0]
    assert "const prefix = \"Utilisateur : \" + message.trim()" in generation
    assert "readStore().memories" not in generation
    assert "Informations mémorisées" not in generation
