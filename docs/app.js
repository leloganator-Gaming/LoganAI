const $ = (s) => document.querySelector(s);
const STORE_KEY = "loganai.browser.v1";
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8");
let session = null;
let lastAssistant = "";
let knowledgePairs = [];

function readStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || { memories: [], messages: [] }; }
  catch { return { memories: [], messages: [] }; }
}
function writeStore(data) { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
function showPanel(name) {
  document.querySelectorAll(".panel").forEach((el) => el.classList.remove("visible"));
  $("#" + name + "Panel").classList.add("visible");
  document.querySelectorAll(".nav").forEach((el) => el.classList.toggle("active", el.dataset.panel === name));
  $("#heading").textContent = { chat: "Discussion", memory: "Mémoire", about: "À propos" }[name];
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
  readStore().memories.forEach((memory, index) => {
    const row = document.createElement("div"); row.className = "memory-item";
    const text = document.createElement("span"); text.textContent = memory;
    const remove = document.createElement("button"); remove.textContent = "Supprimer";
    remove.addEventListener("click", () => {
      const data = readStore(); data.memories.splice(index, 1); writeStore(data); renderMemories();
    });
    row.append(text, remove); root.append(row);
  });
}
$("#memoryForm").addEventListener("submit", (event) => {
  event.preventDefault(); const value = $("#memoryText").value.trim(); if (!value) return;
  const data = readStore(); data.memories.push(value); writeStore(data);
  $("#memoryText").value = ""; renderMemories();
});

function normalizeWords(text) {
  const ignored = new Set(["alors", "avec", "avoir", "cela", "comme", "dans", "des", "donc", "elle", "elles", "est", "etre", "fait", "faire", "ici", "leur", "leurs", "mais", "meme", "mon", "nous", "par", "pas", "peut", "pour", "quoi", "que", "quel", "quelle", "quelles", "quels", "qui", "sans", "ses", "son", "sur", "tes", "toi", "ton", "tous", "tout", "tres", "une", "uns", "vous"]);
  return text.toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/)
    .filter((word) => word.length > 2 && !ignored.has(word));
}
async function loadKnowledge() {
  const response = await fetch("./knowledge.txt", {cache: "no-cache"});
  if (!response.ok) throw new Error("Base de connaissances indisponible.");
  const lines = (await response.text()).split(/\r?\n/);
  let question = null;
  knowledgePairs = [];
  for (const line of lines) {
    const q = line.match(/^Utilisateur\s*:\s*(.+)$/i);
    const a = line.match(/^LoganAI\s*:\s*(.+)$/i);
    if (q) question = q[1].trim();
    else if (a && question) {
      knowledgePairs.push({question, answer: a[1].trim(), words: normalizeWords(question)});
      question = null;
    }
  }
}
function findKnowledgeAnswer(message) {
  const query = new Set(normalizeWords(message));
  if (!query.size) return null;
  let best = null;
  let bestScore = 0;
  for (const item of knowledgePairs) {
    const words = new Set(item.words);
    if (!words.size) continue;
    let overlap = 0;
    for (const word of query) if (words.has(word)) overlap++;
    const score = overlap / Math.sqrt(query.size * words.size);
    if (score > bestScore) { best = item; bestScore = score; }
  }
  return bestScore >= 0.68 ? best.answer : null;
}

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
async function generateReply(message) {
  if (!session) throw new Error("Le modèle n'est pas encore chargé.");
  const memories = readStore().memories;
  const memoryText = memories.length ? "Informations mémorisées : " + memories.join(" ; ") + "\n" : "";
  const prefix = memoryText + "Utilisateur : " + message.trim() + "\nLoganAI :";
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
  return decoder.decode(new Uint8Array(generated)).split(/\n(?:Utilisateur|LoganAI)\s*:/)[0].trim()
    || "Je n'ai pas réussi à formuler une réponse. Reformulez votre question.";
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
    $("#chatForm button").disabled = false; $("#composerNote").textContent = knowledgePairs.length
      ? "Réponses vérifiées sur les questions connues ; modèle neuronal pour les autres demandes."
      : "Modèle exécuté sur cet appareil.";
    status.textContent = "Modèle navigateur chargé"; modelState.textContent = "ONNX / WASM prêt";
  } catch (error) {
    status.textContent = "Modèle indisponible"; modelState.textContent = "En attente du modèle";
    $("#composerNote").textContent = "Le modèle n'est pas encore publié. Relancez le workflow GitHub Pages après fusion.";
    $("#prompt").placeholder = "Modèle non disponible pour le moment…";
    console.error(error);
  }
}
$("#chatForm").addEventListener("submit", async (event) => {
  event.preventDefault(); const input = $("#prompt"), message = input.value.trim(); if (!message || !session) return;
  input.value = ""; addBubble("user", message);
  const button = $("#chatForm button"); button.disabled = true; button.textContent = "Réflexion…";
  try {
    const knownAnswer = findKnowledgeAnswer(message);
    addBubble("assistant", knownAnswer || await generateReply(message));
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
