"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Neural = require("../docs/core/neural-engine.js");

test("n'appelle pas le modèle tant qu'il n'est pas prêt", async () => {
  let calls = 0;
  const engine = Neural.createEngine({
    isReady: () => false,
    generate: async () => { calls++; return "Réponse générée."; }
  });
  assert.equal(await engine.respond("Question ?"), null);
  assert.equal(calls, 0);
});

test("transmet la question au modèle et renvoie sa réponse", async () => {
  let received = "";
  const engine = Neural.createEngine({
    isReady: () => true,
    generate: async (message) => { received = message; return "Réponse générée."; }
  });
  assert.equal(await engine.respond("  Question nouvelle ?  "), "Réponse générée.");
  assert.equal(received, "Question nouvelle ?");
});

test("ignore les entrées vides et les sorties vides", async () => {
  let calls = 0;
  const engine = Neural.createEngine({
    isReady: () => true,
    generate: async () => { calls++; return "   "; }
  });
  assert.equal(await engine.respond("   "), null);
  assert.equal(await engine.respond("Question ?"), null);
  assert.equal(calls, 1);
});

test("exige une fonction de génération", () => {
  assert.throws(() => Neural.createEngine({}), /génération neuronale/);
});


test("rejette une sortie qui échoue à la validation linguistique", async () => {
  const engine = Neural.createEngine({
    isReady: () => true,
    generate: async () => "Unitiene estataten le int on ele len d'unt d'e res d'at",
    validate: (answer) => answer === "Une phrase française correcte."
  });
  assert.equal(await engine.respond("Bonjour"), null);
});

test("conserve une réponse qui passe la validation linguistique", async () => {
  const engine = Neural.createEngine({
    isReady: () => true,
    generate: async () => "Une phrase française correcte.",
    validate: (answer) => answer === "Une phrase française correcte."
  });
  assert.equal(await engine.respond("Bonjour"), "Une phrase française correcte.");
});

test("rejette les sorties qui répètent artificiellement les mêmes mots", () => {
  assert.equal(
    Neural.isReadableFrench("Une prone dest dest dest des des des précons des des des des"),
    false
  );
});

test("accepte une phrase française cohérente", () => {
  assert.equal(
    Neural.isReadableFrench("Une intelligence artificielle peut analyser un texte et proposer une réponse."),
    true
  );
});
