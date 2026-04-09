# TaskFlow — Webapp Todo-List personnelle

## Presentation

TaskFlow est une application web de gestion de taches personnelle, pensee pour un usage quotidien par un seul utilisateur. Elle permet d'organiser ses taches entre vie professionnelle (Pro) et personnelle (Perso), avec un systeme de priorites intelligentes, des deadlines avec alertes, des sous-taches, un calendrier mensuel, et un systeme de dependances entre taches. L'app est protegee par un code PIN a 6 chiffres.

**URL en production** : https://manu61202-source.github.io/task-dashboard/
**Repo GitHub** : https://github.com/manu61202-source/task-dashboard (branche `main`)

---

## Stack technique

| Element | Techno | Details |
|---------|--------|---------|
| Frontend | React 18 + Babel | Single-file `index.html`, transpilation dans le navigateur via Babel standalone |
| Backend | Supabase | Stockage des donnees uniquement (pas d'authentification Supabase) |
| Hosting | GitHub Pages | Deploiement automatique via GitHub Actions a chaque push sur `main` |
| Police | Outfit | Via Google Fonts (weights 300-800) |
| CDN | jsdelivr | **IMPORTANT** : utiliser `cdn.jsdelivr.net`, jamais `unpkg.com` (bloque sur GitHub Pages) |

### Dependances externes (CDN)
- React 18 + ReactDOM 18
- Supabase JS v2
- Babel standalone (transpilation JSX dans le navigateur)
- Google Fonts : Outfit

---

## Structure du projet

```
/
├── index.html              # Fichier unique contenant TOUT le code (HTML + CSS + JS/React)
├── serve.js                # Serveur Node.js local pour le developpement (port 3000)
├── CLAUDE.md               # Ce fichier — documentation du projet
├── .github/
│   └── workflows/
│       └── deploy.yml      # CI/CD GitHub Actions → deploy auto sur GitHub Pages
└── .claude/
    └── launch.json         # Config preview pour Claude Code (lance serve.js)
```

> **Point cle** : Toute l'application est dans `index.html` (~2000+ lignes). Il n'y a pas de build step, pas de bundler, pas de node_modules. Le fichier contient le CSS, le HTML et tout le code React/JSX.

---

## Supabase

- **Project ID** : `krtkwxowuwqmqijcsbvv`
- **URL** : `https://krtkwxowuwqmqijcsbvv.supabase.co`
- **RLS** : desactive (app mono-utilisateur protegee par PIN)
- Le client Supabase est initialise dans un `<script>` classique **AVANT** le bloc Babel (sinon erreur `createClient`)

### Tables

| Table | Role | Colonnes principales |
|-------|------|---------------------|
| `tasks` | Stocke toutes les taches | `id`, `text`, `detail`, `category`, `priority`, `deadline`, `blocked_by`, `done`, `position`, `subtasks` (JSON), `scope`, `updated_at` |
| `app_config` | Configuration de l'app | `key` / `value` — cles utilisees : `pin` (code PIN), `custom_categories` (categories JSON) |
| `user_data` | Donnees utilisateur | (utilisee pour extensions futures) |
| `app_html` | Stockage HTML | (utilisee pour extensions futures) |

### Schema de la table `tasks`
- `text` : titre de la tache (obligatoire)
- `detail` : description detaillee (optionnel)
- `category` : ID de la categorie (ex: `travail`, `sport`)
- `priority` : `critique` / `urgent` / `moyen` / `faible`
- `deadline` : date au format `YYYY-MM-DD` (optionnel)
- `blocked_by` : ID d'une autre tache dont celle-ci depend (optionnel)
- `done` : booleen (false par defaut)
- `position` : entier pour l'ordre d'affichage
- `subtasks` : tableau JSON `[{id, text, done}]`
- `scope` : `pro` ou `perso` (derive de la categorie)

---

## Securite

- Acces protege par un **code PIN a 6 chiffres**
- PIN stocke dans `app_config` (cle `pin`), par defaut `123456`
- Changement du PIN : l'ancien code est requis avant de pouvoir en definir un nouveau
- Verrouillage manuel disponible via le menu parametres

---

## Architecture du code (index.html)

### Organisation par sections

| Section | Lignes (~) | Contenu |
|---------|-----------|---------|
| HTML head + meta | 1-10 | Viewport, favicon, fonts |
| CSS complet | 11-770 | Variables, animations, composants, responsive |
| Body + root div | 774-776 | Point de montage React |
| Init Supabase | 781-789 | Creation du client (avant Babel) |
| Script Babel/JSX | 791-2066 | Tout le code React |

### Composants React

| Composant | Role |
|-----------|------|
| `PinScreen` | Ecran de deverrouillage avec pave numerique |
| `TaskModal` | Formulaire de creation/edition d'une tache |
| `PinChangeModal` | Modal de changement du PIN (ancien code requis) |
| `TaskFlowLogo` | Logo SVG inline avec degrade orange, utilise sur PIN screen et header |
| `CategoryManagerModal` | Gestion des categories (ajout/suppression/edition inline avec emoji picker) |
| `TaskCard` | Affichage d'une tache individuelle (checkbox, tags, actions, sous-taches) |
| `CalendarView` | Vue calendrier mensuel avec points de couleur par priorite |
| `ConfirmDialog` | Popup de confirmation avant suppression |
| `Toast` | Notification temporaire en bas d'ecran |
| `App` | Composant racine, gere tout le state et la logique metier |

---

## Fonctionnalites existantes

### Gestion des taches
- **Creation/edition** via un formulaire modal (titre, detail, categorie, priorite, deadline, tache bloquante, sous-taches)
- **Suppression** avec confirmation (popup avec fond flou)
- **Checkbox** pour marquer une tache comme faite (effet de barre + opacite reduite)
- **Sous-taches** : checklist integree avec barre de progression, ajout/suppression/toggle inline

### Scope Pro / Perso
- Bascule entre le scope "Pro" et "Perso" via un toggle en haut
- Chaque scope a ses propres categories
- Les taches sont filtrees selon le scope actif

### Categories personnalisables
- Categories par defaut : Travail, Entretiens, Admin (Pro) / Appart, Italien, etc. (Perso)
- Chaque categorie a un **emoji** (selectionnable via un picker de 36 emojis) et un **label**
- Ajout/suppression/edition de categories dans le gestionnaire
- **Edition inline** : clic sur ✏️ → l'emoji et le label deviennent editables, validation par ✓ ou Enter, annulation par × ou Escape. L'id de la categorie ne change pas
- Confirmation avant suppression (popup avec fond flou)
- Stockees en JSON dans `app_config`

### Priorites et escalade automatique
- 4 niveaux : Critique (rouge), Urgent (orange), Moyen (jaune), Faible (vert)
- **Escalade automatique** : si une tache est en retard → priorite escaladee a "critique" ; si c'est aujourd'hui → escaladee a "urgent" (indicateur ⬆ affiche)

### Deadlines et alertes
- Affichage contextuel : "En retard (Xj)", "Aujourd'hui", "Demain", "Dans Xj"
- Taches en retard : bordure rouge sur la carte
- **Notifications navigateur** : 1 notification max par jour (persistee via `localStorage` cle `lastNotifDate`), couvre les taches en retard ET du jour, resume type "X tache(s) en retard, Y tache(s) pour aujourd'hui". Verification toutes les heures

### Dependances entre taches
- Une tache peut etre **bloquee par** une autre tache
- Tache bloquee : icone 🔒, opacite reduite (45%), checkbox desactivee
- Deblocage automatique quand la tache bloquante est terminee

### Recherche et filtres
- **Barre de recherche** : recherche texte dans le titre, detail, sous-taches, deadline formatee, label de categorie
- **Filtre temporel** : Tout / Aujourd'hui / Demain / 7 jours
- **Filtre categorie** : dropdown avec toutes les categories du scope actif
- **Filtre priorite** : dropdown par niveau
- **Filtre "Faites"** : toggle pour afficher uniquement les taches completees
- **Tri par priorite** : bouton pour trier par criticite

### Vues
- **Vue Liste** : affichage en cartes avec toutes les interactions
- **Vue Calendrier** : grille mensuelle avec navigation, points colores par priorite, checkbox pour cocher/decocher directement

### Drag & Drop
- **Reordonnancement** des taches par glisser-deposer (handle ⋮⋮ a gauche)
- Mouvement **vertical uniquement** (custom, pas l'API HTML5)
- Support **souris et tactile**
- Met a jour le champ `position` dans Supabase

### Actions mobiles (Swipe)
- Sur mobile (<500px) : glissement horizontal sur une tache pour reveler les boutons **Modifier** (bleu) et **Supprimer** (rouge)
- Desactive sur desktop
- Desactive sur les taches completees
- **Protection anti-conflit** : un flag `isDraggingRef` partage entre drag & drop et swipe desactive le swipe quand un drag est en cours. Le swipe utilise aussi un flag `active` dans `touchRef` pour ignorer les touchmove/touchend orphelins. Les boutons swipe sont masques via CSS (`:has(.custom-dragging)`) pendant le drag pour eviter la transparence

### Pagination des taches completees
- Seules les 3 premieres taches completees sont visibles
- Bouton "Voir plus" pour afficher +10 taches supplementaires

### Boutons d'action (desktop)
- 4 boutons uniformes (32x32px, fond gris clair) :
  - ▲ / ▼ pour monter/descendre l'ordre
  - ✏️ pour modifier
  - ✕ pour supprimer
- Groupes en deux colonnes verticales

### Stats en haut de page
- 4 cartes : En retard (rouge), Aujourd'hui (orange), Cette semaine (bleu), Faites aujourd'hui (vert)
- Cliquables pour filtrer rapidement

---

## Design system

### Logo
- Logo SVG inline (`TaskFlowLogo` composant) : icone carree arrondie avec degrade orange (`#E8630A` → `#F59E0B`) et checkmark blanc, suivi du texte "TaskFlow" en degrade
- Utilise sur : ecran PIN (taille 44), header app (taille 28), favicon (SVG data URI)

### Couleurs
- **Accent principal** : orange `#E8630A`
- **Fond** : blanc casse `#FAFAF7`
- **Cartes** : blanc pur `#FFFFFF`
- **Texte** : presque noir `#1A1A1A`
- **Pro** : bleu `#2563EB`
- **Perso** : vert `#059669`
- **Priorites** : rouge (critique), orange (urgent), jaune (moyen), vert (faible)

### Typographie
- Police : Outfit (sans-serif)
- Titres : 28px, weight 800
- Corps : 14px, weight 500
- Labels : 12px, weight 700, uppercase

### Rayons de bordure
- Grand : 14px (`--radius`)
- Moyen : 10px (`--radius-sm`)
- Petit : 7px (`--radius-xs`)

### Animations
- `fadeIn` : apparition en fondu avec leger deplacement vertical
- `slideUp` : apparition depuis le bas (modals)
- `scaleIn` : zoom in depuis le centre
- `shake` : tremblement horizontal (erreur PIN)

---

## Responsive

- **Breakpoint principal** : `500px`
  - Mobile (<500px) : swipe actions, modal plein ecran depuis le bas (flex-column avec scroll + boutons sticky), vue toggle inline
  - Desktop (>500px) : boutons d'action visibles, modal centree, layout plus aere
- `box-sizing: border-box` sur `.form-input` et `.modal` pour eviter les debordements
- **Breakpoint secondaire** : `400px` — padding reduits, taille PIN adaptee

---

## Git workflow

- Toujours demander confirmation avant commit/push
- Indiquer sur quelle branche on commit
- CI/CD : push sur `main` → deploy automatique via GitHub Actions sur GitHub Pages
- **Mettre a jour ce CLAUDE.md** a chaque changement significatif de l'app

---

## Points d'attention

### Architecture
- **Fichier unique** : tout le code est dans `index.html` (~2000+ lignes). Ca fonctionne pour une app de cette taille mais ca peut devenir difficile a maintenir si ca grossit beaucoup
- **Transpilation Babel dans le navigateur** : pas de build step, ce qui est pratique mais ajoute du poids au chargement initial
- **Init Supabase** : le client DOIT etre initialise dans un `<script>` classique AVANT le script Babel, sinon `createClient` n'est pas defini

### UX
- Le drag & drop est custom (pas l'API native HTML5) pour avoir un mouvement vertical uniquement et un bon support tactile
- Le swipe et le drag coexistent sur mobile grace a `isDraggingRef` qui desactive le swipe pendant un drag en cours
- L'emoji picker dans le gestionnaire de categories est une grille maison (36 emojis predefinis), pas un picker natif OS
- Sur mobile, les boutons du formulaire (Annuler/Ajouter) sont sticky en bas du modal pour rester visibles meme quand le formulaire est long

### Donnees
- **RLS desactive** sur Supabase : l'app est protegee uniquement par le PIN cote client. La cle Supabase `anon` est exposee dans le code source. C'est acceptable pour un usage personnel mais pas pour une app multi-utilisateur
- Les categories custom sont stockees en JSON dans `app_config` — pas de table dediee

---

## Roadmap / Idees futures

- (a definir avec l'utilisateur)
