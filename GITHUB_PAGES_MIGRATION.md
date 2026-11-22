# LoganAI — migration GitHub Pages

Cette branche prépare une version navigateur autonome sans supprimer le serveur FastAPI existant.

## Architecture cible

- GitHub Pages sert les fichiers statiques de `docs/` et le modèle ONNX.
- ONNX Runtime Web exécute le Transformer dans le navigateur via WebAssembly.
- La mémoire et l'historique sont conservés dans le stockage local du navigateur.
- GitHub Actions entraîne le petit modèle à partir du corpus original puis l'exporte lors de la publication.
- Aucun serveur de discussion permanent n'est utilisé.

## État de cette étape

- [x] Interface statique dans `docs/`.
- [x] Mémoire et historique locaux.
- [x] Code d'inférence ONNX Runtime Web.
- [x] Script d'export du Transformer vers ONNX.
- [x] Workflow d'entraînement et de publication GitHub Pages.
- [ ] Exécution réelle du workflow et validation de l'export sur GitHub.
- [ ] Tests sur plusieurs navigateurs et appareils.

Le corpus est très limité et l'entraînement automatique initial ne produit qu'un prototype. Les réponses peuvent être incorrectes ou incohérentes. Le modèle n'est pas un assistant généraliste.

## Publication

Après fusion de la branche dans `main`, GitHub Actions entraîne le modèle, crée `docs/model.onnx` dans l'artefact de publication, puis déploie les fichiers. La source GitHub Pages du dépôt doit être réglée sur **GitHub Actions**.

Le fichier ONNX est généré pendant le workflow et n'est pas commité dans le dépôt. Ne supprimez pas `render.yaml`, `loganai/api.py` ni les autres fichiers serveur tant que la version navigateur n'a pas été vérifiée.
