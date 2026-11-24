# Architecture hybride de LoganAI

## Phase 1 — Socle d'orchestration (0.1.0)

Le noyau `docs/core/orchestrator.js` coordonne des moteurs spécialisés sans coupler leurs implémentations. Chaque moteur reçoit un message et un contexte, puis renvoie une réponse ou indique qu'il ne sait pas répondre. Les moteurs sont exécutés par priorité. Une erreur dans un moteur est isolée et ne bloque pas les suivants.

### Moteurs actuellement raccordés
- Conversation : réponses simples déterministes (salutations, remerciements, présentation).
- Connaissances : recherche dans le corpus français existant.
- Secours : réponse prudente lorsque les moteurs ne trouvent rien.

### Contrat d'un moteur
Un moteur est une fonction asynchrone ou synchrone recevant `{ message, context }`. Il peut renvoyer une chaîne, un objet `{ text, confidence }`, ou `null` lorsqu'il ne peut pas répondre. Il ne doit pas inventer une réponse pour remplir le silence.

### Limites actuelles
Cette phase ne crée pas un nouveau grand modèle, n'entraîne pas les poids, n'ajoute pas de recherche Internet et ne synchronise pas la mémoire locale. Le modèle ONNX existant reste expérimental. Les moteurs conversation et connaissances utilisent encore les fonctions et le corpus déjà présents dans l'application.

## Phase 2 — Extraction des moteurs (0.2.0)

Les fonctions de dialogue et de recherche dans la base française sont maintenant séparées du fichier principal de l'interface.

- `docs/core/conversation-engine.js` : réponses conversationnelles déterministes aux formulations courantes.
- `docs/core/knowledge-engine.js` : normalisation du français, synonymes, indexation et recherche pondérée dans le corpus.
- `docs/core/orchestrator.js` : sélectionne le moteur à interroger et fournit la réponse de secours.
- `docs/app.js` : interface, chargement du corpus, stockage local et raccordement des modules.

Le moteur de connaissances accepte l'ajout d'exemples issus de l'atelier d'auto-apprentissage, sans leur attribuer automatiquement le statut de connaissances vérifiées. Des tests Node couvrent les moteurs séparément.

### Limites maintenues
Le moteur de dialogue reste fondé sur des règles simples. Le moteur de connaissances effectue une recherche lexicale pondérée, pas une compréhension sémantique profonde. Le modèle ONNX n'est pas encore intégré comme moteur génératif de réponse : son entraînement et sa qualité restent expérimentaux.

## Phases suivantes
1. Définir des contrats et tests pour mémoire, raisonnement, apprentissage et outils.
2. Extraire les moteurs existants dans des modules séparés.
3. Ajouter une mémoire structurée avec contrôle de confidentialité et de persistance.
4. Construire un moteur de raisonnement avec étapes vérifiables et gestion explicite de l'incertitude.
5. Ajouter un moteur d'apprentissage évalué : aucune connaissance nouvelle ne sera publiée sans validation.
6. Déplacer les traitements qui nécessitent un calcul partagé vers un service serveur sécurisé ; ne jamais exposer de secret dans GitHub Pages.
