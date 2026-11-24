"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const LoganAI = require("../docs/core/orchestrator.js");

test("exécute les moteurs selon leur priorité", async () => {
  const core = LoganAI.createCore({ fallback: () => "inconnu" });
  core.registerEngine("knowledge", () => "réponse de la base", 10);
  core.registerEngine("conversation", () => "bonjour", 20);
  const result = await core.respond({ message: "salut" });
  assert.equal(result.text, "bonjour");
  assert.equal(result.source, "conversation");
});

test("passe au moteur suivant si un moteur ne sait pas répondre", async () => {
  const core = LoganAI.createCore({ fallback: () => "inconnu" });
  core.registerEngine("empty", () => null, 20);
  core.registerEngine("knowledge", () => ({ text: "réponse fiable", confidence: 0.9 }), 10);
  const result = await core.respond("question");
  assert.equal(result.text, "réponse fiable");
  assert.equal(result.confidence, 0.9);
});

test("isole une erreur de moteur et continue", async () => {
  const core = LoganAI.createCore({ fallback: () => "secours" });
  core.registerEngine("broken", () => { throw new Error("erreur simulée"); }, 20);
  core.registerEngine("working", () => "ça fonctionne", 10);
  assert.equal((await core.respond("test")).text, "ça fonctionne");
});

test("utilise le secours si aucun moteur ne répond", async () => {
  const core = LoganAI.createCore({ fallback: () => "réponse de secours" });
  assert.deepEqual(await core.respond("question"), {
    text: "réponse de secours", source: "fallback", confidence: 0
  });
});

test("refuse une entrée vide sans appeler les moteurs", async () => {
  const core = LoganAI.createCore({ fallback: () => "entrée vide" });
  assert.equal((await core.respond("   ")).text, "entrée vide");
});
