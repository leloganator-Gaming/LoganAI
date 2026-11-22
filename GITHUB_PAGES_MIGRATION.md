# LoganAI — migration GitHub Pages

Cette branche prépare une version statique de LoganAI. Elle ne remplace pas le serveur FastAPI existant.

## Architecture cible

- GitHub Pages sert uniquement les fichiers statiques de `docs/`.
- Le modèle neuronal doit être converti vers un format utilisable dans le navigateur (ONNX Runtime Web ou runtime WebAssembly).
- L'inférence doit être effectuée sur l'appareil de chaque visiteur.
- La mémoire et l'historique de cette première version sont stockés localement dans le navigateur ; ils ne sont pas synchronisés entre appareils.
- GitHub Actions peut tester, entraîner ou convertir le modèle lors de tâches ponctuelles. Actions ne fournit pas un serveur de chat permanent.

## État de cette étape

- [x] Interface statique séparée dans `docs/`.
- [x] Mémoire locale du navigateur.
- [x] Workflow de publication GitHub Pages.
- [ ] Entraîner et vérifier un checkpoint exploitable.
- [ ] Exporter le modèle PyTorch vers ONNX avec des dimensions compatibles.
- [ ] Ajouter ONNX Runtime Web et le code d'inférence autoregressive.
- [ ] Tester sur navigateurs et appareils réels avant activation de la discussion.

La zone de discussion reste volontairement désactivée tant que le moteur neuronal n'est pas réellement intégré. Aucun faux message généré n'est affiché.

## Publication

Après fusion de cette branche dans `main`, le workflow `.github/workflows/pages.yml` publiera `docs/`. Dans les paramètres du dépôt, la source Pages doit être configurée sur **GitHub Actions** si ce n'est pas déjà le cas.

Ne supprimez pas `render.yaml`, `loganai/api.py` ou les autres fichiers serveur pendant la migration.