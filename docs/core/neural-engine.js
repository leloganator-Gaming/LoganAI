(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LoganAINeural = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function isReadableFrench(text) {
    if (typeof text !== "string" || !text.trim() || text.includes("\uFFFD")) return false;
    const words = text.toLocaleLowerCase("fr").match(/[a-zàâçéèêëîïôùûüÿœæ]{2,}/g) || [];
    if (words.length < 4 || words.length > 55) return false;
    if (/(.)\1{4,}/iu.test(text)) return false;
    if (/\b(\p{L}{2,})\s+\1(?:\s+\1)+\b/iu.test(text)) return false;
    const counts = new Map();
    for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
    if (Math.max(...counts.values()) >= 4) return false;
    const common = new Set(("à au aux avec ce ceci cela ces cette ceux chaque comme dans de des du elle elles en et eux il ils je la le les leur lui ma mais me même mes moi mon ne nos notre nous on ou par pas pour pourquoi quand que qui quoi sa sans se ses si son sous sur ta te tes toi ton tu un une vos votre vous y est sont être avoir faire fait peut peux doit suis avez avons ont été était donc très bien bonjour merci comment quel quelle quels quelles où").split(" "));
    const commonCount = words.filter(word => common.has(word)).length;
    const known = words.filter(word => common.has(word) || word.length >= 7 && /(?:tion|ment|ique|able|iste|isme|eur|euse|ées|és|ée|er|ir|re)$/.test(word));
    return commonCount >= 2 && known.length / words.length >= 0.58;
  }
  function createEngine(options = {}) {
    if (typeof options.generate !== "function") {
      throw new TypeError("La fonction de génération neuronale est obligatoire.");
    }
    const isReady = typeof options.isReady === "function"
      ? options.isReady
      : () => false;

    async function respond(message) {
      if (typeof message !== "string" || !message.trim() || !isReady()) return null;
      const answer = await options.generate(message.trim());
      if (typeof answer !== "string" || !answer.trim()) return null;
      if (typeof options.validate === "function" && !options.validate(answer.trim())) return null;
      return answer.trim();
    }

    return Object.freeze({ respond });
  }

  return Object.freeze({ createEngine, isReadableFrench, version: "0.2.0" });
});
