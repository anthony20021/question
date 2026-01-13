# GuessLink - Jeu de questions avec IA

Application de jeu de questions en temps réel avec support de plusieurs providers IA.

## Installation

```bash
npm install
```

## Configuration

Créez un fichier `.env` à la racine du projet (voir `.env.example` pour un modèle).

### Services AI disponibles

Le système utilise une chaîne de fallback automatique entre 3 providers :

1. **OpenRouter** (Cloud) - Provider principal recommandé
2. **Ollama API** (Serveur distant) - Fallback secondaire
3. **Ollama** (Local) - Fallback final

### Variables d'environnement

#### Configuration serveur
- `PORT` : Port du serveur (défaut: 3001)
- `FRONTEND_URL` : URL du frontend (défaut: http://localhost:5173)

#### 1. OpenRouter (Cloud)
- `OPENROUTER_API_KEY` : Clé API OpenRouter (requis pour utiliser OpenRouter)

#### 2. Ollama API (Serveur distant)
- `OLLAMA_API_URL` : URL de l'API Ollama maison (défaut: http://87.91.77.59:3000)
- `OLLAMA_API_TOKEN` : Token d'authentification Bearer (optionnel mais recommandé)
- `OLLAMA_API_MODEL` : Modèle à utiliser (défaut: nemotron-3-nano:latest)

#### 3. Ollama (Local)
- `OLLAMA_URL` : URL de l'instance Ollama locale (défaut: http://localhost:11434)
- `OLLAMA_MODEL` : Modèle à utiliser en local (défaut: qwen2.5:7b-instruct)

## Démarrage

### Développement (frontend + serveur)
```bash
npm run dev:all
```

### Frontend uniquement
```bash
npm run dev
```

### Serveur uniquement
```bash
npm run server
```

### Production
```bash
npm run build
npm start
```

## Architecture des services AI

Le système teste automatiquement les providers dans l'ordre suivant :

1. **OpenRouter** : Si `OPENROUTER_API_KEY` est défini
2. **Ollama API** : Si `OLLAMA_API_URL` est accessible
3. **Ollama Local** : Si Ollama est installé et démarré localement

En cas d'erreur, le système bascule automatiquement vers le provider suivant disponible.

## Documentation API Ollama maison

L'API Ollama maison utilise les endpoints suivants :
- `GET /health` : Health check (route publique)
- `POST /api/generate` : Génération de texte (authentification requise)
- `POST /api/chat` : Chat conversationnel (authentification requise)
- `GET /api/models` : Liste des modèles (authentification requise)

Toutes les routes `/api/*` nécessitent un header `Authorization: Bearer VOTRE_TOKEN` si `OLLAMA_API_TOKEN` est configuré.
