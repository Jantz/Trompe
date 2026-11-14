/**
 * Preview screens: everyday app interfaces built only from Trompe components, so every edit in
 * the Studio is judged on real UI rather than on isolated swatches. Each element carries a
 * data-role naming the skin entry that styles it (used by the inspector).
 */

export interface Screen {
  id: string;
  label: string;
  html: string;
}

const icon = (id: string, size = 18, slot = '') => `<svg ${slot ? `slot="${slot}" ` : ''}width="${size}" height="${size}" aria-hidden="true"><use href="#i-${id}"/></svg>`;

export const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-home" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M3 11 12 4l9 7v9H14v-6h-4v6H3z"/></symbol>
  <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" d="M4 21c1-4 4-6 8-6s7 2 8 6"/></symbol>
  <symbol id="i-bell" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/></symbol>
  <symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" d="M8 10V7a4 4 0 0 1 8 0v3"/></symbol>
  <symbol id="i-card" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path stroke="currentColor" stroke-width="2" d="M3 10h18"/></symbol>
  <symbol id="i-folder" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M3 6h6l2 2h10v11H3z"/></symbol>
  <symbol id="i-file" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M6 3h8l4 4v14H6zM14 3v4h4"/></symbol>
  <symbol id="i-image" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" d="m4 18 5-6 4 4 3-3 4 5"/><circle cx="16" cy="9" r="1.6" fill="currentColor"/></symbol>
  <symbol id="i-star" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></symbol>
  <symbol id="i-trash" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></symbol>
  <symbol id="i-upload" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4"/></symbol>
  <symbol id="i-grid" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/></symbol>
  <symbol id="i-list" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M8 6h12M8 12h12M8 18h12M4 6h0M4 12h0M4 18h0"/></symbol>
  <symbol id="i-more" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/></symbol>
  <symbol id="i-chart" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 20V4M4 20h16M8 16l4-5 3 3 5-7"/></symbol>
  <symbol id="i-bold" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" d="M7 4h6a4 4 0 0 1 0 8H7zM7 12h7a4 4 0 0 1 0 8H7z"/></symbol>
  <symbol id="i-italic" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M10 4h8M6 20h8M14 4l-4 16"/></symbol>
  <symbol id="i-link" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/></symbol>
  <symbol id="i-send" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M3 11 21 3l-8 18-2-8z"/></symbol>
  <symbol id="i-help" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h0"/></symbol>
  <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="m16 16 4.5 4.5"/></symbol>
  <symbol id="i-plus" viewBox="0 0 24 24"><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 5v14M5 12h14"/></symbol>
  <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></symbol>
  <symbol id="i-drop" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z"/></symbol>
  <symbol id="i-cube" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12 4 7.5"/></symbol>
  <symbol id="i-shape" viewBox="0 0 24 24"><rect x="3" y="3" width="10" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="none" stroke="currentColor" stroke-width="2"/></symbol>
  <symbol id="i-wave" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M3 12c2.5-5 4.5-5 6 0s3.5 5 6 0 4.5-5 6 0"/></symbol>
  <symbol id="i-check" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.5 5 5 10-11"/></symbol>
  <symbol id="i-spark" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></symbol>
  <symbol id="i-undo" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/></symbol>
  <symbol id="i-redo" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3"/></symbol>
  <symbol id="i-download" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 4v12m-5-5 5 5 5-5M4 20h16"/></symbol>
  <symbol id="i-copy" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></symbol>
  <symbol id="i-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/><path stroke="currentColor" stroke-width="2" d="M12 1v4M12 19v4M1 12h4M19 12h4"/></symbol>
  <symbol id="i-desktop" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M8 20h8M12 16v4"/></symbol>
  <symbol id="i-tablet" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M11 18h2"/></symbol>
  <symbol id="i-phone" viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M11 18.5h2"/></symbol>
  <symbol id="i-share" viewBox="0 0 24 24"><circle cx="6" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="6" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="18" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path stroke="currentColor" stroke-width="2" d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/></symbol>
  <symbol id="i-close" viewBox="0 0 24 24"><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/></symbol>
  <symbol id="i-dice" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="3.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.4" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.4" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.4" fill="currentColor"/></symbol>
</svg>`;

const settings = `
<div class="pv-app pv-settings">
  <div class="pv-side">
    <tr-nav label="Settings">
      <tr-nav-item href="#">${icon('home', 18, 'icon')}General</tr-nav-item>
      <tr-nav-item href="#" current>${icon('user', 18, 'icon')}Profile</tr-nav-item>
      <tr-nav-item href="#">${icon('bell', 18, 'icon')}Notifications<tr-badge slot="badge" tone="accent">3</tr-badge></tr-nav-item>
      <tr-nav-item href="#">${icon('lock', 18, 'icon')}Security</tr-nav-item>
      <tr-nav-item href="#">${icon('card', 18, 'icon')}Billing</tr-nav-item>
    </tr-nav>
  </div>
  <tr-panel class="pv-main" depth="2">
    <form class="pv-form">
      <div class="pv-form-head">
        <div class="pv-avatar" aria-hidden="true">JR</div>
        <div><h3>Profile</h3><p class="pv-muted">How other people see you.</p></div>
      </div>
      <div class="pv-grid">
        <tr-input label="Display name" value="Jules Rivera" required></tr-input>
        <tr-input label="Email" type="email" value="jules@example.com" required></tr-input>
        <tr-select label="Time zone" value="cet">
          <tr-option value="pst">Pacific (UTC−8)</tr-option>
          <tr-option value="est">Eastern (UTC−5)</tr-option>
          <tr-option value="gmt">London (UTC+0)</tr-option>
          <tr-option value="cet">Berlin (UTC+1)</tr-option>
          <tr-option value="jst">Tokyo (UTC+9)</tr-option>
        </tr-select>
      </div>
      <tr-segmented label="Appearance" value="auto">
        <tr-option value="light">Light</tr-option>
        <tr-option value="dark">Dark</tr-option>
        <tr-option value="auto">Match system</tr-option>
      </tr-segmented>
      <tr-textarea label="Bio" rows="3" maxlength="160" value="Product designer. Collects old calculators and fountain pens."></tr-textarea>
      <fieldset class="pv-fieldset">
        <legend>Email me about</legend>
        <tr-checkbox checked>Mentions and replies</tr-checkbox>
        <tr-checkbox checked>Weekly digest</tr-checkbox>
        <tr-checkbox>Product news</tr-checkbox>
      </fieldset>
      <tr-radio-group label="Profile visibility" value="team">
        <tr-radio value="public">Public</tr-radio>
        <tr-radio value="team">Team only</tr-radio>
        <tr-radio value="private">Private</tr-radio>
      </tr-radio-group>
      <div class="pv-row">
        <tr-switch checked>Two-factor sign-in</tr-switch>
      </div>
      <div class="pv-row pv-end">
        <tr-button type="reset">Cancel</tr-button>
        <tr-button tone="accent" type="submit">Save changes</tr-button>
      </div>
    </form>
  </tr-panel>
</div>`;

const dashboard = `
<div class="pv-app pv-dash">
  <tr-toolbar class="pv-bar" label="Dashboard">
    <span class="pv-title">${icon('chart')} Northwind · Revenue</span>
    <tr-segmented label="Range" value="week" size="sm">
      <tr-option value="day">Day</tr-option>
      <tr-option value="week">Week</tr-option>
      <tr-option value="month">Month</tr-option>
      <tr-option value="year">Year</tr-option>
    </tr-segmented>
    <tr-button size="sm">${icon('upload', 16, 'start')}Export</tr-button>
  </tr-toolbar>
  <div class="pv-kpis">
    <tr-panel class="pv-kpi" depth="2"><p class="pv-kpi-label">Revenue</p><p class="pv-kpi-value">$48,210</p><tr-badge tone="success">+12.4%</tr-badge></tr-panel>
    <tr-panel class="pv-kpi" depth="2"><p class="pv-kpi-label">Orders</p><p class="pv-kpi-value">1,284</p><tr-badge tone="success">+3.1%</tr-badge></tr-panel>
    <tr-panel class="pv-kpi" depth="2"><p class="pv-kpi-label">Refunds</p><p class="pv-kpi-value">23</p><tr-badge tone="danger">+8</tr-badge></tr-panel>
    <tr-panel class="pv-kpi" depth="2"><p class="pv-kpi-label">Quota</p><p class="pv-kpi-value">72%</p><tr-progress value="72" max="100" aria-label="Quarterly quota"></tr-progress></tr-panel>
  </div>
  <tr-panel depth="2" class="pv-chart">
    <tr-tabs value="channels">
      <tr-tab panel="channels">Channels</tr-tab>
      <tr-tab panel="products">Products</tr-tab>
      <tr-tab panel="regions">Regions</tr-tab>
      <tr-tab-panel name="channels">
        <div class="pv-bars" aria-hidden="true">${[42, 58, 51, 66, 73, 61, 88, 79, 92, 70, 84, 96].map((v) => `<span style="--h:${v}%"></span>`).join('')}</div>
        <tr-list>
          <tr-list-item><span slot="start" class="pv-dot" style="--c: oklch(78% 0.16 65)"></span>Direct<span slot="description">Website and app</span><span slot="end">$21,940</span></tr-list-item>
          <tr-list-item><span slot="start" class="pv-dot" style="--c: oklch(75% 0.12 200)"></span>Partners<span slot="description">Resellers</span><span slot="end">$14,302</span></tr-list-item>
          <tr-list-item><span slot="start" class="pv-dot" style="--c: oklch(72% 0.14 300)"></span>Marketplace<span slot="description">Third-party stores</span><span slot="end">$11,968</span></tr-list-item>
        </tr-list>
      </tr-tab-panel>
      <tr-tab-panel name="products"><p class="pv-muted pv-pad">Top sellers this week: Field Notebook, Desk Lamp, Brass Pen.</p></tr-tab-panel>
      <tr-tab-panel name="regions"><p class="pv-muted pv-pad">Europe leads with 46% of revenue, then North America with 38%.</p></tr-tab-panel>
    </tr-tabs>
  </tr-panel>
</div>`;

const files = `
<div class="pv-app">
  <tr-panel class="pv-window" depth="3">
    <div class="pv-window-inner">
      <tr-toolbar class="pv-bar" label="File actions">
        <tr-button tone="accent">${icon('upload', 16, 'start')}Upload</tr-button>
        <tr-button>New folder</tr-button>
        <tr-input class="pv-search" type="search" placeholder="Search files" aria-label="Search files"></tr-input>
        <tr-segmented label="View" value="list" size="sm">
          <tr-option value="grid" aria-label="Grid view">${icon('grid', 16)}</tr-option>
          <tr-option value="list" aria-label="List view">${icon('list', 16)}</tr-option>
        </tr-segmented>
      </tr-toolbar>
      <div class="pv-files">
        <tr-nav label="Places" class="pv-files-side">
          <tr-nav-item href="#" current>${icon('folder', 18, 'icon')}Documents</tr-nav-item>
          <tr-nav-item href="#">${icon('image', 18, 'icon')}Pictures</tr-nav-item>
          <tr-nav-item href="#">${icon('star', 18, 'icon')}Starred</tr-nav-item>
          <tr-nav-item href="#">${icon('trash', 18, 'icon')}Trash</tr-nav-item>
        </tr-nav>
        <div class="pv-files-main">
          <tr-list>
            <tr-list-item>${icon('folder', 22, 'start')}Quarterly reports<span slot="description">12 files</span><span slot="end">Today</span></tr-list-item>
            <tr-list-item>${icon('file', 22, 'start')}Brand guidelines.pdf<span slot="description">4.2 MB</span><span slot="end">Yesterday</span></tr-list-item>
            <tr-list-item>${icon('image', 22, 'start')}Launch poster.png<span slot="description">2.8 MB</span><span slot="end">Mon</span></tr-list-item>
            <tr-list-item>${icon('file', 22, 'start')}Contract draft.docx<span slot="description">88 KB</span><tr-button slot="end" size="sm" shape="circle" id="pv-file-more" aria-label="More actions for Contract draft">${icon('more', 16)}</tr-button></tr-list-item>
          </tr-list>
          <tr-menu anchor="pv-file-more" aria-label="File actions">
            <tr-menu-item value="open">Open</tr-menu-item>
            <tr-menu-item value="rename">Rename</tr-menu-item>
            <tr-menu-item value="star" type="checkbox">Starred</tr-menu-item>
            <tr-menu-item separator></tr-menu-item>
            <tr-menu-item value="delete">Delete…</tr-menu-item>
          </tr-menu>
          <div class="pv-upload"><span>Uploading <strong>Launch film.mov</strong></span><tr-progress value="64" max="100" aria-label="Upload progress"></tr-progress></div>
        </div>
      </div>
    </div>
  </tr-panel>
</div>`;

const checkout = `
<div class="pv-app pv-checkout">
  <tr-panel depth="2">
    <form class="pv-form">
      <h3>Shipping</h3>
      <div class="pv-grid">
        <tr-input label="Full name" autocomplete="name" value="Jules Rivera"></tr-input>
        <tr-input label="Postcode" autocomplete="postal-code" value="10115"></tr-input>
      </div>
      <tr-radio-group label="Delivery" value="standard">
        <tr-radio value="standard">Standard · 3–5 days · free</tr-radio>
        <tr-radio value="express">Express · next day · $9</tr-radio>
      </tr-radio-group>
      <h3>Payment</h3>
      <tr-input label="Card number" inputmode="numeric" placeholder="1234 5678 9012 3456">${icon('card', 18, 'start')}</tr-input>
      <div class="pv-grid">
        <tr-input label="Expiry" placeholder="MM/YY"></tr-input>
        <tr-input label="CVC" inputmode="numeric"></tr-input>
      </div>
      <tr-checkbox>I accept the terms of sale</tr-checkbox>
      <tr-button tone="accent" size="lg" class="pv-pay">Pay $128.00</tr-button>
    </form>
  </tr-panel>
  <tr-panel class="pv-summary" depth="1">
    <h3>Order</h3>
    <tr-list>
      <tr-list-item>Field notebook ×2<span slot="end">$36.00</span></tr-list-item>
      <tr-list-item>Brass pen<span slot="end">$64.00</span></tr-list-item>
      <tr-list-item>Desk blotter<span slot="end">$28.00</span></tr-list-item>
    </tr-list>
    <p class="pv-total"><span>Total</span><strong>$128.00</strong></p>
  </tr-panel>
</div>`;

const home = `
<div class="pv-app pv-home">
  <tr-panel depth="2" class="pv-climate">
    <div class="pv-climate-inner">
      <div class="pv-climate-head"><h3>Living room</h3><tr-badge tone="success">Heating</tr-badge></div>
      <div class="pv-climate-dial">
        <tr-knob label="Target temperature" min="12" max="28" step="0.5" value="21.5" unit="°C" ticks="17"></tr-knob>
        <tr-display type="lcd" glyphs="7seg" digits="4" value="21.5" aria-label="Current temperature"></tr-display>
      </div>
      <tr-slider label="Fan speed" min="0" max="5" step="1" value="2" marks="ticks"></tr-slider>
    </div>
  </tr-panel>
  <div class="pv-tiles">
    <tr-panel depth="2" class="pv-tile">${icon('sun', 22)}<div><strong>Ceiling lights</strong><p class="pv-muted">80% · warm</p></div><tr-switch checked aria-label="Ceiling lights"></tr-switch></tr-panel>
    <tr-panel depth="2" class="pv-tile">${icon('drop', 22)}<div><strong>Garden sprinklers</strong><p class="pv-muted">Next run 06:00</p></div><tr-switch aria-label="Garden sprinklers"></tr-switch></tr-panel>
    <tr-panel depth="2" class="pv-tile">${icon('lock', 22)}<div><strong>Front door</strong><p class="pv-muted">Locked</p></div><tr-switch checked aria-label="Front door lock"></tr-switch></tr-panel>
    <tr-panel depth="2" class="pv-tile">
      <div class="pv-leds"><span><tr-led on color="green" label="Online"></tr-led> Hub online</span><span><tr-led on color="amber" blink label="Syncing"></tr-led> Syncing</span></div>
      <tr-meter label="Energy use" value="0.45" segments="12"></tr-meter>
    </tr-panel>
  </div>
</div>`;

const components = `
<div class="pv-app pv-kit">
  <tr-panel depth="2" class="pv-kit-card">
    <h3>Buttons</h3>
    <div class="pv-row">
      <tr-button>Default</tr-button>
      <tr-button tone="accent">Accent</tr-button>
      <tr-button tone="danger">Danger</tr-button>
      <tr-button toggle pressed aria-label="Bold">${icon('bold', 16)}</tr-button>
      <tr-button shape="circle" aria-label="Add">${icon('plus', 16)}</tr-button>
      <tr-button disabled>Disabled</tr-button>
    </div>
    <div class="pv-row">
      <tr-button size="sm">Small</tr-button>
      <tr-button size="lg" tone="accent">Large</tr-button>
    </div>
  </tr-panel>
  <tr-panel depth="2" class="pv-kit-card">
    <h3>Choice</h3>
    <div class="pv-row"><tr-switch checked>Wi-Fi</tr-switch><tr-switch>Bluetooth</tr-switch></div>
    <div class="pv-row"><tr-checkbox checked>Remember me</tr-checkbox><tr-checkbox indeterminate>Some files</tr-checkbox></div>
    <tr-radio-group label="Plan" value="pro" orientation="horizontal">
      <tr-radio value="free">Free</tr-radio><tr-radio value="pro">Pro</tr-radio><tr-radio value="team">Team</tr-radio>
    </tr-radio-group>
    <tr-segmented label="Align" value="center"><tr-option value="left">Left</tr-option><tr-option value="center">Center</tr-option><tr-option value="right">Right</tr-option></tr-segmented>
  </tr-panel>
  <tr-panel depth="2" class="pv-kit-card">
    <h3>Fields</h3>
    <tr-input label="Search" type="search" placeholder="Find anything">${icon('search', 16, 'start')}</tr-input>
    <tr-input label="Password" type="password" value="hunter22" error="Use at least 12 characters."></tr-input>
    <tr-select label="Country" value="de"><tr-option value="de">Germany</tr-option><tr-option value="fr">France</tr-option><tr-option value="jp">Japan</tr-option></tr-select>
  </tr-panel>
  <tr-panel depth="2" class="pv-kit-card">
    <h3>Range and status</h3>
    <tr-slider label="Volume" value="64" unit="%"></tr-slider>
    <tr-progress value="40" max="100" aria-label="Sync progress"></tr-progress>
    <div class="pv-row"><tr-badge>Draft</tr-badge><tr-badge tone="accent">New</tr-badge><tr-badge tone="success">Paid</tr-badge><tr-badge tone="danger">Overdue</tr-badge></div>
  </tr-panel>
</div>`;

export const SCREENS: Screen[] = [
  { id: 'settings', label: 'Settings', html: settings },
  { id: 'dashboard', label: 'Dashboard', html: dashboard },
  { id: 'files', label: 'Files', html: files },
  { id: 'checkout', label: 'Checkout', html: checkout },
  { id: 'home', label: 'Home', html: home },
  { id: 'kit', label: 'Components', html: components },
];
