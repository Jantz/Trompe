/**
 * Trompe's built-in icons: everyday app glyphs drawn on a 24×24 grid with round 1.75 strokes
 * (`fill="none" stroke="currentColor"` is set by `tr-icon`, so the markup here is only shapes).
 * Dots are tiny stroked circles, so every finish (engraved, embossed, lit) treats them alike.
 *
 * Add your own with `registerIcons({ name: '<path d="…"/>' })`, drawn on the same grid.
 */

const dot = (cx: number, cy: number) => `<circle cx="${cx}" cy="${cy}" r=".4"/>`;
const ring = '<circle cx="12" cy="12" r="8.5"/>';

const builtIn: Record<string, string> = {
  // Navigation and actions
  home: '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9v10.5H10v-6h4v6h4.5V9"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  'zoom-in': '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M10.5 8v5M8 10.5h5"/>',
  menu: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
  settings: '<path d="M18.55 9.83L20.82 10.21L20.82 13.79L18.55 14.17L18.17 15.1L19.5 16.97L16.97 19.5L15.1 18.17L14.17 18.55L13.79 20.82L10.21 20.82L9.83 18.55L8.9 18.17L7.03 19.5L4.5 16.97L5.83 15.1L5.45 14.17L3.18 13.79L3.18 10.21L5.45 9.83L5.83 8.9L4.5 7.03L7.03 4.5L8.9 5.83L9.83 5.45L10.21 3.18L13.79 3.18L14.17 5.45L15.1 5.83L16.97 4.5L19.5 7.03L18.17 8.9z"/><circle cx="12" cy="12" r="3"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  'chevron-up': '<path d="m6 15 6-6 6 6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-left': '<path d="m15 6-6 6 6 6"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  'chevrons-up-down': '<path d="m8 9.5 4-4 4 4M8 14.5l4 4 4-4"/>',
  'arrow-up': '<path d="M12 19.5v-15M5.5 11 12 4.5l6.5 6.5"/>',
  'arrow-down': '<path d="M12 4.5v15M5.5 13l6.5 6.5 6.5-6.5"/>',
  'arrow-left': '<path d="M19.5 12h-15M11 5.5 4.5 12l6.5 6.5"/>',
  'arrow-right': '<path d="M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  'more-horizontal': '<circle cx="5.5" cy="12" r=".75"/><circle cx="12" cy="12" r=".75"/><circle cx="18.5" cy="12" r=".75"/>',
  'more-vertical': '<circle cx="12" cy="5.5" r=".75"/><circle cx="12" cy="12" r=".75"/><circle cx="12" cy="18.5" r=".75"/>',
  external: '<path d="M14 4.5h5.5V10M19.5 4.5 11 13"/><path d="M18 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5.5"/>',
  filter: '<path d="M4 5h16l-6 7.5V18l-4 2v-7.5z"/>',
  sort: '<path d="M8 4.5v15M4.5 8 8 4.5 11.5 8M16 19.5v-15M12.5 16l3.5 3.5 3.5-3.5"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 0 1-13.1 5M4.5 12a7.5 7.5 0 0 1 13.1-5"/><path d="M18 3.5v4h-4M6 20.5v-4h4"/>',
  undo: '<path d="M9 14 4.5 9.5 9 5"/><path d="M4.5 9.5h10a5 5 0 0 1 0 10H11"/>',
  redo: '<path d="m15 14 4.5-4.5L15 5"/><path d="M19.5 9.5h-10a5 5 0 0 0 0 10H13"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M4.5 19.5h15"/>',
  upload: '<path d="M12 15.5v-11M7 9l5-5 5 5M4.5 19.5h15"/>',
  share: '<circle cx="17.5" cy="5.5" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/><path d="m8.7 10.7 6.6-3.9M8.7 13.3l6.6 3.9"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1.2 1.2"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"/>',
  send: '<path d="M20.5 3.5 10.5 13.5M20.5 3.5l-6 17-4-7-7-4z"/>',
  edit: '<path d="M15.5 4.5 19.5 8.5 9 19H5v-4z"/><path d="m13 7 4 4"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="1.8"/><path d="M15.5 8.5V5A1.5 1.5 0 0 0 14 3.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5"/>',
  trash: '<path d="M4.5 6.5h15M9.5 6.5v-2h5v2M6.5 6.5l1 13a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1l1-13M10 10.5v6M14 10.5v6"/>',
  paperclip: '<path d="m19.5 11.5-7.3 7.3a4.6 4.6 0 0 1-6.5-6.5l7.6-7.6a3 3 0 0 1 4.3 4.3l-7.4 7.4a1.5 1.5 0 0 1-2.1-2.1l6.8-6.8"/>',
  login: '<path d="M10 4.5h8A1.5 1.5 0 0 1 19.5 6v12a1.5 1.5 0 0 1-1.5 1.5h-8"/><path d="M3.5 12H14M10 8l4 4-4 4"/>',
  logout: '<path d="M14 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h8"/><path d="M10 12h10.5M16.5 8l4 4-4 4"/>',
  power: '<path d="M12 3.5v8"/><path d="M7.2 6.3a7.5 7.5 0 1 0 9.6 0"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/>',
  list: `<path d="M9 6.5h11M9 12h11M9 17.5h11"/>${dot(4.75, 6.5)}${dot(4.75, 12)}${dot(4.75, 17.5)}`,
  sidebar: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M9 4.5v15"/>',
  dashboard: '<path d="M4 17.5a8.5 8.5 0 1 1 16 0"/><path d="m12 14 3.5-4.5"/><circle cx="12" cy="14" r="1"/>',
  play: '<path d="M7.5 5.3v13.4a.8.8 0 0 0 1.2.7l10.6-6.7a.8.8 0 0 0 0-1.4L8.7 4.6a.8.8 0 0 0-1.2.7z"/>',
  pause: '<path d="M8.5 5v14M15.5 5v14"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',

  // Status
  info: `${ring}<path d="M12 11v5.5"/>${dot(12, 7.75)}`,
  warning: `<path d="M10.3 4.3a2 2 0 0 1 3.4 0l7.3 12.6a2 2 0 0 1-1.7 3H4.7a2 2 0 0 1-1.7-3z"/><path d="M12 9.5v4"/>${dot(12, 16.75)}`,
  error: `${ring}<path d="M12 7.5v5"/>${dot(12, 16)}`,
  help: `${ring}<path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.5v.4"/>${dot(12, 16.75)}`,
  'check-circle': `${ring}<path d="m8 12.3 2.8 2.8 5.4-5.6"/>`,
  'x-circle': `${ring}<path d="m9 9 6 6M15 9l-6 6"/>`,
  'plus-circle': `${ring}<path d="M12 8v8M8 12h8"/>`,
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5v-3a4 4 0 0 1 8 0v3M12 14.5v2"/>',
  unlock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5v-3a4 4 0 0 1 7.7-1.5M12 14.5v2"/>',
  key: '<circle cx="8" cy="15" r="4.5"/><path d="m11.2 11.8 8.3-8.3M16.5 6.5 19 9M14 9l2 2"/>',
  shield: '<path d="M12 3.5 19 6v5.5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z"/>',
  'shield-check': '<path d="M12 3.5 19 6v5.5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off':
    '<path d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.4 3.2M6.5 7.2C3.9 8.9 2.5 12 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.7-1.3"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M4 4l16 16"/>',
  wifi: `<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.3a9.5 9.5 0 0 1 13 0M8.6 15.6a5 5 0 0 1 6.8 0"/><circle cx="12" cy="19" r=".6"/>`,
  battery: '<rect x="2.5" y="7.5" width="17" height="9" rx="2"/><path d="M21.5 10.5v3M6 10.5v3M9.5 10.5v3M13 10.5v3"/>',
  'trending-up': '<path d="m3.5 17 6-6 4 4 7-7.5"/><path d="M15 7.5h5.5V13"/>',
  'trending-down': '<path d="m3.5 7 6 6 4-4 7 7.5"/><path d="M15 16.5h5.5V11"/>',

  // People and communication
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20c.8-3.8 3.7-6 7.5-6s6.7 2.2 7.5 6"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 19.5c.6-3.3 3.1-5.3 6.5-5.3s5.9 2 6.5 5.3M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.6c2.2.6 3.6 2.4 4 4.9"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6.5L20.5 7"/>',
  inbox: '<path d="M3.5 13.5 6 5.5a1.5 1.5 0 0 1 1.4-1h9.2a1.5 1.5 0 0 1 1.4 1l2.5 8V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18z"/><path d="M3.5 13.5H8l1.5 2.5h5l1.5-2.5h4.5"/>',
  message: '<path d="M4 6a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 6v9a1.5 1.5 0 0 1-1.5 1.5H10L5.5 20v-3.5A1.5 1.5 0 0 1 4 15z"/>',
  phone: '<path d="M5 4h3l1.5 4-2 1.3a10 10 0 0 0 7.2 7.2l1.3-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A15.5 15.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z"/>',
  video: '<rect x="3" y="6.5" width="12.5" height="11" rx="2"/><path d="m15.5 10.5 5.5-3v9l-5.5-3"/>',
  mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>',
  smile: `${ring}<path d="M8.5 14.5a4 4 0 0 0 7 0"/>${dot(9, 9.75)}${dot(15, 9.75)}`,
  heart: '<path d="M12 19.5s-7.5-4.4-7.5-10a4 4 0 0 1 7.5-2 4 4 0 0 1 7.5 2c0 5.6-7.5 10-7.5 10z"/>',
  star: '<path d="M12 3.8 14.29 9.44 20.37 9.88 15.71 13.81 17.17 19.72 12 16.5 6.83 19.72 8.29 13.81 3.63 9.88 9.71 9.44z"/>',
  bookmark: '<path d="M6.5 3.5h11v17L12 16.5l-5.5 4z"/>',
  flag: '<path d="M5 21V4M5 4.5h11l-2 4 2 4H5"/>',
  sparkle: '<path d="M12 3.5c.6 4.4 2.1 5.9 6.5 6.5-4.4.6-5.9 2.1-6.5 6.5-.6-4.4-2.1-5.9-6.5-6.5 4.4-.6 5.9-2.1 6.5-6.5z"/><path d="M18.5 15.5v4M16.5 17.5h4"/>',

  // Things
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  clock: `${ring}<path d="M12 7.5V12l3 2"/>`,
  tag: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.6 6.6a1.4 1.4 0 0 1-2 0z"/><circle cx="8" cy="8" r="1.2"/>',
  folder: '<path d="M3.5 7A1.5 1.5 0 0 1 5 5.5h4.5l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18z"/>',
  file: '<path d="M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5z"/><path d="M13.5 3.5v5h5"/>',
  'file-text': '<path d="M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5z"/><path d="M13.5 3.5v5h5M9 13h6M9 16.5h4"/>',
  clipboard: '<rect x="5" y="5" width="14" height="16" rx="1.5"/><path d="M9 3.5h6v3H9zM9 11h6M9 15h4"/>',
  book: '<path d="M5 18.5V5a1.5 1.5 0 0 1 1.5-1.5H19V17H6.5A1.5 1.5 0 0 0 5 18.5 1.5 1.5 0 0 0 6.5 20H19"/>',
  archive: '<rect x="3.5" y="4.5" width="17" height="4.5" rx="1"/><path d="M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="9.5" r="1.6"/><path d="m4 17.5 5-5 4 4 2.5-2.5 4.5 4.5"/>',
  camera: '<path d="M3.5 8.5A1.5 1.5 0 0 1 5 7h2.5L9 4.5h6L16.5 7H19a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18z"/><circle cx="12" cy="13" r="3.5"/>',
  printer: '<path d="M7 9V3.5h10V9M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5 9h14a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 19 17h-2"/><path d="M7 14h10v6.5H7z"/>',
  briefcase: '<rect x="3.5" y="7" width="17" height="12.5" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3.5 12.5h17"/>',
  building: '<path d="M5 20.5v-16a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 9.5h3a1 1 0 0 1 1 1v10M3.5 20.5h17M8.5 7.5h3M8.5 11.5h3M8.5 15.5h3"/>',
  package: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9M8 5.3l8 4.5"/>',
  truck: '<path d="M14.5 16.5V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10.5h2M14.5 9H18l3 3.5v4h-2M9 16.5h5.5"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v7.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V12M12 8v12.5M12 8C10.5 4 7 4.3 7 6.3S10 8 12 8zM12 8c1.5-4 5-3.7 5-1.7S14 8 12 8z"/>',
  globe: `${ring}<path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5S9.7 5.9 12 3.5z"/>`,
  'map-pin': '<path d="M12 20.5s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0c0 4.9-6.5 10.5-6.5 10.5z"/><circle cx="12" cy="10" r="2.3"/>',
  compass: `${ring}<path d="m15.5 8.5-2 5-5 2 2-5z"/>`,

  // Commerce and data
  cart: '<path d="M3 4h2.5l2.2 11.2a1.5 1.5 0 0 0 1.5 1.3h8.3a1.5 1.5 0 0 0 1.5-1.2L20.5 8H6.3"/><circle cx="9.5" cy="20" r="1.2"/><circle cx="17" cy="20" r="1.2"/>',
  'credit-card': '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M6.5 15h3"/>',
  wallet: `<path d="M18.5 7.5v-2A1.5 1.5 0 0 0 17 4H5.5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2H19a1.5 1.5 0 0 0 1.5-1.5V9A1.5 1.5 0 0 0 19 7.5H5.5a2 2 0 0 1-2-1.5"/>${dot(16.5, 13.75)}`,
  bank: '<path d="M3.5 9 12 4l8.5 5M5 9.5v8M9.7 9.5v8M14.3 9.5v8M19 9.5v8M3.5 20h17"/>',
  receipt: '<path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  dollar: '<path d="M12 3.5v17M16 7.5c-.6-1.4-2.1-2.2-4-2.2-2.3 0-4 1.1-4 3s1.6 2.6 4 3.2 4.3 1.3 4.3 3.4-1.8 3.2-4.3 3.2c-2.1 0-3.7-.9-4.3-2.4"/>',
  'chart-bar': '<path d="M4 20h16M7 16.5V11M12 16.5V6M17 16.5v-8"/>',
  'chart-line': '<path d="M4 4v16h16"/><path d="m7.5 14.5 3.5-4 3 2.5 5-6"/>',
  'chart-pie': '<path d="M20.5 13.5A8.5 8.5 0 1 1 10.5 3.6"/><path d="M14 3.3a7 7 0 0 1 6.7 6.7H14z"/>',

  // Weather and nature
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M19.5 14.5a8 8 0 0 1-10-10 8 8 0 1 0 10 10z"/>',
  cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.5 3.8 3.8 0 0 1-.3 7.5z"/>',
  thermometer: '<path d="M14.5 13.8V5.5a2.5 2.5 0 0 0-5 0v8.3a4.5 4.5 0 1 0 5 0z"/><path d="M12 9v7"/>',
  droplet: '<path d="M12 3.5s-6 6.7-6 11a6 6 0 0 0 12 0c0-4.3-6-11-6-11z"/>',
  leaf: '<path d="M5.5 18.5C4 10 9.5 4.5 19.5 4.5c0 10-5.5 15.5-14 14z"/><path d="M4.5 19.5 13 11"/>',
  flame: '<path d="M12 20.5a6 6 0 0 1-6-6c0-3.5 2.5-5.5 3.5-8.5 1.5 1.5 2 3 2 4.5 1-1 1.8-2.3 2-4 2.5 2 4.5 5 4.5 8a6 6 0 0 1-6 6z"/>',
  bolt: '<path d="M13 3 5.5 13.5H12L11 21l7.5-10.5H12z"/>',
};

const registry = new Map<string, string>(Object.entries(builtIn));
const listeners = new Set<() => void>();

/** The markup registered for `name`, or undefined. */
export function iconMarkup(name: string): string | undefined {
  return registry.get(name);
}

/** Every icon name available now: the built-in set plus any you registered. */
export function iconNames(): string[] {
  return [...registry.keys()].sort();
}

/**
 * Add or replace icons. Each value is SVG shape markup drawn on a 24×24 grid, as strokes
 * (`<path d="…"/>`, `<circle …/>`); `tr-icon` supplies the stroke, caps and colour. Icons already
 * on the page with a newly registered name draw themselves at once.
 *
 * @example registerIcons({ espresso: '<path d="M5 8h11v6a5 5 0 0 1-10 0z"/><path d="M16 9.5h1.5a2.5 2.5 0 0 1 0 5H16"/>' })
 */
export function registerIcons(icons: Record<string, string>): void {
  for (const [name, markup] of Object.entries(icons)) registry.set(name, markup);
  for (const fn of listeners) fn();
}

/** @internal Icons re-render when the registry changes. */
export function onIconsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
