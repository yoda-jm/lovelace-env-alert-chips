/**
 * atmo-alert-chips-card
 *
 * Displays AtmoFrance air quality and pollen levels as chips.
 *
 * Config:
 *   type:                custom:atmo-alert-chips-card
 *   device_id:           <HA device id>            # preferred – entities resolved automatically
 *   entity_aq_today:     sensor.qualite_globale_... # manual override
 *   entity_aq_tomorrow:  sensor.qualite_globale_..._j_1
 *   entity_pol_today:    sensor.qualite_globale_pollen_...
 *   entity_pol_tomorrow: sensor.qualite_globale_pollen_..._j_1
 *   date:                today | tomorrow | both    # initial selection (default: today)
 *   mode:                air_quality | pollen | both # initial mode (default: both)
 *   alignment:           center | start | end       # default: center
 *   show_day_label:      true                       # show Aujourd'hui/Demain labels (default: false)
 *   show_level_badge:    true                       # numeric badge on each chip (default: false)
 *   show_detail:         true                       # show individual type chips when available (default: false)
 *   hide_unavailable:    true                       # hide unavailable chips (default: true)
 *   hide_good:           true                       # hide best-level chips (Bon / Nul) (default: true)
 *
 * Air quality scale:  1 Bon | 2 Moyen | 3 Dégradé | 4 Mauvais | 5 Très mauvais | 6 Extrêmement mauvais
 * Pollen scale:       0 Nul | 1 Très faible | 2 Faible | 3 Moyen | 4 Élevé | 5 Très élevé
 */

// ── Entity-id → icon maps ──────────────────────────────────────────────────────

// Pollen type key extracted from sensor.niveau_<TYPE>_<zone> → icon name
const POLLEN_TYPE_TO_ICON = {
  ambroisie: 'ragweed',
  armoise:   'mugwort',
  aulne:     'alder',
  bouleau:   'birch',
  gramine:   'grass',
  graminee:  'grass',
  cypres:    'cypress',
  frene:     'ash',
  noisetier: 'hazel',
  olivier:   'olive',
  platane:   'plane',
  plantain:  'plantain',
};

// AQ pollutant name (start of entity_id after sensor.) → icon name
const AQ_ID_TO_ICON = {
  ozone:             'ozone',
  dioxyde_d_azote:   'no2',
  dioxyde_de_soufre: 'so2',
  pm25:              'pm25',
  pm10:              'pm10',
};

// AQ pollutant name → display label
const AQ_ID_LABELS = {
  ozone:             'Ozone',
  dioxyde_d_azote:   'NO₂',
  dioxyde_de_soufre: 'SO₂',
  pm25:              'PM2.5',
  pm10:              'PM10',
};

// Pollen type key → display label
const POLLEN_TYPE_LABELS = {
  ambroisie: 'Ambroisie',
  armoise:   'Armoise',
  aulne:     'Aulne',
  bouleau:   'Bouleau',
  gramine:   'Graminées',
  graminee:  'Graminées',
  cypres:    'Cyprès',
  frene:     'Frêne',
  noisetier: 'Noisetier',
  olivier:   'Olivier',
  platane:   'Platane',
  plantain:  'Plantain',
};

function _pollenTypeFromId(id) {
  const m = id.match(/\.(?:niveau|concentration)_([a-z]+)/);
  return m?.[1] ?? '';
}

function _pollenIconFromId(id) {
  const key = POLLEN_TYPE_TO_ICON[_pollenTypeFromId(id)];
  return key ? `pollen:${key}` : 'pollen:grass';
}

function _pollenLabelFromId(id) {
  return POLLEN_TYPE_LABELS[_pollenTypeFromId(id)] ?? null;
}

function _aqIconFromId(id) {
  const name = id.replace(/^sensor\./, '').replace(/_j_1$/, '');
  for (const [frag, key] of Object.entries(AQ_ID_TO_ICON)) {
    if (name.startsWith(frag + '_') || name === frag) return `pollen:${key}`;
  }
  return 'pollen:air_quality';
}

function _aqLabelFromId(id) {
  const name = id.replace(/^sensor\./, '').replace(/_j_1$/, '');
  for (const [frag, label] of Object.entries(AQ_ID_LABELS)) {
    if (name.startsWith(frag + '_') || name === frag) return label;
  }
  return null;
}

// ── Chip builders ─────────────────────────────────────────────────────────────

// Level-badge background colours — include all levels so badge shows consistently.
const AQ_BADGE_BG  = `{{ '#888' if v <= 0 else ('#4caf50' if v == 1 else ('#daa520' if v == 2 else ('#ff8c00' if v == 3 else ('#cc0000' if v == 4 else ('#800080' if v == 5 else '#8b0000'))))) }}`;
const POL_BADGE_BG = `{{ '#888' if v < 0 else ('#ccc' if v == 0 else ('#4caf50' if v == 1 else ('#daa520' if v == 2 else ('#ff8c00' if v == 3 else ('#cc0000' if v == 4 else '#800080'))))) }}`;

/** Build card_mod style for a chip that may have a level badge and/or a concentration badge.
 *  - Level badge  (::after):  top-right coloured circle showing the numeric level.
 *  - Concentration badge (::before): bottom-right pill showing raw sensor value + unit.
 */
function _chipBadgeStyle(entity, { showLevel = false, setV = '', bgExpr = '', showConcentration = false, concEntity = null } = {}) {
  const parts = [':host { position: relative; border-radius: 12px; padding: 2px; display: inline-block; }'];

  if (showLevel) {
    parts.push(`
:host::after {
  ${setV}
  content: "{{ v }}";
  display: flex; align-items: center; justify-content: center;
  position: absolute; top: -6px; right: -6px;
  background: ${bgExpr};
  color: white;
  width: 16px; height: 16px; border-radius: 50%;
  font-size: 10px; font-weight: bold; text-align: center; line-height: 16px;
}`);
  }

  if (showConcentration) {
    const ce = concEntity || entity;
    parts.push(`
:host::before {
  {% set cv = states('${ce}') %}{% set u = state_attr('${ce}', 'unit_of_measurement') | default('') %}
  content: "{{ cv ~ (' ' ~ u if u else '') }}";
  display: block;
  position: absolute; bottom: -6px; right: -4px;
  background: rgba(0,0,0,0.55);
  color: white;
  padding: 0 4px;
  border-radius: 7px;
  font-size: 9px; font-weight: 700;
  white-space: nowrap; line-height: 14px; min-width: 14px; text-align: center;
}`);
  }

  return parts.join('\n');
}

function buildAirQualityChip(entity, { showBadge = false, showConcentration = false, label = null, icon = 'pollen:air_quality' } = {}) {
  const setV = `{% set v = states('${entity}') | int(0) %}`;
  const pre  = `${setV}{% set lbl = state_attr('${entity}', 'Libellé') | default('') %}`;
  // Detail chips: show "TypeName (LevelLabel)", global chip: show just level label
  const contentLabel = label ? `${label} ({{ lbl }})` : '{{ lbl }}';
  const chip = {
    type: 'template', entity, icon,
    // Show text only for level 2+ (level 1 = Bon → icon only, same as weather "green")
    content:    `${pre} {% if v >= 2 %}${contentLabel}{% endif %}`,
    icon_color: `${setV} {% if v == 1 %}green{% elif v == 2 %}yellow{% elif v == 3 %}orange{% elif v == 4 %}red{% elif v == 5 %}purple{% elif v >= 6 %}darkred{% else %}grey{% endif %}`,
    tap_action: { action: 'more-info' },
  };
  if (showBadge || showConcentration) {
    chip.card_mod = { style: _chipBadgeStyle(entity, { showLevel: showBadge, setV, bgExpr: AQ_BADGE_BG, showConcentration }) };
  }
  return chip;
}

function buildPollenChip(entity, { showBadge = false, showConcentration = false, label = null, icon = 'pollen:grass', concEntity = null } = {}) {
  const setV = `{% set v = states('${entity}') | int(-1) %}`;
  const pre  = `${setV}{% set lbl = state_attr('${entity}', 'Libellé') | default('') %}`;
  // Detail chips: show "TypeName (LevelLabel)", global chip: show just level label
  const contentLabel = label ? `${label} ({{ lbl }})` : '{{ lbl }}';
  const chip = {
    type: 'template', entity, icon,
    // Show text only for level 2+ (level 1 = Très faible → icon only, same as weather "green")
    content:    `${pre} {% if v >= 2 and v <= 5 %}${contentLabel}{% endif %}`,
    icon_color: `${setV} {% if v == 1 %}green{% elif v == 2 %}yellow{% elif v == 3 %}orange{% elif v == 4 %}red{% elif v == 5 %}purple{% else %}grey{% endif %}`,
    tap_action: { action: 'more-info' },
  };
  // Concentration badge is only meaningful when a separate concentration entity is provided.
  const hasConc = showConcentration && !!concEntity;
  if (showBadge || hasConc) {
    chip.card_mod = { style: _chipBadgeStyle(entity, { showLevel: showBadge, setV, bgExpr: POL_BADGE_BG, showConcentration: hasConc, concEntity }) };
  }
  return chip;
}

// ── Card config builder ────────────────────────────────────────────────────────

function buildAtmoCardConfig(config, resolved, dateKey, mode) {
  const { alignment = 'center', hide_unavailable = true, hide_good = true,
          show_level_badge = false, show_concentration = false,
          detail_level = 'global' } = config;
  const hass = config._hass;

  const showGlobal = detail_level !== 'detail';
  const showDetail = detail_level !== 'global';

  const aqEntity  = resolved[`aq_${dateKey}`];
  const polEntity = resolved[`pol_${dateKey}`];
  const aqDetail  = showDetail ? (resolved[`aq_detail_${dateKey}`] ?? []) : [];
  const polDetail = showDetail ? (resolved[`pol_detail_${dateKey}`] ?? []) : [];

  const chips  = [];
  const baseOpts = { showBadge: show_level_badge, showConcentration: show_concentration };

  if (mode === 'air_quality' || mode === 'both') {
    if (showGlobal && aqEntity && _shouldShowAq(hass, aqEntity, hide_unavailable, hide_good)) {
      chips.push(buildAirQualityChip(aqEntity, baseOpts));
    }
    for (const { level, icon, label } of aqDetail) {
      if (_shouldShowAq(hass, level, hide_unavailable, hide_good)) {
        chips.push(buildAirQualityChip(level, { ...baseOpts, icon, label }));
      }
    }
  }

  if (mode === 'pollen' || mode === 'both') {
    if (showGlobal && polEntity && _shouldShowPol(hass, polEntity, hide_unavailable, hide_good)) {
      chips.push(buildPollenChip(polEntity, baseOpts));
    }
    for (const { level, conc, icon, label } of polDetail) {
      if (_shouldShowPol(hass, level, hide_unavailable, hide_good)) {
        chips.push(buildPollenChip(level, { ...baseOpts, icon, concEntity: conc, label }));
      }
    }
  }

  return { type: 'custom:mushroom-chips-card', alignment, chips };
}

function _shouldShowAq(hass, entity, hideUnavailable, hideGood) {
  if (!hass || !entity) return true;
  const s = hass.states[entity];
  if (!s || ['unavailable', 'unknown'].includes(s.state)) return !hideUnavailable;
  const v = parseInt(s.state, 10);
  return !(hideGood && v <= 1);
}

function _shouldShowPol(hass, entity, hideUnavailable, hideGood) {
  if (!hass || !entity) return true;
  const s = hass.states[entity];
  if (!s || ['unavailable', 'unknown'].includes(s.state)) return !hideUnavailable;
  const v = parseInt(s.state, 10);
  return !(hideGood && v <= 0);
}

// ── Toggle chip styles ────────────────────────────────────────────────────────

const ATMO_CARD_STYLES = `
  :host { display: block; }
  #sections { display: flex; flex-direction: column; }
  .day-label {
    font-size: 11px; font-weight: 600; color: var(--secondary-text-color);
    padding: 6px 8px 0;
  }
`;

// ── Device → entity resolution ─────────────────────────────────────────────────

function resolveAtmoEntitiesFromDevice(hass, deviceId) {
  const empty = {
    aq_today: null, aq_tomorrow: null, pol_today: null, pol_tomorrow: null,
    aq_detail_today: [], pol_detail_today: [],
    aq_detail_tomorrow: [], pol_detail_tomorrow: [],
  };
  if (!hass?.entities || !deviceId) return empty;

  const sensorIds = Object.values(hass.entities)
    .filter((e) => e.device_id === deviceId && e.entity_id.startsWith('sensor.') && e.entity_id in hass.states)
    .map((e) => e.entity_id);

  const isTomorrow      = (id) => {
    const fn = (hass.states[id]?.attributes?.friendly_name ?? '').toLowerCase();
    return id.includes('_j_1') || fn.includes('j+1') || fn.includes('demain');
  };
  // Classification by entity_id pattern + device_class attribute
  const isGlobalAq      = (id) => id.includes('qualite_globale') && !id.includes('pollen');
  const isGlobalPol     = (id) => id.includes('qualite_globale') && id.includes('pollen');
  const isDetailAqLvl   = (id) => hass.states[id]?.attributes?.device_class === 'aqi' && !/\.niveau_/.test(id);
  const isDetailPolLvl  = (id) => /\.niveau_/.test(id);
  const isDetailPolConc = (id) => /\.concentration_/.test(id);

  const findGlobal = (check, tomorrow) =>
    sensorIds.find((id) => check(id) && isTomorrow(id) === tomorrow) ?? null;

  // AQ detail: { level, conc: null, icon } — AQ sensors have no µg/m³ counterpart
  // Sort by entity_id (strip _j_1 suffix) for stable order across today/tomorrow.
  const aqDetail = (tomorrow) =>
    sensorIds
      .filter((id) => isDetailAqLvl(id) && isTomorrow(id) === tomorrow)
      .sort((a, b) => a.replace(/_j_1$/, '').localeCompare(b.replace(/_j_1$/, '')))
      .map((id) => ({ level: id, conc: null, icon: _aqIconFromId(id), label: _aqLabelFromId(id) }));

  // Pollen detail: pair niveau_<type> with concentration_<type> by type key.
  // Sort by type key for stable order across today/tomorrow.
  const polDetail = (tomorrow) => {
    const byType = {};
    for (const id of sensorIds) {
      if (isTomorrow(id) !== tomorrow) continue;
      const type = _pollenTypeFromId(id);
      if (!type) continue;
      if (!byType[type]) byType[type] = { level: null, conc: null };
      if (isDetailPolLvl(id))  byType[type].level = id;
      if (isDetailPolConc(id)) byType[type].conc  = id;
    }
    return Object.keys(byType).sort()
      .filter((type) => byType[type].level)
      .map((type) => {
        const e = byType[type];
        return { level: e.level, conc: e.conc, icon: _pollenIconFromId(e.level), label: _pollenLabelFromId(e.level) };
      });
  };

  return {
    aq_today:            findGlobal(isGlobalAq,  false),
    aq_tomorrow:         findGlobal(isGlobalAq,  true),
    pol_today:           findGlobal(isGlobalPol, false),
    pol_tomorrow:        findGlobal(isGlobalPol, true),
    aq_detail_today:     aqDetail(false),
    aq_detail_tomorrow:  aqDetail(true),
    pol_detail_today:    polDetail(false),
    pol_detail_tomorrow: polDetail(true),
  };
}

// ── Card element ───────────────────────────────────────────────────────────────

class AtmoAlertChipsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._date        = 'today';
    this._mode        = 'both';
    this._innerCards  = { today: null, tomorrow: null, 'today-pol': null, 'tomorrow-pol': null };
    this._ready       = false;
  }

  static getConfigElement() {
    return document.createElement('atmo-alert-chips-card-editor');
  }

  static getStubConfig(hass) {
    if (hass?.entities) {
      const e = Object.values(hass.entities).find(
        (e) => e.entity_id.startsWith('sensor.qualite_globale_') && !e.entity_id.includes('pollen') && e.device_id
      );
      if (e) return { device_id: e.device_id, hide_good: false };
    }
    return { device_id: '' };
  }

  _resolveEntities() {
    const cfg = this._config;
    if (cfg.device_id) return resolveAtmoEntitiesFromDevice(this._hass, cfg.device_id);
    return {
      aq_today:           cfg.entity_aq_today    ?? cfg.entity_today    ?? null,
      aq_tomorrow:        cfg.entity_aq_tomorrow ?? cfg.entity_tomorrow ?? null,
      pol_today:          cfg.entity_pol_today   ?? null,
      pol_tomorrow:       cfg.entity_pol_tomorrow ?? null,
      aq_detail_today: [], pol_detail_today: [], aq_detail_tomorrow: [], pol_detail_tomorrow: [],
    };
  }

  get _showToday()    { return this._date === 'today'    || this._date === 'both'; }
  get _showTomorrow() { return this._date === 'tomorrow' || this._date === 'both'; }

  async setConfig(config) {
    if (!config.device_id && !config.entity_aq_today && !config.entity_today) {
      throw new Error('atmo-alert-chips-card: device_id or entity_aq_today is required');
    }
    // Always sync date and mode from config so editor changes take effect immediately.
    this._date = config.date ?? 'today';
    this._mode = config.mode ?? 'both';
    if (!this._ready) {
      this._ready = true;
      this._buildShell();
    }
    this._config = config;
    this._renderDayVisibility();
    if (Object.values(this._innerCards).some(Boolean)) {
      this._rebuildVisible();
    }
  }

  set hass(hass) {
    const prevHass = this._hass;
    this._hass = hass;
    const resolved = this._resolveEntities();

    for (const dk of ['today', 'tomorrow']) {
      // Propagate hass to all active slots for this day.
      for (const slot of [dk, `${dk}-pol`]) {
        if (this._innerCards[slot]) this._innerCards[slot].hass = hass;
      }
      // Rebuild if any relevant entity changed.
      if (this._innerCards[dk] || this._innerCards[`${dk}-pol`]) {
        const detailEntities = [
          ...resolved[`aq_detail_${dk}`].map((d) => d.level),
          ...resolved[`pol_detail_${dk}`].map((d) => d.level),
          ...resolved[`pol_detail_${dk}`].filter((d) => d.conc).map((d) => d.conc),
        ];
        const entities = [resolved[`aq_${dk}`], resolved[`pol_${dk}`], ...detailEntities].filter(Boolean);
        const changed = entities.some((id) => prevHass?.states?.[id] !== hass.states?.[id]);
        if (!prevHass || changed) this._rebuildCard(dk);
      }
    }

    if (!Object.values(this._innerCards).some(Boolean) && this._config) {
      this._rebuildVisible();
    }
  }

  _buildShell() {
    this.shadowRoot.innerHTML = `
      <style>${ATMO_CARD_STYLES}</style>
      <div id="sections">
        <div id="section-today">
          <div id="label-today" class="day-label"></div>
          <div id="inner-today"></div>
          <div id="inner-today-pol"></div>
        </div>
        <div id="section-tomorrow">
          <div id="label-tomorrow" class="day-label"></div>
          <div id="inner-tomorrow"></div>
          <div id="inner-tomorrow-pol"></div>
        </div>
      </div>
    `;
  }

  _renderDayVisibility() {
    const st  = this.shadowRoot.getElementById('section-today');
    const sm  = this.shadowRoot.getElementById('section-tomorrow');
    const lt  = this.shadowRoot.getElementById('label-today');
    const lm  = this.shadowRoot.getElementById('label-tomorrow');
    if (!st) return;
    const showLabel = !!this._config?.show_day_label;
    st.hidden = !this._showToday;
    sm.hidden = !this._showTomorrow;
    if (lt) lt.textContent = showLabel ? "Aujourd'hui" : '';
    if (lm) lm.textContent = showLabel ? 'Demain'      : '';
  }

  _rebuildVisible() {
    if (this._showToday)    this._rebuildCard('today');
    if (this._showTomorrow) this._rebuildCard('tomorrow');
  }

  _rebuildCard(dk) {
    const split = !!this._config?.split_rows;
    if (split) {
      if (this._mode !== 'pollen')      this._rebuildSlot(dk,           dk, 'air_quality');
      else                              this._clearSlot(dk);
      if (this._mode !== 'air_quality') this._rebuildSlot(`${dk}-pol`,  dk, 'pollen');
      else                              this._clearSlot(`${dk}-pol`);
    } else {
      this._rebuildSlot(dk, dk, this._mode);
      this._clearSlot(`${dk}-pol`);
    }
  }

  _rebuildSlot(slot, dk, rowMode) {
    const resolved   = this._resolveEntities();
    const cardConfig = buildAtmoCardConfig({ ...this._config, _hass: this._hass }, resolved, dk, rowMode);
    const container  = this.shadowRoot.getElementById(`inner-${slot}`);
    if (!container) return;
    container.hidden = false;

    if (!this._innerCards[slot]) {
      const card = document.createElement('mushroom-chips-card');
      card.setConfig(cardConfig);
      this._innerCards[slot] = card;
      container.appendChild(card);
    } else {
      this._innerCards[slot].setConfig(cardConfig);
    }
    if (this._hass) this._innerCards[slot].hass = this._hass;
  }

  _clearSlot(slot) {
    const container = this.shadowRoot.getElementById(`inner-${slot}`);
    if (container) { container.hidden = true; container.innerHTML = ''; }
    this._innerCards[slot] = null;
  }

  getCardSize() {
    const n = (this._showToday ? 1 : 0) + (this._showTomorrow ? 1 : 0);
    return Math.max(this._innerCards.today?.getCardSize?.() ?? 1, this._innerCards.tomorrow?.getCardSize?.() ?? 1) * n;
  }
}

customElements.define('atmo-alert-chips-card', AtmoAlertChipsCard);

// ── Visual editor ──────────────────────────────────────────────────────────────

const ATMO_INTEGRATION = 'atmofrance';

const ATMO_EDITOR_SCHEMA = [
  {
    name: 'device_id',
    selector: { device: { integration: ATMO_INTEGRATION } },
  },
  {
    name: 'date',
    selector: {
      select: {
        options: [
          { label: "Aujourd'hui only",   value: 'today'    },
          { label: 'Demain only',        value: 'tomorrow' },
          { label: 'Both (2 rows)',      value: 'both'     },
        ],
        mode: 'dropdown',
      },
    },
  },
  {
    name: 'mode',
    selector: {
      select: {
        options: [
          { label: 'Both',        value: 'both'        },
          { label: 'Air quality', value: 'air_quality' },
          { label: 'Pollen',      value: 'pollen'      },
        ],
        mode: 'dropdown',
      },
    },
  },
  {
    name: 'alignment',
    selector: {
      select: {
        options: [
          { label: 'Center', value: 'center' },
          { label: 'Start',  value: 'start'  },
          { label: 'End',    value: 'end'    },
        ],
        mode: 'dropdown',
      },
    },
  },
  {
    name: 'detail_level',
    selector: {
      select: {
        options: [
          { label: 'Global only',     value: 'global' },
          { label: 'Detail only',     value: 'detail' },
          { label: 'Global + detail', value: 'both'   },
        ],
        mode: 'dropdown',
      },
    },
  },
  { name: 'split_rows',         selector: { boolean: {} } },
  { name: 'show_day_label',     selector: { boolean: {} } },
  { name: 'show_level_badge',   selector: { boolean: {} } },
  { name: 'show_concentration', selector: { boolean: {} } },
  { name: 'hide_unavailable',   selector: { boolean: {} } },
  { name: 'hide_good',          selector: { boolean: {} } },
];

const ATMO_EDITOR_LABELS = {
  device_id:        'Location (AtmoFrance device)',
  date:             'Date selection',
  mode:             'Initial mode',
  alignment:        'Alignment',
  detail_level:       'Detail level',
  split_rows:         'Split air quality and pollen onto separate rows',
  show_day_label:     "Show 'Aujourd'hui' / 'Demain' section labels",
  show_level_badge:   'Show numeric level badge (top-right)',
  show_concentration: 'Show concentration badge µg/m³ (bottom-right, pollen detail only)',
  hide_unavailable:   'Hide unavailable / unknown chips',
  hide_good:          'Hide best-level chips (Bon / Nul)',
};

// Defaults that should be omitted from config when at their default value.
const ATMO_BOOL_DEFAULTS = {
  hide_unavailable:   true,
  hide_good:          true,
  split_rows:         false,
  show_day_label:     false,
  show_level_badge:   false,
  show_concentration: false,
};

const ATMO_EDITOR_STYLES = `
  :host { display: block; }
  .resolved {
    font-size: 11px; color: var(--secondary-text-color);
    background: var(--secondary-background-color);
    border-radius: 6px; padding: 6px 10px;
    display: flex; flex-direction: column; gap: 2px;
    margin-top: -8px; margin-bottom: 8px;
  }
  .resolved span { font-family: monospace; color: var(--primary-text-color); }
  .resolved .missing { color: var(--warning-color, orange); font-style: italic; }
`;

class AtmoAlertChipsCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config       = {};
    this._hass         = null;
    this._form         = null;
    this._domReady     = false;
    this._updatingForm = false;
  }

  setConfig(config) {
    this._config = { ...config };
    if (!this._domReady) {
      this._initDOM();
    } else {
      this._updateFormData();
      this._updateResolved();
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._domReady) {
      this._initDOM();
    } else if (this._form) {
      this._form.hass = hass;
      this._updateResolved();
    }
  }

  _fireConfigChanged() {
    this.dispatchEvent(
      new CustomEvent('config-changed', { detail: { config: this._config }, bubbles: true, composed: true })
    );
  }

  _initDOM() {
    this._domReady = true;
    this.shadowRoot.innerHTML = `
      <style>${ATMO_EDITOR_STYLES}</style>
      <div id="form-slot"></div>
      <div id="resolved"></div>
    `;

    this._form = document.createElement('ha-form');
    this._form.schema = ATMO_EDITOR_SCHEMA;
    this._form.computeLabel = (s) => ATMO_EDITOR_LABELS[s.name] ?? s.name;
    this._form.hass = this._hass;

    this._form.addEventListener('value-changed', (ev) => {
      if (this._updatingForm) return;
      const d = ev.detail.value;
      this._config = { ...this._config, ...d };
      // Strip boolean fields that are at their default value.
      for (const [key, def] of Object.entries(ATMO_BOOL_DEFAULTS)) {
        if (this._config[key] === def) delete this._config[key];
      }
      this._fireConfigChanged();
      this._updateResolved();
    });

    this.shadowRoot.getElementById('form-slot').appendChild(this._form);
    this._updateFormData();
    this._updateResolved();
  }

  _updateFormData() {
    if (!this._form) return;
    this._updatingForm = true;
    this._form.data = {
      device_id:        this._config.device_id        ?? '',
      date:             this._config.date             ?? 'today',
      mode:             this._config.mode             ?? 'both',
      alignment:        this._config.alignment        ?? 'center',
      detail_level:       this._config.detail_level       ?? 'global',
      show_day_label:     this._config.show_day_label     ?? false,
      show_level_badge:   this._config.show_level_badge   ?? false,
      show_concentration: this._config.show_concentration ?? false,
      hide_unavailable: this._config.hide_unavailable ?? true,
      hide_good:        this._config.hide_good        ?? true,
    };
    setTimeout(() => { this._updatingForm = false; }, 0);
  }

  _updateResolved() {
    const el = this.shadowRoot.getElementById('resolved');
    if (!el) return;
    const deviceId = this._config.device_id;
    if (!deviceId || !this._hass) { el.innerHTML = ''; return; }
    const r = resolveAtmoEntitiesFromDevice(this._hass, deviceId);
    const row = (label, val, detail = []) => {
      const main = val ? `<span>${val}</span>` : `<span class="missing">not found</span>`;
      const concCount = detail.filter((d) => d.conc).length;
      const det = detail.length
        ? ` + ${detail.length} detail${concCount ? ` (${concCount} with conc.)` : ''}`
        : '';
      return `<div>${label} → ${main}${det}</div>`;
    };
    el.innerHTML = `<div class="resolved">
      ${row('AQ today',        r.aq_today,    r.aq_detail_today)}
      ${row('AQ tomorrow',     r.aq_tomorrow, r.aq_detail_tomorrow)}
      ${row('Pollen today',    r.pol_today,   r.pol_detail_today)}
      ${row('Pollen tomorrow', r.pol_tomorrow, r.pol_detail_tomorrow)}
    </div>`;
  }
}

customElements.define('atmo-alert-chips-card-editor', AtmoAlertChipsCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'atmo-alert-chips-card',
  name: 'AtmoFrance Alert Chips Card',
  description: 'AtmoFrance air quality and pollen alerts rendered as mushroom chips',
  preview: true,
});
