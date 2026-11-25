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
  assert.equal(engine.respond("Comment fonctionne mon PC ?"), "Il traite des informations.");
  assert.equal(engine.size, 2);
});

test("le moteur de connaissances refuse une question ambiguë ou inconnue", () => {
  const engine = Knowledge.createEngine();
  engine.setPairs([{question:"Comment fonctionne un ordinateur ?",answer:"Il traite des informations."}]);
  assert.equal(engine.respond("Quelle est la météo demain ?"), null);
  assert.equal(engine.addPairs([{question:"Qu'est-ce qu'un réseau ?",answer:"Un ensemble d'appareils."}]), 1);
  assert.equal(engine.size, 2);
});


const WebSynthesis = require("../docs/core/web-synthesis.js");

test("la synthèse maison sélectionne les phrases liées à la question et cite les sources", () => {
  const result = WebSynthesis.synthesize("Comment fonctionne le moteur solaire ?", [
    {title:"Énergie solaire",summary:"Les panneaux solaires convertissent la lumière du soleil en électricité grâce à des cellules photovoltaïques. Cette technologie est utilisée dans de nombreux bâtiments."},
    {title:"Énergie éolienne",summary:"Les éoliennes utilisent le vent pour produire de l'électricité dans les réseaux locaux."}
  ]);
  assert.match(result, /panneaux solaires/i);
  assert.match(result, /\[1\]/);
  assert.doesNotMatch(result, /éoliennes/i);
});

test("la synthèse maison écarte les phrases répétées", () => {
  const result = WebSynthesis.synthesize("ordinateur et processeur", [
    {summary:"Un ordinateur utilise un processeur pour exécuter des instructions et traiter les données."},
    {summary:"Un ordinateur utilise un processeur pour exécuter des instructions et traiter les données."}
  ]);
  assert.equal((result.match(/ordinateur utilise/g) || []).length, 1);
});

test("la synthèse maison gère les résultats vides", () => {
  assert.equal(WebSynthesis.synthesize("question", []), null);
});

test("le classificateur détecte les intentions temporelles, quantitatives et comparatives", () => {
  assert.equal(WebSynthesis.detectIntent("Quand cette technologie a-t-elle été créée ?"), "temporal");
  assert.equal(WebSynthesis.detectIntent("Combien coûte ce service ?"), "quantitative");
  assert.equal(WebSynthesis.detectIntent("Quelle est la différence entre ces modèles ?"), "comparison");
  assert.equal(WebSynthesis.detectIntent("Pourquoi ce système fonctionne ?"), "causal");
});

test("le détecteur signale des valeurs numériques divergentes", () => {
  const chosen = [
    {sentence:"Le service compte 120 utilisateurs actifs chaque mois.", terms:new Set(["service","compte","120","utilisateurs","actifs","chaque","mois"])},
    {sentence:"Le service compte 150 utilisateurs actifs chaque mois.", terms:new Set(["service","compte","150","utilisateurs","actifs","chaque","mois"])}
  ];
  assert.equal(WebSynthesis.detectDisagreement(chosen), true);
});
