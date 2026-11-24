(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LoganAI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function createCore(options = {}) {
    const engines = new Map();
    const fallback = typeof options.fallback === "function"
      ? options.fallback
      : () => "Je ne dispose pas encore d'une réponse fiable.";

    function registerEngine(id, handler, priority = 0) {
      if (typeof id !== "string" || !id.trim()) throw new TypeError("L'identifiant du moteur est obligatoire.");
      if (typeof handler !== "function") throw new TypeError("Le moteur doit être une fonction.");
      engines.set(id, { id, handler, priority: Number.isFinite(priority) ? priority : 0 });
      return () => engines.delete(id);
    }

    async function respond(input, context = {}) {
      const message = typeof input === "string" ? input : input && input.message;
      if (typeof message !== "string" || !message.trim()) {
        return { text: fallback(), source: "fallback", confidence: 0 };
      }
      const request = { message: message.trim(), context };
      const ordered = [...engines.values()].sort((a, b) => b.priority - a.priority);
      for (const engine of ordered) {
        try {
          const result = await engine.handler(request);
          const text = typeof result === "string" ? result : result && result.text;
          if (typeof text === "string" && text.trim()) {
            return {
              text: text.trim(),
              source: engine.id,
              confidence: result && typeof result === "object" && Number.isFinite(result.confidence)
                ? result.confidence : null
            };
          }
        } catch (error) {
          if (typeof options.onEngineError === "function") options.onEngineError(error, engine.id);
        }
      }
      return { text: fallback(), source: "fallback", confidence: 0 };
    }

    return {
      registerEngine,
      respond,
      getEngines: () => [...engines.values()]
        .sort((a, b) => b.priority - a.priority)
        .map(({ id, priority }) => ({ id, priority }))
    };
  }

  return Object.freeze({ createCore, version: "0.1.0" });
});
