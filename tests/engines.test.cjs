"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Conversation = require("../docs/core/conversation-engine.js");
const Knowledge = require("../docs/core/knowledge-engine.js");

test("le moteur conversation reconnaît les salutations en français", () => {
  assert.match(Conversation.respond("Bonjour LoganAI"), /Bonjour/);
  assert.equal(Conversation.respond("une question inconnue"), null);
});

test("le moteur de connaissances normalise les accents et synonymes", () => {
  assert.deepEqual(Knowledge.normalizeWords("Mon PC est rapide"), ["ordinateur", "rapide"]);
});

test("le moteur de connaissances retrouve une réponse pertinente", () => {
  const engine = Knowledge.createEngine();
  engine.setPairs([
    {question:"Comment fonctionne un ordinateur ?",answer:"Il traite des informations."},
    {question:"Pourquoi le ciel est bleu ?",answer:"La lumière est diffusée."}
  ]);
  assert.equal(engine.respond("Explique le fonctionnement de mon PC"), "Il traite des informations.");
  assert.equal(engine.size, 2);
});

test("le moteur de connaissances refuse une question ambiguë ou inconnue", () => {
  const engine = Knowledge.createEngine();
  engine.setPairs([{question:"Comment fonctionne un ordinateur ?",answer:"Il traite des informations."}]);
  assert.equal(engine.respond("Quelle est la météo demain ?"), null);
  assert.equal(engine.addPairs([{question:"Qu'est-ce qu'un réseau ?",answer:"Un ensemble d'appareils."}]), 1);
  assert.equal(engine.size, 2);
});
