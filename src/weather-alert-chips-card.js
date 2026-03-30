/**
 * weather-alert-chips-card
 *
 * A wrapper around custom:mushroom-chips-card that renders vigilance alerts
 * (currently Météo-France) as coloured chips.
 *
 * Config:
 *   type:              custom:weather-alert-chips-card
 *   provider:          meteo_france             # optional, default: meteo_france
 *   entity:            sensor.68_weather_alert  # required
 *   alignment:         center                   # optional, default: center
 *   show_unavailable:  false                    # show grey/unknown-state chips (default: false)
 *   allowlist:                                  # "force show" – always visible even when grey
 *     - Canicule
 *   blocklist:                                  # "do not show" – always hidden
 *     - Grand-froid
 *   alert_types:                                # optional – full override of the alert list
 *     - type: Canicule
 *       icon: mdi:thermometer-high
 *       hide_when_green: true
 *       badge_on_unknown: true
 */

// ── Providers ──────────────────────────────────────────────────────────────────

const PROVIDERS = [
  { value: 'meteo_france', label: 'Météo-France' },
];

// Integration domain used to filter the entity picker.
const WEATHER_INTEGRATION = 'meteo_france';

const WEATHER_DEFAULT_ALERTS = [
  { type: 'Canicule',         icon: 'mdi:thermometer-high'      },
  { type: 'Vent violent',     icon: 'mdi:weather-windy'         },
  { type: 'Pluie-inondation', icon: 'mdi:weather-pouring'       },
  { type: 'Orages',           icon: 'mdi:weather-lightning'     },
  { type: 'Neige-verglas',    icon: 'mdi:weather-snowy-heavy'   },
  { type: 'Inondation',       icon: 'mdi:waves'                 },
  { type: 'Grand-froid',      icon: 'mdi:snowflake-thermometer' },
];

// ── Chip config builder ────────────────────────────────────────────────────────

function buildChipConfig(entity, alert) {
  const { type, icon } = alert;
  const setV = `{% set v = state_attr('${entity}', '${type}') | lower %}`;

  return {
    type: 'template',
    entity,
    icon,
    // Show label only for active alert levels; icon-only for green or unknown.
    content:    `${setV} {% if v in ['jaune', 'orange', 'rouge'] %}${type}{% endif %}`,
    icon_color: `${setV} {% if v == 'vert' %}green{% elif v == 'jaune' %}yellow{% elif v == 'orange' %}orange{% elif v == 'rouge' %}red{% else %}grey{% endif %}`,
    tap_action: { action: 'more-info' },
    // ? badge whenever the state is not a recognised level (unknown / missing attribute).
    card_mod: { style: `
:host { position: relative; border-radius: 12px; padding: 2px; display: inline-block; }
:host::after {
  ${setV}
  content: "{{ '?' if v not in ['vert','jaune','orange','rouge'] else '' }}";
  display: {{ 'block' if v not in ['vert','jaune','orange','rouge'] else 'none' }};
  position: absolute; top: -6px; right: -6px;
  background: var(--secondary-text-color); color: var(--card-background-color);
  width: 16px; height: 16px; border-radius: 50%;
  font-size: 11px; text-align: center; line-height: 16px;
}` },
  };
}

function buildCardConfig(config, hass = null) {
  const {
    entity, alignment = 'center', allowlist = [], blocklist = [], alert_types,
    hide_unavailable = true, hide_green = true,
  } = config;

  let alerts = alert_types
    ? alert_types.map((a) => {
        if (typeof a === 'string') {
          return WEATHER_DEFAULT_ALERTS.find((d) => d.type === a) ?? { type: a, icon: 'mdi:alert' };
        }
        const def = WEATHER_DEFAULT_ALERTS.find((d) => d.type === a.type) ?? {};
        return { ...def, ...a };
      })
    : WEATHER_DEFAULT_ALERTS;

  alerts = alerts.filter((a) => !blocklist.includes(a.type));

  if ((hide_unavailable || hide_green) && hass && entity) {
    const state   = hass.states[entity];
    const unavail = !state || ['unavailable', 'unknown'].includes(state.state);
    const attrs   = state?.attributes ?? {};
    alerts = alerts.filter(({ type }) => {
      if (allowlist.includes(type)) return true;
      if (unavail) return !hide_unavailable;
      const v = String(attrs[type] ?? '').toLowerCase();
      const known = ['vert', 'jaune', 'orange', 'rouge'].includes(v);
      if (!known) return !hide_unavailable;
      if (v === 'vert') return !hide_green;
      return true;
    });
  }

  return {
    type: 'custom:mushroom-chips-card',
    alignment,
    chips: alerts.map((alert) => buildChipConfig(entity, alert)),
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function findMeteoFranceEntity(hass) {
  if (!hass) return null;
  const knownAttrs = WEATHER_DEFAULT_ALERTS.map((a) => a.type);
  return (
    Object.keys(hass.states).find((entityId) => {
      const attrs = hass.states[entityId].attributes ?? {};
      return knownAttrs.some((attr) => attr in attrs);
    }) ?? null
  );
}

// ── Card ───────────────────────────────────────────────────────────────────────

class WeatherAlertChipsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static getConfigElement() {
    return document.createElement('weather-alert-chips-card-editor');
  }

  static getStubConfig(hass) {
    return { entity: findMeteoFranceEntity(hass) ?? '', hide_green: false };
  }

  setConfig(config) {
    if (!config.entity) throw new Error('weather-alert-chips-card: "entity" is required');
    this._config = config;
    if (this._innerCard) this._rebuildCard();
  }

  set hass(hass) {
    const prevHass         = this._hass;
    const prevEntityState  = this._hass?.states?.[this._config?.entity];
    this._hass = hass;

    if (this._innerCard) {
      this._innerCard.hass = hass;
      // Rebuild when JS filtering is active and the entity state changed,
      // OR when this is the first time hass arrives (prev was null) — the
      // inner card may have been built without hass in that case.
      const needsFilter = (this._config?.hide_unavailable !== false || this._config?.hide_green !== false) && this._config?.entity;
      if (needsFilter && (!prevHass || prevEntityState !== hass.states?.[this._config.entity])) {
        this._rebuildCard();
      }
    } else if (this._config) {
      // First build — hass is now available, so filtering will apply correctly.
      this._rebuildCard();
    }
  }

  _rebuildCard() {
    const cardConfig = buildCardConfig(this._config, this._hass);
    if (!this._innerCard) {
      const card = document.createElement('mushroom-chips-card');
      card.setConfig(cardConfig);
      this._innerCard = card;
      this.shadowRoot.appendChild(card);
    } else {
      this._innerCard.setConfig(cardConfig);
    }
    if (this._hass) this._innerCard.hass = this._hass;
  }

  getCardSize() {
    return this._innerCard?.getCardSize?.() ?? 1;
  }
}

customElements.define('weather-alert-chips-card', WeatherAlertChipsCard);

// ── Visual editor ──────────────────────────────────────────────────────────────

const WEATHER_EDITOR_SCHEMA = [
  {
    name: 'provider',
    selector: {
      select: {
        options: PROVIDERS.map((p) => ({ label: p.label, value: p.value })),
        mode: 'dropdown',
      },
    },
  },
  {
    name: 'entity',
    selector: { entity: { integration: WEATHER_INTEGRATION, domain: 'sensor' } },
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
  { name: 'hide_unavailable', selector: { boolean: {} } },
  { name: 'hide_green',      selector: { boolean: {} } },
];

const WEATHER_EDITOR_LABELS = {
  provider:         'Provider',
  entity:           'Vigilance sensor',
  alignment:        'Alignment',
  hide_unavailable: 'Hide unavailable / unknown alerts',
  hide_green:       'Hide green (no-risk) alerts',
};

const EDITOR_CHIP_STYLES = `
  :host { display: block; }
  .sections { display: flex; flex-direction: column; gap: 16px; padding: 4px 0 8px; }
  .label {
    font-size: 12px; font-weight: 500;
    color: var(--secondary-text-color);
    margin-bottom: 6px;
  }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    display: inline-flex; align-items: center;
    border-radius: 16px; padding: 4px 12px;
    font-size: 12px; font-weight: 500;
    cursor: pointer; user-select: none;
    border: 1px solid var(--divider-color);
    background: var(--card-background-color);
    color: var(--primary-text-color);
    transition: background 0.15s, color 0.15s;
  }
  .chip.force  { background: var(--success-color, #4caf50); color: #fff; border-color: transparent; }
  .chip.hidden { background: var(--error-color, #db4437);   color: #fff; border-color: transparent; }
  .chip.disabled { opacity: 0.35; cursor: default; }
`;

class WeatherAlertChipsCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config        = {};
    this._hass          = null;
    this._form          = null;
    this._domReady      = false;
    this._updatingForm  = false;
  }

  // ── HA lifecycle ─────────────────────────────────────────────────────────────

  setConfig(config) {
    this._config = { ...config };
    if (!this._domReady) {
      this._initDOM();
    } else {
      this._updateFormData();
      this._renderChips();
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._domReady) {
      this._initDOM();
    } else if (this._form) {
      this._form.hass = hass;
    }
  }

  // ── Internals ─────────────────────────────────────────────────────────────────

  _fireConfigChanged() {
    this.dispatchEvent(
      new CustomEvent('config-changed', { detail: { config: this._config }, bubbles: true, composed: true })
    );
  }

  _setListField(key, value) {
    if (!value || value.length === 0) {
      const { [key]: _drop, ...rest } = this._config;
      this._config = rest;
    } else {
      this._config = { ...this._config, [key]: value };
    }
    this._fireConfigChanged();
  }

  /** Called once to create the shadow DOM and the ha-form element. */
  _initDOM() {
    this._domReady = true;

    this.shadowRoot.innerHTML = `
      <style>${EDITOR_CHIP_STYLES}</style>
      <div id="form-slot"></div>
      <div class="sections">
        <div>
          <div class="label">Force show — always visible, even when grey</div>
          <div class="chips" id="allow-chips"></div>
        </div>
        <div>
          <div class="label">Do not show</div>
          <div class="chips" id="block-chips"></div>
        </div>
      </div>
    `;

    this._form = document.createElement('ha-form');
    this._form.schema = WEATHER_EDITOR_SCHEMA;
    this._form.computeLabel = (s) => WEATHER_EDITOR_LABELS[s.name] ?? s.name;
    this._form.hass = this._hass;

    this._form.addEventListener('value-changed', (ev) => {
      // Ignore events we triggered ourselves by setting .data programmatically.
      if (this._updatingForm) return;
      const d = ev.detail.value;
      this._config = { ...this._config, ...d };
      // Remove booleans that are at their default value to keep config tidy.
      if (this._config.hide_unavailable !== false) delete this._config.hide_unavailable;
      if (this._config.hide_green       !== false) delete this._config.hide_green;
      this._fireConfigChanged();
    });

    this.shadowRoot.getElementById('form-slot').appendChild(this._form);
    this._updateFormData();  // sets .data with guard active
    this._renderChips();
  }

  /** Update ha-form data without recreating the element.
   *  Guards against the value-changed event that ha-form fires when .data is
   *  set programmatically (which would otherwise cause a render loop). */
  _updateFormData() {
    if (!this._form) return;
    this._updatingForm = true;
    this._form.data = this._formData();
    // Clear after current and any queued microtasks/macrotasks fire.
    setTimeout(() => { this._updatingForm = false; }, 0);
  }

  _formData() {
    return {
      provider:         this._config.provider         ?? 'meteo_france',
      entity:           this._config.entity           ?? '',
      alignment:        this._config.alignment        ?? 'center',
      hide_unavailable: this._config.hide_unavailable ?? true,
      hide_green:       this._config.hide_green       ?? true,
    };
  }

  _renderChips() {
    const allowEl = this.shadowRoot.getElementById('allow-chips');
    const blockEl = this.shadowRoot.getElementById('block-chips');
    if (!allowEl) return;

    allowEl.innerHTML = '';
    blockEl.innerHTML = '';

    const allowlist = this._config.allowlist ?? [];
    const blocklist = this._config.blocklist ?? [];

    for (const { type } of WEATHER_DEFAULT_ALERTS) {
      const inAllow = allowlist.includes(type);
      const inBlock = blocklist.includes(type);

      const aChip = document.createElement('span');
      aChip.className = `chip${inAllow ? ' force' : ''}${inBlock ? ' disabled' : ''}`;
      aChip.textContent = type;
      if (!inBlock) {
        aChip.addEventListener('click', () => {
          const cur = this._config.allowlist ?? [];
          this._setListField('allowlist', cur.includes(type) ? cur.filter((t) => t !== type) : [...cur, type]);
          this._renderChips();
        });
      }
      allowEl.appendChild(aChip);

      const bChip = document.createElement('span');
      bChip.className = `chip${inBlock ? ' hidden' : ''}${inAllow ? ' disabled' : ''}`;
      bChip.textContent = type;
      if (!inAllow) {
        bChip.addEventListener('click', () => {
          const cur = this._config.blocklist ?? [];
          this._setListField('blocklist', cur.includes(type) ? cur.filter((t) => t !== type) : [...cur, type]);
          this._renderChips();
        });
      }
      blockEl.appendChild(bChip);
    }
  }
}

customElements.define('weather-alert-chips-card-editor', WeatherAlertChipsCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'weather-alert-chips-card',
  name: 'Weather Alert Chips Card',
  description: 'Météo-France vigilance alerts rendered as mushroom chips',
  preview: true,
});
