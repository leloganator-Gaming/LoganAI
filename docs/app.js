const $ = (s) => document.querySelector(s);
const STORE_KEY = "loganai.browser.v1";
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
$("#newChat").addEventListener("click", () => {
  const data = readStore(); data.messages = []; writeStore(data);
  $("#messages").innerHTML = '<div class="welcome"><div class="orb">L</div><h2>Nouvelle conversation</h2><p>Le moteur de réponse sera activé après intégration et validation du modèle navigateur.</p></div>';
});
$("#status").textContent = "Interface locale prête";
renderMemories();