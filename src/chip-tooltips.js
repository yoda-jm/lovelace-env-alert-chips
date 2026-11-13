/**
 * Hover tooltips for chips rendered by an inner mushroom-chips-card.
 *
 * Chip configs may carry a private `_tooltip` function (hass → string).
 * `extractTooltips` strips it before the config is handed to Mushroom, and
 * `applyChipTooltips` sets the resulting text as the `title` attribute of each
 * rendered chip element (matched by order, since Mushroom renders chips in
 * config order).
 */

/** Strip `_tooltip` from every chip; return the clean config + tooltip fns. */
export function extractTooltips(cardConfig) {
  const tooltips = [];
  const chips = cardConfig.chips.map(({ _tooltip, ...chip }) => {
    tooltips.push(_tooltip ?? null);
    return chip;
  });
  return { config: { ...cardConfig, chips }, tooltips };
}

function _chipElements(card) {
  const root = card?.shadowRoot;
  if (!root) return [];
  // Mushroom chip elements are named mushroom-<kind>-chip.
  return [...root.querySelectorAll('*')].filter((el) => el.localName.endsWith('-chip'));
}

/** Apply tooltip text to the chips of `card` once it has rendered. */
export function applyChipTooltips(card, tooltips, hass) {
  if (!card || !tooltips?.length) return;
  const titles = tooltips.map((fn) => {
    try { return fn ? fn(hass) : ''; } catch { return ''; }
  });

  let tries = 0;
  const apply = () => {
    const chips = _chipElements(card);
    if (chips.length !== titles.length) {
      // Not rendered yet (or mid-update) — retry for a few frames.
      if (++tries < 20) requestAnimationFrame(apply);
      return;
    }
    chips.forEach((el, i) => {
      if (titles[i]) el.setAttribute('title', titles[i]);
      else el.removeAttribute('title');
    });
  };
  Promise.resolve(card.updateComplete).then(apply, apply);
}
