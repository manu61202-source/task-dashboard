# TaskFlow — Webapp Todo-List personnelle

## Stack
- **Frontend** : Single-file `index.html` avec React 18 + Babel (via CDN jsdelivr)
- **Backend** : Supabase (data sync uniquement, pas d'auth)
- **Hosting** : GitHub Pages
- **Repo** : https://github.com/manu61202-source/task-dashboard (branche `main`)

## Supabase
- **Project ID** : krtkwxowuwqmqijcsbvv
- **URL** : https://krtkwxowuwqmqijcsbvv.supabase.co
- **Tables** : `tasks` (principale), `app_config` (stocke le PIN), `user_data`, `app_html`
- **RLS** : désactivé (app mono-utilisateur protégée par PIN)
- Le client Supabase est initialisé dans un `<script>` classique AVANT Babel (sinon erreur createClient)

## Sécurité
- Accès protégé par un code PIN à 6 chiffres (stocké dans `app_config`, clé `pin`)
- PIN par défaut : `123456`, modifiable dans les paramètres de l'app

## Features actuelles (v1)
- Catégories pro/perso avec filtres
- Priorités (critique/urgent/moyen/faible) avec escalade automatique selon les deadlines
- Deadlines avec alertes (en retard, aujourd'hui)
- Dépendances entre tâches (blocked_by)
- Drag & drop pour réordonner
- Sous-tâches / checklist par tâche
- Vue calendrier mensuel
- Notifications navigateur pour les deadlines
- Design light theme, police Outfit, accent orange (#E8630A)

## Git workflow
- Toujours demander confirmation avant commit/push
- Indiquer sur quelle branche on commit
- Site GitHub Pages : https://manu61202-source.github.io/task-dashboard/

## CDN
- IMPORTANT : utiliser jsdelivr (cdn.jsdelivr.net), PAS unpkg.com (bloqué sur GitHub Pages)
