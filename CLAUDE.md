# Projet : Ginkoyes V2

Ce projet est géré par **DashClaude**.


## Base de données projet

Le fichier `.dashclaude-data.json` à la racine contient la base de données du projet (identifiants, clés API, mots de passe, etc.).
- Format : tableau JSON, chaque entrée suit le schéma `{ id, category, key, value, sensitive, createdAt, updatedAt }`
- Tu peux lire et écrire dans ce fichier pour stocker ou retrouver des informations du projet.

## Structure des fichiers .dashclaude/

```
.dashclaude/
├── rapports/          # Rapports de fin de session
│   └── YYYY-MM-DD_rapport.md
├── sessions/          # Journaux détaillés de session
│   └── YYYY-MM-DD_session.md
└── notes/             # Notes techniques libres
    └── *.md
```

### Rapports (`.dashclaude/rapports/YYYY-MM-DD_rapport.md`)
Résumé de fin de session : tâches complétées, problèmes rencontrés, prochaines étapes.

### Sessions (`.dashclaude/sessions/YYYY-MM-DD_session.md`)
Journal détaillé : commandes exécutées, fichiers modifiés, décisions prises.

### Notes (`.dashclaude/notes/*.md`)
Notes techniques libres (architecture, procédures, etc.).

## Consignes de session

- **Début de session** : lis le dernier fichier dans `.dashclaude/rapports/` pour reprendre le contexte.
- **Fin de session** : crée un rapport (`rapports/YYYY-MM-DD_rapport.md`) et un journal (`sessions/YYYY-MM-DD_session.md`) pour que le contexte soit retrouvé lors de la prochaine session.
