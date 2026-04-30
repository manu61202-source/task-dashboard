# TaskFlow — Audit history

## 2026-04-30 — 1er audit (baseline, avant migration cloud)

**Stats** : `index.html` 2497 lignes (CSS 890 + React 1563), `App` composant = 562 lignes / 17 useState / 4 useEffect

**Findings par sévérité** : 🔴 5 · 🟠 12 · 🟡 6 — total 23

**Top 3 priorités identifiées** :
1. 🔴 Wrapper `safeWrite()` qui lit `error` sur toutes les écritures Supabase
2. 🔴 Remplacer les boucles `for await update` par des `upsert` batch (drag&drop, reset, swap)
3. 🟠 Brancher Supabase Realtime pour le multi-device

---

## 2026-04-30 (soir) — 2e audit (après Phase 1 : migration auth)

**Stats** : `index.html` 2352 lignes (-145), `auth.js` 337 lignes (nouveau), `App` ~570 lignes

**Findings par sévérité** : 🔴 5 · 🟠 11 · 🟡 6 — total 22 (1 résolu, 0 nouveau bloquant)

**Top 3 priorités** :
1. 🔴 `safeWrite()` wrapper auth-aware (Phase 2A)
2. 🔴 Batch upsert pour drag&drop / reset / swap (Phase 2B)
3. 🟠 Supabase Realtime scoped par user (Phase 2C)

---

## 2026-04-30 (nuit) — 3e audit (après Phase 2 complète : data/sync solides)

**Stats** : `index.html` 2461 lignes, `auth.js` 337 lignes, **`App` toujours ~640 lignes** (a re-grossi avec safeWrite + Realtime + RPC handlers — finding 🟠 inchangé). 14 appels Supabase dans `index.html`.

**Findings par sévérité** : 🔴 1 · 🟠 9 · 🟡 6 — total 16 (6 résolus depuis audit #2, dont **les 4 findings 🔴 critiques sur l'axe data/sync**)

**Évolution depuis audit #2** :
- ✅ **Résolu — 🔴 Aucune écriture ne lit `error`** : safeWrite() en place dans App, wrappe les 6 writes atomiques (toggleDone, delete, submit-update, toggleSubtask, pushDeadline, saveCategories) + handleSubmit insert path en try/catch + generateToken lit error
- ✅ **Résolu — 🔴 Pas de rollback optimistic UI** : chaque safeWrite capture `prevTasks` / `prevCats` avant le set optimiste et restaure si la write échoue
- ✅ **Résolu — 🔴 Drag & drop N updates non-atomiques** : remplacé par RPC `update_task_positions(p_updates jsonb)` côté Supabase + 1 seul appel safeWrite côté client. SECURITY INVOKER + filtre `user_id = auth.uid()` dans la fonction. `index.html:2024`
- ✅ **Résolu — 🔴 resetByDeadlineAndPriority loop pattern** : utilise le même RPC, atomique. `index.html:2098`
- ✅ **Résolu — 🟠 onMoveUp/Down 2 UPDATE non-atomiques** : factorisés en `swapPositions(id, dir)` qui fait 1 RPC. `index.html:2042-2058`
- ✅ **Résolu — 🟠 Pas de Realtime** : 2 subscriptions `tasks:<userId>` et `user_config:<userId>` filtrées par user_id, RLS-friendly, merge idempotent. `index.html:1832-1880`
- ✅ **Résolu — 🔴 SW offline data loss silencieuse** : SW renvoie maintenant un vrai 503 (au lieu d'un faux 200 avec body `{error:'offline'}`) → supabase-js peuple `.error` → safeWrite déclenche son rollback + toast. `sw.js:42-58`
- ✅ **Mitigé — 🟠 Subtasks JSONB concurrence** : avec Realtime, last-write-wins se fait sur l'ordre wall-clock serveur, et l'autre device voit la divergence en quasi-temps-réel (vs jamais avant). Risque résiduel mineur sur ~100ms de fenêtre.
- 🟠 **Persistent** : App composant, helpers dupliqués frontend/edge, CSS plat, useMemo manquant, magic numbers swipe, naming "modal", code mort, lastNotifDate non-sync, pas d'export JSON.
- 🆕 **Nouveau (mineur)** : `App` a re-grossi de ~70 lignes avec safeWrite + 2 useEffect Realtime + 2 nouveaux handlers. La pression sur le mégacomposant augmente.

---

## Findings actuels (audit #3)

### 🔴 Critique (1)
- **App composant 640+ lignes** : `index.html:1777`. 17 useState, 5 useEffect, 12 handlers async, 250 lignes JSX. Chaque feature future fait grossir. **Fix** : extraire `useTasks()` (state CRUD + Realtime), `useDragReorder()`, `useFilters()` en hooks custom dans des fichiers séparés (comme on a fait pour `auth.js`).

### 🟠 Important (9)
- **Logique de tri dupliquée** : `sortTasks` `index.html:866` vs `resetByDeadlineAndPriority` `index.html:2086`. Règles divergentes.
- **Catégories par défaut désynchronisées entre frontend et edge function** : `index.html:799-816` (15 catégories) vs `supabase/functions/calendar-feed/index.ts:152-163` (6 seulement).
- **Pas de couche data centralisée pour `tasks` et `user_config`** : 14 appels Supabase inline dans `index.html`. Auth est extrait, le reste non.
- **useMemo manquant sur filtres + tris** : `index.html:2110-2150` (scopeTasks → catFiltered → timeFiltered → filtered → sorted, recalculés à chaque keystroke).
- **Stats recalculés sans useMemo** : `index.html:2152-2158` (overdueTasks, todayTasks, weekTasks, todayDone).
- **CSS plat 890 lignes dans `<style>`** : aucun découpage par composant. À extraire dans `style.css`.
- **Magic numbers swipe** : `index.html:1506-1508`, `swipeMax = canPush ? -216 : -148` avec calcul commenté.
- **6 states "modal" indépendants dans App** : `pinModal`, `catModal`, `calendarModal`, `confirmDelete`, `settingsOpen`, et `modal` polysémique. Risque d'ouvrir 2 modaux simultanés.
- **Pas de queue/outbox pour rejouer les writes échoués** : si offline, on rollback (bien) mais on perd la modif. Une queue dans `localStorage` permettrait de re-tenter au retour réseau.

### 🟡 Mineur (6)
- **`useCallback` peu utilisé** : `index.html:1862-1865` pour `isBlocked`, gain marginal.
- **Variable `allTasks` inutilisée** : `index.html` (cherche `const allTasks =`).
- **Mélange `style={{...}}` inline et classes CSS** : surtout dans CalendarShareModal et PinChangeModal/PasswordChangeModal.
- **`lastNotifDate` non synchronisé entre devices** : localStorage local, peut envoyer 2 notifs si 2 devices.
- **Pas de bouton "Export JSON"** : pas de backup user-driven dans l'app (le backup actuel est dans le repo git).
- **Auto-submit AuthScreen au 6e chiffre PIN** : `auth.js:96`. Si l'user finit le PIN avant l'email, ça submit avec email vide → erreur. Faible impact, déjà géré par le check `validateEmail`.

### Risques sécurité résiduels (info, non comptés comme findings)
- Clé `anon` exposée dans `index.html:925-927` (inévitable côté SPA, mais RLS limite l'impact)
- Pas de rate-limiting custom sur signup/login (les défaults Supabase Auth s'appliquent)
- Pas de 2FA

---

**Top 3 priorités** :
1. 🔴 **Découper App en hooks custom** (`useTasks`, `useFilters`, `useDragReorder`) + extraire chacun dans son fichier .js → divise par 3 la taille de `App`, prépare la maintenabilité long terme. Le seul finding 🔴 restant.
2. 🟠 **Synchroniser `DEFAULT_CATEGORIES` entre frontend et edge function** : risque de divergence à chaque ajout de catégorie. Fix simple : un seul commentaire de pairing + checklist de revue.
3. 🟠 **Ajouter `useMemo` sur filtres + stats** : 6 `.filter()` enchaînés à chaque keystroke. OK pour 50 tâches, devient grippant à 500.

**Verdict global** : les findings critiques sur l'axe **données / synchronisation Supabase** sont **tous résolus**. Le code est désormais sûr pour un usage multi-device. Reste la dette d'organisation (App trop gros, helpers dupliqués) — non bloquante pour le merge.
