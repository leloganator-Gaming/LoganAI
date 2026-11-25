(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LoganAIWebSynthesis = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const STOP = new Set(["avec","dans","pour","plus","moins","comment","pourquoi","quelle","quelles","quel","quels","est","sont","une","des","les","aux","sur","que","qui","quoi","mais","donc","alors","cela","cette","ces","son","ses","leur","leurs","vous","nous","elle","elles","ils","elles","the","and","for","from","that","this","with"]);
  function words(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .match(/[a-z0-9]{3,}/g)?.filter(w => !STOP.has(w)) || [];
  }
  function stem(word) {
    return word.replace(/(issements|issement|atrices|ateurs|ations|ation|ements|ement|iques|ique|istes|iste|aires|aire|ées|es|s)$/,"");
  }\n  function sentences(value) {
    return String(value || "").replace(/\s+/g," ").split(/(?<=[.!?])\s+/)
      .map(s => s.trim()).filter(s => s.length >= 45 && s.length <= 420);
  }
  function synthesize(query, results, limit = 5) {
    if (!Array.isArray(results) || !results.length) return null;
    const queryTerms = [...new Set(words(query).map(stem))];
    const candidates = [];
    results.slice(0, 5).forEach((item, index) => {
      const source = index + 1;
      const text = [item.pageTitle || item.title, item.summary, item.snippet].filter(Boolean).join(". ");
      const seen = new Set();
      for (const sentence of sentences(text)) {
        const normalized = sentence.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
        const key = normalized.replace(/[^a-z0-9]/g,"");
        if (seen.has(key)) continue;
        seen.add(key);
        const terms = words(sentence).map(stem);
        const hits = queryTerms.filter(term => terms.includes(term)).length;
        const coverage = hits / Math.max(1, queryTerms.length);
        const density = hits / Math.max(1, terms.length);
        const score = coverage * 0.72 + density * 0.18 + Math.min(sentence.length,240)/2400;
        if (hits > 0) candidates.push({ sentence, source, score, terms: new Set(terms) });
      }
    });
    candidates.sort((a,b) => b.score-a.score);
    const chosen = [];
    for (const item of candidates) {
      if (chosen.length >= limit) break;
      const duplicate = chosen.some(old => {
        const overlap = [...item.terms].filter(w => old.terms.has(w)).length;
        return overlap / Math.max(1, Math.min(item.terms.size, old.terms.size)) > 0.78;
      });
      if (!duplicate) chosen.push(item);
    }
    if (!chosen.length) {
      const fallback = results.slice(0,3).map((item,i) => {
        const text = String(item.summary || item.snippet || "").trim();
        return text ? text.slice(0,420) + " [" + (i+1) + "]" : "";
      }).filter(Boolean);
      return fallback.length ? "Les sources disponibles ne permettent pas une réponse suffisamment précise. Voici les informations trouvées :\n" + fallback.join("\n") : null;
    }
    return chosen.map(item => item.sentence + " [" + item.source + "]").join("\n\n");
  }
  return Object.freeze({ synthesize, version: "1.0.0" });
});
