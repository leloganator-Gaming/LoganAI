(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LoganAIMemory = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const TYPES = new Set(["preference", "note"]);
  const SENSITIVE = [
    /\\b(?:mot de passe|password|code secret|secret|clé api|api key|token privé)\\b/i,
    /\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b/i,
    /(?:\\+?\\d[\\d .()-]{7,}\\d)/,
    /\\b(?:adresse|domicile|j'habite au|je vis au)\\b/i,
    /\\b(?:diagnostic|traitement médical|dossier médical|numéro de sécurité sociale)\\b/i
  ];
  const clean = (value) => typeof value === "string" ? value.trim().replace(/\\s+/g, " ") : "";
  function isSafeText(value) {
    const text = clean(value);
    return Boolean(text) && text.length <= 500 && !SENSITIVE.some((pattern) => pattern.test(text));
  }
  function createMemoryStore(readStore, writeStore) {
    if (typeof readStore !== "function" || typeof writeStore !== "function") {
      throw new TypeError("Les fonctions de stockage sont obligatoires.");
    }
    function state() {
      const data = readStore() || {};
      const legacy = Array.isArray(data.memories) ? data.memories : [];
      if (!Array.isArray(data.memoryItems)) {
        data.memoryItems = legacy.filter(isSafeText).map((text, index) => ({
          id: "legacy-" + index, type: "note", text: clean(text), createdAt: null
        }));
        writeStore(data);
      }
      return data;
    }
    function list() {
      return state().memoryItems.filter((item) => item && TYPES.has(item.type) && isSafeText(item.text));
    }
    function add(type, value) {
      const text = clean(value);
      if (!TYPES.has(type) || !isSafeText(text)) return null;
      const data = state();
      const item = { id: "memory-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
        type, text, createdAt: new Date().toISOString() };
      data.memoryItems.push(item);
      data.memories = data.memoryItems.map((entry) => entry.text);
      writeStore(data);
      return item;
    }
    function remove(id) {
      const data = state();
      const before = data.memoryItems.length;
      data.memoryItems = data.memoryItems.filter((item) => item.id !== id);
      data.memories = data.memoryItems.map((entry) => entry.text);
      if (data.memoryItems.length !== before) writeStore(data);
      return data.memoryItems.length !== before;
    }
    function clear() {
      const data = state();
      data.memoryItems = [];
      data.memories = [];
      writeStore(data);
    }
    function respond(message) {
      const query = clean(message).toLocaleLowerCase("fr");
      if (!/(que sais[- ]je de toi|que sais[- ]tu de moi|qu'as[- ]tu retenu|qu'est[- ]ce que tu as mémorisé|rappelle[- ]moi mes (?:préférences|notes|souvenirs))/i.test(query)) return null;
      const items = list();
      if (!items.length) return "Je n'ai aucune note personnelle enregistrée sur cet appareil.";
      return "Voici les éléments que vous avez choisi d'enregistrer sur cet appareil : " +
        items.map((item) => (item.type === "preference" ? "Préférence : " : "Note : ") + item.text).join(" ; ");
    }
    return Object.freeze({ add, list, remove, clear, respond, isSafeText });
  }
  return Object.freeze({ createMemoryStore, isSafeText, version: "0.3.0" });
});
