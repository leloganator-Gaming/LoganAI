# Guide de démarrage LoganAI

## 1. Installer le moteur texte

Installez Python 3.11 ou plus récent. Dans le dossier du dépôt :

```powershell
py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Sur Windows, si PowerShell bloque l'activation, ouvrez une invite de commandes et utilisez `.venv\Scripts\activate.bat`.

## 2. Entraîner le modèle texte

```powershell
python -m loganai.training --steps 1000
```

Le corpus `data/demo_corpus.txt` est volontairement minuscule. Il valide le pipeline mais n'apprend pas les connaissances nécessaires à un assistant généraliste. Remplacez-le ou enrichissez-le avec des textes dont vous détenez les droits. Les poids sont créés localement dans `checkpoints/loganai.pt`.

## 3. Démarrer l'interface Web

```powershell
uvicorn loganai.api:app --host 127.0.0.1 --port 8000
```

Ouvrez http://127.0.0.1:8000. L'historique et les souvenirs sont enregistrés dans `data/loganai.sqlite3`. La mémoire n'est intégrée au prompt que si vous l'ajoutez volontairement dans l'onglet Mémoire.

## 4. Entraîner Vision

Créez le dossier `data/images/` et placez-y un ensemble d'images dont vous détenez les droits. Puis :

```powershell
python -m loganai.vision_training --steps 2000 --batch-size 8
```

Le modèle actuel apprend uniquement un débruitage d'images 64x64 non conditionnel. Il ne comprend pas les descriptions et ne fait pas encore de génération texte-vers-image. Cette étape nécessite un dataset d'images suffisant, une carte graphique et des essais. Le checkpoint est enregistré dans `checkpoints/loganai_vision.pt`.

## 5. Application Windows

Installez Node.js, Rust et les prérequis Tauri 2 pour Windows. Lancez le serveur Python dans un terminal, puis dans un second terminal :

```powershell
cd desktop
npm install
npm run dev
```

Pour créer un paquet Windows :

```powershell
npm run build
```

Le wrapper Desktop se connecte au serveur local. Ce premier paquet n'embarque pas encore automatiquement Python, les dépendances ni les poids : le moteur doit être installé et démarré séparément.

## État des capacités

- Conversation : petit Transformer causal entraînable, pas un assistant compétent à ce stade.
- Tokenizer : UTF-8 byte-level, réversible.
- Mémoire : stockage local contrôlé.
- Web : interface locale.
- Vision : entraînement de débruiteur et génération expérimentale non conditionnelle ; pas encore de compréhension sémantique.
- Voix : synthèse/reconnaissance du navigateur, selon sa prise en charge.
- Desktop : wrapper Tauri nécessitant le serveur local.
