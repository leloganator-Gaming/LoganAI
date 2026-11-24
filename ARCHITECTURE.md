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

## Phases suivantes
1. Définir des contrats et tests pour mémoire, raisonnement, apprentissage et outils.
2. Extraire les moteurs existants dans des modules séparés.
3. Ajouter une mémoire structurée avec contrôle de confidentialité et de persistance.
4. Construire un moteur de raisonnement avec étapes vérifiables et gestion explicite de l'incertitude.
5. Ajouter un moteur d'apprentissage évalué : aucune connaissance nouvelle ne sera publiée sans validation.
6. Déplacer les traitements qui nécessitent un calcul partagé vers un service serveur sécurisé ; ne jamais exposer de secret dans GitHub Pages.
