(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LoganAIConversation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function respond(message) {
    if (typeof message !== "string" || !message.trim()) return null;
    const value = message.toLocaleLowerCase("fr").normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").trim();
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

  return Object.freeze({ respond, version: "0.1.0" });
});
