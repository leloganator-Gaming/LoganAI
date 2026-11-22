# LoganAI — migration GitHub Pages

Cette branche prépare une version navigateur autonome sans supprimer le serveur FastAPI existant.

## Architecture cible

- GitHub Pages sert les fichiers statiques de `docs/` et le modèle ONNX.
- ONNX Runtime Web exécute le Transformer dans le navigateur via WebAssembly.
- La mémoire et l'historique sont conservés dans le stockage local du navigateur.
- GitHub Actions entraîne le petit modèle à partir du corpus original puis l'exporte lors de la publication.
- Aucun serveur de discussion permanent n'est utilisé.

## État de validation

- [x] Interface statique dans `docs/`.
- [x] Mémoire et historique locaux.
- [x] Code d'inférence ONNX Runtime Web.
- [x] Script d'export du Transformer vers ONNX.
- [x] Contrôle de syntaxe JavaScript sur GitHub Actions.
- [x] Tests Python sur GitHub Actions.
- [x] Entraînement initial exécuté avec succès sur GitHub Actions.
- [x] Export ONNX exécuté avec succès.
- [x] Modèle ONNX chargé par ONNX Runtime Python et forme de sortie vérifiée : (1, 12, 256).
- [ ] Publication réelle sur GitHub Pages après fusion.
- [ ] Vérification du chargement ONNX Runtime Web dans un navigateur réel.
- [ ] Tests fonctionnels de conversation, mémoire et historique après publication.
- [ ] Tests sur ordinateur, téléphone et plusieurs navigateurs.

La validation actuelle confirme le pipeline Python et ONNX, mais ne remplace pas un test réel du site publié dans un navigateur.

## Limites connues

Le corpus est très limité et l'entraînement automatique initial ne produit qu'un prototype. Les réponses peuvent être incorrectes ou incohérentes. Le modèle n'est pas un assistant généraliste.

La mémoire et l'historique sont enregistrés dans le navigateur utilisé : ils ne sont pas synchronisés entre appareils et peuvent être perdus si les données du site sont effacées.

Cette version navigateur ne comprend pas encore les fonctions Vision, Voice et Desktop de l'ancienne architecture. Leur migration constitue un chantier distinct et ne doit pas être considérée comme incluse dans cette première publication.

## Publication

Après fusion de la branche dans `main`, GitHub Actions entraîne le modèle, crée `docs/model.onnx` dans l'artefact de publication, puis déploie les fichiers. La source GitHub Pages du dépôt doit être réglée sur **GitHub Actions**.

Après le déploiement, vérifier :
1. que la page s'ouvre en HTTPS ;
2. que le statut indique que le modèle navigateur est chargé ;
3. qu'un message reçoit une réponse ;
4. qu'une conversation reste présente après actualisation ;
5. qu'un souvenir ajouté reste présent après actualisation ;
6. que l'interface reste utilisable sur téléphone.

Ne supprimez pas `render.yaml`, `loganai/api.py` ni les autres fichiers serveur tant que la version navigateur n'a pas été vérifiée sur plusieurs appareils.
