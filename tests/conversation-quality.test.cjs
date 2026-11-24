"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Knowledge = require("../docs/core/knowledge-engine.js");
const LoganAI = require("../docs/core/orchestrator.js");

const cases = [
  {
    question: "Qu'est-ce qu'un ordinateur ?",
    answer: "Un ordinateur est une machine électronique qui traite des informations.",
    variants: [
      "C'est quoi un ordinateur ?",
      "Pouvez-vous expliquer ce qu'est un PC ?",
      "Définis le mot ordinateur"
    ]
  },
  {
    question: "Qu'est-ce que l'intelligence artificielle ?",
    answer: "L'intelligence artificielle désigne des systèmes capables d'effectuer des tâches associées à l'intelligence humaine.",
    variants: [
      "C'est quoi une IA ?",
      "Expliquez l'intelligence artificielle",
      "Que signifie IA ?"
    ]
  },
  {
    question: "Qu'est-ce qu'Internet ?",
    answer: "Internet est un réseau mondial qui permet aux appareils d'échanger des informations.",
    variants: [
      "À quoi sert le web ?",
      "Explique ce qu'est Internet",
      "C'est quoi le réseau Internet ?"
    ]
  },
  {
    question: "Qu'est-ce qu'un logiciel ?",
    answer: "Un logiciel est un ensemble de programmes qui permettent à un appareil d'effectuer des tâches.",
    variants: [
      "C'est quoi une application informatique ?",
      "Expliquez le terme logiciel",
      "À quoi sert un programme ?"
    ]
  },
  {
    question: "Qu'est-ce qu'un bug informatique ?",
    answer: "Un bug est une erreur dans un programme qui provoque un comportement incorrect.",
    variants: [
      "Que signifie une erreur informatique ?",
      "C'est quoi un bogue ?",
      "Explique le mot bug"
    ]
  }
];

function createKnowledge() {
  const engine = Knowledge.createEngine();
  engine.setPairs(cases.map(({ question, answer }) => ({
    question,
    answer,
    words: Knowledge.normalizeWords(question)
  })));
  return engine;
}

test("évaluation de compréhension : retrouve la réponse sur plusieurs formulations françaises", () => {
  const engine = createKnowledge();
  let correct = 0;
  let total = 0;
  const failures = [];

  for (const item of cases) {
    for (const variant of item.variants) {
      total++;
      const answer = engine.respond(variant);
      if (answer === item.answer) correct++;
      else failures.push({ question: variant, expected: item.answer, received: answer });
    }
  }

  const accuracy = correct / total;
  assert.ok(
    accuracy >= 0.70,
    `Précision trop faible : ${correct}/${total} (${Math.round(accuracy * 100)}%). Échecs : ${JSON.stringify(failures)}`
  );
});

test("refuse une question sans rapport avec la base de connaissances", () => {
  const engine = createKnowledge();
  assert.equal(engine.respond("Quelle est la météo sur Mars demain ?"), null);
});

test("l'orchestrateur utilise le moteur neuronal si la base ne connaît pas la réponse", async () => {
  const engine = createKnowledge();
  const core = LoganAI.createCore({ fallback: () => "Réponse de secours." });
  core.registerEngine("knowledge", ({ message }) => engine.respond(message), 50);
  core.registerEngine("neural", async ({ message }) => `Réponse neuronale à : ${message}`, 10);

  const result = await core.respond("Comment fonctionne la photosynthèse ?");
  assert.equal(result.source, "neural");
  assert.match(result.text, /photosynthèse/);
});

test("une réponse connue passe avant le moteur neuronal", async () => {
  const engine = createKnowledge();
  let neuralCalls = 0;
  const core = LoganAI.createCore({ fallback: () => "Réponse de secours." });
  core.registerEngine("knowledge", ({ message }) => engine.respond(message), 50);
  core.registerEngine("neural", async () => {
    neuralCalls++;
    return "Réponse neuronale.";
  }, 10);

  const result = await core.respond("C'est quoi un ordinateur ?");
  assert.equal(result.source, "knowledge");
  assert.equal(neuralCalls, 0);
});

test("retrouve une réponse précise à une question sur l'intelligence artificielle avec exemple", () => {
  const engine = createKnowledge();
  engine.addPairs([{
    question: "Expliquez-moi ce qu'est une intelligence artificielle et donnez-moi un exemple concret.",
    answer: "Une intelligence artificielle est un système informatique conçu pour réaliser des tâches qui demandent habituellement certaines capacités humaines, comme reconnaître des images, comprendre du texte ou aider à prendre une décision. Par exemple, un assistant conversationnel peut répondre à des questions en analysant les mots d'un message."
  }]);
  const answer = engine.respond("Expliquez-moi ce qu'est une intelligence artificielle et donnez-moi un exemple concret.");
  assert.match(answer, /assistant conversationnel/);
});
