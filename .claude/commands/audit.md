---
description: Audit du code TaskFlow (lisibilité, organisation, risques données/sync)
---

Tu es un reviewer senior qui audite le code de TaskFlow (webapp React + Supabase, fichier unique `index.html`, voir `CLAUDE.md` pour le contexte).

## Objectif

Produire un rapport d'audit structuré, **factuel** (pas de blabla, des références `fichier:ligne`), couvrant **3 axes uniquement** :

### 1. Lisibilité / "spaghetti"
- Composants > 200 lignes, fonctions > 50 lignes, JSX imbriqué profond
- Duplication de logique (constantes, tris, helpers)
- Magic numbers, valeurs en dur sans constante nommée
- Code mort, variables inutilisées, imports non utilisés
- Mélange `style={{...}}` inline + classes CSS sur les mêmes composants
- Naming incohérent (ex. plusieurs states "modal" qui font des choses différentes)

### 2. Organisation / architecture
- Séparation logique métier ↔ UI : requêtes Supabase inline dans les composants vs service centralisé
- State global trop chargé dans `App` (trop de `useState`, trop de handlers)
- Logique de filtrage / tri non mémoïsée (`useMemo` manquant)
- Constantes / helpers dupliqués entre `index.html` et `supabase/functions/calendar-feed/index.ts` (catégories par défaut, priorités, `getCatInfo`)
- CSS : sectioning, classes orphelines, styles à extraire

### 3. Risques données / synchronisation Supabase ⚠️ (axe le plus critique)
Pour chaque écriture Supabase, vérifie :
- **Gestion d'erreur** : est-ce que `error` est lu ? sinon, l'UI ment à l'utilisateur si l'écriture échoue
- **Rollback optimistic UI** : si l'`await` échoue après `setTasks(...)`, l'état local diverge silencieusement de la DB
- **Atomicité** : boucles `for (const u of updates) await supabase...` (drag & drop, reset, swap) → si une seule échoue, positions/données incohérentes. Préférer `upsert` / RPC en 1 requête
- **Race conditions** : clics rapides successifs, drag pendant un toggle
- **Multi-device / multi-onglet** : pas de Supabase Realtime → données stale, last-write-wins, perte silencieuse
- **JSON columns** (`subtasks`) : modifs concurrentes écrasent l'array entier
- **Mode offline** : le SW renvoie `{error: 'offline'}` mais le client ne lit jamais `error` → data loss garantie hors-ligne
- **Pas de queue / outbox** pour rejouer les writes échoués
- **Sécurité** : clé `anon` exposée + RLS désactivé (mentionne le risque, pas la solution complète)
- **Backup** : pas d'export périodique des données

## Format du rapport

Pour chaque axe, lister les findings par **sévérité** :
- 🔴 **Critique** : risque de perte de données ou bug bloquant
- 🟠 **Important** : à corriger rapidement, dette qui s'aggrave
- 🟡 **Mineur** : nice-to-have, à faire au passage

Chaque finding :
```
🔴 Titre court
  - Où : index.html:1234 (et autres si pertinent)
  - Problème : 1-2 phrases
  - Fix proposé : 1 phrase concrète, actionnable
```

Termine par :
- **Top 3 priorités** (les findings à attaquer en premier, avec justification courte)
- **Évolution depuis le dernier audit** : si un fichier `.claude/audit-history.md` existe, lis-le et indique brièvement quels findings ont été résolus, lesquels persistent, et lesquels sont nouveaux. Sinon, mentionne juste "premier audit, pas d'historique".
- **Mise à jour de l'historique** : à la fin, ajoute une entrée datée dans `.claude/audit-history.md` (créer le fichier s'il n'existe pas) avec : date, nombre de findings par sévérité, top 3 priorités. Garder le fichier court (max 20 dernières entrées).

## Contraintes
- Ne propose **pas de refactor géant** : reste sur des findings isolés et actionnables
- Ne **modifie aucun fichier de code source** (uniquement `.claude/audit-history.md`)
- Ne lance **pas de commit / push** : c'est juste un rapport
- Sois concis : viser ~50-80 findings max au total, prioriser le signal sur le volume
