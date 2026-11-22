# Publier LoganAI sur Render

Ce dépôt contient un Blueprint Render dans `render.yaml`.

## Déploiement

1. Connectez votre compte GitHub à Render et autorisez l'accès au dépôt privé `leloganator-Gaming/LoganAI`.
2. Dans Render, créez un nouveau Blueprint et sélectionnez ce dépôt ainsi que la branche `main`.
3. Vérifiez que Render détecte le service `loganai` à partir de `render.yaml`.
4. Avant le déploiement, renseignez la variable secrète `LOGANAI_ACCESS_PASSWORD` dans les variables d'environnement du service. Choisissez un mot de passe long et unique. Ne le publiez jamais dans GitHub.
5. Lancez le déploiement. Render attribuera une adresse publique en HTTPS au service.
6. À l'ouverture du site, l'authentification HTTP demandera :
   - Identifiant : `loganai`
   - Mot de passe : la valeur définie dans `LOGANAI_ACCESS_PASSWORD`

La route `/healthz` est volontairement accessible sans authentification pour le contrôle de santé Render. Le reste du site et de l'API est protégé.

## Limites actuelles à connaître

- Le service utilise une instance gratuite : elle peut s'endormir après 15 minutes sans trafic et le premier chargement suivant peut prendre environ une minute.
- Le système de fichiers gratuit est éphémère. La base SQLite locale, l'historique et les souvenirs peuvent être perdus lors d'un redémarrage, d'une mise en veille ou d'un redéploiement. Ne stockez pas de données personnelles importantes.
- Le modèle texte n'est pas encore entraîné et le checkpoint n'est pas inclus dans Git. LoganAI restera donc en mode prototype jusqu'à un véritable entraînement.
- La mémoire actuelle est partagée par l'instance. C'est pourquoi le site est protégé par mot de passe et ne doit pas être diffusé publiquement à plusieurs utilisateurs avant la mise en place d'une authentification individuelle et d'une mémoire séparée par compte.
- Le déploiement n'est pas encore validé : il faut contrôler les journaux Render et tester le site après le premier build.

## Dépendances

Render utilise `requirements-render.txt`, qui installe les paquets PyTorch CPU pour éviter les dépendances GPU inutiles sur un serveur standard.
