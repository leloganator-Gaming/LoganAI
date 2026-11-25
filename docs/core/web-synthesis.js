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
  }
  function sentences(value) {
    return String(value || "").replace(/\s+/g," ").split(/(?<=[.!?])\s+/)
      .map(s => s.trim()).filter(s => s.length >= 45 && s.length <= 420);
  }

  function detectIntent(query) {
    const q = String(query || "").toLowerCase();
    if (/\b(quand|date|année|heure|depuis)\b/.test(q)) return "temporal";
    if (/\b(combien|prix|coût|pourcentage|nombre|chiffre)\b/.test(q)) return "quantitative";
    if (/\b(compare|différence|versus|contre)\b/.test(q)) return "comparison";
    if (/\b(pourquoi|cause|raison)\b/.test(q)) return "causal";
    return "general";
  }
  function rankSentences(query, results) {
    const queryTerms = [...new Set(words(query).map(stem))];
    const candidates = [];
    results.slice(0, 5).forEach((item, index) => {
      const source = index + 1;
      const text = [item.pageTitle || item.title, item.summary, item.snippet].filter(Boolean).join(". ");
      for (const sentence of sentences(text)) {
        const terms = words(sentence).map(stem);
        const hits = queryTerms.filter(term => terms.includes(term)).length;
        if (!hits) continue;
        const coverage = hits / Math.max(1, queryTerms.length);
        const density = hits / Math.max(1, terms.length);
        const score = coverage * 0.72 + density * 0.18 + Math.min(sentence.length,240)/2400;
        candidates.push({ sentence, source, score, terms: new Set(terms) });
      }
    });
    return candidates.sort((a,b) => b.score-a.score);
  }
  function removeRedundancy(candidates, limit) {
    const chosen = [];
    for (const item of candidates) {
      if (chosen.length >= limit) break;
      const duplicate = chosen.some(old => {
        const itemNumbers = (item.sentence.match(/\b\d+(?:[.,]\d+)?\s?(?:%|euros?|€|ans?|jours?|mois|km|m|kg)?\b/g) || []).join("|");
        const oldNumbers = (old.sentence.match(/\b\d+(?:[.,]\d+)?\s?(?:%|euros?|€|ans?|jours?|mois|km|m|kg)?\b/g) || []).join("|");
        if (itemNumbers && oldNumbers && itemNumbers !== oldNumbers) return false;
        const overlap = [...item.terms].filter(w => old.terms.has(w)).length;
        return overlap / Math.max(1, Math.min(item.terms.size, old.terms.size)) > 0.78;
      });
      if (!duplicate) chosen.push(item);
    }
    return chosen;
  }
  function detectDisagreement(chosen) {
    for (let i = 0; i < chosen.length; i++) {
      for (let j = i + 1; j < chosen.length; j++) {
        const left = chosen[i].sentence.toLowerCase();
        const right = chosen[j].sentence.toLowerCase();
        const leftNumbers = left.match(/\d+(?:[.,]\d+)?/g) || [];
        const rightNumbers = right.match(/\d+(?:[.,]\d+)?/g) || [];
        if (!leftNumbers.length || !rightNumbers.length) continue;
        if (leftNumbers.join("|") === rightNumbers.join("|")) continue;
        const leftTerms = new Set(words(left).filter(w => !/^\d+$/.test(w)).map(stem));
        const rightTerms = new Set(words(right).filter(w => !/^\d+$/.test(w)).map(stem));
        const overlap = [...leftTerms].filter(w => rightTerms.has(w)).length;
        const similarity = overlap / Math.max(1, Math.min(leftTerms.size, rightTerms.size));
        if (overlap >= 3 && similarity >= 0.4) return true;
      }
    }
    return false;
  }
  function synthesize(query, results, limit = 5) {
    if (!Array.isArray(results) || !results.length) return null;
    const intent = detectIntent(query);
    const candidates = rankSentences(query, results);
    const chosen = removeRedundancy(candidates, limit);
    if (!chosen.length) {
      const fallback = results.slice(0,3).map((item,i) => {
        const text = String(item.summary || item.snippet || "").trim();
        return text ? text.slice(0,420) + " [" + (i+1) + "]" : "";
      }).filter(Boolean);
      return fallback.length ? "Les sources disponibles ne permettent pas une réponse suffisamment précise. Voici les informations trouvées :\n" + fallback.join("\n") : null;
    }
    const answer = chosen.map(item => item.sentence + " [" + item.source + "]").join("\n\n");
    if (detectDisagreement(chosen)) {
      return answer + "\n\nAttention : les sources présentent des valeurs numériques différentes. Vérifiez les chiffres dans les pages citées avant de les retenir.";
    }
    return answer;
  }
  return Object.freeze({
    synthesize, detectIntent, rankSentences, removeRedundancy, detectDisagreement,
    version: "1.1.0"
  });
});
