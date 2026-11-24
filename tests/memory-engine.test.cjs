"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Memory = require("../docs/core/memory-engine.js");

function fixture(initial = {}) {
  let data = { messages: [], memories: [], ...initial };
  const store = Memory.createMemoryStore(() => structuredClone(data), (next) => { data = structuredClone(next); });
  return { store, read: () => data };
}

test("migre les anciennes notes texte sans perdre leur contenu", () => {
  const { store, read } = fixture({ memories: ["Aime les réponses courtes"] });
  assert.equal(store.list().length, 1);
  assert.equal(store.list()[0].text, "Aime les réponses courtes");
  assert.equal(store.list()[0].type, "note");
  assert.ok(Array.isArray(read().memoryItems));
});

test("enregistre séparément les préférences et les notes", () => {
  const { store } = fixture();
  assert.equal(store.add("preference", "Préfère les explications simples").type, "preference");
  assert.equal(store.add("note", "Projet de robotique").type, "note");
  assert.equal(store.list().length, 2);
});

test("refuse les catégories invalides et les données sensibles", () => {
  const { store } = fixture();
  assert.equal(store.add("password", "abc123"), null);
  assert.equal(store.add("note", "Mon mot de passe est abc123"), null);
  assert.equal(store.add("note", "contact@example.com"), null);
  assert.equal(store.add("note", "x".repeat(501)), null);
  assert.equal(store.list().length, 0);
});

test("permet la suppression ciblée et l'effacement complet", () => {
  const { store } = fixture();
  const first = store.add("note", "Projet de robotique");
  store.add("preference", "Réponses en français");
  assert.equal(store.remove(first.id), true);
  assert.equal(store.list().length, 1);
  store.clear();
  assert.equal(store.list().length, 0);
});

test("ne révèle les notes que pour une demande explicite de rappel", () => {
  const { store } = fixture();
  store.add("preference", "Préfère le français");
  assert.equal(store.respond("Bonjour"), null);
  assert.match(store.respond("Que sais-tu de moi ?"), /Préfère le français/);
});
