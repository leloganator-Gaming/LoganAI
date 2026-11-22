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
    assert "data.memories" in app


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
    assert "function findKnowledgeAnswer(message)" in app
    assert "knownAnswer || await generateReply(message)" in app
    assert "temperature = 0.68, topK = 24" in app
