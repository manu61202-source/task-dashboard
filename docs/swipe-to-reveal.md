# Swipe-to-reveal-actions — pattern réutilisable

UI mobile : une carte/ligne glisse horizontalement vers la gauche pour révéler progressivement des boutons d'action (Modifier, Supprimer, etc.) cachés derrière elle. Une seule ligne peut être ouverte à la fois (comportement type iOS Mail).

Ce doc est autonome : copie-colle dans n'importe quelle app React (ou adapte en vanilla JS, section plus bas) et ça marche.

---

## Démo en mots

- Tu mets le doigt sur la carte
- Tu glisses vers la gauche : la carte suit ton doigt en temps réel, les boutons apparaissent **progressivement** sous-jacents
- Tu lâches :
  - Si tu as glissé ≥ 50 px → la carte s'ouvre (snap à -148 px ou -216 px selon le nombre de boutons)
  - Sinon → la carte revient à 0
- Carte ouverte, tu glisses vers la droite ≥ 20 px → elle se referme
- Tu touches une **autre** carte (et tu glisses) → la première se referme automatiquement
- Si tu commences à scroller verticalement, le swipe horizontal ne s'active pas et la page scroll normalement

---

## 4 idées clés à comprendre

| # | Idée | Pourquoi |
|---|---|---|
| 1 | **Listener `touchmove` non-passif** (via `addEventListener({passive:false})`, PAS via `onTouchMove` React) | `preventDefault()` est ignoré sur les listeners passifs → impossible de bloquer le scroll vertical natif sinon |
| 2 | **DOM direct pendant la gesture, state React seulement au lâcher** | `setState` à chaque frame déclenche un re-render → lag perceptible. Manipuler `card.style.transform` directement = 60fps garanti |
| 3 | **`touch-action: pan-y` sur la ligne** | Dit au navigateur "laisse le scroll vertical natif, je gère l'horizontal". Combiné avec preventDefault dynamique = scroll bloqué seulement quand on swipe |
| 4 | **Boutons rendus en permanence, cachés par `overflow: hidden` du parent + z-index** | Permet la révélation progressive sans re-render. Le slide les expose naturellement |

---

## Implémentation React (complète)

### Composant `<SwipeRow>`

```jsx
import { useState, useRef, useEffect } from 'react';

/**
 * Une ligne qui se swipe horizontalement (gauche) pour révéler des boutons d'action.
 *
 * Props :
 *   - id          : identifiant unique de la ligne (utilisé pour l'auto-close cross-rows)
 *   - actions     : tableau de { label, onClick, color? } — boutons révélés au swipe
 *   - children    : contenu de la ligne (carte, item de liste, etc.)
 *   - disabled?   : si true, désactive le swipe (ex : ligne déjà "done")
 *   - mobileOnly? : si true, swipe actif seulement sous 500px de largeur (default: true)
 */
export function SwipeRow({ id, actions, children, disabled = false, mobileOnly = true }) {
  const BTN_WIDTH = 64;
  const BTN_GAP = 4;
  const PADDING = 8;
  const swipeMax = -(PADDING * 2 + actions.length * BTN_WIDTH + (actions.length - 1) * BTN_GAP);

  const ACTIVATION = 8;
  const OPEN_TH = 50;
  const CLOSE_TH = 20;

  const [swipeX, setSwipeX] = useState(0);
  const cardRef = useRef(null);
  const stateRef = useRef({ active: false, swiping: false, startX: 0, startY: 0, lockedX: 0, currentX: 0 });

  const isMobile = () => !mobileOnly || window.innerWidth <= 500;

  // Sync DOM transform when swipeX changes via state (snap au touchend ou close externe)
  useEffect(() => {
    const card = cardRef.current;
    if (!card || stateRef.current.active) return;
    card.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
    card.style.transform = swipeX !== 0 ? `translateX(${swipeX}px)` : '';
  }, [swipeX]);

  // Auto-close : si une AUTRE ligne est swipée, on referme la nôtre
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.id === id) return;
      if (swipeX !== 0 && !stateRef.current.active) {
        stateRef.current.lockedX = 0;
        stateRef.current.currentX = 0;
        setSwipeX(0);
      }
    };
    window.addEventListener('swipe-row:opened', handler);
    return () => window.removeEventListener('swipe-row:opened', handler);
  }, [id, swipeX]);

  // Touch handlers natifs (non-passifs pour pouvoir preventDefault le scroll vertical)
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const onTouchStart = (e) => {
      if (disabled || !isMobile()) return;
      const t = e.touches[0];
      stateRef.current = {
        active: true, swiping: false,
        startX: t.clientX, startY: t.clientY,
        lockedX: swipeX, currentX: swipeX,
      };
      card.style.transition = 'none';
    };

    const onTouchMove = (e) => {
      const s = stateRef.current;
      if (!s.active) return;
      const t = e.touches[0];
      const dx = t.clientX - s.startX;
      const dy = t.clientY - s.startY;

      if (!s.swiping) {
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > ACTIVATION) {
          s.swiping = true;
          // Notifie les autres lignes qui pourraient être ouvertes
          window.dispatchEvent(new CustomEvent('swipe-row:opened', { detail: { id } }));
        } else if (Math.abs(dy) > ACTIVATION) {
          s.active = false; // scroll vertical, on lâche
          return;
        } else {
          return;
        }
      }

      if (e.cancelable) e.preventDefault(); // bloque le scroll vertical pendant le swipe
      const newX = Math.min(0, Math.max(swipeMax, s.lockedX + dx));
      s.currentX = newX;
      card.style.transform = `translateX(${newX}px)`;
    };

    const onTouchEnd = () => {
      const s = stateRef.current;
      if (!s.active) return;
      s.active = false;
      s.swiping = false;

      // Snap directionnel : ouvrir = 50px à gauche, fermer = 20px à droite
      let finalX;
      if (s.lockedX === 0) {
        finalX = s.currentX < -OPEN_TH ? swipeMax : 0;
      } else {
        finalX = (s.currentX - s.lockedX) > CLOSE_TH ? 0 : swipeMax;
      }
      card.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
      card.style.transform = finalX !== 0 ? `translateX(${finalX}px)` : '';
      if (finalX !== swipeX) setSwipeX(finalX);
    };

    card.addEventListener('touchstart', onTouchStart, { passive: true });
    card.addEventListener('touchmove', onTouchMove, { passive: false });
    card.addEventListener('touchend', onTouchEnd, { passive: true });
    card.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      card.removeEventListener('touchstart', onTouchStart);
      card.removeEventListener('touchmove', onTouchMove);
      card.removeEventListener('touchend', onTouchEnd);
      card.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [swipeX, swipeMax, disabled, id]);

  return (
    <div className="swipe-row-container">
      {!disabled && (
        <div className="swipe-row-actions" style={{ padding: PADDING, gap: BTN_GAP }}>
          {actions.map((a, i) => (
            <button
              key={i}
              type="button"
              className="swipe-row-action"
              style={{ width: BTN_WIDTH, background: a.color || '#888' }}
              onClick={() => { setSwipeX(0); a.onClick(); }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
      <div ref={cardRef} className="swipe-row-card">
        {children}
      </div>
    </div>
  );
}
```

### CSS

```css
.swipe-row-container {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  margin-bottom: 8px;
  background: #fff; /* doit être opaque sinon les boutons "peekent" */
}

.swipe-row-card {
  position: relative;
  z-index: 2;
  background: #fff; /* DOIT être opaque pour cacher les boutons en dessous */
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  /* pan-y : autorise le scroll vertical natif, JS gère l'horizontal */
  touch-action: pan-y;
}

.swipe-row-actions {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1; /* sous la carte */
  display: flex;
  align-items: center;
}

.swipe-row-action {
  height: 100%;
  max-height: 64px;
  border: none;
  border-radius: 14px;
  color: white;
  font-weight: 700;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0,0,0,0.12);
}

.swipe-row-action:active {
  transform: scale(0.94);
}
```

### Usage

```jsx
<SwipeRow
  id={task.id}
  actions={[
    { label: '✏️ MODIFIER', color: '#3B7DD8', onClick: () => onEdit(task) },
    { label: '🗑️ SUPPR.',   color: '#D94949', onClick: () => onDelete(task) },
  ]}
>
  <div style={{ padding: 16 }}>
    <strong>{task.text}</strong>
    <div>{task.detail}</div>
  </div>
</SwipeRow>
```

---

## Implémentation Vanilla JS (sans framework)

Pour quand tu n'as pas React. Même logique, juste sans hooks.

```js
function attachSwipeRow(container, { id, actions, onOpen, onClose }) {
  const card = container.querySelector('.swipe-row-card');
  const BTN_WIDTH = 64, BTN_GAP = 4, PADDING = 8;
  const swipeMax = -(PADDING * 2 + actions.length * BTN_WIDTH + (actions.length - 1) * BTN_GAP);
  const ACTIVATION = 8, OPEN_TH = 50, CLOSE_TH = 20;

  let swipeX = 0;
  let state = { active: false, swiping: false, startX: 0, startY: 0, lockedX: 0, currentX: 0 };

  const applyTransform = (x, animate = true) => {
    card.style.transition = animate ? 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)' : 'none';
    card.style.transform = x !== 0 ? `translateX(${x}px)` : '';
  };

  card.addEventListener('touchstart', (e) => {
    if (window.innerWidth > 500) return;
    const t = e.touches[0];
    state = { active: true, swiping: false, startX: t.clientX, startY: t.clientY, lockedX: swipeX, currentX: swipeX };
    card.style.transition = 'none';
  }, { passive: true });

  card.addEventListener('touchmove', (e) => {
    if (!state.active) return;
    const t = e.touches[0];
    const dx = t.clientX - state.startX;
    const dy = t.clientY - state.startY;

    if (!state.swiping) {
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > ACTIVATION) {
        state.swiping = true;
        window.dispatchEvent(new CustomEvent('swipe-row:opened', { detail: { id } }));
      } else if (Math.abs(dy) > ACTIVATION) {
        state.active = false;
        return;
      } else return;
    }
    if (e.cancelable) e.preventDefault();
    const newX = Math.min(0, Math.max(swipeMax, state.lockedX + dx));
    state.currentX = newX;
    card.style.transform = `translateX(${newX}px)`;
  }, { passive: false });  // ← critique : non-passif

  const handleEnd = () => {
    if (!state.active) return;
    state.active = false;
    state.swiping = false;
    let finalX;
    if (state.lockedX === 0) {
      finalX = state.currentX < -OPEN_TH ? swipeMax : 0;
    } else {
      finalX = (state.currentX - state.lockedX) > CLOSE_TH ? 0 : swipeMax;
    }
    applyTransform(finalX);
    swipeX = finalX;
    if (finalX !== 0) onOpen?.(); else onClose?.();
  };
  card.addEventListener('touchend', handleEnd, { passive: true });
  card.addEventListener('touchcancel', handleEnd, { passive: true });

  // Auto-close si une autre row s'ouvre
  window.addEventListener('swipe-row:opened', (e) => {
    if (e.detail?.id === id) return;
    if (swipeX !== 0 && !state.active) {
      swipeX = 0;
      state.lockedX = 0;
      state.currentX = 0;
      applyTransform(0);
      onClose?.();
    }
  });
}
```

Markup HTML correspondant :

```html
<div class="swipe-row-container">
  <div class="swipe-row-actions">
    <button class="swipe-row-action edit-btn">✏️</button>
    <button class="swipe-row-action delete-btn">🗑️</button>
  </div>
  <div class="swipe-row-card">
    Contenu de la ligne...
  </div>
</div>
```

---

## Pourquoi ces choix techniques (les pièges qui ne se voient pas)

### 🚨 React `onTouchMove` ne marche pas pour bloquer le scroll
React enregistre tous les listeners touch comme **passifs** par défaut. `e.preventDefault()` dans un listener passif est silencieusement ignoré → le scroll vertical continue pendant ton swipe horizontal. **Tu DOIS attacher `touchmove` manuellement via `addEventListener(..., { passive: false })`** dans un `useEffect`.

### 🐢 `setState` à chaque frame de gesture = laggy
Si tu fais `setSwipeX(newX)` à chaque touchmove, React re-render à chaque frame → 60fps en théorie, mais avec le batching et le reconciliation, ça lag visuellement. **Solution** : manipule `card.style.transform` directement via ref pendant la gesture, sync l'état React **seulement au touchend**.

### 🎯 `touch-action: pan-y` est la clé pour la cohabitation scroll/swipe
Sans cette propriété, le navigateur démarre un scroll dès le premier pixel de mouvement vertical, et tu te bats contre lui. Avec `pan-y` :
- Mouvement vertical → scroll natif (smooth, hardware-accelerated)
- Mouvement horizontal → ton JS prend la main, preventDefault possible

### 🪟 Le snap directionnel évite la frustration
Ouvrir et fermer ne devraient pas demander la même force :
- **Ouvrir** : 50 px (intentionnel, évite les faux positifs)
- **Fermer** : 20 px (rapide, l'user veut juste annuler)

Distinguer en mémorisant `lockedX` au touchstart : si tu pars de 0 → tu veux ouvrir, sinon tu veux fermer.

### 🚪 Auto-close via CustomEvent : zéro couplage
Pas besoin d'un store global ou de remonter le state. Chaque ligne dispatche un event sur `window` quand elle s'ouvre, et écoute les events des autres. **Découplé, propre, fonctionne aussi en vanilla JS.**

---

## Customisation rapide

| Knob | Default | Effet |
|---|---|---|
| `BTN_WIDTH` | 64 px | Largeur de chaque bouton révélé |
| `ACTIVATION` | 8 px | Distance avant de décider swipe vs scroll |
| `OPEN_TH` | 50 px | Distance min pour ouvrir |
| `CLOSE_TH` | 20 px | Distance min pour fermer |
| Transition | `0.25s cubic-bezier(0.4, 0, 0.2, 1)` | Easing du snap |
| `mobileOnly` | `true` (≤500px) | Désactive sur desktop |

---

## Limites connues

- **Multitouch ignoré** : on suit uniquement `e.touches[0]`. Si l'user fait du pinch-zoom dessus, c'est imprévisible.
- **Pas de mouse drag** : volontaire — sur desktop on préfère un autre pattern (boutons toujours visibles, hover state). Si tu veux le swipe sur desktop aussi, dupliquer le code avec `mousedown/mousemove/mouseup`.
- **Animation pendant un re-render** : si le parent re-render alors qu'on est en plein milieu d'une gesture, le `useEffect` qui re-bind les listeners peut perdre une frame. Rare en pratique.

---

## Crédits

Pattern extrait de TaskFlow (`index.html` / composant `TaskCard`, commits `90b172d` à `c118bb0`). Mai 2026.
