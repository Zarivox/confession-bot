# 💬 Confession Bot

Bot Discord permettant d'envoyer des confessions anonymes dans un salon dédié via message privé.

## Fonctionnement

1. Un utilisateur ouvre les **MP du bot** et utilise la commande `/confession`
2. Il rédige son message dans l'option de la commande
3. Le bot poste la confession dans le salon configuré sous forme d'embed **anonyme**
4. Les membres peuvent voter avec ✅ ou ❌ pour donner leur avis
5. L'auteur reçoit une confirmation privée — personne ne sait que c'est lui

> La commande est bloquée dans les salons de serveur, elle ne fonctionne **qu'en MP**.

## Installation

### Prérequis

- [Node.js](https://nodejs.org/) v18+
- Un bot Discord créé sur le [Portail développeur](https://discord.com/developers/applications)

### 1. Cloner le projet

```bash
git clone https://github.com/Zarivox/confession-bot.git
cd confession-bot
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer les variables d'environnement

Crée un fichier `.env` à la racine en te basant sur `.env.example` :

```env
BOT_TOKEN=ton_token_ici
CLIENT_ID=ton_client_id_ici
CONFESSION_CHANNEL_ID=id_du_salon_ici
```

| Variable | Où la trouver |
|---|---|
| `BOT_TOKEN` | Portail développeur → Bot → Token |
| `CLIENT_ID` | Portail développeur → General Information → Application ID |
| `CONFESSION_CHANNEL_ID` | Clic droit sur le salon Discord → Copier l'identifiant |

### 4. Déployer la commande slash

```bash
npm run deploy
```

> Les commandes globales peuvent mettre jusqu'à **1 heure** à apparaître, mais c'est souvent instantané.

### 5. Lancer le bot

```bash
npm start
```

## Permissions requises

Dans le salon des confessions, le bot doit avoir :

- `Voir le salon`
- `Envoyer des messages`
- `Intégrer des liens` (embeds)
- `Ajouter des réactions`

## Structure du projet

```
confession-bot/
├── index.js              # Bot principal
├── deploy-commands.js    # Enregistrement de la commande slash
├── package.json
└── .env.example          # Modèle de configuration
```

## Stack

- [discord.js](https://discord.js.org/) v14
- Node.js ESM (`"type": "module"`)
