# TaskFlow — Audit history

## 2026-04-30 — 1er audit (baseline, avant migration cloud)

**Stats** : `index.html` 2497 lignes (CSS 890 + React 1563), `App` composant = 562 lignes / 17 useState / 4 useEffect

**Findings par sévérité** : 🔴 5 · 🟠 12 · 🟡 6 — total 23

**Top 3 priorités identifiées** :
1. 🔴 Wrapper `safeWrite()` qui lit `error` sur toutes les écritures Supabase
2. 🔴 Remplacer les boucles `for await update` par des `upsert` batch (drag&drop, reset, swap)
3. 🟠 Brancher Supabase Realtime pour le multi-device

**Note** : audit produit avant la migration vers projet Supabase dédié + auth Supabase.

---

## 2026-04-30 (soir) — 2e audit (après Phase 1 : migration auth)

**Contexte** : migration en cours. Step A (backup), Step B (schéma + edge function), Step C (auth UI) **terminés**. Step D-G (signup user, import data, validation, cleanup ancien projet) et Phase 2 (safeWrite + batch upsert + Realtime) **pending**. Code pas encore merged sur `main` / déployé en prod.

**Stats** : `index.html` 2352 lignes (-145), `auth.js` 337 lignes (nouveau), `App` toujours ~570 lignes / 17 useState / 4 useEffect

**Findings par sévérité** : 🔴 5 · 🟠 11 · 🟡 6 — total 22 (1 finding résolu, 0 nouveau bloquant)

**Évolution depuis audit #1** :
- ✅ **Résolu** : `saveCategories` utilise maintenant `upsert` atomique (1 round-trip, plus de race)
- ✅ **Résolu** : PinScreen "code incorrect" sur erreur réseau → AuthScreen distingue les erreurs auth des erreurs réseau
- ✅ **Améliorations majeures non comptées comme findings** :
  - **RLS activé** sur le nouveau projet, policies par user_id en place → `tasks` et `user_config` "Restricted" (au lieu d'"Unrestricted")
  - Auth Supabase : email + PIN remplace le PIN global stocké en clair en DB
  - Backup JSON local des 50 tâches (commit `47da2ad`)
  - Premier découpage du spaghetti : auth extrait dans `auth.js` (-145 lignes dans `index.html`)
- 🟠 **Persistent** (Phase 2) : safeWrite, batch upsert (drag&drop, reset, swap), Realtime, SW offline data loss
- 🆕 **Nouveau** : auto-submit dans AuthScreen quand PIN atteint 6 chiffres (peut déclencher avant que l'user ait fini de taper l'email — mineur)

**Top 3 priorités** :
1. 🔴 `safeWrite()` wrapper auth-aware (Phase 2A) — non commencé
2. 🔴 Batch upsert pour drag&drop / reset / swap (Phase 2B) — non commencé
3. 🟠 Supabase Realtime scoped par user (Phase 2C) — non commencé
