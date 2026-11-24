(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LoganAIKnowledge = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

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
    let normalized = String(text).toLocaleLowerCase("fr").normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    normalized = normalized.replace(/\bintelligence artificielle\b/g, "intelligence");
    return normalized.replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/)
      .map((word) => WORD_ALIASES.get(word) || word)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  }

  function createEngine() {
    let pairs = [];
    function setPairs(items) {
      pairs = (Array.isArray(items) ? items : []).map((item) => ({
        question: String(item.question || ""),
        answer: String(item.answer || ""),
        words: Array.isArray(item.words) ? item.words : normalizeWords(item.question || "")
      }));
      return pairs.length;
    }
    function addPairs(items) {
      const additions = (Array.isArray(items) ? items : []).map((item) => ({
        question: String(item.question || ""),
        answer: String(item.answer || ""),
        words: Array.isArray(item.words) ? item.words : normalizeWords(item.question || "")
      }));
      pairs.push(...additions);
      return additions.length;
    }
    function respond(message) {
      const queryWords = normalizeWords(message);
      if (!queryWords.length || !pairs.length) return null;
      const query = new Set(queryWords);
      const documentFrequency = new Map();
      for (const item of pairs) {
        for (const word of new Set(item.words)) {
          documentFrequency.set(word, (documentFrequency.get(word) || 0) + 1);
        }
      }
      let best = null, bestScore = 0, secondScore = 0;
      for (const item of pairs) {
        const words = new Set(item.words);
        if (!words.size) continue;
        let matchedWeight = 0, totalWeight = 0;
        for (const word of query) {
          const weight = 1 + Math.log(1 + pairs.length / (1 + (documentFrequency.get(word) || 0)));
          totalWeight += weight;
          if (words.has(word)) matchedWeight += weight;
        }
        const coverage = totalWeight ? matchedWeight / totalWeight : 0;
        const precision = [...words].filter((word) => query.has(word)).length / Math.max(1, words.size);
        const score = coverage * 0.82 + precision * 0.18;
        if (score > bestScore) { secondScore = bestScore; bestScore = score; best = item; }
        else if (score > secondScore) secondScore = score;
      }
      if (bestScore < 0.72 || (bestScore - secondScore < 0.035 && bestScore < 0.94)) return null;
      return best.answer || null;
    }
    return Object.freeze({
      setPairs, addPairs, respond,
      get size() { return pairs.length; }
    });
  }

  return Object.freeze({ createEngine, normalizeWords, version: "0.1.0" });
});
