# Guide de démarrage LoganAI

## 1. Installer le moteur texte sous Windows

Installez Python 3.11 ou plus récent. Dans le dossier du dépôt :

```powershell
py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Si PowerShell bloque l'activation, utilisez l'invite de commandes et lancez `.venv\Scripts\activate.bat`.

## 2. Créer les premiers poids de LoganAI

Le corpus original de départ se trouve dans `data/train_corpus.txt`. Il contient des dialogues français de démonstration et reste trop petit pour produire un assistant généraliste.

Commencez par un essai court :

```powershell
python -m loganai.training --steps 200 --batch-size 4
```

Puis poursuivez l'apprentissage en reprenant les poids et l'état de l'optimiseur :

```powershell
python -m loganai.training --steps 2000 --batch-size 4 --resume
```

Les pertes d'entraînement et de validation s'affichent dans le terminal. Une perte qui baisse indique que le modèle s'adapte au corpus ; cela ne prouve pas qu'il sait répondre correctement à des questions générales.

Les poids sont enregistrés dans `checkpoints/loganai.pt`. L'état permettant de reprendre l'entraînement est dans `checkpoints/loganai_training_state.pt`.

Pour enrichir le corpus, ajoutez des dialogues originaux au format :

```text
Utilisateur : Votre question
LoganAI : Une réponse exacte, claire et vérifiée.
```

Utilisez des textes originaux, autorisés ou du domaine public. N'ajoutez aucun mot de passe, donnée privée ou conversation personnelle sans autorisation. La qualité et la diversité des exemples sont plus importantes que leur quantité brute.

## 3. Charger le modèle sur le site Render

Le serveur Render ne reçoit pas automatiquement les fichiers créés sur votre ordinateur. Le checkpoint doit donc être transféré sur le serveur après l'entraînement. Le moyen le plus simple pour ce prototype est d'ajouter `checkpoints/loganai.pt` au dépôt GitHub, puis de laisser Render redéployer. Ne publiez pas `loganai_training_state.pt`, qui n'est pas nécessaire au fonctionnement du site.

Attention : un checkpoint créé avec une configuration différente peut être incompatible. Après toute modification de l'architecture ou de `loganai/config.py`, il faut réentraîner le modèle.

## 4. Démarrer l'interface Web en local

```powershell
uvicorn loganai.api:app --host 127.0.0.1 --port 8000
```

Ouvrez http://127.0.0.1:8000. L'historique et les souvenirs sont enregistrés dans `data/loganai.sqlite3`. La mémoire est distincte des poids neuronaux.

## 5. Entraîner Vision

Le modèle Vision actuel est expérimental : il apprend uniquement le débruitage d'images 64x64 non conditionnel. Il ne comprend pas les descriptions et ne fait pas de génération texte-vers-image.

## 6. Application Windows

Le wrapper Tauri se connecte au serveur Python. Il ne contient pas encore automatiquement Python, les dépendances et les poids.

## État actuel des capacités

- Texte : petit Transformer causal entraînable depuis une initialisation aléatoire.
- Tokenizer : UTF-8 byte-level, réversible.
- Corpus : premiers dialogues originaux en français, à enrichir et vérifier.
- Mémoire : stockage distinct des poids du modèle.
- Vision : débruiteur expérimental non conditionnel.
- Voix : fonctions vocales du navigateur.
- Desktop : wrapper Tauri nécessitant le moteur Python.
