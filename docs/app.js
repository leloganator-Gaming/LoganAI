const $ = (s) => document.querySelector(s);
const STORE_KEY = "loganai.browser.v1";
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8");
let session = null;
let lastAssistant = "";
let knowledgePairs = [];
const aiCore = window.LoganAI.createCore({ fallback: unknownAnswer });

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

const STOP_WORDS = new Set([
  "alors","avec","avoir","cela","comme","dans","depuis","des","donc","elle","elles","est","etre","fait","faire","ici","leur","leurs","mais","meme","mon","nous","par","pas","peut","pour","quoi","que","quel","quelle","quelles","quels","sans","ses","son","sur","tes","toi","ton","tous","tout","tres","une","uns","vous",
  "les","des","aux","du","de","la","le","un","et","ou","en","a","au","ce","ces","cet","cette","qui","dont","je","tu","il","ils","on","me","te","se","ma","ta","sa","mes","nos","vos","y","ne","ni","plus","moins","bien","comment","pourquoi","quand","combien","estce",
  "explique","expliquer","expliquez","definis","definir","definition","signification","signifie","signifier","terme","mot","mots","parle","parler","presente","presenter","donne","donner","peux","pouvez","sagit","cest","quest","quil","elle","fonctionne","fonctionner","utilite","sert"
]);
const WORD_ALIASES = new Map([
  ["ordi","ordinateur"],["pc","ordinateur"],["microordinateur","ordinateur"],
  ["auto","voiture"],["automobile","voiture"],["bagnole","voiture"],
  ["bicyclette","velo"],["cycle","velo"],["bicloo","velo"],
  ["portable","telephone"],["smartphone","telephone"],["mobile","telephone"],
  ["web","internet"],["reseau mondial","internet"],
  ["ia","intelligence"],["artificielle","artificielle"],
  ["appli","application"],["logiciel","programme"],["progiciel","programme"],
  ["photo","photographie"],["images","image"],["videos","video"],
  ["courriel","email"],["mel","email"],["mail","email"],
  ["chiffrement","cryptage"],["crypter","chiffrer"],["piratage","attaque"],
  ["bug","erreur"],["bogue","erreur"],["plantage","panne"],
  ["vite","rapide"],["rapidement","rapide"],["promptement","rapide"],
  ["maison","habitation"],["logement","habitation"],["demeure","habitation"],
  ["enseignant","professeur"],["instituteur","professeur"],["enseignante","professeur"],
  ["élève","apprenant"],["etudiant","apprenant"],["étudiant","apprenant"],
  ["commencer","debuter"],["demarrer","debuter"],["entamer","debuter"],
  ["terminer","finir"],["achever","finir"],["clore","finir"],
  ["aider","assister"],["soutenir","assister"],["accompagner","assister"]
]);
function normalizeWords(text) {
  let normalized = text.toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  normalized = normalized.replace(/\bintelligence artificielle\b/g, "intelligence");
  return normalized.replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/)
    .map((word) => WORD_ALIASES.get(word) || word)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}
function conversationalAnswer(message) {
  const value = message.toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (/^(salut|bonjour|bonsoir|coucou|hello|hey)(\b|[!. ,])/i.test(value)) {
    return "Bonjour ! Que souhaitez-vous savoir ou faire aujourd'hui ?";
  }
  if (/^(merci|merci beaucoup|je te remercie|je vous remercie)(\b|[!. ,])/i.test(value)) {
    return "Je vous en prie. Avez-vous une autre question ?";
  }
  if (/^(au revoir|a bientot|bonne journee|bonne soiree|a plus)(\b|[!. ,])/i.test(value)) {
    return "Au revoir ! Passez une bonne journée.";
  }
  if (/^(comment ca va|ca va|tu vas bien|vous allez bien)\??[!. ]*$/i.test(value)) {
    return "Je fonctionne correctement, merci. Et vous, que puis-je faire pour vous ?";
  }
  if (/^(qui es tu|tu es qui|presente toi)\??[!. ]*$/i.test(value)) {
    return "Je suis LoganAI, un assistant expérimental développé autour d'un petit modèle neuronal et d'une base de connaissances française.";
  }
  return null;
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
  if (window.LoganSelfLearning) window.LoganSelfLearning.init(knowledgePairs, readStore, writeStore, (items) => {
    for (const item of items) knowledgePairs.push({question: item.question, answer: item.answer, words: normalizeWords(item.question)});
  });
}
function findKnowledgeAnswer(message) {
  const conversational = conversationalAnswer(message);
  if (conversational) return conversational;
  const queryWords = normalizeWords(message);
  if (!queryWords.length) return null;
  const query = new Set(queryWords);
  const documentFrequency = new Map();
  for (const item of knowledgePairs) {
    for (const word of new Set(item.words)) {
      documentFrequency.set(word, (documentFrequency.get(word) || 0) + 1);
    }
  }
  let best = null;
  let bestScore = 0;
  let secondScore = 0;
  for (const item of knowledgePairs) {
    const words = new Set(item.words);
    if (!words.size) continue;
    let matchedWeight = 0;
    let totalWeight = 0;
    for (const word of query) {
      const weight = 1 + Math.log(1 + knowledgePairs.length / (1 + (documentFrequency.get(word) || 0)));
      totalWeight += weight;
      if (words.has(word)) matchedWeight += weight;
    }
    const coverage = totalWeight ? matchedWeight / totalWeight : 0;
    const precision = [...words].filter((word) => query.has(word)).length / Math.max(1, words.size);
    const score = coverage * 0.82 + precision * 0.18;
    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      best = item;
    } else if (score > secondScore) {
      secondScore = score;
    }
  }
  if (bestScore < 0.72 || (bestScore - secondScore < 0.035 && bestScore < 0.94)) return null;
  return best.answer;
}

aiCore.registerEngine("conversation", ({ message }) => conversationalAnswer(message), 100);
aiCore.registerEngine("knowledge", ({ message }) => findKnowledgeAnswer(message), 50);

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
  const answer = decoder.decode(new Uint8Array(generated)).split(/\n(?:Utilisateur|LoganAI)\s*:/)[0].trim();
  return isReadableFrench(answer) ? answer : unknownAnswer();
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
      ? "Base de connaissances française chargée."
      : "Modèle exécuté sur cet appareil.";
    status.textContent = "Modèle navigateur chargé"; modelState.textContent = "ONNX / WASM prêt";
  } catch (error) {
    status.textContent = knowledgePairs.length ? "Base française disponible" : "Modèle indisponible";
    modelState.textContent = knowledgePairs.length ? "Base de connaissances prête" : "En attente du modèle";
    if (knowledgePairs.length) {
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
  event.preventDefault(); const input = $("#prompt"), message = input.value.trim(); if (!message || (!session && !knowledgePairs.length)) return;
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
