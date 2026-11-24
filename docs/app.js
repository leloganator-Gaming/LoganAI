// Phase 2: l’interface délègue les réponses aux moteurs modulaires du noyau hybride.
const $ = (s) => document.querySelector(s);
const STORE_KEY = "loganai.browser.v1";
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8");
let session = null;
let lastAssistant = "";
const knowledgeEngine = window.LoganAIKnowledge.createEngine();
const aiCore = window.LoganAI.createCore({ fallback: unknownAnswer });
const memoryStore = window.LoganAIMemory.createMemoryStore(readStore, writeStore);
const neuralEngine = window.LoganAINeural.createEngine({\n  isReady: () => Boolean(session),\n  generate: (message) => generateReply(message)\n});

function readStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || { memories: [], messages: [] }; }
  catch { return { memories: [], messages: [] }; }
}
function writeStore(data) { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
function showPanel(name) {
  document.querySelectorAll(".panel").forEach((el) => el.classList.remove("visible"));
  $("#" + name + "Panel").classList.add("visible");
  document.querySelectorAll(".nav").forEach((el) => el.classList.toggle("active", el.dataset.panel === name));
  $("#heading").textContent = { chat: "Discussion", memory: "Mémoire", about: "À propos", learning: "Auto-apprentissage" }[name];
}
document.querySelectorAll(".nav").forEach((button) => button.addEventListener("click", () => showPanel(button.dataset.panel)));

function addBubble(role, content, persist = true) {
  const root = $("#messages");
  const welcome = root.querySelector(".welcome");
  if (welcome) welcome.remove();
  const bubble = document.createElement("div"); bubble.className = "bubble " + role;
  const who = document.createElement("span"); who.className = "who";
  who.textContent = role === "user" ? "VOUS" : "LOGANAI";
  const body = document.createElement("div"); body.textContent = content;
  bubble.append(who, body); root.append(bubble); root.scrollTop = root.scrollHeight;
  if (role === "assistant") lastAssistant = content;
  if (persist) { const data = readStore(); data.messages.push({role, content}); data.messages = data.messages.slice(-80); writeStore(data); }
}
function renderHistory() {
  const data = readStore();
  if (!data.messages.length) return;
  $("#messages").replaceChildren();
  data.messages.forEach((m) => addBubble(m.role, m.content, false));
}
function renderMemories() {
  const root = $("#memoryList"); root.replaceChildren();
  for (const memory of memoryStore.list()) {
    const row = document.createElement("div"); row.className = "memory-item";
    const content = document.createElement("span");
    content.textContent = (memory.type === "preference" ? "Préférence · " : "Note · ") + memory.text;
    const remove = document.createElement("button"); remove.textContent = "Supprimer";
    remove.addEventListener("click", () => { memoryStore.remove(memory.id); renderMemories(); });
    row.append(content, remove); root.append(row);
  }
  $("#memoryCount").textContent = memoryStore.list().length + " élément(s) enregistré(s) sur cet appareil.";
}
$("#memoryForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const saved = memoryStore.add($("#memoryType").value, $("#memoryText").value.trim());
  if (!saved) {
    $("#memoryFeedback").textContent = "Texte refusé : vérifiez sa longueur et n'enregistrez aucune donnée sensible.";
    return;
  }
  $("#memoryText").value = "";
  $("#memoryFeedback").textContent = "Élément enregistré localement.";
  renderMemories();
});
$("#clearMemory").addEventListener("click", () => {
  if (!memoryStore.list().length) return;
  memoryStore.clear();
  $("#memoryFeedback").textContent = "La mémoire personnelle locale a été effacée.";
  renderMemories();
});

async function loadKnowledge() {
  const response = await fetch("./knowledge.txt", {cache: "no-cache"});
  if (!response.ok) throw new Error("Base de connaissances indisponible.");
  const lines = (await response.text()).split(/\r?\n/);
  let question = null;
  const pairs = [];
  for (const line of lines) {
    const q = line.match(/^Utilisateur\s*:\s*(.+)$/i);
    const a = line.match(/^LoganAI\s*:\s*(.+)$/i);
    if (q) question = q[1].trim();
    else if (a && question) {
      pairs.push({question, answer: a[1].trim(), words: window.LoganAIKnowledge.normalizeWords(question)});
      question = null;
    }
  }
  knowledgeEngine.setPairs(pairs);
  if (window.LoganSelfLearning) window.LoganSelfLearning.init(pairs, readStore, writeStore, (items) => {
    knowledgeEngine.addPairs(items);
  });
}

aiCore.registerEngine("conversation", ({ message }) => window.LoganAIConversation.respond(message), 100);
aiCore.registerEngine("memory", ({ message }) => memoryStore.respond(message), 80);
aiCore.registerEngine("knowledge", ({ message }) => knowledgeEngine.respond(message), 50);
aiCore.registerEngine("neural", ({ message }) => neuralEngine.respond(message), 10);

function bytesToIds(text) { return Array.from(encoder.encode(text)); }
function softmaxSample(logits, temperature = 0.68, topK = 24) {
  const candidates = Array.from(logits, (value, id) => ({id, value: value / temperature}))
    .sort((a, b) => b.value - a.value).slice(0, topK);
  const max = candidates[0].value;
  const weights = candidates.map((x) => Math.exp(x.value - max));
  const total = weights.reduce((a, b) => a + b, 0);
  let pick = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) { pick -= weights[i]; if (pick <= 0) return candidates[i].id; }
  return candidates[0].id;
}
function isReadableFrench(text) {
  if (!text || text.includes("\uFFFD")) return false;
  const words = text.match(/[A-Za-zÀ-ÖØ-öø-ÿ]{2,}/g) || [];
  if (words.length < 3) return false;
  const letters = (text.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) || []).length;
  const vowels = (text.match(/[aeiouyàâäéèêëïîôöùûüÿ]/gi) || []).length;
  if (!letters || vowels / letters < 0.22 || vowels / letters > 0.68) return false;
  if (/(.)\\1{4,}/i.test(text)) return false;
  return true;
}
function unknownAnswer() {
  return "Je n'ai pas encore appris à répondre correctement à cette question. Je peux déjà traiter plusieurs sujets comme le français, les sciences, les mathématiques et l'informatique. Essayez de préciser votre demande.";
}

async function generateReply(message) {
  if (!session) throw new Error("Le modèle n'est pas encore chargé.");
  // Les notes personnelles ne sont jamais injectées automatiquement dans le prompt neuronal.
  const prefix = "Utilisateur : " + message.trim() + "\nLoganAI :";
  const ids = bytesToIds(prefix).slice(-512);
  const generated = [];
  for (let step = 0; step < 80; step++) {
    const context = ids.slice(-512);
    const input = new ort.Tensor("int64", BigInt64Array.from(context, (v) => BigInt(v)), [1, context.length]);
    const result = await session.run({input_ids: input});
    const logitsTensor = result.logits;
    const offset = (context.length - 1) * 256;
    const logits = logitsTensor.data.slice(offset, offset + 256);
    const next = softmaxSample(logits);
    generated.push(next); ids.push(next);
    if (next === 10 && generated.length > 12) break;
  }
  const answer = decoder.decode(new Uint8Array(generated)).split(/\n(?:Utilisateur|LoganAI)\s*:/)[0].trim();
  return isReadableFrench(answer) ? answer : null;
}

async function loadModel() {
  const status = $("#status"), modelState = $("#modelState");
  try {
    try { await loadKnowledge(); }
    catch (error) { console.warn("Base de connaissances non chargée :", error); }
    if (!window.ort) throw new Error("La bibliothèque ONNX Runtime Web n'a pas pu être chargée.");
    ort.env.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 1);
    session = await ort.InferenceSession.create("./model.onnx", {executionProviders: ["wasm"]});
    $("#prompt").disabled = false; $("#prompt").placeholder = "Écrivez un message à LoganAI…";
    $("#chatForm button").disabled = false; $("#composerNote").textContent = knowledgeEngine.size
      ? "Base de connaissances française chargée."
      : "Modèle exécuté sur cet appareil.";
    status.textContent = "Modèle navigateur chargé"; modelState.textContent = "ONNX / WASM prêt";
  } catch (error) {
    status.textContent = knowledgeEngine.size ? "Base française disponible" : "Modèle indisponible";
    modelState.textContent = knowledgeEngine.size ? "Base de connaissances prête" : "En attente du modèle";
    if (knowledgeEngine.size) {
      $("#prompt").disabled = false;
      $("#chatForm button").disabled = false;
      $("#prompt").placeholder = "Écrivez un message à LoganAI…";
      $("#composerNote").textContent = "Le mode questions-réponses reste disponible sans le modèle neuronal.";
    } else {
      $("#composerNote").textContent = "La base française et le modèle ne sont pas disponibles. Réessayez plus tard.";
      $("#prompt").placeholder = "Service indisponible pour le moment…";
    }
    console.error(error);
  }
}
$("#chatForm").addEventListener("submit", async (event) => {
  event.preventDefault(); const input = $("#prompt"), message = input.value.trim(); if (!message || (!session && !knowledgeEngine.size)) return;
  input.value = ""; addBubble("user", message);
  const button = $("#chatForm button"); button.disabled = true; button.textContent = "Réflexion…";
  try {
    const result = await aiCore.respond({ message }, { memories: readStore().memories });
    addBubble("assistant", result.text);
  }
  catch (error) { addBubble("assistant", "Erreur du moteur : " + error.message); }
  finally { button.disabled = false; button.textContent = "Envoyer ↑"; input.focus(); }
});
$("#prompt").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); $("#chatForm").requestSubmit(); }
});
$("#newChat").addEventListener("click", () => {
  const data = readStore(); data.messages = []; writeStore(data);
  $("#messages").innerHTML = '<div class="welcome"><div class="orb">L</div><h2>Nouvelle conversation</h2><p>Posez une question à LoganAI.</p></div>';
  lastAssistant = "";
});
renderHistory(); renderMemories(); loadModel();
