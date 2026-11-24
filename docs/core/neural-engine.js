(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LoganAINeural = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

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
      return typeof answer === "string" && answer.trim() ? answer.trim() : null;
    }

    return Object.freeze({ respond });
  }

  return Object.freeze({ createEngine, version: "0.1.0" });
});
