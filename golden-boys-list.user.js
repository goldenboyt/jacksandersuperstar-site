// ==UserScript==
// @name         Jacks List Generator
// @namespace    nightly-vin-list
// @author       jsander@tesla.com
// @version      19.6
// @updateURL    https://gist.githubusercontent.com/goldenboyt/3c5b3b0f20d44ca823c6e8c59d2ad0d7/raw/golden-boys-list.user.js
// @downloadURL  https://gist.githubusercontent.com/goldenboyt/3c5b3b0f20d44ca823c6e8c59d2ad0d7/raw/golden-boys-list.user.js
// @description  automates list making process
// @match        https://*.tesla.com/*
// @match        https://*.teslamotors.com/*
// @run-at       document-idle
// @grant        GM_setClipboard
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      garage.dev.teslamotors.com
// @connect      teslamotors.com
// ==/UserScript==
// @ts-nocheck

(() => {
  'use strict';

  const TARGET = {
    path: '/vehicles',
    upkeepPath: '/upkeep',
    driverlessEnv: 'prod',
    assignmentNames: {
      '59': 'RTB',
      '448': 'L4',
      '160': 'Injection',
      '474': 'RTB Smoke',
      '475': 'RTB Smoke',
      '476': 'RTB Smoke',
      '477': 'RTB Smoke'
    }
  };

  const CONFIG = {
    dateOffsetDays: 0,
    scrollDelayMs: 700,
    pageDelayMs: 2200,
    loadTimeoutMs: 22000,
    scrollStepPx: 900,
    maxScrollsPerPage: 140,
    maxPages: 10,
    upkeepMaxHours: 22,
    // A VIN counts as "completed" once ALL of these upkeep tasks are completed
    // within the shift window (start..end). Read from the upkeep page.
    upkeepCompleteTasks: ['cabinCleaning', 'offgassingInspection'],
    // Cybercabs are handled differently: cabin cleaning / offgassing aren't daily.
    // A cybercab is only included if one of its tasks is due within this many hours.
    cybercabDueWithinHours: 24,
    // The List drops reservations further out than this (we only need cars soon).
    listReservationWindowHours: 24,
    // Arriving cars only show if they return within this many hours of the
    // tracking start (7:30 PM, same as work count / progress bar). The shift
    // itself starts at 8:00 PM, but tracking begins at 7:30 PM, so 7:30 PM + 10h
    // = 5:30 AM cutoff — cars back later than that can't be worked this shift.
    arrivingWindowFromShiftStartHours: 10,
    // List/Vins left/Work Count all scan the same upkeep page. Within this many
    // minutes, Vins left and Work Count reuse the last scan instead of re-scanning.
    scanReuseMinutes: 10,
    // A scan returning fewer than this many VINs is treated as a failed/blank load
    // (we keep the previous result instead of overwriting it).
    minScanVins: 5,
    autoUpkeepMinutes: 5,
    // Smaller scroll step on upkeep so virtualized rows overlap and task chips
    // (which render lazily) aren't skipped between capture points.
    upkeepScrollStepPx: 450,
    progressShiftStartHour: 19,
    progressShiftStartMinute: 30,
    progressShiftEndHour: 7,
    progressShiftEndMinute: 30
  };
  const VERSION = '19.6';
  const UI = {
    accent: '#D4B87A',
    accentBright: '#E8D4A8',
    accentText: '#12100c',
    panelBg: 'linear-gradient(168deg, rgba(16,14,11,.98) 0%, rgba(7,7,9,.99) 55%, rgba(10,9,8,.98) 100%)',
    panelBorder: 'rgba(201,168,107,.28)',
    panelShadow: '0 16px 56px rgba(0,0,0,.6), 0 0 0 1px rgba(201,168,107,.1), inset 0 1px 0 rgba(232,212,168,.14)',
    panelWidth: '920px',
    panelRadius: '20px',
    buttonRowPad: '12px 22px 16px 22px',
    chromePad: '12px 22px 10px 22px'
  };
  const VERSION_SEEN_KEY = '__jacks_list_version_seen__';
  const VERSION_LOG_ID = '19.6';
  const STATE_KEY = '__jacks_list_state_v146__';
  const LAST_TEXT_KEY = '__jacks_list_last_text_v146__';
  const RESERVATION_VINS_KEY = '__jacks_list_reservation_vins__';
  // VINs that surfaced on upkeep mid-shift but weren't on the pasted list. They're
  // treated like new list reservations (count toward progress + work count), still
  // gated by the same reservation-window rules (includeInUpkeep). Reset per list.
  const SURFACED_VINS_KEY = '__jacks_list_surfaced_vins__';
  const RESERVATION_LIST_TEXT_KEY = '__jacks_list_reservation_list_text__';
  const RESERVATION_VINS_TIME_KEY = '__jacks_list_reservation_vins_time__';
  const RESERVATION_VINS_PROD_KEY = '__jacks_list_reservation_vins_prod__';
  const PANEL_SIZE_KEY = '__jacks_list_panel_size__';
  const PANEL_DEFAULT_OUTPUT_H = 500;
  const PANEL_DEFAULT_MAX_H = 'calc(100vh - 80px)';
  const WC_STATE_KEY = '__jacks_list_wc_state__';
  const PROGRESS_DONE_VINS_KEY = '__jacks_list_progress_done__';
  const PROGRESS_WC_CACHE_KEY = '__jacks_list_progress_wc_cache__';
  const PROGRESS_LAST_TEXT_KEY = '__jacks_list_progress_last_text__';
  const PROGRESS_PENDING_FINISH_KEY = '__jacks_list_progress_pending_finish__';
  const LIST_LAST_TEXT_KEY = '__jacks_list_last_text__';
  const UPKEEP_LAST_TEXT_KEY = '__jacks_list_upkeep_last_text__';
  const UPKEEP_OVERVIEW_LAST_TEXT_KEY = '__jacks_list_upkeep_overview_last_text__';
  const UPKEEP_DUE_ON_LIST_KEY = '__jacks_list_upkeep_due_on_list__';
  const UPKEEP_DONE_VINS_KEY = '__jacks_list_upkeep_done_vins__';
  // VINs a human manually marked complete via the ✓ on a list row. Shift-scoped.
  // Counts toward the progress bar / Vins left but NEVER credits anyone in Work
  // Count (kept entirely separate from upkeepTaskData / task history).
  const MANUAL_DONE_VINS_KEY = '__jacks_list_manual_done_vins__';
  const UPKEEP_SCAN_CACHE_KEY = '__jacks_list_upkeep_scan_cache__';
  // Every completed upkeep task we've seen this shift, so Work Count keeps the
  // credit even after a VIN drops off the upkeep page.
  const UPKEEP_TASK_HISTORY_KEY = '__jacks_list_upkeep_task_history__';
  // Reservation VINs we've actually seen on the upkeep page this shift. Once a
  // VIN that was here disappears, its upkeep is finished -> mark it done.
  const UPKEEP_SEEN_KEY = '__jacks_list_upkeep_seen__';
  // Cross-reference data pulled from the admin /vehicles tab during a List scan:
  // per-VIN { commuter, unavailable, until } used purely to categorize the VINs
  // that come from upkeep (admin never adds VINs, only labels them).
  const LIST_ADMIN_XREF_KEY = '__jacks_list_admin_xref__';
  const UPKEEP_SCOPE_MAX_AGE_MS = 90 * 60 * 1000;
  const LAST_SCAN_DURATION_KEY = '__jacks_list_last_scan_duration__';
  const OUTPUT_SCROLL_KEY = '__jacks_list_output_scroll__';
  const outputScrollSig = t => (t ? String(t.length) + ':' + String(t).slice(0, 24) : '');
  const AUTO_UPKEEP_MS = () => CONFIG.autoUpkeepMinutes * 60 * 1000;
  const UPKEEP_START_URL = 'https://humans.tesla.com/upkeep?schedule=Dallas';
  // Admin /vehicles pages the List scan cross-references for categorization.
  const ADMIN_VEHICLES_SCHEDULE = '310';
  const ADMIN_AVAILABLE_URL = `https://humans.tesla.com/vehicles?schedule=${ADMIN_VEHICLES_SCHEDULE}&status=Available`;
  const ADMIN_UNAVAILABLE_URL = `https://humans.tesla.com/vehicles?schedule=${ADMIN_VEHICLES_SCHEDULE}&status=Unavailable`;
  // "Low CC" button: available cybercabs, used to list low-charge ones (info only).
  const LOW_CC_URL = `https://humans.tesla.com/vehicles?chassis=CYBERCAB&schedule=${ADMIN_VEHICLES_SCHEDULE}&status=Available`;
  const LOW_CC_MAX_BATTERY = 30; // list cybercabs strictly under this %
  const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
  const VIN_FIND_RE = /\b[A-HJ-NPR-Z0-9]{17}\b/g;
  const CHASSIS_RE = /\b(MY|CT|CC|M3|MX|MS|HW)\b/i;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const clean = value => String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  const isVin = value => VIN_RE.test(clean(value).toUpperCase());
  const firstVin = value => clean(value).toUpperCase().match(VIN_FIND_RE)?.[0] || '';
  // Specific VINs to always exclude from list/output, in addition to the 7G rule.
  const EXCLUDED_VINS = new Set([
    '7SAYGDEE4TA378600',
    '7SAYGDEE6TF340059',
    '7SAYGDEE8TA378602'
  ]);
  // VINs we never use — excluded from list/output. All 5YJ… are cybercabs and are kept.
  const isExcludedVin = value => {
    const v = clean(value).toUpperCase();
    return /^7G/i.test(v) || EXCLUDED_VINS.has(v);
  };
  const isCybercabVin = value => /^5YJ/i.test(clean(value).toUpperCase());

  let statusEl = null;
  let startButton = null;
  let copyButton = null;
  let upkeepButton = null;
  let progressButton = null;
  let reportButton = null;
  let lowCcButton = null;
  let panelMinimized = false;
  let statusHasBeenShown = false;
  let stopScanRequested = false;
  let activeScan = null;
  let rawMode = false;
  let fullOutputCache = '';
  let statusProgressValue = null;
  let statusFinalizeToken = 0;
  let statusHideAfterFullTimer = null;
  let statusHideSwipeTimer = null;
  let progressPreviewArmed = false;
  let listPreviewArmed = false;
  let upkeepPreviewArmed = false;
  // Per-VIN upkeep task completion captured during an upkeep scan (from the page's
  // task cells / React data). Reset at the start of each upkeep scan.
  let upkeepTaskData = {};
  // VINs flagged BACKUP on the upkeep page during the current scan — excluded.
  let upkeepBackupVins = new Set();
  let statusIsFinalizing = false;
  let isResumingScan = false;
  let statusFillSkipTransition = false;
  // One-shot: when set, the next showPreview() restores this scrollTop instead of
  // resetting to the top (used after a manual ✓ toggle, where the content changes
  // but we want to keep the user's place in the list).
  let forceRestoreTop = null;

  // Mission control pages live on a different domain (garage.dev.teslamotors.com
  // and garage.vn.teslamotors.com) and get a dedicated panel of assignment
  // buttons. The buttons will eventually
  // toggle blinkers; for now each one brings up the VINs for that time, read from
  // the list saved on humans.tesla.com via cross-origin GM storage.
  const SHARED_LIST_KEY = 'gb_shared_list_text';
  const SHARED_LIST_TIME_KEY = 'gb_shared_list_time';
  const SHARED_VINSLEFT_KEY = 'gb_shared_vinsleft_text';
  const SHARED_VINSLEFT_TIME_KEY = 'gb_shared_vinsleft_time';

  // ==========================================================================
  // SCHEDULE — auto-fire "Toggle Hazard Lights On" per Arriving bucket.
  //
  // When armed, one timer per "Arriving at <time>" bucket fires 5 minutes after
  // that arriving time. On fire it (1) targets that bucket's VINs on the page's
  // Include control, (2) HARD-VERIFIES the vin: chip is present, (3) opens the
  // Create Task modal, (4) sets Batch command = "Toggle Hazard Lights On",
  // (5) ensures "Now" timing, then (6) clicks the modal's "Create" — no prompt.
  //
  // MODE: MC_SCHED_MODE is 'LIVE' (auto-clicks Create). The final click is still
  //     hard-gated on mcHasVinChip() so it can never submit against the default
  //     "All" scope (which would toggle hazards fleet-wide), and on the command
  //     actually being set. Set MC_SCHED_MODE back to 'DRY_RUN' to make the
  //     scheduler only prep the modal (leaving Create to a human). The
  //     double-click time-button path is always LIVE but asks for confirmation
  //     first. See mcSchedFire().
  // ==========================================================================
  const MC_SCHED_MODE = 'LIVE'; // 'LIVE' (auto-clicks Create, still gated on the vin: chip + command) | 'DRY_RUN' (preps modal, never clicks Create)
  // Batch commands fired from the timeslot buttons. Holding a timeslot creates
  // both, one after the other (hazards, then precondition).
  const MC_HAZARD_CMD = 'Toggle Hazard Lights On';
  const MC_PRECONDITION_CMD = 'Precondition';
  const MC_SCHED_FIRE_OFFSET_MS = 5 * 60 * 1000; // fire this long after the arriving time
  const MC_SCHED_ENABLED_KEY = '__gb_mc_sched_enabled__'; // sessionStorage flag '1'
  const MC_SCHED_MAP_KEY = '__gb_mc_sched_map__';         // sessionStorage armed-schedule map

  let mcActiveKey = null;
  let mcSchedInterval = null;  // 1s ticker handle (drives countdown + fires)
  let mcSchedLastSig = '';     // last seen arr-bucket signature (re-arm on list change)
  let mcSchedFiring = false;   // true while a fire is mid-flight (one modal at a time)
  const mcSchedCooldown = {};  // key -> ms: short backoff after an aborted fire
  // Double-click detection for Arriving time buttons (native dblclick can be
  // flaky when the panel re-renders, so we also detect two quick clicks here).
  let mcLastArrClick = { label: '', at: 0 };
  const MC_DBLCLICK_MS = 700;
  let mcLastFireAttempt = 0;   // debounce so native dblclick + manual detect don't double-fire

  function gmGet(key, def) {
    try { if (typeof GM_getValue === 'function') { const v = GM_getValue(key, undefined); if (v !== undefined && v !== null) return v; } } catch { /* ignore */ }
    try { const v = localStorage.getItem('__' + key); if (v !== null) return v; } catch { /* ignore */ }
    return def;
  }
  function gmSet(key, val) {
    try { if (typeof GM_setValue === 'function') GM_setValue(key, val); } catch { /* ignore */ }
    try { localStorage.setItem('__' + key, String(val)); } catch { /* ignore */ }
  }
  function persistSharedList(text) {
    if (!text) return;
    gmSet(SHARED_LIST_KEY, text);
    gmSet(SHARED_LIST_TIME_KEY, Date.now());
  }

  // Normalize a time label or button into a canonical key (e.g. "ar 2am" -> "2a",
  // "5:30a" -> "5.30a") so buttons match the list's section headers.
  function mcTimeKey(s) {
    let t = String(s || '').toLowerCase().trim();
    t = t.replace(/^(arriving|arr|ar|due)\s+/i, '');
    t = t.replace(/\s+/g, '');
    t = t.replace(/:/g, '.');
    t = t.replace(/pm$/, 'p').replace(/am$/, 'a');
    t = t.replace(/\.00([ap])$/, '$1');
    return t;
  }

  // Parse the saved list text into time buckets keyed by "due|<time>" / "arr|<time>".
  // Self-contained so it doesn't depend on the humans-only code below the early return.
  function mcParseBuckets(text) {
    const buckets = new Map();
    if (!text) return buckets;
    const vinRe = /\b[A-HJ-NPR-Z0-9]{17}\b/g;
    let key = null;
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const due = line.match(/^Due (?:by|at)\s+(.+?)(?:\s*\[\d+\].*)?$/i);
      const arr = line.match(/^Arriving at\s+(.+?)(?:\s*\[\d+\].*)?$/i);
      if (due) { key = 'due|' + mcTimeKey(due[1]); continue; }
      if (arr) { key = 'arr|' + mcTimeKey(arr[1]); continue; }
      // Driverless and Back Ups are their own sections (anchored so the
      // "Driverless: N" / "Back Ups: N" count lines don't trigger them).
      if (/^Driverless(?:\s*\[\d+\])?\s*$/i.test(line)) { key = 'driverless|all'; continue; }
      if (/^Back ?Ups(?:\s*\[\d+\])?\s*$/i.test(line)) { key = 'backup|all'; continue; }
      if (/^={3,}/.test(line) || /^(Commuter|Unavailable|Training|Cybercabs|Reservations:|Total|Vins not required|Vins at the lot|No reservation|_{3,})/i.test(line)) {
        key = null;
      }
      if (!key) continue;
      const vins = line.match(vinRe);
      if (vins) {
        if (vins.some(isExcludedVin)) continue; // skip 7G VINs
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(line);
      }
    }
    return buckets;
  }

  // Refresh the panel's status line to reflect whether a list has carried over
  // from humans and how fresh it is. Skips updating while a selection is shown.
  function mcRefreshStatus(outEl) {
    const out = outEl || document.getElementById('gb-mc-out-title');
    if (!out) return;
    const box = document.getElementById('gb-mc-out');
    if (box && box.value) return;
    const text = gmGet(SHARED_LIST_KEY, '') || '';
    if (!text) { out.textContent = 'No list yet — open humans.tesla.com and run a List scan.'; return; }
    const ts = Number(gmGet(SHARED_LIST_TIME_KEY, 0)) || 0;
    const age = ts ? `${Math.round((Date.now() - ts) / 60000)}m ago` : 'unknown time';
    out.textContent = `List loaded (updated ${age}). Pick a time.`;
  }

  function mcSortTimes(times) {
    return [...new Set(times)].sort((a, b) => sortForSimpleTime(a) - sortForSimpleTime(b));
  }

  function mcHighlightActive() {
    document.querySelectorAll('#gb-mc-due-row button, #gb-mc-arr-row button, #gb-mc-vinsleft-btn, #gb-mc-driverless-btn, #gb-mc-backup-btn').forEach(b => {
      const key = b.dataset.key || '';
      if (key && key === mcActiveKey) {
        b.style.cssText = ghostButtonStyle() + `;background:${UI.accent};color:${UI.accentText};border-color:transparent;`;
      } else if (key.startsWith('arr|')) {
        // Arriving = cool blue tint (matches the list's arriving dot).
        b.style.cssText = ghostButtonStyle() + ';border-color:rgba(106,169,233,.5);color:#bcd6f5;';
      } else if (key.startsWith('due|')) {
        // Due = warm amber tint.
        b.style.cssText = ghostButtonStyle() + ';border-color:rgba(201,168,107,.55);color:#E8D4A8;';
      } else {
        b.style.cssText = ghostButtonStyle();
      }
    });
  }

  // Find the page's "Include" react-select control (the Targeted Vehicles input).
  function mcFindIncludeSelect() {
    const labelHas = (el, re) => re.test((el.querySelector('label')?.textContent || ''));
    // 1) criteria form-group whose label mentions "include" (but not "exclude").
    const groups = [...document.querySelectorAll('.form-group.td-criteria, .form-group')];
    let g = groups.find(el => labelHas(el, /include/i) && !labelHas(el, /exclude/i));
    if (g) return g;
    // 2) any react-select whose enclosing form-group label mentions include.
    const selects = [...document.querySelectorAll('.Select')];
    for (const s of selects) {
      const fg = s.closest('.form-group');
      if (fg && labelHas(fg, /include/i) && !labelHas(fg, /exclude/i)) return fg;
    }
    // 3) last resort: a react-select that currently holds an "All" chip.
    for (const s of selects) {
      if ([...s.querySelectorAll('.Select-value-label')].some(e => /^\s*all\s*$/i.test(e.textContent || ''))) {
        return s.closest('.form-group') || s;
      }
    }
    return null;
  }

  // Apply the given VINs to the page's Targeted Vehicles "Include" control:
  // remove the default "All" (and any prior chips), then enter a tesladex
  // query "vin: (V1 V2 ...)" the same way a user types + presses Enter.
  function mcHasVinChip() {
    const inc = mcFindIncludeSelect();
    if (!inc) return false;
    return [...inc.querySelectorAll('.Select-value-label')].some(e => /vin\s*:/i.test(e.textContent || ''));
  }

  // MouseEvent with `view: window` throws under some Tampermonkey sandboxes
  // ("Failed to convert value to 'Window'"); fall back to no view in that case.
  function gbMouseEvent(type, opts) {
    const o = Object.assign({ bubbles: true, cancelable: true }, opts || {});
    try { return new MouseEvent(type, Object.assign({}, o, { view: window })); }
    catch { return new MouseEvent(type, o); }
  }

  function mcClickEl(el) {
    if (!el) return;
    ['mousedown', 'mouseup', 'click'].forEach(t =>
      el.dispatchEvent(gbMouseEvent(t, { button: 0 })));
  }

  // react-select v1 attaches its remove logic as a React prop (onMouseDown),
  // not a real DOM listener, so synthetic DOM events are ignored. Reach into
  // the element's React props and call the handler the way a real click does.
  function mcReactProps(el) {
    if (!el) return null;
    const k = Object.keys(el).find(n => n.startsWith('__reactProps$') || n.startsWith('__reactEventHandlers$'));
    return k ? el[k] : null;
  }

  function mcFakeEvent() {
    return { preventDefault() {}, stopPropagation() {}, type: 'mousedown', button: 0, target: {}, currentTarget: {} };
  }

  function mcRemoveChips() {
    const inc = mcFindIncludeSelect();
    if (!inc) return;
    inc.querySelectorAll('.Select-value-icon').forEach(icon => {
      const p = mcReactProps(icon);
      if (p && typeof p.onMouseDown === 'function') {
        try { p.onMouseDown(mcFakeEvent()); return; } catch { /* fall through */ }
      }
      if (p && typeof p.onClick === 'function') {
        try { p.onClick(mcFakeEvent()); return; } catch { /* fall through */ }
      }
      mcClickEl(icon); // last-resort synthetic DOM event
    });
    // Also handle the single "clear" button react-select renders for defaults.
    inc.querySelectorAll('.Select-clear, .Select-clear-zone').forEach(c => {
      const p = mcReactProps(c);
      if (p && typeof p.onMouseDown === 'function') {
        try { p.onMouseDown(mcFakeEvent()); return; } catch { /* fall through */ }
      }
      mcClickEl(c);
    });
  }

  function mcTypeQuery(query) {
    const inc = mcFindIncludeSelect();
    if (!inc) return false;
    const input = inc.querySelector('.Select-input input') || inc.querySelector('input');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    input.focus();
    setter.call(input, query);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    ['keydown', 'keypress', 'keyup'].forEach(t =>
      input.dispatchEvent(new KeyboardEvent(t, { bubbles: true, cancelable: true, key: 'Enter', keyCode: 13, which: 13 })));
    return true;
  }

  function mcApplyTargeting(vins) {
    const inc = mcFindIncludeSelect();
    if (!inc) return 'no-control';
    if (!(inc.querySelector('.Select-input input') || inc.querySelector('input'))) return 'no-input';
    mcRemoveChips();
    if (!vins || !vins.length) return 'cleared';
    const query = 'vin: (' + vins.join(' ') + ')';
    // react-select re-renders (and swaps the input element) after the chip
    // removal, so retry the type+Enter on fresh DOM until the chip sticks.
    const delays = [120, 350, 700, 1200];
    delays.forEach(d => setTimeout(() => {
      try {
        if (mcHasVinChip()) return;     // already applied
        mcRemoveChips();                // clear any lingering "All"
        mcTypeQuery(query);
      } catch { /* ignore */ }
    }, d));
    return 'ok';
  }

  // Show a parsed bucket (by raw key, e.g. "due|7.30a", "driverless|all") with a
  // display label, dedupe its VINs, and target them on the page.
  function mcShowKey(key, label) {
    const out = document.getElementById('gb-mc-out-title');
    const box = document.getElementById('gb-mc-out');
    if (!out || !box) return;
    const text = gmGet(SHARED_LIST_KEY, '') || '';
    if (!text) { out.textContent = 'No list yet — paste a list or run a List scan on humans.'; box.value = ''; return; }
    const buckets = mcParseBuckets(text);
    const lines = buckets.get(key) || [];
    const seen = new Set();
    const vins = [];
    const unique = lines.filter(l => {
      const m = l.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
      const vin = m ? m[0] : l;
      if (seen.has(vin)) return false;
      seen.add(vin);
      if (m) vins.push(m[0]);
      return true;
    });
    const ts = Number(gmGet(SHARED_LIST_TIME_KEY, 0)) || 0;
    const age = ts ? ` · list ${Math.round((Date.now() - ts) / 60000)}m old` : '';
    box.value = unique.join('\n');
    mcActiveKey = key;
    mcHighlightActive();
    // Target these VINs on the page.
    const result = mcApplyTargeting(vins);
    const note = result === 'ok' ? ' · targeting…' : result === 'no-control' ? ' · target control not found' : '';
    out.textContent = `${label} — ${unique.length} VIN${unique.length === 1 ? '' : 's'}${age}${note}`;
  }

  function mcShowBucket(kind, time) {
    mcShowKey(kind + '|' + mcTimeKey(time), `${kind === 'arr' ? 'Arriving' : 'Due'} ${mcTimeKey(time)}`);
  }

  // Pull every line under the "=== Vins Left [...] ===" header (up to the next
  // section header) from the shared upkeep output.
  function mcVinsLeftLines(text) {
    if (!text) return [];
    const out = [];
    let capturing = false;
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (/^=+\s*Vins Left\b/i.test(line)) { capturing = true; continue; }
      if (capturing) {
        if (/^=+/.test(line)) break; // next section header ends the list
        if (line) out.push(line);
      }
    }
    return out;
  }

  function mcShowVinsLeft() {
    const out = document.getElementById('gb-mc-out-title');
    const box = document.getElementById('gb-mc-out');
    if (!out || !box) return;
    const text = gmGet(SHARED_VINSLEFT_KEY, '') || '';
    if (!text) { out.textContent = 'No Vins Left yet — run a Vins Left scan on humans.'; box.value = ''; return; }
    const lines = mcVinsLeftLines(text);
    const seen = new Set();
    const vins = [];
    const unique = lines.filter(l => {
      const m = l.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
      const vin = m ? m[0] : l;
      if (seen.has(vin)) return false;
      seen.add(vin);
      if (m) vins.push(m[0]);
      return true;
    });
    const ts = Number(gmGet(SHARED_VINSLEFT_TIME_KEY, 0)) || 0;
    const age = ts ? ` · ${Math.round((Date.now() - ts) / 60000)}m old` : '';
    box.value = unique.join('\n');
    mcActiveKey = 'vinsleft';
    mcHighlightActive();
    const result = mcApplyTargeting(vins);
    const note = result === 'ok' ? ' · targeting…' : result === 'no-control' ? ' · target control not found' : '';
    out.textContent = `Vins Left — ${vins.length} VIN${vins.length === 1 ? '' : 's'}${age}${note}`;
  }

  // Build the time buttons from the real times present in the loaded list.
  // Rebuilds only when the set of times changes (tracked via a signature).
  function mcRenderButtons() {
    const dueRow = document.getElementById('gb-mc-due-row');
    const arrRow = document.getElementById('gb-mc-arr-row');
    if (!dueRow || !arrRow) return;
    const buckets = mcParseBuckets(gmGet(SHARED_LIST_KEY, '') || '');
    // Driverless / Back Ups are single fixed buttons; refresh their counts every
    // call (they live outside the due/arr signature short-circuit below).
    const updateFixed = (id, key, label) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      const n = (buckets.get(key) || []).reduce((set, l) => {
        const m = l.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
        if (m) set.add(m[0]);
        return set;
      }, new Set()).size;
      btn.textContent = n ? `${label} (${n})` : label;
      btn.disabled = !n;
      btn.style.opacity = n ? '1' : '0.45';
      btn.style.cursor = n ? 'pointer' : 'not-allowed';
    };
    updateFixed('gb-mc-driverless-btn', 'driverless|all', 'Driverless');
    updateFixed('gb-mc-backup-btn', 'backup|all', 'Back Ups');
    const dueTimes = [];
    const arrTimes = [];
    for (const k of buckets.keys()) {
      const [kind, time] = k.split('|');
      if (kind === 'due') dueTimes.push(time);
      else if (kind === 'arr') arrTimes.push(time);
    }
    const due = mcSortTimes(dueTimes);
    const arr = mcSortTimes(arrTimes);
    const sig = 'D:' + due.join(',') + '|A:' + arr.join(',');
    if (dueRow.dataset.sig === sig) return;
    dueRow.dataset.sig = sig;
    arrRow.dataset.sig = sig;
    const fill = (row, times, kind) => {
      row.textContent = '';
      if (!times.length) {
        const span = document.createElement('span');
        span.textContent = '—';
        span.style.cssText = 'font:500 11px "DM Mono",monospace;color:#7a7a85;';
        row.appendChild(span);
        return;
      }
      times.forEach(t => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = t;
        b.dataset.key = kind + '|' + t;
        b.style.cssText = ghostButtonStyle();
        if (kind === 'arr' || kind === 'due') {
          // Single click targets & shows the bucket. Double-click turns hazards ON
          // now (confirm-gated). Press-and-HOLD turns hazards ON *and* preconditions
          // (two tasks, one after the other) — also confirm-gated. All work for Due
          // and Arriving. We wire the native dblclick + a manual two-quick-clicks
          // detector (native can be missed on re-render); mcConfirmLiveFire debounces
          // so the paths can't double-fire.
          b.title = 'Click: target & show VINs · Double-click: hazards ON now · Hold: hazards ON + precondition (confirms first)';
          const clickKey = kind + '|' + t;
          b.onclick = () => {
            const now = Date.now();
            const rapid = mcLastArrClick.label === clickKey && (now - mcLastArrClick.at) < MC_DBLCLICK_MS;
            mcLastArrClick = rapid ? { label: '', at: 0 } : { label: clickKey, at: now };
            if (rapid) { mcConfirmLiveFire(kind, t); return; }
            mcShowBucket(kind, t);
          };
          b.ondblclick = (e) => { e.preventDefault(); e.stopPropagation(); mcConfirmLiveFire(kind, t); };
          // Hold = hazards ON, then precondition (fired back-to-back).
          bindButtonLongPress(b, () => mcConfirmLiveFire(kind, t, {
            commands: [MC_HAZARD_CMD, MC_PRECONDITION_CMD],
            verb: 'Turn on hazards + precondition'
          }), 650);
          row.appendChild(b);
          return;
        }
        b.onclick = () => mcShowBucket(kind, t);
        row.appendChild(b);
      });
    };
    fill(dueRow, due, 'due');
    fill(arrRow, arr, 'arr');
    mcHighlightActive();
  }

  // ---------------------------------------------------------------------------
  // Schedule helpers (all within the MC code path; see the doc block up top).
  // ---------------------------------------------------------------------------

  // Poll a predicate until it's truthy or the timeout elapses. Used to wait for
  // async react-select re-renders (chip appearing, modal opening, menu options).
  function mcWaitFor(pred, timeoutMs = 4000, intervalMs = 150) {
    return new Promise(resolve => {
      const start = Date.now();
      const tick = () => {
        let ok = false;
        try { ok = !!pred(); } catch { ok = false; }
        if (ok) return resolve(true);
        if (Date.now() - start >= timeoutMs) return resolve(false);
        setTimeout(tick, intervalMs);
      };
      tick();
    });
  }

  // Convert a compact list label ("8.30p", "5.30a", "2a") to minutes-of-day.
  // Mirrors the parse in sortForSimpleTime but returns the raw clock minutes
  // (no list-ordering wraparound) so we can build a real Date from it.
  function mcMinutesFromLabel(label) {
    const m = String(label || '').match(/^(\d{1,2})(?:\.(\d{2}))?([ap])$/i);
    if (!m) return null;
    let h = Number(m[1]);
    const min = Number(m[2] || 0);
    const ap = m[3].toLowerCase();
    if (ap === 'p' && h !== 12) h += 12;
    if (ap === 'a' && h === 12) h = 0;
    return h * 60 + min;
  }

  // Fire time for an Arriving label = the next upcoming occurrence of
  // (arriving clock time + MC_SCHED_FIRE_OFFSET_MS). Resolving to the next
  // occurrence (rolling forward whole days until it's in the future) handles
  // both "armed before the time today" and midnight wraparound robustly. If
  // armed AFTER the fire moment already passed today, it targets tomorrow.
  function mcFireMsForArrLabel(label, now = Date.now()) {
    const mins = mcMinutesFromLabel(label);
    if (mins == null) return null;
    const base = new Date(now);
    base.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    let fireMs = base.getTime() + MC_SCHED_FIRE_OFFSET_MS;
    while (fireMs <= now) fireMs += 86400000;
    return fireMs;
  }

  function mcFmtCountdown(ms) {
    const secs = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // Derive the current Arriving buckets from the shared list: [{key,label,vins}].
  // Uses ONLY arr| buckets, with deduped 17-char VINs (7G/excluded filtered).
  function mcArrBuckets() {
    const buckets = mcParseBuckets(gmGet(SHARED_LIST_KEY, '') || '');
    const out = [];
    for (const [key, lines] of buckets) {
      if (!key.startsWith('arr|')) continue;
      const label = key.slice(4);
      const seen = new Set();
      const vins = [];
      for (const line of lines) {
        const found = line.match(/\b[A-HJ-NPR-Z0-9]{17}\b/g) || [];
        for (const v of found) {
          if (isExcludedVin(v) || seen.has(v)) continue;
          seen.add(v);
          vins.push(v);
        }
      }
      if (vins.length) out.push({ key, label, vins });
    }
    return out;
  }

  // Signature of the current arr buckets so the ticker can detect list changes
  // and re-arm (re-derive VINs/times) without clobbering fired state every tick.
  function mcSchedListSig() {
    return mcArrBuckets().map(b => `${b.key}#${b.vins.length}`).join('|');
  }

  // --- Persistence (sessionStorage: survives reloads within the tab) ---
  function mcSchedEnabled() {
    try { return sessionStorage.getItem(MC_SCHED_ENABLED_KEY) === '1'; } catch { return false; }
  }
  function mcSchedGetMap() {
    try { return JSON.parse(sessionStorage.getItem(MC_SCHED_MAP_KEY) || '{}') || {}; }
    catch { return {}; }
  }
  function mcSchedSetMap(map) {
    try { sessionStorage.setItem(MC_SCHED_MAP_KEY, JSON.stringify(map)); } catch { /* ignore */ }
  }

  // "Pending fire" survives the pre-fire page refresh: when a bucket's time is up
  // we stash its key, reload the page, then fire it once the fresh page is ready.
  const MC_SCHED_PENDING_KEY = '__gb_mc_sched_pending__';
  function mcSchedGetPending() { try { return JSON.parse(sessionStorage.getItem(MC_SCHED_PENDING_KEY) || 'null'); } catch { return null; } }
  function mcSchedSetPending(p) { try { sessionStorage.setItem(MC_SCHED_PENDING_KEY, JSON.stringify(p)); } catch { /* ignore */ } }
  function mcSchedClearPending() { try { sessionStorage.removeItem(MC_SCHED_PENDING_KEY); } catch { /* ignore */ } }
  // Page is ready to fire once its targeting control and Create Task button exist.
  function mcPageReadyToFire() {
    return !!(mcFindIncludeSelect() && mcFindButtonByText('Create Task', { notInModal: true }));
  }

  // Rebuild the armed map from the current shared list. Preserves a bucket's
  // firedDryRun flag only when its computed fireMs is unchanged (same upcoming
  // occurrence); a new fireMs (e.g. rolled to tomorrow) re-arms it fresh.
  function mcSchedRebuild() {
    const prev = mcSchedGetMap();
    const now = Date.now();
    const next = {};
    for (const b of mcArrBuckets()) {
      const fireMs = mcFireMsForArrLabel(b.label, now);
      if (fireMs == null) continue;
      const old = prev[b.key];
      const firedDryRun = !!(old && old.fireMs === fireMs && old.firedDryRun);
      next[b.key] = { key: b.key, label: b.label, vins: b.vins, fireMs, firedDryRun };
    }
    mcSchedSetMap(next);
    return next;
  }

  function mcSchedMarkFired(key) {
    const map = mcSchedGetMap();
    if (map[key]) { map[key].firedDryRun = true; mcSchedSetMap(map); }
    mcSchedRenderQueue(mcSchedGetMap(), Date.now());
  }

  // Surface a status message: panel status line + a toast + console (best-effort).
  function mcSchedStatus(msg, isError) {
    try { (isError ? console.warn : console.log)('[GB Schedule] ' + msg); } catch { /* ignore */ }
    const el = document.getElementById('gb-mc-sched-status');
    if (el) {
      el.textContent = msg;
      el.style.color = isError ? '#E8A8A8' : '#cfcabd';
    }
    mcToast(msg, isError);
  }

  function mcToast(msg, isError) {
    try {
      let t = document.getElementById('gb-mc-toast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'gb-mc-toast';
        t.style.cssText = [
          'position:fixed', 'bottom:20px', 'left:20px', 'z-index:2147483647',
          'max-width:380px', 'padding:12px 14px', 'border-radius:12px',
          'font:600 12px "DM Mono",monospace', 'color:#12100c',
          'box-shadow:0 12px 44px rgba(0,0,0,.55)', 'white-space:pre-wrap', 'line-height:1.4'
        ].join(';');
        document.body.appendChild(t);
      }
      t.style.background = isError ? '#E8A8A8' : UI.accentBright;
      t.style.border = `1px solid ${isError ? '#c97a7a' : UI.accent}`;
      t.textContent = msg;
      t.style.display = 'block';
      clearTimeout(t._hideTimer);
      t._hideTimer = setTimeout(() => { t.style.display = 'none'; }, isError ? 13000 : 9000);
    } catch { /* ignore */ }
  }

  // --- DOM lookups for the live blinker flow ---

  // The Create Task modal, located by its distinctive body class. Returns the
  // .modal-content element (what holds the final "Create" button).
  function mcFindModal() {
    const body = document.querySelector('.create-mc-task-modal-body');
    if (body) return body.closest('.modal-content') || body.closest('.modal-dialog') || body.parentElement;
    return document.querySelector('div.modal.fade.show .modal-content, div.modal.show .modal-content');
  }
  function mcModalOpen() { return !!mcFindModal(); }

  // Find a <button> by exact (trimmed, case-insensitive) text. opts.inModal /
  // opts.notInModal scope the search relative to the create-task modal so that
  // "Create Task" (outside) and "Create" (inside) never get confused.
  function mcFindButtonByText(text, opts = {}) {
    const want = String(text).trim().toLowerCase();
    const modal = mcFindModal();
    return [...document.querySelectorAll('button')].find(b => {
      if ((b.textContent || '').trim().toLowerCase() !== want) return false;
      const inside = !!(modal && modal.contains(b));
      if (opts.inModal && !inside) return false;
      if (opts.notInModal && inside) return false;
      return true;
    }) || null;
  }

  // The modal's "Batch command" react-select control (the .Select next to the
  // <label>Batch command</label>).
  function mcFindBatchCommandSelect() {
    const modal = mcFindModal();
    if (!modal) return null;
    const lbl = [...modal.querySelectorAll('label')].find(l => /batch command/i.test(l.textContent || ''));
    if (lbl) {
      const grp = lbl.closest('.form-group') || lbl.parentElement;
      const sel = grp && grp.querySelector('.Select');
      if (sel) return sel;
    }
    return modal.querySelector('.Select');
  }

  // Set the Batch command react-select. Accepts a single option name OR an array
  // of candidate names (tried in order) — useful when a command's exact label
  // isn't known (e.g. "Precondition"). Returns true once one is set; logs the
  // available options to the console on total failure so the exact label can be
  // confirmed.
  async function mcSetBatchCommand(optionText) {
    const candidates = (Array.isArray(optionText) ? optionText : [optionText])
      .map(s => String(s).trim()).filter(Boolean);
    for (const cand of candidates) {
      if (await mcSetBatchCommandOne(cand)) return true;
    }
    try {
      const opts = [...document.querySelectorAll('.Select-option')]
        .map(o => (o.textContent || '').trim()).filter(Boolean);
      console.warn('[GB fire] batch command not set. Wanted:', candidates, '| available options in dropdown:', opts);
    } catch { /* ignore */ }
    return false;
  }

  // Set the Batch command react-select to one specific option ("Toggle Hazard
  // Lights On") using the same React-props approach as mcRemoveChips/mcClickEl:
  // open the control, then invoke the matching .Select-option's onMouseDown.
  async function mcSetBatchCommandOne(optionText) {
    const want = String(optionText).trim().toLowerCase();
    const isSet = () => {
      const sel = mcFindBatchCommandSelect();
      const v = sel && sel.querySelector('.Select-value-label');
      return !!(v && (v.textContent || '').trim().toLowerCase() === want);
    };
    if (isSet()) return true;
    // Mirror the proven mcTypeQuery/mcApplyTargeting pattern: focus the input,
    // set its value via the native (React-aware) setter to filter the options,
    // then press Enter to select the match. Fall back to clicking the option.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const optReady = () => [...document.querySelectorAll('.Select-option')]
      .some(o => (o.textContent || '').trim().toLowerCase() === want);
    for (let attempt = 0; attempt < 4 && !isSet(); attempt++) {
      const sel = mcFindBatchCommandSelect();
      const input = sel && (sel.querySelector('.Select-input input') || sel.querySelector('input'));
      if (!input) { await sleep(150); continue; }
      try { input.focus(); } catch { /* ignore */ }
      setter.call(input, optionText);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await mcWaitFor(optReady, 1200, 100);
      ['keydown', 'keypress', 'keyup'].forEach(t =>
        input.dispatchEvent(new KeyboardEvent(t, { bubbles: true, cancelable: true, key: 'Enter', keyCode: 13, which: 13 })));
      if (await mcWaitFor(isSet, 700, 100)) return true;
      // Fallback: click the matching option directly (react props, else DOM).
      const opt = [...document.querySelectorAll('.Select-option')]
        .find(o => (o.textContent || '').trim().toLowerCase() === want);
      if (opt) {
        const op = mcReactProps(opt);
        if (op && typeof op.onMouseDown === 'function') { try { op.onMouseDown(mcFakeEvent()); } catch { mcClickEl(opt); } }
        else mcClickEl(opt);
        if (await mcWaitFor(isSet, 700, 100)) return true;
      }
    }
    return isSet();
  }

  // Ensure the modal's "Now" timing button is selected (vs "Repeat").
  function mcEnsureNow() {
    const modal = mcFindModal();
    if (!modal) return false;
    const all = [...modal.querySelectorAll('button, a, .btn, label, span')];
    const now = all.find(b => /^(button|a)$/i.test(b.tagName) && (b.textContent || '').trim().toLowerCase() === 'now')
      || all.find(b => (b.textContent || '').trim().toLowerCase() === 'now');
    if (!now) return false;
    const cls = String(now.className || '');
    const active = /\b(active|selected)\b/.test(cls) ||
      now.getAttribute('aria-pressed') === 'true' || now.getAttribute('aria-selected') === 'true';
    if (!active) mcClickEl(now); // selecting "Now" is idempotent/safe
    return true;
  }

  // ===========================================================================
  // THE FIRE. Clearly-named, single entry point gated by MC_SCHED_MODE.
  // DRY_RUN (default): target -> verify chip -> open Create Task -> set batch
  // command -> ensure "Now" -> STOP (modal left open; "Create" NEVER clicked).
  // LIVE: identical, then clicks "Create" — still only after re-verifying the
  // vin: chip so it can never fire against the default "All" scope.
  // ===========================================================================
  // opts.mode  — 'DRY_RUN' | 'LIVE'. Defaults to MC_SCHED_MODE (the scheduler's
  //              global mode). The double-click / hold paths pass 'LIVE'.
  // opts.manual — true for the double-click / hold paths: reports aborts via
  //              alert() and does NOT touch the schedule map/cooldown.
  // opts.commands — ordered list of Batch commands to create back-to-back (each
  //              a label string OR an array of candidate labels). Defaults to a
  //              single hazards command. Targeting + the vin: chip gate run ONCE;
  //              each command then opens its own Create Task modal and submits.
  async function mcSchedFire(entry, opts = {}) {
    const mode = opts.mode || MC_SCHED_MODE;
    const manual = !!opts.manual;
    const commands = (Array.isArray(opts.commands) && opts.commands.length) ? opts.commands : [MC_HAZARD_CMD];
    const cmdLabel = (c) => Array.isArray(c) ? c[0] : c;
    if (mcSchedFiring) return;
    mcSchedFiring = true;
    const log = (...a) => { try { console.log('[GB fire]', ...a); } catch { /* ignore */ } };
    const abort = (msg) => {
      log('ABORT:', msg);
      mcSchedStatus(msg, true);
      if (manual) { try { alert(msg); } catch { /* ignore */ } }
      else mcSchedMarkFired(entry.key); // scheduled fire failed — mark done, don't retry
    };
    try {
      const vins = entry.vins || [];
      log('start', { label: entry.label, vins: vins.length, mode, manual, commands: commands.map(cmdLabel) });
      if (!vins.length) { mcSchedStatus(`No VINs for arrival ${entry.label}; skipped.`, true); if (!manual) mcSchedMarkFired(entry.key); return; }

      // 1) Target this bucket's VINs on the page's "Include" control.
      const applied = mcApplyTargeting(vins);
      log('1) targeting applied =', applied);
      if (applied === 'no-control' || applied === 'no-input') {
        return abort(`ABORT [arrived ${entry.label}]: targeting control not found.`);
      }

      // 2) HARD SAFETY GATE: do not continue until the vin: chip is actually
      //    present. Never proceed on the default "All" (fleet-wide) scope.
      const chipOk = await mcWaitFor(() => mcHasVinChip(), 4500, 150);
      log('2) vin: chip present =', chipOk);
      if (!chipOk) {
        return abort(`ABORT [arrived ${entry.label}]: vin: chip never confirmed — refusing to act on "All".`);
      }

      // Create each command in order. Targeting stays applied on the page between
      // modals; we re-verify (and re-apply) the vin: chip before each one.
      for (let ci = 0; ci < commands.length; ci++) {
        const command = commands[ci];
        const label = cmdLabel(command);
        const step = commands.length > 1 ? ` (${ci + 1}/${commands.length})` : '';

        if (!mcHasVinChip()) {
          mcApplyTargeting(vins);
          const reok = await mcWaitFor(() => mcHasVinChip(), 4500, 150);
          if (!reok) return abort(`ABORT [arrived ${entry.label}]: vin: chip lost before "${label}" — refusing to act on "All".`);
        }

        // 3) Open the Create Task form (button lives OUTSIDE any modal).
        const createTaskBtn = mcFindButtonByText('Create Task', { notInModal: true });
        log(`3) Create Task button found${step} =`, !!createTaskBtn);
        if (!createTaskBtn) return abort(`ABORT [arrived ${entry.label}]: "Create Task" button not found.`);
        if (!mcHasVinChip()) return abort(`ABORT [arrived ${entry.label}]: vin: chip lost before opening modal.`);
        mcClickEl(createTaskBtn);

        // 4) Wait for the modal, then set the Batch command.
        const modalReady = await mcWaitFor(() => mcFindModal(), 5000, 150);
        log(`4) modal opened${step} =`, !!modalReady);
        if (!modalReady) return abort(`ABORT [arrived ${entry.label}]: Create Task modal didn't open for "${label}".`);
        const cmdOk = await mcSetBatchCommand(command);
        log(`5) batch command "${label}" set${step} =`, cmdOk);

        // 5) Ensure "Now" timing.
        mcEnsureNow();

        const cmdNote = cmdOk ? '' : ' (couldn\'t auto-set batch command — set it manually)';

        // 6) FINAL STEP — gated by mode. DRY_RUN never reaches the click.
        if (mode === 'LIVE') {
          // LIVE safety: never click Create unless the command is CONFIRMED set
          // and the vin: chip is still present — so we can never submit the wrong
          // command or fire against the default "All" scope.
          if (!cmdOk) return abort(`ABORT [arrived ${entry.label}]: couldn't set "${label}" — NOT creating. Set it manually, then click Create.`);
          if (!mcHasVinChip()) return abort(`ABORT [arrived ${entry.label}]: vin: chip missing at submit — NOT creating.`);
          // Find the modal's submit button (exact "Create", else "Create …", else
          // a submit button that isn't Cancel/Close).
          const findCreateBtn = () => {
            const modal = mcFindModal();
            if (!modal) return null;
            const btns = [...modal.querySelectorAll('button')];
            return btns.find(b => (b.textContent || '').trim().toLowerCase() === 'create')
              || btns.find(b => /^create\b/i.test((b.textContent || '').trim()))
              || btns.find(b => b.type === 'submit' && !/cancel|close/i.test(b.textContent || ''))
              || null;
          };
          // Create is briefly disabled while the form validates after the command /
          // targeting apply — wait for an enabled one before submitting.
          await mcWaitFor(() => { const b = findCreateBtn(); return b && !isDisabled(b); }, 3000, 150);
          const createBtn = findCreateBtn();
          log(`6) Create button found${step} =`, !!createBtn, '| text =', createBtn && (createBtn.textContent || '').trim(), '| disabled =', createBtn && isDisabled(createBtn));
          if (!createBtn) return abort(`ABORT [arrived ${entry.label}]: final "Create" button not found.`);
          if (isDisabled(createBtn)) return abort(`ABORT [arrived ${entry.label}]: "Create" stayed disabled — NOT creating.`);
          // Try several ways to submit: native .click() (fires a submit button's
          // default action), then a full synthetic mouse sequence, then requesting
          // the enclosing form to submit. Verify the modal closed after each.
          const closedNow = () => !mcModalOpen();
          log(`7) clicking Create (native)${step}…`);
          try { createBtn.click(); } catch (e) { log('native click threw', e && e.message); }
          let closed = await mcWaitFor(closedNow, 2000, 150);
          if (!closed) { log('7b) modal still open — synthetic mouse sequence…'); mcClickEl(createBtn); closed = await mcWaitFor(closedNow, 2000, 150); }
          if (!closed) {
            log('7c) still open — trying form.requestSubmit()/submit…');
            try {
              const form = createBtn.closest('form');
              if (form && typeof form.requestSubmit === 'function') form.requestSubmit(createBtn);
              else if (form) form.submit();
            } catch (e) { log('form submit threw', e && e.message); }
            closed = await mcWaitFor(closedNow, 2000, 150);
          }
          log(`8) modal closed after submit${step} =`, closed);
          if (!closed) return abort(`ABORT [arrived ${entry.label}]: clicked Create for "${label}" but the modal didn't close — check the form and click Create manually.`);
          log(`DONE — "${label}" created for`, vins.length, 'VIN(s)');
          mcSchedStatus(`LIVE: created ${label} for ${vins.length} VIN(s) [arrived ${entry.label}]${step}.`);
          // Let the page settle before opening the next command's modal.
          if (ci < commands.length - 1) await sleep(700);
        } else {
          // DRY_RUN (default): stop at the first command; leave the modal open.
          mcSchedStatus(`DRY RUN: prepared ${label} for ${vins.length} VIN(s) [arrived ${entry.label}] — review the modal and click Create yourself${cmdNote}.`, !cmdOk);
          break;
        }
      }
      if (!manual) mcSchedMarkFired(entry.key);
    } catch (e) {
      abort('Schedule fire error [arrived ' + entry.label + ']: ' + (e && e.message ? e.message : e));
    } finally {
      mcSchedFiring = false;
    }
  }

  // Double-click a Due or Arriving time: confirm, then run the FULL LIVE flow
  // (clicks the modal's Create) for that bucket's VINs. `kind` is 'due' or 'arr'.
  // Separate from the Schedule switch (which auto-fires arriving buckets without a
  // prompt). Debounced so the native dblclick and the manual two-click detector
  // can't both fire it. opts.commands lets the hold gesture fire hazards THEN
  // precondition (two tasks); opts.verb customizes the confirm wording.
  function mcConfirmLiveFire(kind, time, opts = {}) {
    const commands = (Array.isArray(opts.commands) && opts.commands.length) ? opts.commands : [MC_HAZARD_CMD];
    const verb = opts.verb || 'Turn on hazard lights';
    const nowMs = Date.now();
    if (nowMs - mcLastFireAttempt < 1500) return;
    mcLastFireAttempt = nowMs;
    const key = kind + '|' + mcTimeKey(time);
    const buckets = mcParseBuckets(gmGet(SHARED_LIST_KEY, '') || '');
    const seen = new Set();
    const vins = [];
    for (const line of (buckets.get(key) || [])) {
      for (const v of (line.match(/\b[A-HJ-NPR-Z0-9]{17}\b/g) || [])) {
        if (isExcludedVin(v) || seen.has(v)) continue;
        seen.add(v); vins.push(v);
      }
    }
    const kindLabel = kind === 'arr' ? 'arriving at' : 'due at';
    try { console.log('[GB fire] manual fire for', key, '| VINs', vins.length, '| commands', commands); } catch { /* ignore */ }
    if (!vins.length) { try { alert(`No VINs found for the ${time} ${kindLabel} bucket.`); } catch { /* ignore */ } return; }
    if (mcSchedFiring) { try { alert('A task is already being prepared — wait a moment and try again.'); } catch { /* ignore */ } return; }
    if (mcModalOpen()) { try { alert('A Create Task modal is already open — review/close it first.'); } catch { /* ignore */ } return; }
    const taskWord = commands.length > 1 ? `${commands.length} real tasks` : 'a real task';
    let ok = false;
    try {
      ok = window.confirm(`${verb} now for the ${vins.length} VIN${vins.length === 1 ? '' : 's'} ${kindLabel} ${time}? This creates ${taskWord}.`);
    } catch { ok = false; }
    if (!ok) return;
    mcSchedFire({ key, label: time, vins }, { mode: 'LIVE', manual: true, commands });
  }

  // 1-second ticker: keeps the armed map synced to the list, renders the
  // countdown/queue, and fires the next due bucket (one at a time).
  function mcSchedTick() {
    if (!mcSchedEnabled()) { mcSchedStop(); return; }
    const sig = mcSchedListSig();
    if (sig !== mcSchedLastSig) { mcSchedRebuild(); mcSchedLastSig = sig; }
    const map = mcSchedGetMap();
    const now = Date.now();
    // Only one modal at a time: defer firing while a fire is mid-flight or a
    // Create Task modal is already open (e.g. a prior dry-run left it open).
    if (!mcSchedFiring && !mcModalOpen()) {
      const due = Object.keys(map)
        .filter(k => !map[k].firedDryRun && now >= map[k].fireMs && now >= (mcSchedCooldown[k] || 0))
        .sort((a, b) => map[a].fireMs - map[b].fireMs);
      const key = due.length ? due[0] : null;
      const pending = mcSchedGetPending();
      // Drop a stale pending (its bucket already fired or is no longer the next up).
      if (pending && pending.key !== key) mcSchedClearPending();
      if (key) {
        if (pending && pending.key === key) {
          // Already refreshed for this bucket — fire once the fresh page is ready.
          // Give up after a grace so a stuck page can't loop (and never retry).
          if (mcPageReadyToFire()) {
            mcSchedClearPending();
            mcSchedFire(map[key]);
          } else if (now - (pending.at || 0) > 60000) {
            mcSchedClearPending();
            mcSchedMarkFired(key);
            mcSchedStatus(`Skipped ${map[key].label}: page never got ready after refresh.`, true);
          }
        } else {
          // Time's up — refresh the page FIRST, then fire after it reloads.
          mcSchedSetPending({ key, at: now });
          mcSchedStatus(`Refreshing before firing ${map[key].label}…`);
          setTimeout(() => { try { location.reload(); } catch { /* ignore */ } }, 400);
        }
      }
    }
    mcSchedRenderQueue(map, now);
  }

  function mcSchedStop() {
    if (mcSchedInterval) { clearInterval(mcSchedInterval); mcSchedInterval = null; }
  }
  function mcSchedStartTicker() {
    mcSchedStop();
    mcSchedTick();
    mcSchedInterval = setInterval(mcSchedTick, 1000);
  }

  function mcSchedStart() {
    try { sessionStorage.setItem(MC_SCHED_ENABLED_KEY, '1'); } catch { /* ignore */ }
    mcSchedRebuild();
    mcSchedLastSig = mcSchedListSig();
    mcSchedStartTicker();
    mcSchedUpdateToggleUI();
    const n = Object.keys(mcSchedGetMap()).length;
    mcSchedStatus(n
      ? `Schedule armed: ${n} Arriving bucket(s). Each auto-turns on hazards 5 min after its time (LIVE — targets the bucket, then clicks Create; gated on the vin: chip).`
      : 'Schedule armed, but no Arriving buckets in the current list yet.');
  }

  function mcSchedDisable() {
    try {
      sessionStorage.removeItem(MC_SCHED_ENABLED_KEY);
      sessionStorage.removeItem(MC_SCHED_MAP_KEY);
    } catch { /* ignore */ }
    mcSchedStop();
    mcSchedLastSig = '';
    for (const k of Object.keys(mcSchedCooldown)) delete mcSchedCooldown[k];
    mcSchedUpdateToggleUI();
    mcSchedRenderQueue({}, Date.now());
    mcSchedStatus('Schedule disarmed — all timers cleared.');
  }

  // Resume after a reload/navigation if it was left armed. Cheap no-op when
  // already running; called from the MC panel's keep-alive interval.
  function mcSchedResume() {
    if (mcSchedEnabled() && !mcSchedInterval) {
      mcSchedRebuild();
      mcSchedLastSig = mcSchedListSig();
      mcSchedStartTicker();
    }
    mcSchedUpdateToggleUI();
    mcSchedRenderQueue(mcSchedGetMap(), Date.now());
  }

  function mcSchedUpdateToggleUI() {
    const track = document.getElementById('gb-mc-sched-track');
    const thumb = document.getElementById('gb-mc-sched-thumb');
    const labelText = document.getElementById('gb-mc-sched-labeltext');
    if (!track || !thumb) return;
    const on = mcSchedEnabled();
    applySwitchTheme(track, thumb, on, labelText); // gold/bright when ON, like the Auto-VL switch
    if (!on) {
      const timer = document.getElementById('gb-mc-sched-timer');
      if (timer) timer.textContent = '';
    }
  }

  // Render the queued buckets + the next-fire countdown shown next to the toggle.
  function mcSchedRenderQueue(map, now) {
    const q = document.getElementById('gb-mc-sched-queue');
    const timer = document.getElementById('gb-mc-sched-timer');
    if (!q) return;
    const on = mcSchedEnabled();
    const entries = Object.values(map || {}).sort((a, b) => a.fireMs - b.fireMs);
    const nextUp = entries.find(e => !e.firedDryRun);
    if (timer) {
      if (!on) timer.textContent = '';
      else if (nextUp) timer.textContent = `· next ${nextUp.label} in ${mcFmtCountdown(nextUp.fireMs - now)}`;
      else if (entries.length) timer.textContent = '· all prepped';
      else timer.textContent = '· waiting for list';
    }
    q.textContent = '';
    if (!on) return;
    if (!entries.length) {
      const span = document.createElement('div');
      span.textContent = 'No Arriving buckets to arm.';
      span.style.cssText = 'font:500 11px "DM Mono",monospace;color:#7a7a85;';
      q.appendChild(span);
      return;
    }
    for (const e of entries) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;font:500 11px "DM Mono",monospace;';
      const left = document.createElement('span');
      left.textContent = `${e.label} · ${e.vins.length} VIN${e.vins.length === 1 ? '' : 's'}`;
      left.style.color = '#bcd6f5'; // arriving = cool blue tint (matches the list)
      const right = document.createElement('span');
      if (e.firedDryRun) {
        right.textContent = MC_SCHED_MODE === 'LIVE' ? 'created ✓' : 'prepped ✓';
        right.style.color = '#9ad29a';
      } else {
        const ms = e.fireMs - now;
        right.textContent = ms <= 0 ? 'firing…' : mcFmtCountdown(ms);
        right.style.color = ms <= 60000 ? '#E8D4A8' : '#cfcabd';
      }
      row.append(left, right);
      q.appendChild(row);
    }
  }

  function buildMissionControlPanel() {
    if (document.getElementById('gb-mc-panel') || !document.body) return;

    const panel = document.createElement('div');
    panel.id = 'gb-mc-panel';
    panel.style.cssText = [
      'position:fixed', 'bottom:20px', 'right:20px', 'z-index:2147483600',
      'display:flex', 'flex-direction:column', 'gap:12px', 'box-sizing:border-box',
      'padding:16px 18px', 'border-radius:16px', 'width:340px', 'max-width:90vw',
      `background:${UI.panelBg}`, `border:1px solid ${UI.panelBorder}`,
      `box-shadow:${UI.panelShadow}`, 'color:#ececec'
    ].join(';');

    const titleRow = document.createElement('div');
    titleRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;';
    const title = document.createElement('div');
    const gbVersion = (typeof GM_info !== 'undefined' && GM_info?.script?.version) ? GM_info.script.version : '';
    title.textContent = 'Jacks List — Assignments' + (gbVersion ? ` v${gbVersion}` : '');
    title.style.cssText = `font:600 12px "DM Mono",monospace;color:${UI.accentBright};letter-spacing:.02em;`;
    const pasteBtn = document.createElement('button');
    pasteBtn.type = 'button';
    pasteBtn.textContent = 'Paste list';
    pasteBtn.style.cssText = ghostButtonStyle() + ';padding:4px 12px;font-size:11px;';
    pasteBtn.onclick = () => {
      const pasted = prompt('Paste the Jacks List here:');
      if (pasted == null) return;
      const text = String(pasted).trim();
      if (!text) return;
      gmSet(SHARED_LIST_KEY, text);
      gmSet(SHARED_LIST_TIME_KEY, Date.now());
      const box = document.getElementById('gb-mc-out');
      if (box) box.value = '';
      mcActiveKey = null;
      mcRenderButtons();
      mcRefreshStatus();
    };
    const minBtn = document.createElement('button');
    minBtn.type = 'button';
    minBtn.textContent = '–';
    minBtn.title = 'Minimize';
    minBtn.style.cssText = ghostButtonStyle() + ';padding:4px 10px;font-size:14px;line-height:1;';
    const titleBtns = document.createElement('div');
    titleBtns.style.cssText = 'display:flex;align-items:center;gap:6px;';
    titleBtns.append(pasteBtn, minBtn);
    titleRow.append(title, titleBtns);

    const out = document.createElement('div');
    out.id = 'gb-mc-out-title';
    out.style.cssText = 'font:600 11px "DM Mono",monospace;color:#cfcabd;';
    mcRefreshStatus(out);

    const outBox = document.createElement('textarea');
    outBox.id = 'gb-mc-out';
    outBox.readOnly = true;
    outBox.style.cssText = [
      'width:100%', 'box-sizing:border-box', 'min-height:140px', 'resize:vertical',
      'background:rgba(0,0,0,.35)', 'color:#e8e4dc', 'border:1px solid rgba(201,168,107,.2)',
      'border-radius:10px', 'padding:8px 10px', 'font:500 11px "DM Mono",monospace', 'outline:none'
    ].join(';');

    const mkGroup = (labelText, rowId) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
      const lbl = document.createElement('div');
      lbl.textContent = labelText;
      lbl.style.cssText = 'font:600 10px "DM Mono",monospace;color:#7a7a85;letter-spacing:.06em;text-transform:uppercase;';
      const row = document.createElement('div');
      row.id = rowId;
      row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;';
      wrap.append(lbl, row);
      return wrap;
    };
    const dueGroup = mkGroup('Due', 'gb-mc-due-row');
    const arrGroup = mkGroup('Arriving', 'gb-mc-arr-row');

    // Schedule switch — lives UNDER the Arriving time buttons, styled like the
    // Auto-VL switch. When ON it arms one DRY-RUN timer per Arriving bucket
    // (prep "Toggle Hazard Lights On" 5 min after each time; never clicks
    // Create) and shows a live countdown to the next fire. Default OFF.
    // (To fire LIVE right now, double-click a time button above.)
    const schedControls = document.createElement('div');
    schedControls.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;';
    const schedThumb = document.createElement('span');
    schedThumb.id = 'gb-mc-sched-thumb';
    schedThumb.style.cssText = [
      'position:absolute', 'top:2px', 'left:2px', 'width:12px', 'height:12px',
      'border-radius:50%', 'background:#7a7a85', 'transition:transform .2s, background .2s'
    ].join(';');
    const schedTrack = document.createElement('span');
    schedTrack.id = 'gb-mc-sched-track';
    schedTrack.style.cssText = [
      'position:relative', 'display:inline-block', 'width:32px', 'height:18px',
      'border-radius:999px', 'background:#28282f', 'border:1px solid #3a3a42',
      'transition:background .2s', 'flex-shrink:0'
    ].join(';');
    schedTrack.appendChild(schedThumb);
    const schedLabelText = document.createElement('span');
    schedLabelText.id = 'gb-mc-sched-labeltext';
    schedLabelText.textContent = 'Schedule';
    schedLabelText.style.cssText = 'font:500 11px "DM Mono",monospace;color:#7a7a85;display:flex;align-items:center;text-transform:none;';
    const schedTimer = document.createElement('span');
    schedTimer.id = 'gb-mc-sched-timer';
    schedTimer.style.cssText = 'font:500 11px "DM Mono",monospace;color:#7a7a85;margin-left:2px;display:flex;align-items:center;text-transform:none;';
    const schedToggle = document.createElement('label');
    schedToggle.id = 'gb-mc-sched-toggle';
    schedToggle.title = 'Schedule (LIVE): when ON, 5 min after each Arriving time it targets that bucket and turns on "Toggle Hazard Lights On" automatically (no prompt; gated on the vin: chip). To fire one now, double-click a time button above (asks first).';
    schedToggle.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;flex-shrink:0;line-height:1;white-space:nowrap;text-transform:none;';
    schedToggle.append(schedTrack, schedLabelText, schedTimer);
    schedToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (mcSchedEnabled()) mcSchedDisable(); else mcSchedStart();
    });
    schedControls.appendChild(schedToggle);
    const schedStatus = document.createElement('div');
    schedStatus.id = 'gb-mc-sched-status';
    schedStatus.style.cssText = 'font:600 11px "DM Mono",monospace;color:#cfcabd;';
    const schedQueue = document.createElement('div');
    schedQueue.id = 'gb-mc-sched-queue';
    schedQueue.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    arrGroup.append(schedControls, schedStatus, schedQueue);

    const driverlessGroup = mkGroup('Driverless', 'gb-mc-driverless-row');
    const driverlessBtn = document.createElement('button');
    driverlessBtn.type = 'button';
    driverlessBtn.id = 'gb-mc-driverless-btn';
    driverlessBtn.dataset.key = 'driverless|all';
    driverlessBtn.textContent = 'Driverless';
    driverlessBtn.style.cssText = ghostButtonStyle();
    driverlessBtn.onclick = () => {
      // garage.vn is the driverless / production garage. From the dev garage, offer
      // to hop over there for driverless work; otherwise just show the bucket.
      if (location.hostname === 'garage.dev.teslamotors.com') {
        let go = false;
        try { go = window.confirm('Driverless cars are in the production garage (garage.vn). Transfer there now?'); } catch { go = false; }
        if (go) { location.href = 'https://garage.vn.teslamotors.com' + location.pathname + location.search; return; }
      }
      mcShowKey('driverless|all', 'Driverless');
    };
    driverlessGroup.querySelector('#gb-mc-driverless-row').appendChild(driverlessBtn);

    const backupGroup = mkGroup('Back Ups', 'gb-mc-backup-row');
    const backupBtn = document.createElement('button');
    backupBtn.type = 'button';
    backupBtn.id = 'gb-mc-backup-btn';
    backupBtn.dataset.key = 'backup|all';
    backupBtn.textContent = 'Back Ups';
    backupBtn.style.cssText = ghostButtonStyle();
    backupBtn.onclick = () => mcShowKey('backup|all', 'Back Ups');
    backupGroup.querySelector('#gb-mc-backup-row').appendChild(backupBtn);

    const vinsLeftGroup = mkGroup('Vins Left', 'gb-mc-vinsleft-row');
    const vinsLeftBtn = document.createElement('button');
    vinsLeftBtn.type = 'button';
    vinsLeftBtn.id = 'gb-mc-vinsleft-btn';
    vinsLeftBtn.dataset.key = 'vinsleft';
    vinsLeftBtn.textContent = 'Recent Vins Left';
    vinsLeftBtn.style.cssText = ghostButtonStyle();
    vinsLeftBtn.onclick = () => mcShowVinsLeft();
    vinsLeftGroup.querySelector('#gb-mc-vinsleft-row').appendChild(vinsLeftBtn);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.textContent = 'Copy';
    copyBtn.style.cssText = ghostButtonStyle();
    copyBtn.onclick = async () => {
      const val = outBox.value;
      if (!val) { copyBtn.textContent = 'Nothing to copy'; setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1200); return; }
      try {
        if (typeof GM_setClipboard === 'function') GM_setClipboard(val, 'text');
        else await navigator.clipboard.writeText(val);
      } catch {
        outBox.focus();
        outBox.select();
        try { document.execCommand('copy'); } catch { /* ignore */ }
      }
      copyBtn.textContent = 'Copied';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1200);
    };
    const copyRow = document.createElement('div');
    copyRow.style.cssText = 'display:flex;justify-content:flex-end;';
    copyRow.appendChild(copyBtn);

    const locRow = document.createElement('div');
    locRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;';
    const locLabel = document.createElement('div');
    locLabel.textContent = 'Location';
    locLabel.style.cssText = 'font:600 10px "DM Mono",monospace;color:#7a7a85;letter-spacing:.06em;text-transform:uppercase;width:100%;';
    locRow.appendChild(locLabel);
    [
      { name: 'Bomar', id: '442556' },
      { name: 'Maple', id: '489307' },
      { name: 'All', id: '940' }
    ].forEach(loc => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = loc.name;
      const isCurrent = location.pathname.includes('/mission_controls/' + loc.id);
      b.style.cssText = ghostButtonStyle() + ';padding:4px 10px;font-size:11px;' +
        (isCurrent ? `border-color:${UI.accentBright};color:${UI.accentBright};` : '');
      b.onclick = () => { if (!isCurrent) location.href = location.origin + '/mission_controls/' + loc.id; };
      locRow.appendChild(b);
    });

    const body = document.createElement('div');
    body.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
    body.append(locRow, dueGroup, arrGroup, driverlessGroup, backupGroup, vinsLeftGroup, out, outBox, copyRow);
    panel.append(titleRow, body);

    const MC_MIN_KEY = '__gb_mc_min__';
    const applyMin = (min) => {
      body.style.display = min ? 'none' : 'flex';
      minBtn.textContent = min ? '+' : '–';
      minBtn.title = min ? 'Expand' : 'Minimize';
      panel.style.width = min ? 'auto' : '340px';
    };
    minBtn.onclick = () => {
      const min = localStorage.getItem(MC_MIN_KEY) !== '1';
      try { localStorage.setItem(MC_MIN_KEY, min ? '1' : '0'); } catch { /* ignore */ }
      applyMin(min);
    };
    applyMin(localStorage.getItem(MC_MIN_KEY) === '1');

    document.body.appendChild(panel);
    mcRenderButtons();
    mcSchedUpdateToggleUI();
    mcSchedRenderQueue(mcSchedGetMap(), Date.now());
  }

  if (location.hostname === 'garage.dev.teslamotors.com' || location.hostname === 'garage.vn.teslamotors.com') {
    const ensureMcPanel = () => { try { buildMissionControlPanel(); mcRenderButtons(); mcRefreshStatus(); mcSchedResume(); } catch { /* ignore */ } };
    ensureMcPanel();
    setInterval(ensureMcPanel, 2000);
    return;
  }

  if (location.hostname === 'serviceapp.tesla.com') {
    // Parse the service-visit activity table into individual tickets. Each ticket
    // is a <tr class="activity-list-table-row">; its narrative cell
    // (.owner-narrative-cell, whose id is the activity id) holds the ticket text.
    const svcFindTickets = () => {
      const rows = document.querySelectorAll('tr.activity-list-table-row, tr.sa-table-body-row');
      const seen = new Set();
      const out = [];
      for (const tr of rows) {
        const cell = tr.querySelector('.owner-narrative-cell');
        if (!cell) continue;
        const narrative = ((cell.querySelector('.narrative-display') || cell).textContent || '').replace(/\s+/g, ' ').trim();
        if (!narrative) continue;
        const id = cell.id || '';
        const key = id || narrative;
        if (seen.has(key)) continue;
        seen.add(key);
        const num = ((tr.querySelector('.activity-cell-links a.sa-link') || tr.querySelector('a.sa-link'))?.textContent || '').replace(/\s+/g, ' ').trim();
        out.push({ id, narrative, num });
      }
      return out;
    };

    // The activity number (a.sa-link, e.g. "01") is a JS link that opens the
    // activity/visit in place (no URL change), so we re-find the row by its stable
    // activity id (the narrative cell's id) and click that link.
    const svcClickActivity = (cellId, num) => {
      let tr = null;
      if (cellId) { const c = document.getElementById(cellId); tr = c ? c.closest('tr.activity-list-table-row') : null; }
      if (!tr && num) {
        tr = [...document.querySelectorAll('tr.activity-list-table-row')]
          .find(r => ((r.querySelector('a.sa-link') || {}).textContent || '').replace(/\s+/g, ' ').trim() === num);
      }
      if (!tr) { try { alert('Could not find that activity on the page — it may have reloaded. Refresh and try again.'); } catch { /* ignore */ } return; }
      const link = tr.querySelector('.activity-cell-links a.sa-link') || tr.querySelector('a.sa-link') || tr.querySelector('a');
      if (!link) { try { alert('Could not find the activity link in that row.'); } catch { /* ignore */ } return; }
      try { link.scrollIntoView({ block: 'center' }); } catch { /* ignore */ }
      try { link.click(); }
      catch { ['mousedown', 'mouseup', 'click'].forEach(t => link.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true }))); }
    };

    // Cross-origin GET (garage.dev) via the userscript manager, sending the user's
    // cookies so the authenticated vitals page/data comes back. Resolves with the
    // full response object (status + responseText) so callers can diagnose failures.
    const gmFetch = (url) => new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== 'function') { reject(new Error('GM_xmlhttpRequest unavailable — enable it in the userscript manager.')); return; }
      GM_xmlhttpRequest({
        method: 'GET', url, withCredentials: true, timeout: 30000,
        onload: (r) => resolve(r || {}),
        onerror: () => reject(new Error('request failed')),
        ontimeout: () => reject(new Error('timed out'))
      });
    });

    // Pull the current odometer for this service page's VIN from the garage.dev
    // vitals page (no tab opened), rounded to the nearest whole mile.
    const svcGetOdometer = async (btn, resultEl) => {
      const vin = (location.pathname.match(/[A-HJ-NPR-Z0-9]{17}/) || [])[0]
        || (document.body.innerText.match(/\b[A-HJ-NPR-Z0-9]{17}\b/) || [])[0] || '';
      if (!isVin(normalizeVin(vin))) { try { alert('Could not find a VIN on this service page.'); } catch { /* ignore */ } return; }
      // On any failure (unreachable, unreadable, or 0 miles) show the error plus a
      // link to the vitals page so it can be checked manually.
      const vitalsPageUrl = `https://garage.dev.teslamotors.com/vehicles/${encodeURIComponent(vin)}/vitals`;
      const showError = (msg) => {
        resultEl.textContent = '';
        resultEl.style.display = 'flex';
        resultEl.style.flexWrap = 'wrap';
        resultEl.style.color = '#e6a5a5';
        const span = document.createElement('span');
        span.textContent = msg;
        const link = document.createElement('a');
        link.href = vitalsPageUrl;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'Open vitals page ↗';
        link.style.cssText = 'color:#8fb7e8;text-decoration:underline;';
        resultEl.append(span, link);
      };
      const orig = btn.textContent;
      btn.disabled = true; btn.textContent = 'Getting odometer…';
      resultEl.style.display = 'none';
      try {
        // The garage API accepts the VIN as the vehicle tag; ?device_type=vehicle
        // returns the vitals blob whose `odo` field is the odometer in miles.
        const url = `https://garage.dev.teslamotors.com/api/1/vehicles/${encodeURIComponent(vin)}/vitals?device_type=vehicle`;
        const r = await gmFetch(url);
        const status = r.status || 0;
        const text = (r && typeof r.responseText === 'string') ? r.responseText : '';
        let j = null;
        try { j = JSON.parse(text); } catch { /* not JSON */ }
        const resp = j && j.response ? j.response : null;
        let odo = resp ? resp.odo : null;
        if (odo == null) { const m = text.match(/"odo"\s*:\s*([0-9]+(?:\.[0-9]+)?)/); if (m) odo = parseFloat(m[1]); }
        const miles = Math.round(Number(odo));
        // Always log the full picture so failures can be reported.
        try { console.log('[GB odo]', { vin, status, odo, source: resp && resp.source, sleep: resp && resp.sleep_state, hasResponse: !!resp, snippet: text.slice(0, 400) }); } catch { /* ignore */ }
        if (!Number.isFinite(miles) || miles <= 0) {
          // Explain WHY it failed rather than a generic message.
          let why;
          if (status && status !== 200) {
            why = `API returned HTTP ${status}${r.statusText ? ' ' + r.statusText : ''}. `;
          } else if (!text) {
            why = 'Empty response from the vitals API (auth or connection?). ';
          } else if (!resp) {
            const errMsg = (j && (j.error || j.message)) || text.slice(0, 140);
            why = `No vitals data returned: ${errMsg}. `;
          } else if (odo == null) {
            why = `Vitals loaded but had no "odo" field (source: ${resp.source || '?'}, sleep: ${resp.sleep_state || '?'}) — car may be offline. `;
          } else {
            why = `Odometer read as ${odo} (source: ${resp.source || '?'}, sleep: ${resp.sleep_state || '?'}) — likely a stale/offline pull. `;
          }
          showError(why);
          return;
        }
        resultEl.textContent = '';
        resultEl.style.display = 'flex';
        resultEl.style.flexWrap = 'wrap';
        resultEl.style.color = '#E8D4A8';
        const label = document.createElement('span');
        label.textContent = `Odometer: ${miles.toLocaleString()} mi`;
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.textContent = 'Copy';
        copy.style.cssText = ghostButtonStyle() + ';padding:2px 9px;font-size:11px;';
        copy.onclick = () => { try { copyText(String(miles)); } catch { /* ignore */ } copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy'; }, 1200); };
        resultEl.append(label, copy);
      } catch (e) {
        showError(`Couldn\u2019t reach the vitals API (${(e && e.message) || 'request failed'}): `);
      } finally {
        btn.disabled = false; btn.textContent = orig;
      }
    };

    // Render the detected tickets into the panel (display only for now — each is a
    // separate service ticket that will later be closable). Signature-guarded so
    // the 2s refresh doesn't rebuild when nothing changed.
    const svcRenderTickets = () => {
      const box = document.getElementById('gb-svc-tickets');
      if (!box) return;
      const tickets = svcFindTickets();
      const sig = tickets.map(t => `${t.id}:${t.narrative}`).join('|');
      if (box.dataset.sig === sig) return;
      box.dataset.sig = sig;
      box.textContent = '';
      const header = document.createElement('div');
      header.textContent = tickets.length ? `Service tickets (${tickets.length})` : 'No service tickets on this page';
      header.style.cssText = 'font:600 11px "DM Mono",monospace;color:#9a9aa2;letter-spacing:.02em;';
      box.appendChild(header);
      tickets.forEach((t, idx) => {
        const rowEl = document.createElement('div');
        rowEl.style.cssText = 'display:flex;align-items:flex-start;gap:8px;padding:7px 8px;border:1px solid #3a3a42;border-radius:8px;background:rgba(255,255,255,.03);cursor:pointer;';
        rowEl.title = 'Open this activity / service visit';
        rowEl.onclick = () => svcClickActivity(t.id, t.num);
        rowEl.onmouseenter = () => { rowEl.style.borderColor = 'rgba(106,169,233,.55)'; rowEl.style.background = 'rgba(106,169,233,.08)'; };
        rowEl.onmouseleave = () => { rowEl.style.borderColor = '#3a3a42'; rowEl.style.background = 'rgba(255,255,255,.03)'; };
        const num = document.createElement('span');
        num.textContent = t.num || String(idx + 1);
        num.style.cssText = 'flex-shrink:0;font:700 11px "DM Mono",monospace;color:#9a9aa2;min-width:16px;';
        const txt = document.createElement('div');
        txt.textContent = t.narrative;
        txt.title = t.narrative + (t.id ? ` (activity ${t.id})` : '');
        txt.style.cssText = 'font:500 11px "DM Sans",system-ui,sans-serif;color:#d7d7de;line-height:1.35;';
        rowEl.append(num, txt);
        box.appendChild(rowEl);
      });
    };

    const buildServiceAppPanel = () => {
      if (document.getElementById('gb-svc-panel') || !document.body) return;

      const panel = document.createElement('div');
      panel.id = 'gb-svc-panel';
      panel.style.cssText = [
        'position:fixed', 'bottom:20px', 'right:20px', 'z-index:2147483600',
        'display:flex', 'flex-direction:column', 'gap:12px', 'box-sizing:border-box',
        'padding:16px 18px', 'border-radius:16px', 'width:300px', 'max-width:90vw',
        `background:${UI.panelBg}`, `border:1px solid ${UI.panelBorder}`,
        `box-shadow:${UI.panelShadow}`, 'color:#ececec'
      ].join(';');

      const titleRow = document.createElement('div');
      titleRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;';
      const title = document.createElement('div');
      const ver = (typeof GM_info !== 'undefined' && GM_info?.script?.version) ? GM_info.script.version : '';
      title.textContent = 'Jacks List — Service' + (ver ? ` v${ver}` : '');
      title.style.cssText = `font:600 12px "DM Mono",monospace;color:${UI.accentBright};letter-spacing:.02em;`;
      const minBtn = document.createElement('button');
      minBtn.type = 'button';
      minBtn.textContent = '–';
      minBtn.title = 'Minimize';
      minBtn.style.cssText = ghostButtonStyle() + ';padding:4px 10px;font-size:14px;line-height:1;';
      titleRow.append(title, minBtn);

      const body = document.createElement('div');
      body.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

      const odoBtn = document.createElement('button');
      odoBtn.type = 'button';
      odoBtn.textContent = 'Get current odometer';
      odoBtn.style.cssText = ghostButtonStyle();
      const odoResult = document.createElement('div');
      odoResult.id = 'gb-svc-odo';
      odoResult.style.cssText = 'display:none;align-items:center;gap:8px;font:600 13px "DM Mono",monospace;color:#E8D4A8;';
      odoBtn.onclick = () => svcGetOdometer(odoBtn, odoResult);
      body.append(odoBtn, odoResult);

      const ticketsBox = document.createElement('div');
      ticketsBox.id = 'gb-svc-tickets';
      ticketsBox.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
      body.appendChild(ticketsBox);

      panel.append(titleRow, body);

      const SVC_MIN_KEY = '__gb_svc_min__';
      const applyMin = (min) => {
        body.style.display = min ? 'none' : 'flex';
        minBtn.textContent = min ? '+' : '–';
        minBtn.title = min ? 'Expand' : 'Minimize';
        panel.style.width = min ? 'auto' : '300px';
      };
      minBtn.onclick = () => {
        const min = localStorage.getItem(SVC_MIN_KEY) !== '1';
        try { localStorage.setItem(SVC_MIN_KEY, min ? '1' : '0'); } catch { /* ignore */ }
        applyMin(min);
      };
      applyMin(localStorage.getItem(SVC_MIN_KEY) === '1');

      document.body.appendChild(panel);
    };
    const ensureSvcPanel = () => { try { buildServiceAppPanel(); svcRenderTickets(); } catch { /* ignore */ } };
    ensureSvcPanel();
    setInterval(ensureSvcPanel, 2000);
    return;
  }

  if (location.hostname !== 'humans.tesla.com' || (!location.pathname.startsWith(TARGET.path) && !location.pathname.startsWith(TARGET.upkeepPath))) return;

  function normalizeVin(vin) {
    return clean(vin).toUpperCase();
  }

  function uiTheme() {
    return UI;
  }

  function getAccent() {
    return UI.accent;
  }

  function getAccentText() {
    return UI.accentText;
  }

  function injectJacksListStyles() {
    if (document.getElementById('jacks-list-theme-styles')) return;
    const style = document.createElement('style');
    style.id = 'jacks-list-theme-styles';
    style.textContent = `
      #jacks-list-panel {
        overflow: hidden;
        box-sizing: border-box;
        position: relative;
      }
      #jacks-list-button-row {
        box-sizing: border-box;
        overflow: hidden;
        border-radius: 0 0 16px 16px;
        padding: 0 !important;
      }
      #jacks-list-panel-chrome {
        display: flex;
        align-items: center;
        position: relative;
        box-sizing: border-box;
        border-bottom: 1px solid rgba(201,168,107,.14);
        background: linear-gradient(180deg, rgba(201,168,107,.09) 0%, transparent 100%);
        box-sizing: border-box;
      }
      #jacks-list-panel-chrome::before {
        content: '';
        position: absolute;
        top: 0;
        left: 12%;
        right: 12%;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(201,168,107,.15), #D4B87A, #C9A86B, rgba(201,168,107,.15), transparent);
        pointer-events: none;
      }
      #jacks-list-brand-title {
        font: 500 11px "DM Mono", monospace;
        letter-spacing: .04em;
        color: rgba(201,168,107,.65);
        line-height: 1.35;
        white-space: nowrap;
      }
      #jacks-list-button-inner-row {
        padding: 6px 14px 10px 14px;
        overflow-x: auto;
        overflow-y: visible;
        scrollbar-width: none;
        box-sizing: border-box;
        align-items: center;
        width: 100%;
      }
      #jacks-list-status {
        margin: 0;
        border-radius: 0;
        width: 100%;
        box-sizing: border-box;
      }
      #jacks-list-panel-top-bar {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 6px;
        padding: 6px 10px 4px;
        width: 100%;
        box-sizing: border-box;
        flex-shrink: 0;
        border-bottom: 1px solid rgba(201,168,107,.1);
        background: linear-gradient(180deg, rgba(201,168,107,.06) 0%, transparent 100%);
      }
      #jacks-list-resize-corner {
        position: relative;
        width: 22px;
        height: 22px;
        display: flex;
        align-items: flex-start;
        justify-content: flex-end;
        color: rgba(201, 168, 107, .7);
        cursor: nesw-resize;
        user-select: none;
        font-size: 0;
        line-height: 0;
        flex-shrink: 0;
      }
      #jacks-list-resize-corner::after {
        content: '';
        display: block;
        width: 10px;
        height: 10px;
        border-top: 2px solid currentColor;
        border-right: 2px solid currentColor;
        box-sizing: border-box;
      }
      #jacks-list-resize-corner:hover {
        color: rgba(201, 168, 107, 1);
      }
      #jacks-list-output-area {
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
        align-self: stretch;
        border-bottom: 1px solid rgba(201,168,107,.12);
        background: rgba(0,0,0,.22);
      }
      #jacks-list-info {
        width: 100%;
        box-sizing: border-box;
        flex-wrap: wrap;
        gap: 8px;
        padding-right: 14px;
        background: rgba(201,168,107,.05);
        color: #a89a82;
        border-bottom: 1px solid rgba(201,168,107,.1);
      }
      #jacks-list-info .gb-info-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        flex-shrink: 0;
        align-items: center;
      }
      #jacks-list-info-text {
        flex: 1 1 auto;
        min-width: 0;
        word-break: break-word;
        color: #D4B87A;
      }
      #jacks-list-button-inner-row::-webkit-scrollbar {
        display: none;
      }
      #jacks-list-output-title {
        color: #C9A86B;
      }
      #jacks-list-output-text {
        color: #d8d2c6;
        border-left: 2px solid rgba(201,168,107,.35);
        margin: 0 14px 0 14px;
        padding: 2px 0 12px 12px !important;
        width: calc(100% - 28px) !important;
        box-sizing: border-box;
      }
      #jacks-list-output-text::-webkit-scrollbar,
      #jacks-list-output-render::-webkit-scrollbar { width: 5px; }
      #jacks-list-output-text::-webkit-scrollbar-thumb,
      #jacks-list-output-render::-webkit-scrollbar-thumb {
        background: rgba(201,168,107,.35);
        border-radius: 999px;
      }
      #jacks-list-output-text::-webkit-scrollbar-thumb:hover,
      #jacks-list-output-render::-webkit-scrollbar-thumb:hover {
        background: rgba(201,168,107,.55);
      }
      #jacks-list-minimize-corner {
        position: relative;
        flex-shrink: 0;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        border: 1px solid rgba(201,168,107,.28);
        background: rgba(201,168,107,.08);
        color: #C9A86B;
        font: 600 14px "DM Sans", system-ui, sans-serif;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        line-height: 1;
      }
      #jacks-list-minimize-corner:hover {
        background: rgba(201,168,107,.18);
      }
      #jacks-list-find-panel {
        position: fixed;
        bottom: 12px;
        left: 12px;
        z-index: 2147483647;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 1px solid rgba(201,168,107,.35);
        background: linear-gradient(168deg, rgba(24,20,16,.96) 0%, rgba(10,9,8,.98) 100%);
        color: #C9A86B;
        font: 600 13px "DM Sans", system-ui, sans-serif;
        cursor: pointer;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 0;
        line-height: 1;
        box-shadow: 0 4px 16px rgba(0,0,0,.45), 0 0 0 1px rgba(201,168,107,.08);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }
      #jacks-list-find-panel:hover {
        background: rgba(201,168,107,.14);
        border-color: rgba(201,168,107,.5);
        color: #E8D4A8;
      }
    `;
    document.head.appendChild(style);
  }

  function applySwitchTheme(track, thumb, on, labelText) {
    if (on) {
      track.style.background = getAccent();
      track.style.borderColor = getAccent();
      thumb.style.background = getAccentText();
      thumb.style.transform = 'translateX(14px)';
      if (labelText) labelText.style.color = UI.accentBright;
    } else {
      track.style.background = 'rgba(18,16,13,.95)';
      track.style.borderColor = 'rgba(201,168,107,.22)';
      thumb.style.background = '#5c574e';
      thumb.style.transform = 'translateX(0)';
      if (labelText) labelText.style.color = '#8a8478';
    }
  }

  function applyUiTheme() {
    const t = uiTheme();
    const panel = document.getElementById('jacks-list-panel');
    if (!panel) return;

    if (!panelMinimized) {
      let appliedSavedSize = false;
      const savedSize = sessionStorage.getItem(PANEL_SIZE_KEY);
      if (savedSize) {
        try {
          const parsed = JSON.parse(savedSize);
          const sw = parseInt(parsed.width, 10);
          const sh = parseInt(parsed.height, 10);
          if (Number.isFinite(sw) && sw > 0) {
            const minW = 760;
            const maxW = Math.max(minW, window.innerWidth - 32);
            const width = Math.min(maxW, Math.max(minW, sw));
            panel.style.width = `${width}px`;
            panel.style.maxWidth = `${width}px`;
            appliedSavedSize = true;
          }
          if (Number.isFinite(sh) && sh > 0) {
            const minH = 280;
            const maxH = Math.max(minH, window.innerHeight - 24);
            const height = Math.min(maxH, Math.max(minH, sh));
            panel.style.height = `${height}px`;
            panel.style.maxHeight = `${height}px`;
          }
        } catch { /* ignore */ }
      }
      if (!appliedSavedSize) {
        panel.style.width = t.panelWidth;
        panel.style.maxWidth = t.panelWidth;
      }
      panel.style.background = t.panelBg;
      panel.style.border = `1px solid ${t.panelBorder}`;
      panel.style.boxShadow = t.panelShadow;
      panel.style.borderRadius = t.panelRadius;
      panel.style.color = '#f0ebe3';
    }

    const chrome = document.getElementById('jacks-list-panel-chrome');
    if (chrome && !panelMinimized) chrome.style.padding = uiTheme().chromePad;

    updateScanButtons();
    styleSecondaryButtons();
  }

  function styleSecondaryButtons() {
    const border = 'rgba(201,168,107,.22)';
    const bg = 'rgba(201,168,107,.06)';
    const color = '#c9c4b8';
    const colorBright = '#e8e4dc';
    for (const btn of document.querySelectorAll('#jacks-list-info button, #jacks-list-paste-notif button')) {
      btn.style.border = `1px solid ${border}`;
      btn.style.background = bg;
      btn.style.color = colorBright;
      btn.style.borderRadius = '999px';
      btn.style.flexShrink = '0';
    }
    const clearBtn = document.querySelector('#jacks-list-info button');
    if (clearBtn) clearBtn.style.color = color;
  }

  function formatScanDuration(startTime) {
    if (!startTime) return '??';
    const sec = Math.max(0, Math.round((Date.now() - startTime) / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
    return `${s}s`;
  }

  function recordScanFinish(startTime) {
    const duration = formatScanDuration(startTime);
    sessionStorage.setItem(LAST_SCAN_DURATION_KEY, duration);
    return duration;
  }

  function getSavedListText() {
    return sessionStorage.getItem(RESERVATION_LIST_TEXT_KEY) || '';
  }

  function parseListVinMeta(listText) {
    const meta = {};
    if (!listText) return meta;
    let sectionKind = '';
    let sectionLabel = '';

    for (const rawLine of listText.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;

      const dueBy = line.match(/^Due (?:by|at)\s+(.+?)(?:\s*\[[\d]+\]|\s*\([\d]+ VINs?\))?\s*$/i);
      if (dueBy) {
        sectionKind = 'due';
        sectionLabel = dueBy[1].trim();
        continue;
      }
      const arriving = line.match(/^Arriving at\s+(.+?)(?:\s*\[[\d]+\]|\s*\([\d]+ VINs?\))?\s*$/i);
      if (arriving) {
        sectionKind = 'arriving';
        sectionLabel = arriving[1].trim();
        continue;
      }
      if (/^Back Ups(?:\s*\[[\d]+\]|\s*\([\d]+ VINs?\))?\s*$/i.test(line)) {
        sectionKind = 'backup';
        sectionLabel = '';
        continue;
      }
      if (/^Commuter(?:\s*\[[\d]+\]|\s*\([\d]+ VINs?\))?\s*$/i.test(line)) {
        sectionKind = 'commuter';
        sectionLabel = '';
        continue;
      }
      if (/^Driverless(?:\s*\[[\d]+\]|\s*\([\d]+ VINs?\))?\s*$/i.test(line)) {
        sectionKind = 'driverless';
        sectionLabel = '';
        continue;
      }
      if (/^Cybercabs(?:\s*\[[\d]+\]|\s*\([\d]+ VINs?\))?\s*$/i.test(line)) {
        sectionKind = 'cybercab';
        sectionLabel = '';
        continue;
      }
      if (/^======\s*Vins not required\s*=======$/i.test(line)) {
        sectionKind = 'notRequired';
        sectionLabel = '';
        continue;
      }
      if (/^Unavailable(?:\s*\[[\d]+\]|\s*\([\d]+ VINs?\))?\s*$/i.test(line)) {
        sectionKind = 'unavailable';
        sectionLabel = '';
        continue;
      }
      if (/^Training(?:\s*\[[\d]+\]|\s*\([\d]+ VINs?\))?\s*$/i.test(line)) {
        sectionKind = 'training';
        sectionLabel = '';
        continue;
      }
      if (/^No reservation(?:\s*\[[\d]+\]|\s*\([\d]+ VINs?\))?\s*$/i.test(line)) {
        sectionKind = 'noReservation';
        sectionLabel = '';
        continue;
      }
      if (/^======|^Reservations:|^Total|^_{3,}/i.test(line)) {
        if (!/^======\s*Active/i.test(line)) { sectionKind = ''; sectionLabel = ''; }
        continue;
      }

      const vinsOnLine = line.match(VIN_FIND_RE);
      if (!vinsOnLine) continue;

      const dueInline = line.match(/\bDue:\s*([^|]+)/i);
      const reservedInline = line.match(/\|\s*Reserved:\s*([^|]+)/i);
      for (const vin of vinsOnLine) {
        const v = normalizeVin(vin);
        const isCc = isCybercabVin(v);
        if (sectionKind === 'backup') { meta[v] = { dueAt: '', kind: 'backup' }; continue; }
        if (sectionKind === 'commuter') { meta[v] = { dueAt: '', kind: 'commuter' }; continue; }
        if (sectionKind === 'training') { meta[v] = { dueAt: '', kind: 'training' }; continue; }
        if (sectionKind === 'noReservation') { meta[v] = { dueAt: '', kind: 'noReservation', cybercab: isCc }; continue; }
        if (sectionKind === 'driverless') { meta[v] = { dueAt: '', kind: 'driverless' }; continue; }
        if (sectionKind === 'cybercab') {
          const reservedLine = line.match(/\b(?:Reserved|Due):\s*(.+)$/i);
          meta[v] = { dueAt: reservedLine ? clean(reservedLine[1]) : '', kind: 'cybercab', cybercab: isCybercabVin(v) };
          continue;
        }
        if (sectionKind === 'notRequired') {
          const arrivingLine = line.match(/\bArriving\s+(.+)$/i);
          const dueLine = line.match(/\bDue:?\s*(.+)$/i);
          meta[v] = {
            dueAt: arrivingLine ? clean(arrivingLine[1]) : (dueLine ? clean(dueLine[1]) : ''),
            kind: 'notRequired'
          };
          continue;
        }
        if (sectionKind === 'unavailable') {
          const arrivingLine = line.match(/\bArriving\s+(.+)$/i);
          const dueLine = line.match(/\bDue:?\s*(.+)$/i);
          meta[v] = {
            dueAt: arrivingLine ? clean(arrivingLine[1]) : (dueLine ? clean(dueLine[1]) : ''),
            kind: 'unavailable'
          };
          continue;
        }
        if (dueInline) meta[v] = { dueAt: clean(dueInline[1]), kind: 'due', cybercab: isCc };
        else if (reservedInline) meta[v] = { dueAt: clean(reservedInline[1]), kind: 'reserved', cybercab: isCc };
        else if (sectionKind === 'due' && sectionLabel) meta[v] = { dueAt: sectionLabel, kind: 'due', cybercab: isCc };
        else if (sectionKind === 'arriving' && sectionLabel) meta[v] = { dueAt: sectionLabel, kind: 'arriving', cybercab: isCc };
        else if (!meta[v]) meta[v] = { dueAt: '', kind: '', cybercab: isCc };
      }
    }
    return meta;
  }

  function getVinListMeta(meta, vin) {
    return meta[normalizeVin(vin)] || null;
  }

  function getListVinMeta() {
    return parseListVinMeta(getSavedListText());
  }

  /** Counts toward progress: reservations (due/arriving/reserved), cybercabs, and driverless (prod). Excludes backups, commuter, not-required, unscheduled. */
  function isScheduledReservationVin(meta, vin) {
    const m = getVinListMeta(meta, vin);
    if (!m) return false;
    // Driverless (prod) has no due time but still counts toward progress.
    if (m.kind === 'driverless') return true;
    if (!m.dueAt) return false;
    return m.kind === 'due' || m.kind === 'arriving' || m.kind === 'reserved' || m.kind === 'cybercab';
  }

  /** Every VIN on the saved list (reservations + backups + driverless + etc.). */
  function getAllListVins() {
    return getReservationVins();
  }

  /** Scheduled reservations only — progress bar, needs work, and Vins-left scope. */
  // Surfaced VINs: found on upkeep this shift but not on the pasted list. Stored
  // as { [vin]: { dueAt, kind, ts } } and treated as extra reservations.
  function getSurfacedVins() {
    try { return JSON.parse(sessionStorage.getItem(SURFACED_VINS_KEY) || '{}') || {}; }
    catch { return {}; }
  }
  function setSurfacedVins(map) {
    try { sessionStorage.setItem(SURFACED_VINS_KEY, JSON.stringify(map || {})); } catch { /* ignore */ }
  }
  function getSurfacedVinList() {
    return Object.keys(getSurfacedVins()).map(normalizeVin).filter(v => isVin(v) && !isExcludedVin(v));
  }

  function getProgressVins() {
    const meta = getListVinMeta();
    const base = getAllListVins().filter(v => isScheduledReservationVin(meta, v));
    // Fold in mid-shift surfaced VINs so they count toward progress like the list.
    return [...new Set([...base, ...getSurfacedVinList()])];
  }

  function savePastedList(pasted) {
    const rawText = String(pasted ?? '').trim();
    if (!rawText) return null;
    // Drop any line referencing an excluded (7G) VIN so they never appear anywhere.
    const text = rawText.split('\n').filter(line => {
      const m = line.match(/\b[A-HJ-NPR-Z0-9]{17}\b/g);
      return !(m && m.some(isExcludedVin));
    }).join('\n');
    const matches = text.match(/\b[A-HJ-NPR-Z0-9]{17}\b/gi);
    if (!matches) return null;
    const vins = [...new Set(matches.map(normalizeVin))].filter(v => !isExcludedVin(v));
    const now = Date.now();
    sessionStorage.setItem(RESERVATION_VINS_KEY, JSON.stringify(vins));
    sessionStorage.setItem(RESERVATION_LIST_TEXT_KEY, text);
    sessionStorage.setItem(RESERVATION_VINS_TIME_KEY, String(now));
    sessionStorage.setItem(LAST_TEXT_KEY, text);
    sessionStorage.setItem('__jacks_list_saved_time__', String(now));
    persistSharedList(text);
    const prodVins = [];
    const pastedMeta = parseListVinMeta(text);
    for (const [vin, m] of Object.entries(pastedMeta)) {
      if (m.kind === 'driverless') prodVins.push(normalizeVin(vin));
    }
    let inDriverless = false;
    for (const line of text.split('\n')) {
      if (/^Driverless(?:\s*\[[\d]+\]|\s*\([\d]+ VINs?\))?\s*$/i.test(line.trim())) { inDriverless = true; continue; }
      if (inDriverless) {
        if (/^(====|Back Ups|Commuter|Unavailable|Arriving|Due (?:by|at))/i.test(line.trim())) { inDriverless = false; continue; }
        const vinsOnLine = line.match(/\b[A-HJ-NPR-Z0-9]{17}\b/g);
        if (vinsOnLine) prodVins.push(...vinsOnLine.map(normalizeVin));
      }
    }
    sessionStorage.setItem(RESERVATION_VINS_PROD_KEY, JSON.stringify([...new Set(prodVins.filter(v => isVin(v)))]));
    sessionStorage.removeItem(PROGRESS_DONE_VINS_KEY);
    sessionStorage.removeItem(PROGRESS_WC_CACHE_KEY);
    sessionStorage.removeItem(PROGRESS_PENDING_FINISH_KEY);
    sessionStorage.removeItem(UPKEEP_DUE_ON_LIST_KEY);
    sessionStorage.removeItem(UPKEEP_DONE_VINS_KEY);
    sessionStorage.removeItem(MANUAL_DONE_VINS_KEY);
    sessionStorage.removeItem(UPKEEP_SCAN_CACHE_KEY);
    sessionStorage.removeItem(UPKEEP_TASK_HISTORY_KEY);
    sessionStorage.removeItem(SURFACED_VINS_KEY);
    sessionStorage.removeItem(UPKEEP_SEEN_KEY);
    sessionStorage.removeItem(LIST_ADMIN_XREF_KEY);
    return vins;
  }

  function showConfirmModal({ title = 'Are you sure?', message = '', confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel } = {}) {
    document.getElementById('jacks-list-confirm-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'jacks-list-confirm-overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483647',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:rgba(0,0,0,.55)', 'backdrop-filter:blur(2px)',
      'font:500 13px "DM Mono",monospace'
    ].join(';');

    const card = document.createElement('div');
    card.style.cssText = [
      'width:min(420px,90vw)', 'box-sizing:border-box',
      'padding:22px 24px 18px', 'border-radius:16px',
      `background:${UI.panelBg}`, `border:1px solid ${UI.panelBorder}`,
      `box-shadow:${UI.panelShadow}`, 'color:#ececec',
      'transform:translateY(8px) scale(.98)', 'opacity:0',
      'transition:transform .18s ease, opacity .18s ease'
    ].join(';');

    const titleEl = document.createElement('div');
    titleEl.textContent = title;
    titleEl.style.cssText = `font:600 15px "DM Mono",monospace;color:${UI.accentBright};margin:0 0 8px;`;

    const msgEl = document.createElement('div');
    msgEl.textContent = message;
    msgEl.style.cssText = 'font:500 12.5px "DM Mono",monospace;color:#cfcabd;line-height:1.5;margin:0 0 18px;white-space:pre-wrap;';

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = cancelLabel;
    cancelBtn.style.cssText = [
      'padding:8px 16px', 'border-radius:10px', 'cursor:pointer',
      'font:600 12px "DM Mono",monospace',
      'background:transparent', 'color:#cfcabd',
      'border:1px solid rgba(201,168,107,.28)'
    ].join(';');

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.textContent = confirmLabel;
    confirmBtn.style.cssText = [
      'padding:8px 16px', 'border-radius:10px', 'cursor:pointer',
      'font:700 12px "DM Mono",monospace',
      `background:${UI.accent}`, `color:${UI.accentText}`,
      'border:1px solid transparent'
    ].join(';');

    let closed = false;
    const close = (confirmed) => {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey, true);
      card.style.opacity = '0';
      card.style.transform = 'translateY(8px) scale(.98)';
      setTimeout(() => overlay.remove(), 160);
      if (confirmed) onConfirm?.();
      else onCancel?.();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); close(true); }
    };

    cancelBtn.onclick = () => close(false);
    confirmBtn.onclick = () => close(true);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    document.addEventListener('keydown', onKey, true);

    btnRow.append(cancelBtn, confirmBtn);
    card.append(titleEl, msgEl, btnRow);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => { card.style.opacity = '1'; card.style.transform = 'translateY(0) scale(1)'; });
    confirmBtn.focus();
  }

  function bindButtonLongPress(btn, onHold, holdMs = 1000) {
    if (!btn || btn.dataset.gbLongPressBound) return;
    btn.dataset.gbLongPressBound = '1';
    let timer = null;
    let holdFired = false;
    const clear = () => {
      clearTimeout(timer);
      timer = null;
    };
    const startHold = () => {
      holdFired = false;
      clear();
      timer = setTimeout(() => {
        holdFired = true;
        onHold();
      }, holdMs);
    };
    btn.addEventListener('mousedown', startHold);
    btn.addEventListener('mouseup', clear);
    btn.addEventListener('mouseleave', clear);
    btn.addEventListener('click', (e) => {
      if (!holdFired) return;
      e.preventDefault();
      e.stopPropagation();
      holdFired = false;
    }, true);
  }

  function getReservationVins() {
    const raw = sessionStorage.getItem(RESERVATION_VINS_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return [...new Set(parsed.map(normalizeVin).filter(v => isVin(v)))];
    } catch { return []; }
  }

  function progressShiftStartMs(now = Date.now()) {
    const d = new Date(now);
    const startH = CONFIG.progressShiftStartHour;
    const startM = CONFIG.progressShiftStartMinute || 0;
    const endH = CONFIG.progressShiftEndHour;
    const endM = CONFIG.progressShiftEndMinute || 0;
    const todayStartMs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), startH, startM, 0, 0).getTime();
    const todayEndMs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), endH, endM, 0, 0).getTime();
    // Shift runs 7:30 PM -> 7:30 AM the next morning.
    // Past tonight's 7:30 PM: current shift started today at 7:30 PM.
    if (now >= todayStartMs) return todayStartMs;
    // Before 7:30 AM: still inside last night's overnight shift (started yesterday 7:30 PM).
    if (now < todayEndMs) return todayStartMs - 86400000;
    // Between 7:30 AM and 7:30 PM there's no active shift. Anchor to the upcoming
    // 7:30 PM (still in the future) so the finished shift's completions no longer
    // count and Progress/Work Count read 0 until the next shift begins.
    return todayStartMs;
  }

  // End of the active shift (the 7:30 AM that follows the shift's 7:30 PM start).
  function progressShiftEndMs(now = Date.now()) {
    const start = progressShiftStartMs(now);
    const s = new Date(start);
    const endSameDay = new Date(
      s.getFullYear(), s.getMonth(), s.getDate(),
      CONFIG.progressShiftEndHour, CONFIG.progressShiftEndMinute || 0, 0, 0
    ).getTime();
    // Start is in the evening; the end time is the next morning, so roll forward
    // a day whenever the end isn't already after the start.
    return endSameDay > start ? endSameDay : endSameDay + 86400000;
  }

  // True while a shift is running (7:30 PM -> 7:30 AM). False in the daytime gap.
  function isProgressShiftActive(now = Date.now()) {
    return now >= progressShiftStartMs(now);
  }

  // "7:30 PM" / "7 AM" style label from an hour + minute (for status messages).
  function fmtClockLabel(h, m = 0) {
    const ap = h >= 12 ? 'PM' : 'AM';
    let hr = h % 12; if (hr === 0) hr = 12;
    return m ? `${hr}:${String(m).padStart(2, '0')} ${ap}` : `${hr} ${ap}`;
  }
  function shiftStartLabel() { return fmtClockLabel(CONFIG.progressShiftStartHour, CONFIG.progressShiftStartMinute || 0); }
  function shiftEndLabel() { return fmtClockLabel(CONFIG.progressShiftEndHour, CONFIG.progressShiftEndMinute || 0); }

  function progressDoneVinFromEntry(entry) {
    if (typeof entry === 'string') return normalizeVin(entry);
    return normalizeVin(entry?.vin);
  }

  function progressDoneTsFromEntry(entry) {
    if (typeof entry === 'string') return 0;
    return Number(entry?.ts) || 0;
  }

  function progressDoneUserFromEntry(entry) {
    if (typeof entry === 'string') return '';
    return clean(entry?.user || '');
  }

  function parseProgressDoneEntries(raw) {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const cutoff = progressShiftStartMs();
      return parsed.map(entry => {
        const vin = progressDoneVinFromEntry(entry);
        if (typeof entry === 'string') {
          return { vin, ts: 0, task: '', user: '', prod: false, cybercab: false };
        }
        const isProd = entry?.prod === true;
        return {
          vin,
          ts: progressDoneTsFromEntry(entry),
          task: clean(entry?.task || ''),
          user: progressDoneUserFromEntry(entry),
          prod: isProd,
          cybercab: !isProd && isCybercabVin(vin)
        };
      }).filter(e => isVin(e.vin) && e.ts >= cutoff);
    } catch { return []; }
  }

  function timeOnlyToMs(text, now) {
    const t = clean(text);
    const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)$/i);
    if (!m) return null;
    let hr = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const sec = parseInt(m[3] || '0', 10);
    const ap = m[4].toLowerCase();
    if (ap === 'pm' && hr !== 12) hr += 12;
    if (ap === 'am' && hr === 12) hr = 0;

    const nowDate = new Date(now);
    const candidates = [];
    const base = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), hr, min, sec);
    candidates.push(base.getTime());
    candidates.push(new Date(base.getTime() - 86400000).getTime());
    if (base.getTime() > now) candidates.push(new Date(base.getTime() - 86400000).getTime());

    let best = null;
    for (const ts of candidates) {
      if (ts > now) continue;
      const age = now - ts;
      if (best === null || age < best.age) best = { ts, age };
    }
    return best?.ts ?? null;
  }

  function progressShiftElapsedMs(now = Date.now()) {
    return Math.max(0, now - progressShiftStartMs(now));
  }

  function progressCarsPerHourLine(doneCount, now = Date.now()) {
    const elapsedMs = progressShiftElapsedMs(now);
    if (elapsedMs <= 0) return '';
    const hours = elapsedMs / 3600000;
    const rate = doneCount / hours;
    return `~${rate.toFixed(1)} cars/hr since shift start`;
  }

  // Estimated finish time for the remaining reservations, projected from the
  // average done-rate since shift start. Flags when the estimate lands past shift
  // end so it's clear the current pace won't clear the list in time.
  function progressEtaLine(doneCount, total, now = Date.now()) {
    if (!total) return '';
    const remaining = Math.max(0, total - (doneCount || 0));
    if (remaining === 0) return 'Est. finish: all caught up';
    const hours = progressShiftElapsedMs(now) / 3600000;
    if (hours <= 0 || doneCount <= 0) return `Est. finish: — · ${remaining} to go (need more data)`;
    const rate = doneCount / hours; // cars/hr so far
    const hoursLeft = remaining / rate;
    const etaMs = now + hoursLeft * 3600000;
    const clock = new Date(etaMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const h = Math.floor(hoursLeft);
    const m = Math.round((hoursLeft - h) * 60);
    const dur = h > 0 ? `${h}h ${m}m` : `${m}m`;
    const shiftEnd = progressShiftEndMs(now);
    const late = shiftEnd && etaMs > shiftEnd ? ` (past ${shiftEndLabel()})` : '';
    return `Est. finish: ~${clock} · ${dur} left · ${remaining} to go${late}`;
  }

  function progressBarLine(doneCount, total, opts = {}) {
    if (!total) return '';
    const pct = Math.round((doneCount / total) * 100);
    const barFilled = Math.min(20, Math.round(pct / 5));
    const needsPart = opts.needsWork != null ? ` · Needs work (${opts.needsWork})` : '';
    const now = opts.now != null ? opts.now : Date.now();
    const head = `Progress: ${doneCount}/${total} done (${pct}%)${needsPart}`;
    const bar = `[${'█'.repeat(barFilled)}${'░'.repeat(20 - barFilled)}]`;
    const rateLine = progressCarsPerHourLine(doneCount, now);
    return rateLine ? `${head}\n${bar}\n${rateLine}` : `${head}\n${bar}`;
  }

  function migrateStoredProgressDoneCybercabFlags() {
    const raw = sessionStorage.getItem(PROGRESS_DONE_VINS_KEY);
    if (!raw) return;
    const entries = parseProgressDoneEntries(raw);
    if (!entries.length) return;
    sessionStorage.setItem(PROGRESS_DONE_VINS_KEY, JSON.stringify(entries));
  }

  function getProgressDoneVins() {
    return [...new Set(parseProgressDoneEntries(sessionStorage.getItem(PROGRESS_DONE_VINS_KEY)).map(e => e.vin))];
  }

  function getProgressDoneVinSet() {
    return new Set(getProgressDoneVins());
  }

  // --- UK-complete detection (from the upkeep page's task cells) -------------
  // Each upkeep task is a link to the cleanliness app; its React fiber carries a
  // `data` object: { task, label, completed, completionTimestamp, username, ... }.
  function reactFiberData(node) {
    try {
      const fk = Object.keys(node).find(k => k.startsWith('__reactFiber$'));
      let f = node[fk];
      let d = 0;
      while (f && d < 20) {
        const mp = f.memoizedProps;
        if (mp && mp.data && typeof mp.data === 'object' && 'task' in mp.data && 'completed' in mp.data) return mp.data;
        f = f.return;
        d++;
      }
    } catch { /* ignore */ }
    return null;
  }

  function collectUpkeepTaskData(map) {
    for (const a of document.querySelectorAll('a[href*="/cleanliness/vehicle/"]')) {
      const href = a.getAttribute('href') || '';
      const vin = normalizeVin((href.match(/vehicle\/([A-HJ-NPR-Z0-9]{17})/i) || [])[1] || '');
      if (!isVin(vin)) continue;
      const data = reactFiberData(a);
      if (!data || !data.task) continue;
      if (!map[vin]) map[vin] = {};
      map[vin][data.task] = {
        completed: !!data.completed,
        ts: data.completionTimestamp || '',
        user: clean(data.username || ''),
        // hours until next due (null when the task isn't on a recurring schedule)
        diff: (typeof data.diff === 'number') ? data.diff : null
      };
    }
  }

  // Cybercabs don't do cabin cleaning / offgassing daily. They only matter when
  // one of their tasks is actually coming due within cybercabDueWithinHours.
  function cybercabNeedsWork(tasks) {
    if (!tasks) return false;
    const limit = CONFIG.cybercabDueWithinHours;
    for (const e of Object.values(tasks)) {
      if (e && typeof e.diff === 'number' && e.diff <= limit) return true;
    }
    return false;
  }

  // A VIN is complete when ALL required tasks are completed within the shift
  // window (shift start .. shift end). Every required task must be present and
  // done — both Cabin Cleaning and Offgassing Inspection.
  // Cybercabs are excluded — they aren't held to the daily cabin/offgassing rule.
  function upkeepCompletedEntries(taskData) {
    const shiftStart = progressShiftStartMs();
    const windowEnd = progressShiftEndMs();
    const required = CONFIG.upkeepCompleteTasks || [];
    const adminExcluded = getAdminExcludedVinSet();
    const out = [];
    for (const [vinRaw, tasks] of Object.entries(taskData || {})) {
      const vin = normalizeVin(vinRaw);
      if (!isVin(vin) || isExcludedVin(vin) || isCybercabVin(vin) || upkeepBackupVins.has(vin)) continue;
      // Commuter / unavailable cars (admin tab) get no completion credit.
      if (adminExcluded.has(vin)) continue;
      let latestTs = 0;
      let user = '';
      const allDone = required.every(t => {
        const e = tasks[t];
        if (!e || !e.completed) return false;
        const ms = Date.parse(e.ts);
        if (!(ms >= shiftStart && ms <= windowEnd)) return false;
        if (ms > latestTs) { latestTs = ms; user = e.user || user; }
        return true;
      });
      if (allDone) out.push({ vin, ts: latestTs, user, task: 'upkeep', prod: false, cybercab: isCybercabVin(vin) });
    }
    return out;
  }

  function saveUpkeepDoneVins(entries, { replace = false } = {}) {
    const shiftCutoff = progressShiftStartMs();
    let existing = [];
    if (!replace) {
      try { existing = JSON.parse(sessionStorage.getItem(UPKEEP_DONE_VINS_KEY) || '[]') || []; } catch { existing = []; }
    }
    const byVin = new Map();
    for (const e of existing) { const v = normalizeVin(e?.vin); if (isVin(v)) byVin.set(v, e); }
    for (const e of (entries || [])) { const v = normalizeVin(e?.vin); if (isVin(v)) byVin.set(v, e); }
    const merged = [...byVin.values()].filter(e => (Number(e?.ts) || 0) >= shiftCutoff);
    sessionStorage.setItem(UPKEEP_DONE_VINS_KEY, JSON.stringify(merged));
  }

  function getUpkeepDoneVinSet() {
    const shiftCutoff = progressShiftStartMs();
    let arr = [];
    try { arr = JSON.parse(sessionStorage.getItem(UPKEEP_DONE_VINS_KEY) || '[]') || []; } catch { arr = []; }
    return new Set(
      arr.filter(e => (Number(e?.ts) || 0) >= shiftCutoff)
        .map(e => normalizeVin(e.vin))
        .filter(v => isVin(v))
    );
  }

  // --- Manual "mark complete" (shift-scoped) --------------------------------
  // Human-driven completions toggled from the list's ✓ button. Stored as
  // {vin, ts} and pruned to the shift, mirroring saveUpkeepDoneVins. These feed
  // the progress bar / Vins left only — Work Count never reads this key.
  function readManualDoneEntries() {
    const shiftCutoff = progressShiftStartMs();
    let arr = [];
    try { arr = JSON.parse(sessionStorage.getItem(MANUAL_DONE_VINS_KEY) || '[]') || []; } catch { arr = []; }
    const byVin = new Map();
    for (const e of arr) {
      const v = normalizeVin(e?.vin);
      if (isVin(v) && (Number(e?.ts) || 0) >= shiftCutoff) byVin.set(v, { vin: v, ts: Number(e.ts) || 0 });
    }
    return byVin;
  }

  function getManualDoneVinSet() {
    return new Set(readManualDoneEntries().keys());
  }

  function addManualDoneVin(vin) {
    const v = normalizeVin(vin);
    if (!isVin(v)) return;
    const byVin = readManualDoneEntries();
    byVin.set(v, { vin: v, ts: Date.now() });
    try { sessionStorage.setItem(MANUAL_DONE_VINS_KEY, JSON.stringify([...byVin.values()])); } catch { /* quota */ }
  }

  function removeManualDoneVin(vin) {
    const v = normalizeVin(vin);
    if (!isVin(v)) return;
    const byVin = readManualDoneEntries();
    byVin.delete(v);
    try { sessionStorage.setItem(MANUAL_DONE_VINS_KEY, JSON.stringify([...byVin.values()])); } catch { /* quota */ }
  }

  // Union of completion sources: per-VIN history scan (Work Count) + upkeep tasks
  // + manual "mark complete" toggles.
  function getDoneVinSetAll() {
    return new Set([...getProgressDoneVinSet(), ...getUpkeepDoneVinSet(), ...getManualDoneVinSet()]);
  }

  // --- Persistent upkeep task history (shift-scoped) -------------------------
  // The upkeep page only shows cars still due, so a completed car drops off on
  // the next scan and its task data would otherwise be lost. We keep every
  // completed task seen this shift so Work Count still credits whoever did it.
  function readUpkeepTaskHistory() {
    let stored = {};
    try { stored = JSON.parse(sessionStorage.getItem(UPKEEP_TASK_HISTORY_KEY) || '{}') || {}; } catch { stored = {}; }
    return stored;
  }

  // Returns the persisted completed-task history, pruned to this shift.
  function getUpkeepTaskHistory() {
    const shiftStart = progressShiftStartMs();
    const out = {};
    for (const [vinRaw, tasks] of Object.entries(readUpkeepTaskHistory())) {
      const vin = normalizeVin(vinRaw);
      if (!isVin(vin)) continue;
      for (const [task, e] of Object.entries(tasks || {})) {
        if (!e || !e.completed) continue;
        const ms = Date.parse(e.ts);
        if (!(ms >= shiftStart)) continue;
        (out[vin] || (out[vin] = {}))[task] = e;
      }
    }
    return out;
  }

  // Merge this scan's completed tasks into the shift history and return the
  // combined task data (history ∪ current) for Work Count / completion checks.
  function mergeUpkeepTaskHistory(current) {
    const merged = getUpkeepTaskHistory();
    const shiftStart = progressShiftStartMs();
    for (const [vinRaw, tasks] of Object.entries(current || {})) {
      const vin = normalizeVin(vinRaw);
      if (!isVin(vin)) continue;
      for (const [task, e] of Object.entries(tasks || {})) {
        if (!e || !e.completed) continue;
        const ms = Date.parse(e.ts);
        if (!(ms >= shiftStart)) continue;
        const prev = merged[vin]?.[task];
        const prevMs = prev ? Date.parse(prev.ts) : -Infinity;
        if (!prev || ms >= prevMs) (merged[vin] || (merged[vin] = {}))[task] = e;
      }
    }
    try { sessionStorage.setItem(UPKEEP_TASK_HISTORY_KEY, JSON.stringify(merged)); } catch { /* quota */ }
    return merged;
  }

  // Reservation VINs present on the upkeep page for this scan — mirrors the
  // inclusion rules formatUpkeepList uses to build "allOnListDue".
  function upkeepPresentReservationVins(vehicles) {
    const progressVinSet = new Set(getProgressVins());
    const present = [];
    for (const v of augmentUpkeepVehicles(vehicles || [])) {
      if (!v.includeInUpkeep || !v.vin) continue;
      const vin = normalizeVin(v.vin);
      if (v.backup || upkeepBackupVins.has(vin)) continue;
      if (isCybercabVin(vin) && !cybercabNeedsWork(upkeepTaskData[vin])) continue;
      const onOurList = progressVinSet.size === 0 || progressVinSet.has(vin);
      if (!onOurList) continue;
      present.push(vin);
    }
    return present;
  }

  // Detect VINs that showed up on this upkeep scan but aren't on the pasted list
  // and stash them as "surfaced" reservations so they count toward progress +
  // work count. Same gates as the list: within the upkeep/reservation window
  // (includeInUpkeep), reservation-bearing (or a cybercab that needs work), and
  // not a backup / commuter / unavailable / excluded VIN.
  function recordSurfacedVins(vehicles) {
    const listSet = new Set(getAllListVins().map(normalizeVin));
    const meta = getListVinMeta();
    const adminExcluded = getAdminExcludedVinSet();
    const store = getSurfacedVins();
    let changed = false;
    for (const v of augmentUpkeepVehicles(vehicles || [])) {
      if (!v || !v.vin || !v.includeInUpkeep) continue;
      const vin = normalizeVin(v.vin);
      if (!isVin(vin) || isExcludedVin(vin)) continue;
      if (v.backup || upkeepBackupVins.has(vin)) continue;
      if (v.commuter || v.unavailable || v.training || adminExcluded.has(vin)) continue;
      const isCc = isCybercabVin(vin);
      if (isCc && !cybercabNeedsWork(upkeepTaskData[vin])) continue;
      // Reservation-time restriction: only reservation-bearing cars (or cybercabs
      // that need work) surface.
      if (!isCc && !v.reservedAt) continue;
      if (listSet.has(vin)) continue;                     // already a real list VIN
      if (isScheduledReservationVin(meta, vin)) continue; // already counts via list meta
      if (store[vin]) continue;                            // already surfaced
      store[vin] = {
        dueAt: v.reservedAt ? reservationUntilBucket(clean(v.reservedAt)) : '',
        kind: isCc ? 'cybercab' : 'reserved',
        ts: Date.now()
      };
      changed = true;
    }
    if (changed) setSurfacedVins(store);
  }

  // Run after every fresh upkeep scan. Persists completed-task credit, auto-
  // completes any reservation that is absent from upkeep with no completion and
  // no Work Count credit, and returns the merged task data (history ∪ current)
  // to drive Work Count / completion.
  function reconcileUpkeepScan(vehicles) {
    const merged = mergeUpkeepTaskHistory(upkeepTaskData);
    // VINs whose required tasks were ever completed this shift stay done.
    saveUpkeepDoneVins(upkeepCompletedEntries(merged));

    // SAFETY: never run the auto-complete pass off a blank/failed scan. An empty
    // (or throttled) scan has an empty present set, which would otherwise mark
    // EVERY reservation "done" and poison the whole shift's done set. Only touch
    // the drop-off set when the scan actually returned a healthy set of cars.
    if (scanLooksEmpty(vehicles)) return merged;

    // Fold any newly-surfaced upkeep VINs into the progress set BEFORE computing
    // present/auto-complete, so they're treated exactly like list reservations.
    recordSurfacedVins(vehicles);

    const presentSet = new Set(upkeepPresentReservationVins(vehicles));

    // SELF-HEAL: drop any prior AUTO-complete for a VIN that is present again on
    // this healthy scan — it clearly still needs work, so return it to Vins left.
    // Only auto-complete marks (task 'auto-complete', nobody worked it) are
    // removed; real task-credit completions and manual ✓ marks are never touched.
    let doneArr = [];
    try { doneArr = JSON.parse(sessionStorage.getItem(UPKEEP_DONE_VINS_KEY) || '[]') || []; } catch { doneArr = []; }
    const healed = doneArr.filter(e => !(e && e.task === 'auto-complete' && presentSet.has(normalizeVin(e?.vin))));
    if (healed.length !== doneArr.length) saveUpkeepDoneVins(healed, { replace: true });

    // Auto-complete every reservation that is no longer on upkeep. A list VIN
    // absent from this (healthy) scan is finished -> mark it done with an empty
    // user so it counts toward progress and drops out of Vins left. We do NOT
    // skip work-counted cars anymore: a car that left upkeep is done regardless,
    // and marking it done here never removes anyone's Work Count credit (that's
    // tracked separately). Cars still present are skipped; the self-heal above
    // un-marks any that reappear.
    const done = getDoneVinSetAll();
    const now = Date.now();
    const autoDone = [];
    for (const vin of getProgressVins()) {
      if (presentSet.has(vin) || done.has(vin)) continue;
      autoDone.push({ vin, ts: now, user: '', task: 'auto-complete', prod: false, cybercab: isCybercabVin(vin) });
    }
    if (autoDone.length) saveUpkeepDoneVins(autoDone);
    return merged;
  }

  // Shared upkeep-scan cache. List / Vins left / Work Count all scan the same
  // page, so we stash the scan result and let the other two reuse it for a while.
  function saveUpkeepScanCache(vehicles, source) {
    try {
      sessionStorage.setItem(UPKEEP_SCAN_CACHE_KEY, JSON.stringify({
        ts: Date.now(),
        source,
        vehicles: vehicles || [],
        taskData: upkeepTaskData || {},
        backupVins: [...upkeepBackupVins]
      }));
    } catch { /* ignore (quota) */ }
  }

  // A scan that came back with almost nothing means the page didn't load (blank /
  // throttled / wrong page) — caller should keep the previous result.
  function scanLooksEmpty(vehicles, { needTasks = false } = {}) {
    const n = (vehicles || []).filter(v => v && isVin(normalizeVin(v.vin))).length;
    if (n < CONFIG.minScanVins) return true;
    if (needTasks && Object.keys(upkeepTaskData || {}).length === 0) return true;
    return false;
  }

  function warnEmptyScan(label, vehicles) {
    sessionStorage.removeItem(STATE_KEY);
    setActiveScan(null);
    showStatus();
    const n = (vehicles || []).length;
    setStatus(`${label}: scan looked empty (${n} VINs) — kept your previous result. Try again.`);
  }

  function getUpkeepScanCache() {
    try {
      const raw = sessionStorage.getItem(UPKEEP_SCAN_CACHE_KEY);
      if (!raw) return null;
      const c = JSON.parse(raw);
      if (!c || !Array.isArray(c.vehicles)) return null;
      return c;
    } catch { return null; }
  }

  function freshUpkeepScanCache() {
    const c = getUpkeepScanCache();
    if (!c) return null;
    if (Date.now() - (Number(c.ts) || 0) > CONFIG.scanReuseMinutes * 60 * 1000) return null;
    return c;
  }

  function scanAgeLabel(ts) {
    const secs = Math.max(0, Math.round((Date.now() - (Number(ts) || 0)) / 1000));
    if (secs < 60) return `${secs}s ago`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return s ? `${m}m ${s}s ago` : `${m}m ago`;
  }

  // --- Admin /vehicles cross-reference --------------------------------------
  // The List scan visits the admin Available + Unavailable tabs and records, per
  // VIN, whether it is a commuter, unavailable, and its "Available until" time.
  // The VIN set still comes entirely from upkeep — this only categorizes them.
  function getAdminXref() {
    try {
      const raw = sessionStorage.getItem(LIST_ADMIN_XREF_KEY);
      if (!raw) return { ts: 0, vins: {} };
      const c = JSON.parse(raw);
      if (!c || typeof c.vins !== 'object' || !c.vins) return { ts: 0, vins: {} };
      return c;
    } catch { return { ts: 0, vins: {} }; }
  }

  function saveAdminXref(xref) {
    try {
      sessionStorage.setItem(LIST_ADMIN_XREF_KEY, JSON.stringify({ ts: Date.now(), vins: xref.vins || {} }));
    } catch { /* ignore (quota) */ }
  }

  // Fold a freshly-scanned admin page's vehicles into the saved xref map.
  // forcedUnavailable marks every VIN on the Unavailable tab as unavailable.
  // The admin tabs only ANNOTATE VINs that came from upkeep — they never add new
  // VINs. Anything on admin that isn't on the upkeep scan is ignored entirely.
  function mergeAdminXref(vehicles, { forcedUnavailable = false } = {}) {
    const xref = getAdminXref();
    const cache = getUpkeepScanCache();
    const upkeepSet = new Set((cache?.vehicles || []).map(v => normalizeVin(v?.vin)).filter(v => isVin(v)));
    for (const v of (vehicles || [])) {
      const vin = normalizeVin(v?.vin);
      if (!isVin(vin) || isExcludedVin(vin)) continue;
      // Only annotate VINs that are on upkeep; admin never introduces VINs.
      if (upkeepSet.size && !upkeepSet.has(vin)) continue;
      const e = xref.vins[vin] || { commuter: false, unavailable: false, training: false, until: '', arriving: '', arrivingStart: '', arrivingDurMin: 0 };
      if (v.commuter) e.commuter = true;
      if (forcedUnavailable || v.unavailable) e.unavailable = true;
      if (v.training) e.training = true;
      if (v.availableUntil && !e.until) e.until = v.availableUntil;
      if (v.arriving && !e.arriving) {
        e.arriving = v.arriving;
        e.arrivingStart = v.arrivingStart || '';
        e.arrivingDurMin = v.arrivingDurMin || 0;
      }
      xref.vins[vin] = e;
    }
    saveAdminXref(xref);
    return xref;
  }

  // VINs flagged commuter or unavailable. They never appear in Vins left or Work
  // Count and don't count toward the progress bar. Read from the SAVED LIST (the
  // last List scan persisted the Commuter/Unavailable sections), so the rule
  // survives even after the transient admin xref is cleared.
  function getAdminExcludedVinSet() {
    const meta = getListVinMeta();
    const set = new Set();
    for (const [vin, m] of Object.entries(meta)) {
      if (m && (m.kind === 'commuter' || m.kind === 'unavailable' || m.kind === 'training')) {
        const n = normalizeVin(vin);
        if (isVin(n)) set.add(n);
      }
    }
    return set;
  }

  // Load a cached scan into the live module vars so the formatters can rebuild
  // from it without re-scanning the page.
  function applyUpkeepScanCache(c) {
    upkeepTaskData = c.taskData || {};
    upkeepBackupVins = new Set(c.backupVins || []);
  }

  // Work count straight from the upkeep scan: every completed task this shift is
  // credited to its task username (no per-VIN history navigation). Counts per
  // completed task, split by vehicle type (prod / cybercab / dev).
  function buildUpkeepWorkCount(taskData) {
    const shiftStart = progressShiftStartMs();
    const windowEnd = progressShiftEndMs();
    const prodSet = getDriverlessVinSet();
    const adminExcluded = getAdminExcludedVinSet();
    const userCounts = {};
    for (const [vinRaw, tasks] of Object.entries(taskData || {})) {
      const vin = normalizeVin(vinRaw);
      if (!isVin(vin) || isExcludedVin(vin) || upkeepBackupVins.has(vin)) continue;
      // Commuter / unavailable cars (admin tab) get no Work Count credit.
      if (adminExcluded.has(vin)) continue;
      const isProd = prodSet.has(vin);
      const isCc = !isProd && isCybercabVin(vin);
      // Count each VIN once per person — a person who did several tasks on the
      // same car still only counts as one VIN (no per-task duplication).
      const users = new Set();
      for (const e of Object.values(tasks || {})) {
        if (!e || !e.completed || !e.user) continue;
        const ms = Date.parse(e.ts);
        // Only count work finished within the shift window (7:30 PM .. 7:30 AM).
        if (!(ms >= shiftStart && ms <= windowEnd)) continue;
        users.add(e.user);
      }
      for (const u of users) {
        const b = userCounts[u] || { prod: 0, cybercab: 0, dev: 0 };
        if (isProd) b.prod += 1; else if (isCc) b.cybercab += 1; else b.dev += 1;
        userCounts[u] = b;
      }
    }
    return userCounts;
  }

  // VINs that earned Work Count credit this shift — at least one completed task
  // with a non-empty user inside the shift window. Mirrors the per-VIN and
  // per-task filtering in buildUpkeepWorkCount so this set is exactly the VINs
  // that show up in the Work Count tally. reconcileUpkeepScan uses it to keep
  // credited cars from being auto-completed (which would credit nobody).
  function getUpkeepWorkCountVinSet() {
    const shiftStart = progressShiftStartMs();
    const windowEnd = progressShiftEndMs();
    const adminExcluded = getAdminExcludedVinSet();
    const out = new Set();
    for (const [vinRaw, tasks] of Object.entries(getUpkeepTaskHistory())) {
      const vin = normalizeVin(vinRaw);
      if (!isVin(vin) || isExcludedVin(vin) || upkeepBackupVins.has(vin)) continue;
      // Commuter / unavailable cars (admin tab) get no Work Count credit.
      if (adminExcluded.has(vin)) continue;
      for (const e of Object.values(tasks || {})) {
        if (!e || !e.completed || !e.user) continue;
        const ms = Date.parse(e.ts);
        if (!(ms >= shiftStart && ms <= windowEnd)) continue;
        out.add(vin);
        break;
      }
    }
    return out;
  }

  function buildUpkeepWorkCountText(taskData) {
    const map = new Map(Object.entries(buildUpkeepWorkCount(taskData)));
    const completedVins = upkeepCompletedEntries(taskData).length;
    const reservations = getProgressVins();
    const doneSet = getDoneVinSetAll();
    const vinsLeft = reservations.filter(v => !doneSet.has(v)).length;
    const now = new Date();
    const lines = [
      `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - Jacks List Work Count`,
      `Total Vins: ${completedVins} · Vins left: ${vinsLeft}`,
      '',
      ...formatWorkCount(map).split('\n')
    ];
    return lines.join('\n').trim();
  }

  function saveUpkeepDueScope(allOnListDue, needsWork) {
    const reservations = getProgressVins();
    sessionStorage.setItem(UPKEEP_DUE_ON_LIST_KEY, JSON.stringify({
      reservationTotal: reservations.length,
      allOnListDue: [...new Set(allOnListDue.map(normalizeVin).filter(v => isVin(v)))],
      needsWork: [...new Set(needsWork.map(normalizeVin).filter(v => isVin(v)))],
      ts: Date.now()
    }));
  }

  function getUpkeepDueScopeCache() {
    const raw = sessionStorage.getItem(UPKEEP_DUE_ON_LIST_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      const ts = Number(parsed.ts) || 0;
      const stale = !ts || Date.now() - ts > UPKEEP_SCOPE_MAX_AGE_MS;
      return {
        allOnListDue: Array.isArray(parsed.allOnListDue) ? parsed.allOnListDue.map(normalizeVin).filter(v => isVin(v)) : [],
        needsWork: Array.isArray(parsed.needsWork) ? parsed.needsWork.map(normalizeVin).filter(v => isVin(v)) : [],
        ts,
        stale
      };
    } catch { return null; }
  }

  /** Progress uses all reservations; "needs work" matches Vins left after a upkeep scan. */
  function getAlignedWorkCounts() {
    const reservationVins = getProgressVins();
    const allListVins = getAllListVins();
    const total = reservationVins.length;
    if (!total && !allListVins.length) {
      return {
        done: 0, total: 0, left: 0, checked: 0, scanTotal: 0, scanning: false,
        mode: 'list', notOnUpkeep: 0, onUpkeep: 0, upkeepStale: true,
        needsWorkVins: [], notOnUpkeepVins: [], scopeVins: []
      };
    }

    let doneSet = getDoneVinSetAll();
    let checked = 0;
    let scanTotal = allListVins.length;
    let scanning = false;
    let skippedDone = 0;
    let allListTotal = allListVins.length;
    const stateRaw = sessionStorage.getItem(STATE_KEY);
    if (stateRaw) {
      try {
        const state = JSON.parse(stateRaw);
        if (state.active && state.stage === 'history_check') {
          scanning = true;
          scanTotal = (state.vins || allListVins).length;
          checked = Math.min(Math.max(state.checkedCount || 0, state.index || 0), scanTotal);
          skippedDone = state.skippedDone || 0;
          allListTotal = state.allListTotal || allListVins.length;
          if (Array.isArray(state.completedVins)) {
            const cutoff = progressShiftStartMs();
            state.completedVins.forEach(entry => {
              const vin = progressDoneVinFromEntry(entry);
              const ts = progressDoneTsFromEntry(entry);
              if (isVin(vin) && ts >= cutoff) doneSet.add(vin);
            });
          }
        }
      } catch { /* ignore */ }
    }

    const done = reservationVins.filter(v => doneSet.has(v)).length;
    const cache = getUpkeepDueScopeCache();
    const scanMeta = { skippedDone, allListTotal };

    if (cache && !cache.stale) {
      const dueSet = new Set(cache.allOnListDue);
      const needsWorkVins = reservationVins.filter(v => dueSet.has(v) && !doneSet.has(v));
      // A reservation that's off the upkeep page but already done (e.g. dropped
      // off after its upkeep finished) counts as done, not "not on upkeep".
      const notOnUpkeepVins = reservationVins.filter(v => !dueSet.has(v) && !doneSet.has(v));
      const onUpkeepCount = reservationVins.filter(v => dueSet.has(v)).length;
      return {
        done,
        total,
        left: needsWorkVins.length,
        checked,
        scanTotal,
        scanning,
        mode: 'upkeep',
        notOnUpkeep: notOnUpkeepVins.length,
        onUpkeep: onUpkeepCount,
        upkeepStale: false,
        needsWorkVins,
        notOnUpkeepVins,
        scopeVins: reservationVins,
        ...scanMeta
      };
    }

    return {
      done,
      total,
      left: total - done,
      checked,
      scanTotal,
      scanning,
      mode: 'list',
      notOnUpkeep: null,
      onUpkeep: 0,
      upkeepStale: true,
      needsWorkVins: reservationVins.filter(v => !doneSet.has(v)),
      notOnUpkeepVins: [],
      scopeVins: reservationVins,
      ...scanMeta
    };
  }

  function getDriverlessVinSet() {
    const set = new Set();
    const raw = sessionStorage.getItem(RESERVATION_VINS_PROD_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) parsed.forEach(v => { const n = normalizeVin(v); if (isVin(n)) set.add(n); });
      } catch { /* ignore */ }
    }
    const meta = getListVinMeta();
    for (const [vin, m] of Object.entries(meta)) {
      if (m.kind === 'driverless') set.add(normalizeVin(vin));
    }
    for (const line of getSavedListText().split('\n')) {
      if (!/\[DRIVERLESS\]/i.test(line)) continue;
      const vinsOnLine = line.match(VIN_FIND_RE);
      if (vinsOnLine) vinsOnLine.forEach(v => { const n = normalizeVin(v); if (isVin(n)) set.add(n); });
    }
    return set;
  }

  function getCybercabVinSet() {
    const set = new Set();
    for (const vin of getProgressVins()) {
      if (isCybercabVin(vin)) set.add(normalizeVin(vin));
    }
    return set;
  }

  function workCountBucketTotal(v = {}) {
    return (v.prod || 0) + (v.cybercab || 0) + (v.dev || 0);
  }

  function formatWorkCountUserParts(v = {}) {
    const parts = [];
    if (v.prod) parts.push(`${v.prod} prod`);
    if (v.cybercab) parts.push(`${v.cybercab} cybercab`);
    if (v.dev) parts.push(`${v.dev} dev`);
    return parts.join(' ') || '0';
  }

  // Save a pasted list (multi-line text) and show it. Returns true on success.
  function applyPastedList(rawText) {
    const vins = savePastedList(rawText);
    if (!vins) { showStatus(); setStatus('No VINs found in pasted text.'); return false; }
    listPreviewArmed = true; // it's now showing; next List click follows the toggle
    showStatus();
    setStatus(`Pasted list saved: ${vins.length} VINs`);
    showPreview(getSavedListText());
    updateListInfoBar();
    return true;
  }

  // A proper multi-line paste box (prompt() is single-line and mangles a pasted
  // list). Used by the info-bar button and by long-pressing the List button.
  function showPasteListModal() {
    document.getElementById('jacks-list-paste-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'jacks-list-paste-overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483647',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:rgba(0,0,0,.55)', 'backdrop-filter:blur(2px)'
    ].join(';');

    const card = document.createElement('div');
    card.style.cssText = [
      'width:min(460px,92vw)', 'box-sizing:border-box',
      'padding:22px 24px 18px', 'border-radius:16px',
      `background:${UI.panelBg}`, `border:1px solid ${UI.panelBorder}`,
      `box-shadow:${UI.panelShadow}`, 'color:#ececec',
      'transform:translateY(8px) scale(.98)', 'opacity:0',
      'transition:transform .18s ease, opacity .18s ease'
    ].join(';');

    const titleEl = document.createElement('div');
    titleEl.textContent = 'Paste list';
    titleEl.style.cssText = `font:600 15px "DM Mono",monospace;color:${UI.accentBright};margin:0 0 4px;`;
    const hintEl = document.createElement('div');
    hintEl.textContent = 'Paste the Jacks List below, then Save (Ctrl+Enter).';
    hintEl.style.cssText = 'font:500 11px "DM Mono",monospace;color:#9a9488;margin:0 0 12px;';

    const ta = document.createElement('textarea');
    ta.placeholder = 'Paste the Jacks List here…';
    ta.style.cssText = [
      'width:100%', 'height:220px', 'box-sizing:border-box', 'resize:vertical',
      'background:rgba(0,0,0,.35)', 'color:#e8e4dc',
      'border:1px solid rgba(201,168,107,.25)', 'border-radius:10px',
      'padding:10px 12px', 'font:500 12px "DM Mono",monospace', 'outline:none', 'margin:0 0 16px'
    ].join(';');

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = ['padding:8px 16px', 'border-radius:10px', 'cursor:pointer', 'font:600 12px "DM Mono",monospace', 'background:transparent', 'color:#cfcabd', 'border:1px solid rgba(201,168,107,.28)'].join(';');
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.textContent = 'Save list';
    saveBtn.style.cssText = ['padding:8px 16px', 'border-radius:10px', 'cursor:pointer', 'font:700 12px "DM Mono",monospace', `background:${UI.accent}`, `color:${UI.accentText}`, 'border:1px solid transparent'].join(';');

    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey, true);
      card.style.opacity = '0';
      card.style.transform = 'translateY(8px) scale(.98)';
      setTimeout(() => overlay.remove(), 160);
    };
    const save = () => {
      const val = ta.value;
      close();
      if (val && val.trim()) applyPastedList(val);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopPropagation(); save(); }
    };
    cancelBtn.onclick = () => close();
    saveBtn.onclick = () => save();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey, true);

    btnRow.append(cancelBtn, saveBtn);
    card.append(titleEl, hintEl, ta, btnRow);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => { card.style.opacity = '1'; card.style.transform = 'none'; });
    ta.focus();
    // Best-effort prefill from the clipboard (works only if the page has access).
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(t => { if (t && !ta.value) ta.value = t; }).catch(() => {});
      }
    } catch { /* ignore */ }
  }

  function promptAndSavePastedList() {
    if (activeScan) return;
    showPasteListModal();
  }

  function startOrPreviewList() {
    const saved = sessionStorage.getItem(LIST_LAST_TEXT_KEY) || getSavedListText();
    const hasSavedList = !!(saved && getReservationVins().length);
    if (hasSavedList && !listPreviewArmed) {
      showPreview(saved);
      showStatus();
      setStatus('Showing last result. Click List again to run a new scan.');
      listPreviewArmed = true;
      return;
    }
    listPreviewArmed = false;
    if (hasSavedList) {
      showConfirmModal({
        title: 'Rescan list?',
        message: 'You already have a saved list. Running a new scan will re-scan the upkeep page and rebuild it from scratch. Continue?',
        confirmLabel: 'Rescan',
        cancelLabel: 'Keep current',
        onConfirm: () => startFullScan(),
        onCancel: () => { setStatus('Rescan cancelled — keeping current list'); }
      });
      return;
    }
    startFullScan();
  }

  function startOrPreviewUpkeep() {
    // Reuse a recent upkeep scan instead of re-scanning (within scanReuseMinutes).
    const cache = freshUpkeepScanCache();
    if (cache) {
      applyUpkeepScanCache(cache);
      reconcileUpkeepScan(cache.vehicles);
      const text = formatUpkeepList(cache.vehicles);
      sessionStorage.setItem(UPKEEP_LAST_TEXT_KEY, text);
      sessionStorage.setItem(LAST_TEXT_KEY, text);
      try { gmSet(SHARED_VINSLEFT_KEY, text); gmSet(SHARED_VINSLEFT_TIME_KEY, Date.now()); } catch { /* ignore */ }
      copyText(text);
      showPreview(text);
      showStatus();
      setStatus(`Vins left · synced from ${cache.source} scan · ${scanAgeLabel(cache.ts)}`);
      return;
    }
    startUpkeepScan();
  }

  function startOrPreviewProgress() {
    const cache = freshUpkeepScanCache();
    if (cache) {
      applyUpkeepScanCache(cache);
      const merged = reconcileUpkeepScan(cache.vehicles);
      const text = buildUpkeepWorkCountText(merged);
      sessionStorage.setItem(PROGRESS_LAST_TEXT_KEY, text);
      sessionStorage.setItem(LAST_TEXT_KEY, text);
      copyText(text);
      showPreview(text);
      showStatus();
      setStatus(`Work Count · synced from ${cache.source} scan · ${scanAgeLabel(cache.ts)}`);
      return;
    }
    startWorkCountScan();
  }

  function params() { return new URLSearchParams(location.search); }
  function currentAssignment() { return params().get('assignment') || ''; }
  function assignmentLabel(id = currentAssignment()) { return TARGET.assignmentNames[id] || id || 'current'; }
  function isDriverlessPage() { return location.pathname === TARGET.path && params().get('env') === TARGET.driverlessEnv; }
  function isUpkeepPage() { return location.pathname === TARGET.upkeepPath; }

  function reportDate() {
    const d = new Date();
    d.setDate(d.getDate() + CONFIG.dateOffsetDays);
    return d;
  }

  function dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function addDays(d, days) {
    const copy = new Date(d);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  function upkeepUrl() {
    return UPKEEP_START_URL;
  }

  function isUpkeepStartPage() {
    if (location.pathname !== TARGET.upkeepPath) return false;
    const params = new URLSearchParams(location.search);
    return params.get('schedule') === 'Dallas';
  }

  function isAdminVehiclesPage(status) {
    if (location.pathname !== TARGET.path) return false;
    const p = new URLSearchParams(location.search);
    if (p.get('schedule') !== ADMIN_VEHICLES_SCHEDULE) return false;
    return (p.get('status') || '').toLowerCase() === String(status).toLowerCase();
  }

  function isLowCcPage() {
    if (location.pathname !== TARGET.path) return false;
    const p = new URLSearchParams(location.search);
    return (p.get('chassis') || '').toUpperCase() === 'CYBERCAB' && p.get('schedule') === ADMIN_VEHICLES_SCHEDULE;
  }

  function showStatus() {
    statusHasBeenShown = true;
    if (statusEl) statusEl.style.display = '';
  }

  function applyStatusFillWidth(ratio, animate = true) {
    const fill = document.getElementById('jacks-list-status-fill');
    if (!fill) return;
    const pct = `${Math.min(100, Math.max(0, ratio * 100))}%`;
    if (!animate) {
      fill.style.transition = 'none';
      fill.style.width = pct;
      void fill.offsetWidth;
      fill.style.transition = 'width 0.65s ease';
      return;
    }
    fill.style.width = pct;
  }

  function hideStatusBar() {
    statusHasBeenShown = false;
    statusProgressValue = null;
    sessionStorage.removeItem('__jacks_list_status_progress__');
    if (statusEl) statusEl.style.display = 'none';
    applyStatusFillWidth(0, false);
  }

  function setStatus(text, progress, opts = {}) {
    const textEl = document.getElementById('jacks-list-status-text');
    const fill = document.getElementById('jacks-list-status-fill');
    if (textEl) textEl.textContent = text;
    else if (statusEl) statusEl.textContent = text;
    if (typeof progress === 'number' && Number.isFinite(progress)) {
      statusProgressValue = Math.min(1, Math.max(0, progress));
      if (activeScan) {
        sessionStorage.setItem('__jacks_list_status_progress__', String(statusProgressValue));
      }
    }
    if (fill) {
      // During finalize we temporarily keep the fill visible even if activeScan becomes null.
      const canFill = statusProgressValue !== null && (activeScan || statusHasBeenShown || statusIsFinalizing);
      const instantFill = opts.instantFill === true || statusFillSkipTransition;
      if (statusFillSkipTransition) statusFillSkipTransition = false;
      if (canFill) applyStatusFillWidth(statusProgressValue, opts.animateFill !== false && !instantFill);
      else if (!activeScan) {
        applyStatusFillWidth(0, false);
        statusProgressValue = null;
      }
    }
    if (statusEl) statusEl.style.display = activeScan ? '' : (statusHasBeenShown ? '' : 'none');
  }

  function finalizeStatusBar() {
    if (!statusEl) return;
    statusFinalizeToken += 1;
    const token = statusFinalizeToken;

    if (statusHideAfterFullTimer) clearTimeout(statusHideAfterFullTimer);
    if (statusHideSwipeTimer) clearTimeout(statusHideSwipeTimer);
    statusHideAfterFullTimer = null;
    statusHideSwipeTimer = null;

    statusIsFinalizing = true;
    showStatus();

    statusProgressValue = 1;
    const text = document.getElementById('jacks-list-status-text')?.textContent
      || statusEl.textContent
      || '';
    const fill = document.getElementById('jacks-list-status-fill');
    if (fill) applyStatusFillWidth(1, true);
    if (document.getElementById('jacks-list-status-text')) {
      document.getElementById('jacks-list-status-text').textContent = text;
    } else {
      statusEl.textContent = text;
    }

    statusHideAfterFullTimer = setTimeout(() => {
      if (token !== statusFinalizeToken || statusIsFinalizing === false) return;
      statusHideSwipeTimer = setTimeout(() => {
        if (token !== statusFinalizeToken) return;
        statusIsFinalizing = false;
        statusHasBeenShown = false;
        statusProgressValue = null;
        const fill2 = document.getElementById('jacks-list-status-fill');
        if (fill2) applyStatusFillWidth(0, false);
        statusEl.style.display = 'none';
        statusEl.style.transform = '';
        statusEl.style.opacity = '';
      }, 260);
      statusEl.style.transition = 'transform .25s ease, opacity .25s ease';
      statusEl.style.transform = 'translateY(10px)';
      statusEl.style.opacity = '0';
    }, 3000);
  }

  function shouldKeepStatusBarOnLoad() {
    const raw = sessionStorage.getItem(STATE_KEY);
    if (raw) {
      try {
        const s = JSON.parse(raw);
        if (s.active && (s.stage === 'history_check' || s.stage === 'upkeep' || s.stage === 'upkeep_overview' || s.stage === 'work_count_scan')) return true;
      } catch { /* ignore */ }
    }
    return false;
  }

  function progressScanBarValue(state, phase = 'loading') {
    const total = (state.vins || []).length;
    if (!total) return 0;
    if (phase === 'checked') {
      const checked = state.checkedCount ?? (state.index ?? 0) + 1;
      return Math.min(0.995, checked / total);
    }
    return Math.min(0.995, (state.index || 0) / total);
  }

  function computeScanProgress(scanState, scrollIndex, maxScrolls) {
    if (!scanState) return null;
    const pageNum = Math.max(1, scanState.pageNum || 1);
    const pageTotal = Math.max(1, scanState.pageTotal || CONFIG.maxPages);
    const maxS = Math.max(1, maxScrolls || CONFIG.maxScrollsPerPage);
    const scrollFrac = Math.min(1, (scrollIndex + 1) / maxS);
    const ctx = scanState.progressCtx;
    const pageSlice = ctx ? ctx.span / pageTotal : 1 / pageTotal;
    const base = ctx ? ctx.base + (pageNum - 1) * pageSlice : (pageNum - 1) / pageTotal;
    return Math.min(0.995, base + scrollFrac * pageSlice * 0.98);
  }

  // Upkeep progress is driven by how many of the total "Results: N" VINs we've
  // collected so far, so the bar climbs smoothly (70 of 100 scanned -> 70%)
  // and carries across pages instead of stalling until the page flips.
  function upkeepScanProgress(collected) {
    const total = getResultsCount();
    if (!total || total <= 0) return null;
    return Math.min(0.98, Math.max(0, collected) / total);
  }

  function scanBarProgress(isUpkeep, mapSize, scanState, scrollIndex, maxScrolls) {
    if (isUpkeep) {
      const up = upkeepScanProgress(mapSize);
      if (up != null) return up;
    }
    return computeScanProgress(scanState, scrollIndex, maxScrolls);
  }

  function stopActiveScan() {
    stopScanRequested = true;
    sessionStorage.removeItem(WC_STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(PROGRESS_PENDING_FINISH_KEY);
    hidePasteNotification();
    setActiveScan(null);
    showStatus();
    setStatus('stopped');
  }

  function syncActiveScanFromSession() {
    sessionStorage.removeItem(WC_STATE_KEY);
    const raw = sessionStorage.getItem(STATE_KEY);
    if (raw) {
      try {
        const state = JSON.parse(raw);
        if (!state.active) { setActiveScan(null); return; }
        if (state.stage === 'history_check') setActiveScan('progress');
        else if (state.stage === 'work_count_scan') setActiveScan('progress');
        else if (state.stage === 'upkeep' && state.forProgress) setActiveScan('progress');
        else if (state.stage === 'upkeep') setActiveScan('upkeep');
        else if (state.stage === 'upkeep_overview') setActiveScan(state.asList ? 'list' : 'upkeep_overview');
        else if (state.stage === 'low_cc') setActiveScan('lowcc');
        else setActiveScan('list');
        return;
      } catch { /* ignore */ }
    }
    setActiveScan(null);
  }

  function updateScanButtons() {
    const scans = [
      { id: 'list', btn: startButton, label: 'List', start: () => startOrPreviewList() },
      { id: 'progress', btn: progressButton, label: 'Work Count', start: () => startOrPreviewProgress() },
      { id: 'upkeep', btn: upkeepButton, label: 'Vins left', start: () => startOrPreviewUpkeep() },
      { id: 'lowcc', btn: lowCcButton, label: 'Low CC', start: () => { if (!activeScan) startLowCcScan(); } }
    ];
    for (const { id, btn, label, start } of scans) {
      if (!btn) continue;
      const isActive = activeScan === id;
      btn.textContent = isActive ? 'Stop' : label;
      btn.style.cssText = isActive ? buttonStyle() : ghostButtonStyle();
      btn.disabled = !!(activeScan && !isActive);
      btn.style.opacity = btn.disabled ? '0.45' : '1';
      btn.style.cursor = btn.disabled ? 'not-allowed' : 'pointer';
      btn.onclick = isActive ? stopActiveScan : start;
    }
    if (statusEl && !activeScan && !statusIsFinalizing) statusEl.style.display = 'none';
    else if (statusEl && activeScan) statusEl.style.display = '';
  }

  function setActiveScan(scanType) {
    activeScan = scanType || null;
    if (scanType) {
      // New scan started: cancel any finalize hide animation.
      statusIsFinalizing = false;
      statusFinalizeToken += 1;
      if (statusHideAfterFullTimer) clearTimeout(statusHideAfterFullTimer);
      if (statusHideSwipeTimer) clearTimeout(statusHideSwipeTimer);
      statusHideAfterFullTimer = null;
      statusHideSwipeTimer = null;
      if (statusEl) {
        statusEl.style.transform = '';
        statusEl.style.opacity = '';
      }
    }
    updateScanButtons();
    if (!activeScan && document.getElementById('jacks-list-output-area')?.style.display === 'flex') {
      // Let finalizeStatusBar control hiding; otherwise hide immediately.
      if (!statusIsFinalizing) hideStatusBar();
    }
  }

  function buttonStyle(bg, textColor) {
    const fill = bg || getAccent();
    const fg = textColor || getAccentText();
    return [
      'border:0', 'border-radius:999px', 'padding:8px 16px', `background:${fill}`,
      `color:${fg}`, 'font:600 12px "DM Sans",system-ui,sans-serif', 'cursor:pointer',
      'box-shadow:0 4px 20px rgba(201,168,107,.4), inset 0 1px 0 rgba(255,255,255,.15)',
      'transition:transform .12s, box-shadow .12s, opacity .15s',
      'flex-shrink:0', 'white-space:nowrap'
    ].join(';');
  }

  function ghostButtonStyle() {
    return [
      'border:1px solid rgba(201,168,107,.22)', 'border-radius:999px', 'padding:8px 14px',
      'background:rgba(201,168,107,.05)', 'color:#e8e4dc',
      'font:600 12px "DM Sans",system-ui,sans-serif', 'cursor:pointer',
      'transition:background .15s, border-color .15s, color .15s',
      'flex-shrink:0', 'white-space:nowrap'
    ].join(';');
  }

  function updateListInfoBar() {
    const bar = document.getElementById('jacks-list-info');
    const text = document.getElementById('jacks-list-info-text');
    if (!bar || !text) return;
    const c = getAlignedWorkCounts();
    const { done, total, left, checked, scanTotal, scanning, skippedDone } = c;
    if (total || getProgressVins().length) {
      const pct = total ? Math.round((done / total) * 100) : 0;
      const scanCache = getUpkeepScanCache();
      const freshPart = scanCache ? ` · scanned ${scanAgeLabel(scanCache.ts)}` : '';
      if (!isProgressShiftActive() && !scanning) {
        text.textContent = `${total} reservations · shift not started (resets at ${shiftStartLabel()})`;
        bar.style.display = 'flex';
        return;
      }
      if (scanning) {
        const skipPart = skippedDone ? ` · ${skippedDone} cached` : '';
        text.textContent = `${total} reservations · check ${checked}/${scanTotal}${skipPart} · ${done} done · ${left} need work`;
      } else if (c.mode === 'upkeep') {
        const notOnUpkeepPart = c.notOnUpkeep != null ? ` · ${c.notOnUpkeep} not on upkeep` : '';
        text.textContent = `${total} reservations · ${done} done (${pct}%) · ${left} need work (VL)${notOnUpkeepPart}${freshPart}`;
      } else {
        text.textContent = `${total} reservations · ${done} done (${pct}%)${freshPart}`;
      }
      bar.style.display = 'flex';
    } else {
      text.textContent = 'No list — run List, or use Paste new list';
      bar.style.display = 'flex';
    }
  }

    function showPasteNotification() {
    document.getElementById('jacks-list-paste-notif')?.remove();
    const notif = document.createElement('div');
    notif.id = 'jacks-list-paste-notif';
    notif.style.cssText = [
      'position:fixed', 'top:16px', 'right:16px', 'z-index:2147483647',
      'display:flex', 'align-items:center', 'gap:10px',
      'padding:10px 16px', 'border-radius:12px',
      'background:rgba(17,17,21,.96)', 'border:1px solid #28282f',
      'box-shadow:0 8px 24px rgba(0,0,0,.4)',
      'font:500 12px "DM Mono",monospace', 'color:#7a7a85',
      'backdrop-filter:blur(14px)'
    ].join(';');

    const saved = sessionStorage.getItem(RESERVATION_VINS_KEY);
    const count = saved ? JSON.parse(saved).length : 0;

    const label = document.createElement('span');
    label.textContent = saved ? `Work Count — ${count} VINs (saved list)` : 'Work Count — no saved list';
    label.style.color = saved ? '#ececec' : getAccent();

    const btn = document.createElement('button');
    btn.textContent = 'Paste new list';
    btn.style.cssText = [
      'border:1px solid #28282f', 'border-radius:999px', 'padding:4px 12px',
      'background:rgba(255,255,255,.08)', 'color:#ececec',
      'font:500 11px "DM Mono",monospace', 'cursor:pointer', 'white-space:nowrap'
    ].join(';');
    btn.onclick = () => {
      const pasted = prompt('Paste the Jacks List here:');
      if (!pasted) return;
      const vins = savePastedList(pasted);
      if (!vins) return;
      showStatus();
      setStatus(`Pasted list saved: ${vins.length} VINs`);
      showPreview(getSavedListText());
      showPasteNotification();
      updateListInfoBar();
    };

    notif.append(label, btn);
    document.body.appendChild(notif);
  }

  function hidePasteNotification() {
    document.getElementById('jacks-list-paste-notif')?.remove();
  }
  function showUpdateLog(force = false) {
    // Auto-shows once per version at startup; `force` (from the info modal's
    // "View update log" button) shows it again on demand.
    if (!force && localStorage.getItem(VERSION_SEEN_KEY) === VERSION_LOG_ID) return;
    localStorage.setItem(VERSION_SEEN_KEY, VERSION_LOG_ID);

    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483648',
      'background:rgba(0,0,0,.72)', 'display:flex',
      'align-items:center', 'justify-content:center',
      'backdrop-filter:blur(6px)'
    ].join(';');

    const modal = document.createElement('div');
    modal.style.cssText = [
      'position:relative',
      'background:linear-gradient(168deg, rgba(16,14,11,.98) 0%, rgba(7,7,9,.99) 55%, rgba(10,9,8,.98) 100%)',
      'border:1px solid rgba(201,168,107,.28)',
      'border-radius:20px', 'padding:26px 28px 24px',
      'max-width:480px', 'width:90%', 'max-height:80vh',
      'overflow-y:auto',
      'box-shadow:0 16px 56px rgba(0,0,0,.6), 0 0 0 1px rgba(201,168,107,.1), inset 0 1px 0 rgba(232,212,168,.12)',
      'font-family:"DM Sans",system-ui,sans-serif', 'color:#ececec'
    ].join(';');

    const modalShine = document.createElement('div');
    modalShine.style.cssText = [
      'position:absolute', 'top:0', 'left:12%', 'right:12%', 'height:1px', 'pointer-events:none',
      'background:linear-gradient(90deg, transparent, rgba(201,168,107,.15), #D4B87A, #C9A86B, rgba(201,168,107,.15), transparent)'
    ].join(';');
    modal.appendChild(modalShine);

    const title = document.createElement('div');
    title.style.cssText = 'font:700 15px "DM Sans",system-ui,sans-serif;margin-bottom:4px;color:#E8D4A8;letter-spacing:.01em;';
    title.textContent = `Jacks List Generator · v${VERSION}`;

    const subtitle = document.createElement('div');
    subtitle.style.cssText = 'font:500 11px "DM Mono",monospace;color:rgba(201,168,107,.6);margin-bottom:18px;letter-spacing:.04em;';
    subtitle.textContent = `What's new in v${VERSION}`;
    const updates = [
      ['🚦', 'Mission Control: hold a Due/Arriving time to turn hazards ON and precondition (two tasks, one after the other). Double-click still does hazards only.'],
      ['🔄', 'Scheduled hazard fires now refresh the page first, then fire — and no longer retry if the first attempt fails.'],
      ['➕', 'New VINs that show up on upkeep mid-shift now count toward progress and Work Count (same reservation rules as the list).'],
      ['🔋', 'New "Low CC" button: lists available cybercabs under 30% charge with no reservation (info only).'],
      ['🎓', 'Cars tagged "training" now go under "Vins not required" — skipped by Vins Left, Work Count, and the progress bar.'],
      ['🔗', 'Vins Left: the ↗ opens the vehicles page and the ✓ mark-complete now sits right next to it.'],
    ];

    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:10px;margin-bottom:22px;';

    for (const [icon, text] of updates) {
      const item = document.createElement('div');
      item.style.cssText = 'display:flex;gap:10px;align-items:flex-start;';
      const ic = document.createElement('span');
      ic.style.cssText = 'flex-shrink:0;width:20px;text-align:center;font-size:13px;line-height:1.45;color:#C9A86B;';
      ic.textContent = icon;
      ic.setAttribute('aria-hidden', 'true');
      const p = document.createElement('div');
      p.style.cssText = 'font:400 12px "DM Sans",system-ui,sans-serif;color:#c9c4b8;line-height:1.45;flex:1;';
      p.textContent = text;
      item.append(ic, p);
      list.appendChild(item);
    }

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Got it';
    closeBtn.style.cssText = [
      'border:1px solid rgba(201,168,107,.35)', 'border-radius:999px', 'padding:10px 28px',
      `background:linear-gradient(180deg, #D4B87A 0%, ${getAccent()} 100%)`,
      `color:${getAccentText()}`,
      'font:600 13px "DM Sans",system-ui,sans-serif',
      'cursor:pointer', 'width:100%',
      'box-shadow:0 2px 12px rgba(201,168,107,.25)'
    ].join(';');
    closeBtn.onclick = () => overlay.remove();

    modal.append(title, subtitle, list, closeBtn);
    closeBtn.onmouseenter = () => { closeBtn.style.filter = 'brightness(1.08)'; };
    closeBtn.onmouseleave = () => { closeBtn.style.filter = ''; };
    overlay.appendChild(modal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }
  function showInfoModal() {
    document.getElementById('jacks-list-info-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'jacks-list-info-overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483648',
      'background:rgba(0,0,0,.72)', 'display:flex',
      'align-items:center', 'justify-content:center',
      'backdrop-filter:blur(6px)'
    ].join(';');

    const modal = document.createElement('div');
    modal.style.cssText = [
      'position:relative',
      'background:linear-gradient(168deg, rgba(16,14,11,.98) 0%, rgba(7,7,9,.99) 55%, rgba(10,9,8,.98) 100%)',
      'border:1px solid rgba(201,168,107,.28)',
      'border-radius:20px', 'padding:26px 28px 22px',
      'max-width:580px', 'width:92%', 'max-height:84vh',
      'overflow-y:auto',
      'box-shadow:0 16px 56px rgba(0,0,0,.6), 0 0 0 1px rgba(201,168,107,.1), inset 0 1px 0 rgba(232,212,168,.12)',
      'font-family:"DM Sans",system-ui,sans-serif', 'color:#ececec'
    ].join(';');

    const shine = document.createElement('div');
    shine.style.cssText = [
      'position:absolute', 'top:0', 'left:12%', 'right:12%', 'height:1px', 'pointer-events:none',
      'background:linear-gradient(90deg, transparent, rgba(201,168,107,.15), #D4B87A, #C9A86B, rgba(201,168,107,.15), transparent)'
    ].join(';');
    modal.appendChild(shine);

    const title = document.createElement('div');
    title.style.cssText = 'font:700 16px "DM Sans",system-ui,sans-serif;margin-bottom:3px;color:#E8D4A8;letter-spacing:.01em;';
    title.textContent = `Jacks List Generator · v${VERSION}`;

    const subtitle = document.createElement('div');
    subtitle.style.cssText = 'font:500 11px "DM Mono",monospace;color:rgba(201,168,107,.6);margin-bottom:20px;letter-spacing:.04em;';
    subtitle.textContent = 'How it works — what every button and section means';
    modal.append(title, subtitle);

    const sections = [
      ['🎯', 'What this is', [
        'Builds the nightly Jacks List and tracks the work \u2014 all from the Dallas Upkeep page on humans.tesla.com. It scrolls/pages the upkeep page for you, formats a clean list, marks cars complete, and tallies who did what.',
        'Lists also sync with the garage mission control panel, so a list saved on one side shows up on the other.'
      ]],
      ['🔘', 'The buttons', [
        'List — Scans the Dallas upkeep page (every VIN), then cross-references the Admin Vehicles tab (Available + Unavailable) to categorize those VINs, and saves it as the Jacks List: separate "Due at <time>" and "Arriving at <time>" sections, plus Driverless, Commuter, Unavailable and Back Ups sections. Every VIN still comes from upkeep — admin only labels them. Click again to show the saved list; it asks before re-scanning.',
        'Vins left — Shows what still needs doing tonight, with a progress bar at top; completed cars drop off automatically. Reuses the last upkeep scan if it\u2019s under 10 min old (you\u2019ll see "synced from … scan"), otherwise re-scans. Hold it 1 second to force a fresh scan.',
        'Work Count — Per-person tally of who completed what this shift, plus Vins left. Reuses the last upkeep scan if under 10 min old, otherwise re-scans. Hold it 1 second to force a fresh scan.',
        'Copy — Copies the output box. Flip the Raw switch first to copy just the bare VINs.',
        'Garage — Opens the mission control assignments page in a new tab.',
        'Raw — Switches the output to plain VINs only (no battery, tags, or headings).',
        'Auto VL — Re-runs Vins left automatically on a timer; the countdown shows when the next run fires.',
        'i / − — Info (this) and minimize sit at the top-right of the button row.'
      ]],
      ['✅', 'What counts as "complete"', [
        'A car is complete once BOTH Cabin Cleaning and Offgassing Inspection are done within the shift window (7:30 PM\u20137:30 AM). Read straight from the upkeep page (done? + who + when).',
        'Completed cars drop off Vins left and fill the progress bar.',
        'Cybercabs are different: cabin/offgassing aren\u2019t daily for them, so a cybercab only shows when one of its tasks is due within 24h \u2014 it is not held to the cabin/offgassing rule.',
        'Back Ups never count toward Vins left, Work Count, or the progress bar (they\u2019re listed on the List for reference only).'
      ]],
      ['📋', 'The List sections & tags', [
        'Below 60% — Count of reservation + driverless VINs under 60% battery, shown at the top.',
        'Vins at the lot — Umbrella for cars physically at the lot: the Due at times and the Driverless section.',
        'Due at <time> — Cleaning deadline from the admin "Available until <time>" (falls back to the upkeep reserved time when admin has none). Only within the next 24h.',
        'Driverless — All prod (driverless) cars, in their own section under Vins at the lot.',
        'Arriving at <time> — Cars out on a reservation, grouped by when they return. Only shown if they get back within 10h of shift start; cars returning too late (e.g. the next day) are dropped. Separate from Vins at the lot.',
        'Vins not required — Commuter + Unavailable + Training, grouped under one separator (they don\u2019t count toward Vins left, Work Count, or the progress bar).',
        'Commuter — Cars tagged "commuter" on the admin tab.',
        'Unavailable — Cars on the admin Unavailable tab.',
        'Back Ups — Backup cars, shown separately for reference.',
        '[CC] = cybercab. Driverless (prod) cars are now in their own Driverless section.',
        'Battery icons: 🔋 above 70%, 😬 36\u201370%, 🪫 35% or less.',
        'Hidden everywhere: VINs starting with 7G, most 5YJ (cybercabs 5YJAJEEU\u2026 are kept), and a few specific excluded VINs.'
      ]],
      ['📊', 'Progress bar & Work Count', [
        'Progress bar (in Vins left) — Reservations completed this shift \u00f7 total reservations, with a cars-per-hour rate since shift start.',
        'Work Count — Each car a person worked counts once for them (not per task), split into dev / cybercab / prod, only for work finished within the shift window (7:30 PM\u20137:30 AM).',
        'Total Vins (on Work Count) — How many cars are fully complete (both cabin + offgassing done).'
      ]],
      ['💡', 'Panel & tips', [
        'List, Vins left, and Work Count all scan the same upkeep page, so they share the scan: Vins left and Work Count reuse the most recent scan for 10 minutes (shown as "synced from … scan") instead of re-scanning. The info bar shows how old that scan is ("scanned Xm ago").',
        'Need fresher data? Hold Vins left or Work Count for 1 second to force a fresh scan and skip the reuse window.',
        'If a scan comes back blank or nearly empty (page didn\u2019t load), it\u2019s ignored and your previous list/result is kept; you\u2019ll see a "scan looked empty" notice.',
        'Drag the panel to move it; drag the bottom-right corner to resize; − minimizes (click + to restore).',
        'Lists sync both ways with the garage mission control panel, which always uses the most recent saved Vins left.'
      ]],
      ['📨', 'Help', [
        'Any problems? Contact jsander@tesla.com or message Jack Sander on Teams.'
      ]]
    ];

    for (const [icon, heading, items] of sections) {
      const sec = document.createElement('div');
      sec.style.cssText = 'margin-bottom:16px;';
      const h = document.createElement('div');
      h.style.cssText = 'font:700 12.5px "DM Sans",system-ui,sans-serif;color:#D4B87A;margin-bottom:7px;display:flex;align-items:center;gap:7px;';
      h.textContent = `${icon}  ${heading}`;
      sec.appendChild(h);
      for (const item of items) {
        const row = document.createElement('div');
        row.style.cssText = 'font:400 12px/1.5 "DM Sans",system-ui,sans-serif;color:#c9c4b8;margin:0 0 5px 8px;position:relative;padding-left:10px;';
        const dot = document.createElement('span');
        dot.style.cssText = 'position:absolute;left:0;top:0;color:rgba(201,168,107,.55);';
        dot.textContent = '•';
        row.appendChild(dot);
        const dash = item.indexOf(' — ');
        if (dash > 0) {
          const b = document.createElement('span');
          b.style.cssText = 'color:#ececec;font-weight:600;';
          b.textContent = item.slice(0, dash);
          row.appendChild(b);
          row.appendChild(document.createTextNode(item.slice(dash)));
        } else {
          row.appendChild(document.createTextNode(item));
        }
        sec.appendChild(row);
      }
      modal.appendChild(sec);
    }

    const logBtn = document.createElement('button');
    logBtn.textContent = 'View update log';
    logBtn.style.cssText = [
      'border:1px solid rgba(201,168,107,.35)', 'border-radius:999px', 'padding:9px 28px',
      'background:rgba(201,168,107,.08)', 'color:#E8D4A8',
      'font:600 12.5px "DM Sans",system-ui,sans-serif',
      'cursor:pointer', 'width:100%', 'margin:4px 0 8px'
    ].join(';');
    logBtn.onmouseenter = () => { logBtn.style.background = 'rgba(201,168,107,.16)'; };
    logBtn.onmouseleave = () => { logBtn.style.background = 'rgba(201,168,107,.08)'; };
    logBtn.onclick = () => { overlay.remove(); showUpdateLog(true); };
    modal.appendChild(logBtn);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Got it';
    closeBtn.style.cssText = [
      'border:1px solid rgba(201,168,107,.35)', 'border-radius:999px', 'padding:10px 28px',
      `background:linear-gradient(180deg, #D4B87A 0%, ${getAccent()} 100%)`,
      `color:${getAccentText()}`,
      'font:600 13px "DM Sans",system-ui,sans-serif',
      'cursor:pointer', 'width:100%',
      'box-shadow:0 2px 12px rgba(201,168,107,.25)'
    ].join(';');
    closeBtn.onclick = () => overlay.remove();
    closeBtn.onmouseenter = () => { closeBtn.style.filter = 'brightness(1.08)'; };
    closeBtn.onmouseleave = () => { closeBtn.style.filter = ''; };
    modal.appendChild(closeBtn);

    overlay.appendChild(modal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }
  function makePanel() {
    injectJacksListStyles();
    if (document.getElementById('jacks-list-panel')) {
      syncActiveScanFromSession();
      applyUiTheme();
      return;
    }

    const t0 = uiTheme();
    sessionStorage.removeItem('__jacks_list_ui_theme__');
    const panel = document.createElement('div');
    panel.id = 'jacks-list-panel';
    panel.className = 'gb-panel';
    panel.style.cssText = [
      'position:fixed', 'bottom:24px', 'left:24px', 'z-index:2147483647',
      'display:flex', 'flex-direction:column-reverse', 'align-items:stretch', 'gap:0',
      `border-radius:${t0.panelRadius}`, `background:${t0.panelBg}`, 'color:#ececec',
      `box-shadow:${t0.panelShadow}`,
      'font:600 13px "DM Sans",system-ui,sans-serif',
      `border:1px solid ${t0.panelBorder}`,
      'backdrop-filter:blur(20px)', '-webkit-backdrop-filter:blur(20px)',
      `max-width:${t0.panelWidth}`, `width:${t0.panelWidth}`,
      'height:auto', 'max-height:calc(100vh - 80px)', 'overflow:hidden', 'box-sizing:border-box'
    ].join(';');
    const outputArea = document.createElement('div');
    outputArea.id = 'jacks-list-output-area';
    outputArea.style.cssText = [
      'display:none', 'flex-direction:column',
      'width:100%', 'min-width:0', 'box-sizing:border-box', 'align-self:stretch',
      'border-bottom:1px solid #28282f',
      'overflow:hidden', 'flex:1 1 auto', 'min-height:0'
    ].join(';');
    const outputHeader = document.createElement('div');
    outputHeader.style.cssText = [
      'display:flex', 'align-items:center', 'justify-content:space-between',
      'width:100%', 'box-sizing:border-box',
      'padding:10px 14px 8px',
      'font:500 11px "DM Mono",monospace', 'color:#7a7a85',
      'letter-spacing:.06em', 'text-transform:uppercase'
    ].join(';');

    const outputTitle = document.createElement('span');
    outputTitle.id = 'jacks-list-output-title';
    outputTitle.textContent = 'Output';

    const outputClose = document.createElement('button');
    outputClose.textContent = '✕';
    outputClose.style.cssText = [
      'border:0', 'background:transparent', 'color:#7a7a85',
      'cursor:pointer', 'font-size:13px', 'padding:0', 'line-height:1'
    ].join(';');
    outputClose.onclick = () => collapseOutputPanel();

    outputHeader.append(outputTitle, outputClose);

    const outputText = document.createElement('textarea');
    outputText.id = 'jacks-list-output-text';
    outputText.readOnly = false;
    outputText.style.cssText = [
      'width:100%', 'height:500px',
      'background:transparent', 'border:0', 'resize:none',
      'padding:2px 14px 12px 14px', 'margin:0',
      'font:13px/1.45 "DM Mono",monospace', 'color:#c8c8d0',
      'outline:none', 'overflow-y:auto',
      'box-sizing:border-box'
    ].join(';');
    // Styled (pretty) view of the same content; default visible, Raw flips to
    // the plain textarea above.
    const outputRender = document.createElement('div');
    outputRender.id = 'jacks-list-output-render';
    outputRender.style.cssText = [
      'width:100%', 'height:500px',
      'margin:0', 'box-sizing:border-box',
      'overflow-y:auto', 'overflow-x:hidden'
    ].join(';');
    // Remember scroll position so refreshes/page navigations during a scan don't
    // yank the output back to the top while the user is reading it.
    const saveOutputScroll = (el) => {
      try {
        sessionStorage.setItem(OUTPUT_SCROLL_KEY, JSON.stringify({ sig: outputScrollSig(fullOutputCache), top: el.scrollTop }));
      } catch { /* ignore */ }
    };
    outputText.addEventListener('scroll', () => saveOutputScroll(outputText));
    outputRender.addEventListener('scroll', () => saveOutputScroll(outputRender));
    function syncOutputHeight(panelHeightPx) {
      if (!panelHeightPx || panelHeightPx <= 0) return;
      const reserve = panelMinimized ? 0 : 230;
      const next = Math.max(220, Math.floor(panelHeightPx - reserve));
      outputText.style.height = `${next}px`;
      outputRender.style.height = `${next}px`;
      if (outputArea) {
        outputArea.style.width = '100%';
        outputArea.style.maxWidth = '100%';
      }
      const infoBar = document.getElementById('jacks-list-info');
      if (infoBar) {
        infoBar.style.width = '100%';
        infoBar.style.maxWidth = '100%';
      }
    }
    const listInfoBar = document.createElement('div');
    listInfoBar.id = 'jacks-list-info';
    listInfoBar.style.cssText = [
      'display:none', 'width:100%', 'box-sizing:border-box',
      'padding:7px 14px', 'flex-wrap:wrap', 'gap:8px',
      'font:500 11px "DM Mono",monospace',
      'color:#7a7a85', 'border-bottom:1px solid #28282f',
      'justify-content:space-between', 'align-items:center'
    ].join(';');

    const listInfoText = document.createElement('span');
    listInfoText.id = 'jacks-list-info-text';
    listInfoText.style.cssText = 'flex:1 1 auto;min-width:0;word-break:break-word;';
    const listClearBtn = document.createElement('button');
    listClearBtn.textContent = 'Clear list';
    listClearBtn.style.cssText = [
      'border:1px solid #28282f', 'border-radius:999px', 'padding:3px 10px',
      'background:rgba(255,255,255,.04)', 'color:#7a7a85',
      'font:500 11px "DM Mono",monospace', 'cursor:pointer'
    ].join(';');
    listClearBtn.onclick = () => {
      sessionStorage.removeItem(RESERVATION_VINS_KEY);
      sessionStorage.removeItem(RESERVATION_LIST_TEXT_KEY);
      sessionStorage.removeItem(RESERVATION_VINS_TIME_KEY);
      sessionStorage.removeItem('__jacks_list_saved_time__');
      sessionStorage.removeItem(LAST_TEXT_KEY);
      sessionStorage.removeItem(LIST_LAST_TEXT_KEY);
      sessionStorage.removeItem(UPKEEP_LAST_TEXT_KEY);
      sessionStorage.removeItem(PROGRESS_LAST_TEXT_KEY);
      sessionStorage.removeItem(STATE_KEY);
      sessionStorage.removeItem(WC_STATE_KEY);
      sessionStorage.removeItem(PROGRESS_DONE_VINS_KEY);
      sessionStorage.removeItem(PROGRESS_WC_CACHE_KEY);
      sessionStorage.removeItem(PROGRESS_PENDING_FINISH_KEY);
      sessionStorage.removeItem(UPKEEP_DONE_VINS_KEY);
      sessionStorage.removeItem(MANUAL_DONE_VINS_KEY);
      sessionStorage.removeItem(UPKEEP_SCAN_CACHE_KEY);
      sessionStorage.removeItem(UPKEEP_TASK_HISTORY_KEY);
      sessionStorage.removeItem(UPKEEP_SEEN_KEY);
      sessionStorage.removeItem(LIST_ADMIN_XREF_KEY);
      sessionStorage.removeItem(SURFACED_VINS_KEY);
      const oa = document.getElementById('jacks-list-output-area');
      if (oa) collapseOutputPanel();
      updateListInfoBar();
      showStatus();
      setStatus('cleared — press List to scan or paste a list');
    };

    const listInfoBtn = document.createElement('button');
    listInfoBtn.textContent = 'Paste new list';
    listInfoBtn.style.cssText = [
      'border:1px solid #28282f', 'border-radius:999px', 'padding:3px 10px',
      'background:rgba(255,255,255,.08)', 'color:#ececec',
      'font:500 11px "DM Mono",monospace', 'cursor:pointer'
    ].join(';');
    listInfoBtn.onclick = () => promptAndSavePastedList();

    const listInfoActions = document.createElement('div');
    listInfoActions.className = 'gb-info-actions';
    listInfoActions.append(listClearBtn, listInfoBtn);
    listInfoBar.append(listInfoText, listInfoActions);
    outputArea.append(listInfoBar, outputHeader, outputRender, outputText);

    const panelChrome = document.createElement('div');
    panelChrome.id = 'jacks-list-panel-chrome';
    panelChrome.style.padding = t0.chromePad;
    const chromeBrand = document.createElement('div');
    const brandTitle = document.createElement('div');
    brandTitle.id = 'jacks-list-brand-title';
    brandTitle.textContent = `Jacks List Generator · v${VERSION}`;
    chromeBrand.append(brandTitle);
    panelChrome.append(chromeBrand);

    const buttonRow = document.createElement('div');
    buttonRow.id = 'jacks-list-button-row';
    buttonRow.style.cssText = [
      'display:flex', 'flex-direction:column', 'gap:0',
      'padding:0', 'position:relative', 'box-sizing:border-box',
      'width:100%', 'min-width:0', 'align-self:stretch'
    ].join(';');

   const buttonInnerRow = document.createElement('div');
          buttonInnerRow.id = 'jacks-list-button-inner-row';
    buttonInnerRow.style.cssText = [
      'display:flex', 'align-items:center', 'gap:7px',
      'flex-wrap:nowrap', 'box-sizing:border-box', 'width:100%', 'min-width:0'
    ].join(';');
    startButton = document.createElement('button');
    startButton.textContent = 'List';
    startButton.title = 'List scan (click to scan/show; hold 1s to paste a list)';
    startButton.style.cssText = ghostButtonStyle();

    copyButton = document.createElement('button');
    copyButton.textContent = 'Copy';
    copyButton.style.cssText = ghostButtonStyle();
    copyButton.onclick = async () => {
      const text = fullOutputCache || sessionStorage.getItem(LAST_TEXT_KEY);
      if (!text) { showStatus(); setStatus('nothing copied yet'); return; }
      await copyText(rawMode ? toRawText(text) : text);
      showStatus();
      setStatus(rawMode ? 'copied (raw)' : 'copied');
    };

    upkeepButton = document.createElement('button');
    upkeepButton.textContent = 'Vins left';
    upkeepButton.title = 'Upkeep scan (click to re-run; hold 1s to force a fresh scan)';
    upkeepButton.style.cssText = ghostButtonStyle();

    progressButton = document.createElement('button');
    progressButton.textContent = 'Work Count';
    progressButton.title = 'Work count — scans the upkeep page and credits each completed task to its user (no per-VIN history). Click to re-run.';
    progressButton.style.cssText = ghostButtonStyle();

    // Long-press Vins left / Work Count to force a fresh scan (skip the cache).
    // Hold the List button to paste a list instead of scanning.
    bindButtonLongPress(startButton, () => promptAndSavePastedList());
    bindButtonLongPress(upkeepButton, () => { if (!activeScan) startUpkeepScan(); });
    bindButtonLongPress(progressButton, () => { if (!activeScan) startWorkCountScan(); });

    reportButton = document.createElement('button');
    reportButton.textContent = 'Garage';
    reportButton.title = 'Open mission control assignments in a new tab';
    reportButton.style.cssText = ghostButtonStyle();
    reportButton.onclick = () => window.open('https://garage.dev.teslamotors.com/mission_controls/442556', '_blank');

    lowCcButton = document.createElement('button');
    lowCcButton.textContent = 'Low CC';
    lowCcButton.title = `Scan all cybercabs and list those under ${LOW_CC_MAX_BATTERY}% that are available and not reserved (info only — doesn't affect the list/progress)`;
    lowCcButton.style.cssText = ghostButtonStyle();

    statusEl = document.createElement('div');
    statusEl.id = 'jacks-list-status';
    statusEl.style.display = 'none';
    statusEl.style.cssText = [
      'position:relative', 'width:100%',
      'margin:0',
      'border-radius:0',
      'overflow:hidden',
      'transform:translateY(0)', 'opacity:1',
      'transition:transform .25s ease, opacity .25s ease',
      'border:1px solid rgba(201,168,107,.22)', 'background:rgba(0,0,0,.4)',
      'box-sizing:border-box'
    ].join(';');
    const statusFill = document.createElement('div');
    statusFill.id = 'jacks-list-status-fill';
    statusFill.style.cssText = [
      'position:absolute', 'left:0', 'top:0', 'bottom:0', 'width:0%',
      'background:linear-gradient(90deg, rgba(140,110,58,.75) 0%, #C9A86B 35%, #D4B87A 65%, #E8D4A8 100%)',
      'transition:width 0.65s ease', 'pointer-events:none', 'opacity:0.92'
    ].join(';');
    const statusText = document.createElement('span');
    statusText.id = 'jacks-list-status-text';
    statusText.style.cssText = [
      'position:relative', 'z-index:1', 'display:block',
      'padding:6px 10px', 'white-space:normal',
      'font:500 11px "DM Mono",monospace', 'color:#f5f0e6',
      'text-shadow:0 1px 2px rgba(0,0,0,.9), 0 0 8px rgba(0,0,0,.6)',
      'line-height:1.4'
    ].join(';');
    statusEl.append(statusFill, statusText);

    const switchThumb = document.createElement('span');
    switchThumb.style.cssText = [
      'position:absolute', 'top:2px', 'left:2px',
      'width:12px', 'height:12px', 'border-radius:50%',
      'background:#7a7a85', 'transition:transform .2s, background .2s'
    ].join(';');

    const switchTrack = document.createElement('span');
    switchTrack.style.cssText = [
      'position:relative', 'display:inline-block',
      'width:32px', 'height:18px', 'border-radius:999px',
      'background:#28282f', 'border:1px solid #3a3a42',
      'transition:background .2s', 'flex-shrink:0'
    ].join(';');
    switchTrack.appendChild(switchThumb);

    const switchLabel = document.createElement('label');
    switchLabel.title = 'Raw VINs only';
    switchLabel.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;flex-shrink:0;line-height:1;white-space:nowrap;margin-left:4px;';
    switchLabel.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      rawMode = !rawMode;
      applySwitchTheme(switchTrack, switchThumb, rawMode, switchLabelText);
      const outputText = document.getElementById('jacks-list-output-text');
      const outputArea = document.getElementById('jacks-list-output-area');
      const outputRender = document.getElementById('jacks-list-output-render');
      if (!outputText || !outputArea || outputArea.style.display === 'none') return;
      outputText.value = rawMode ? toRawText(fullOutputCache) : fullOutputCache;
      const renderOk = !!(outputRender && outputRender.firstChild && outputRender.firstChild.childElementCount > 0);
      const useRender = !rawMode && renderOk;
      if (outputRender) outputRender.style.display = useRender ? 'block' : 'none';
      outputText.style.display = useRender ? 'none' : 'block';
      requestAnimationFrame(() => { outputText.scrollTop = 0; if (outputRender) outputRender.scrollTop = 0; });
    });

    const switchLabelText = document.createElement('span');
    switchLabelText.textContent = 'Raw';
    switchLabelText.style.cssText = 'font:500 11px "DM Mono",monospace;color:#7a7a85;display:flex;align-items:center;';
    switchLabel.appendChild(switchTrack);
    switchLabel.appendChild(switchLabelText);
    let autoUpkeepInterval = null;
    let vlCountdownInterval = null;

    function runAutoUpkeep() {
      const vlNextRefresh = Date.now() + AUTO_UPKEEP_MS();
      sessionStorage.setItem('__jacks_list_vl_next__', String(vlNextRefresh));
      if (activeScan) return;
      startUpkeepScan();
    }

    // The scan works by navigating the page (location.href), which destroys all
    // in-memory timers. So instead of relying on setInterval(runAuto*, MS) — which
    // would be reset on every navigation and drift past its deadline — the 1s
    // countdown ticker below is the single source of truth: it both renders the
    // remaining time AND fires the next run when the deadline passes.
    function tickVlCountdown() {
      const t = document.getElementById('jacks-list-vl-timer');
      if (!t) { clearInterval(vlCountdownInterval); vlCountdownInterval = null; return; }
      const next = parseInt(sessionStorage.getItem('__jacks_list_vl_next__') || '0', 10);
      const secs = Math.max(0, Math.round((next - Date.now()) / 1000));
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      t.textContent = `(${m}:${String(s).padStart(2, '0')})`;
      t.style.display = '';
      if (Date.now() >= next && !activeScan) runAutoUpkeep();
    }

    function startVlCountdown() {
      clearInterval(vlCountdownInterval);
      tickVlCountdown();
      vlCountdownInterval = setInterval(tickVlCountdown, 1000);
    }

    const vlThumb = document.createElement('span');
    vlThumb.style.cssText = [
      'position:absolute', 'top:2px', 'left:2px',
      'width:12px', 'height:12px', 'border-radius:50%',
      'background:#7a7a85', 'transition:transform .2s, background .2s'
    ].join(';');

    const vlTrack = document.createElement('span');
    vlTrack.style.cssText = [
      'position:relative', 'display:inline-block',
      'width:32px', 'height:18px', 'border-radius:999px',
      'background:#28282f', 'border:1px solid #3a3a42',
      'transition:background .2s', 'flex-shrink:0'
    ].join(';');
    vlTrack.appendChild(vlThumb);

    const vlLabelText = document.createElement('span');
    vlLabelText.textContent = 'Auto VL';
    vlLabelText.style.cssText = 'font:500 11px "DM Mono",monospace;color:#7a7a85;display:flex;align-items:center;white-space:nowrap;';

    const vlTimerText = document.createElement('span');
    vlTimerText.id = 'jacks-list-vl-timer';
    vlTimerText.style.cssText = 'font:500 11px "DM Mono",monospace;color:#7a7a85;margin-left:4px;display:none;';

    const vlLabel = document.createElement('label');
    vlLabel.title = `Auto-run Vins left every ${CONFIG.autoUpkeepMinutes} minutes (hold to rescan now)`;
    vlLabel.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;flex-shrink:0;line-height:1;white-space:nowrap;margin-left:6px;';
    vlLabel.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (vlCountdownInterval || autoUpkeepInterval) {
        clearInterval(autoUpkeepInterval);
        clearInterval(vlCountdownInterval);
        autoUpkeepInterval = null;
        vlCountdownInterval = null;
        sessionStorage.removeItem('__jacks_list_auto_upkeep__');
        sessionStorage.removeItem('__jacks_list_vl_next__');
        const t = document.getElementById('jacks-list-vl-timer');
        if (t) t.style.display = 'none';
        applySwitchTheme(vlTrack, vlThumb, false, vlLabelText);
      } else {
        applySwitchTheme(vlTrack, vlThumb, true, vlLabelText);
        sessionStorage.setItem('__jacks_list_auto_upkeep__', '1');
        runAutoUpkeep();
        startVlCountdown();
      }
    });
    vlLabel.appendChild(vlTrack);
    vlLabel.appendChild(vlLabelText);
    vlLabel.appendChild(vlTimerText);

    // Hold the Auto VL toggle to force the Vins-left rescan immediately instead of
    // waiting for the countdown timer to elapse. Resets the countdown afterwards.
    bindButtonLongPress(vlLabel, () => {
      if (activeScan) return;
      runAutoUpkeep();
      if (vlCountdownInterval) startVlCountdown();
    });

    const panelTopBar = document.createElement('div');
    panelTopBar.id = 'jacks-list-panel-top-bar';

    const minimizeCorner = document.createElement('button');
    minimizeCorner.id = 'jacks-list-minimize-corner';
    minimizeCorner.type = 'button';
    minimizeCorner.title = 'Minimize panel';
    minimizeCorner.textContent = '−';

    const resizeCorner = document.createElement('div');
    resizeCorner.id = 'jacks-list-resize-corner';
    resizeCorner.title = 'Drag to resize panel';
    resizeCorner.textContent = '';

    panelTopBar.append(resizeCorner);
    const autoToggleRow = document.createElement('div');
    autoToggleRow.id = 'jacks-list-auto-toggles';
    autoToggleRow.style.cssText = 'display:flex;align-items:center;gap:14px;flex-shrink:0;margin-left:4px;';
    autoToggleRow.append(vlLabel);

    const roundBtnBase = [
      'flex-shrink:0', 'width:22px', 'height:22px', 'border-radius:50%',
      'border:1px solid rgba(201,168,107,.45)',
      'background:rgba(201,168,107,.10)', 'color:#E8D4A8',
      'cursor:pointer', 'display:flex', 'align-items:center', 'justify-content:center',
      'line-height:1', 'padding:0'
    ];

    const infoButton = document.createElement('button');
    infoButton.type = 'button';
    infoButton.id = 'jacks-list-info-btn';
    infoButton.textContent = 'i';
    infoButton.title = 'How this script works';
    infoButton.style.cssText = [...roundBtnBase, 'font:italic 700 12px Georgia,"DM Sans",serif'].join(';');
    infoButton.onclick = () => showInfoModal();
    infoButton.onmouseenter = () => { infoButton.style.background = 'rgba(201,168,107,.24)'; };
    infoButton.onmouseleave = () => { infoButton.style.background = 'rgba(201,168,107,.10)'; };

    minimizeCorner.style.cssText = [...roundBtnBase, 'font:700 16px system-ui,sans-serif'].join(';');
    minimizeCorner.onmouseenter = () => { minimizeCorner.style.background = 'rgba(201,168,107,.24)'; };
    minimizeCorner.onmouseleave = () => { minimizeCorner.style.background = 'rgba(201,168,107,.10)'; };

    // mainControls collapse when minimized; minimize stays as the restore handle.
    const mainControls = document.createElement('div');
    mainControls.id = 'jacks-list-main-controls';
    mainControls.style.cssText = 'display:flex;align-items:center;gap:7px;flex-wrap:nowrap;min-width:0;flex:1 1 auto;';
    mainControls.append(startButton, copyButton, upkeepButton, progressButton, lowCcButton, reportButton, switchLabel, autoToggleRow);

    minimizeCorner.style.marginLeft = 'auto';
    buttonInnerRow.append(mainControls, minimizeCorner, infoButton);
    syncActiveScanFromSession();
    updateScanButtons();
    buttonRow.append(panelChrome, buttonInnerRow, statusEl);

    minimizeCorner.onclick = () => {
      panelMinimized = !panelMinimized;
      const innerRow = document.getElementById('jacks-list-button-inner-row');
      if (innerRow) innerRow.style.display = 'flex';
      const main = document.getElementById('jacks-list-main-controls');
      if (main) main.style.display = panelMinimized ? 'none' : 'flex';
      infoButton.style.display = panelMinimized ? 'none' : 'flex';
      if (statusEl) statusEl.style.display = panelMinimized || !activeScan ? 'none' : '';
      const listInfo = document.getElementById('jacks-list-info');
      if (listInfo) listInfo.style.display = panelMinimized ? 'none' : '';
      const oa = document.getElementById('jacks-list-output-area');
      const ot = document.getElementById('jacks-list-output-text');
      const topBar = document.getElementById('jacks-list-panel-top-bar');
      if (oa) oa.style.display = panelMinimized ? 'none' : (ot && ot.value ? 'flex' : 'none');
      if (topBar) topBar.style.display = panelMinimized || !oa || oa.style.display === 'none' ? 'none' : 'flex';
      const t = uiTheme();
      panel.style.width = panelMinimized ? 'auto' : t.panelWidth;
      panel.style.background = panelMinimized ? 'transparent' : t.panelBg;
      panel.style.border = panelMinimized ? 'none' : `1px solid ${t.panelBorder}`;
      panel.style.boxShadow = panelMinimized ? 'none' : t.panelShadow;
      panel.style.borderRadius = panelMinimized ? '0' : t.panelRadius;
      const chrome = document.getElementById('jacks-list-panel-chrome');
      if (chrome) chrome.style.display = panelMinimized ? 'none' : 'flex';
      resizeCorner.style.display = panelMinimized ? 'none' : 'flex';
      if (panelMinimized) {
        panel.style.height = 'auto';
        panel.style.maxHeight = 'none';
      }
      minimizeCorner.textContent = panelMinimized ? '+' : '−';
      if (!panelMinimized) applyUiTheme();
      updateFindPanelBtn();
    };
    const findPanelBtn = document.createElement('button');
    findPanelBtn.id = 'jacks-list-find-panel';
    findPanelBtn.type = 'button';
    findPanelBtn.title = 'Find panel — reset position and size';
    findPanelBtn.textContent = '⌂';
    const scrollPanelIntoView = () => {
      try {
        panel.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
      } catch {
        panel.scrollIntoView(true);
      }
    };
    const resetPanelLayout = () => {
      sessionStorage.removeItem('__jacks_list_panel_pos__');
      sessionStorage.removeItem(PANEL_SIZE_KEY);
      panel.style.left = '24px';
      panel.style.bottom = '24px';
      panel.style.top = 'auto';
      panel.style.right = 'auto';
      if (panelMinimized) {
        panelMinimized = false;
        minimizeCorner.textContent = '−';
        const innerRow = document.getElementById('jacks-list-button-inner-row');
        if (innerRow) innerRow.style.display = 'flex';
        const main = document.getElementById('jacks-list-main-controls');
        if (main) main.style.display = 'flex';
        infoButton.style.display = 'flex';
        const chrome = document.getElementById('jacks-list-panel-chrome');
        if (chrome) chrome.style.display = 'flex';
        const topBar = document.getElementById('jacks-list-panel-top-bar');
        if (topBar) topBar.style.display = 'flex';
        resizeCorner.style.display = 'flex';
        const t = uiTheme();
        panel.style.width = t.panelWidth;
        panel.style.maxWidth = t.panelWidth;
        panel.style.background = t.panelBg;
        panel.style.border = `1px solid ${t.panelBorder}`;
        panel.style.boxShadow = t.panelShadow;
        panel.style.borderRadius = t.panelRadius;
        applyUiTheme();
      }
      const t = uiTheme();
      panel.style.width = t.panelWidth;
      panel.style.maxWidth = t.panelWidth;
      panel.style.height = 'auto';
      panel.style.maxHeight = PANEL_DEFAULT_MAX_H;
      const ot = document.getElementById('jacks-list-output-text');
      if (ot) ot.style.height = `${PANEL_DEFAULT_OUTPUT_H}px`;
      syncOutputHeight(panel.offsetHeight);
      updateFindPanelBtn();
      requestAnimationFrame(scrollPanelIntoView);
    };
    findPanelBtn.onclick = resetPanelLayout;
    document.body.appendChild(findPanelBtn);
    // The Find-panel (⌂) button only appears once the panel has actually been
    // moved or resized, and never while minimized — when minimized the + corner
    // is the single "bring it back" control, so there's just one at a time.
    function updateFindPanelBtn() {
      let moved = false;
      try { moved = !!(sessionStorage.getItem('__jacks_list_panel_pos__') || sessionStorage.getItem(PANEL_SIZE_KEY)); } catch { moved = false; }
      findPanelBtn.style.display = (moved && !panelMinimized) ? 'flex' : 'none';
    }

    panel.style.position = 'fixed';
    panel.append(buttonRow, outputArea, panelTopBar);
      (document.body || document.documentElement).appendChild(panel);
// Drag to reposition panel
    let dragStartX, dragStartY, panelStartX, panelStartY, isDragging = false;
    let resizeStartX = 0;
    let resizeStartY = 0;
    let resizeStartW = 0;
    let resizeStartH = 0;
    let isResizing = false;

    const applyPanelSize = (w, h, persist = true) => {
      const minW = 760;
      const maxW = Math.max(minW, window.innerWidth - 32);
      const width = Math.min(maxW, Math.max(minW, Math.round(w)));
      panel.style.width = `${width}px`;
      panel.style.maxWidth = `${width}px`;
      if (!panelMinimized) {
        if (h) {
          const minH = 280;
          const maxH = Math.max(minH, window.innerHeight - 24);
          const height = Math.min(maxH, Math.max(minH, Math.round(h)));
          panel.style.height = `${height}px`;
          panel.style.maxHeight = `${height}px`;
          syncOutputHeight(height);
        } else {
          syncOutputHeight(panel.offsetHeight);
        }
      }
      if (persist) {
        sessionStorage.setItem(PANEL_SIZE_KEY, JSON.stringify({
          width: panel.style.width,
          height: panel.style.height || ''
        }));
      }
    };

    buttonRow.addEventListener('mousedown', (e) => {
      if (e.target.closest('button, label, #jacks-list-resize-corner, #jacks-list-minimize-corner')) return;
      if (!e.target.closest('#jacks-list-button-row, #jacks-list-panel-chrome, #jacks-list-button-inner-row')) return;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      const rect = panel.getBoundingClientRect();
      panelStartX = rect.left;
      panelStartY = rect.top;
      e.preventDefault();
    });

  document.addEventListener('mousemove', (e) => {
      if (isResizing) {
        const dx = e.clientX - resizeStartX;
        const dy = e.clientY - resizeStartY;
        applyPanelSize(resizeStartW + dx, resizeStartH - dy, false);
        return;
      }
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      const newTop = panelStartY + dy;
      const newBottom = window.innerHeight - (newTop + panel.offsetHeight);
      panel.style.left = `${panelStartX + dx}px`;
      panel.style.bottom = `${newBottom}px`;
      panel.style.top = 'auto';
    });

document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        sessionStorage.setItem(PANEL_SIZE_KEY, JSON.stringify({
          width: panel.style.width,
          height: panel.style.height || ''
        }));
        updateFindPanelBtn();
      }
      if (isDragging) {
        const rect = panel.getBoundingClientRect();
        const bottomVal = window.innerHeight - rect.bottom;
        sessionStorage.setItem('__jacks_list_panel_pos__', JSON.stringify({
          left: panel.style.left,
          bottom: `${bottomVal}px`
        }));
        updateFindPanelBtn();
      }
      isDragging = false;
    });

    resizeCorner.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = panel.getBoundingClientRect();
      resizeStartX = e.clientX;
      resizeStartY = e.clientY;
      resizeStartW = rect.width;
      resizeStartH = rect.height;
      isResizing = true;
    });

    // Re-arm Auto VL if it was on (countdown ticker survives navigation; a plain
    // setInterval would reset on every page change and stall at 0:00).
    if (sessionStorage.getItem('__jacks_list_auto_upkeep__')) {
      applySwitchTheme(vlTrack, vlThumb, true, vlLabelText);
      if (!sessionStorage.getItem('__jacks_list_vl_next__')) {
        sessionStorage.setItem('__jacks_list_vl_next__', String(Date.now() + AUTO_UPKEEP_MS()));
      }
      startVlCountdown();
    }
    const savedPos = sessionStorage.getItem('__jacks_list_panel_pos__');
    if (savedPos) {
      try {
        const { left, bottom } = JSON.parse(savedPos);
        if (left) panel.style.left = left;
        if (bottom) panel.style.bottom = bottom;
        panel.style.top = 'auto';
      } catch { /* ignore */ }
    }
    const savedSize = sessionStorage.getItem(PANEL_SIZE_KEY);
    if (savedSize) {
      try {
        const parsed = JSON.parse(savedSize);
        const sw = parseInt(parsed.width, 10);
        const sh = parseInt(parsed.height, 10);
        if (Number.isFinite(sw) && sw > 0) applyPanelSize(sw, Number.isFinite(sh) ? sh : panel.offsetHeight, false);
      } catch { /* ignore */ }
    } else {
      syncOutputHeight(panel.offsetHeight);
    }
    updateFindPanelBtn();
    applySwitchTheme(switchTrack, switchThumb, rawMode, switchLabelText);
    if (!sessionStorage.getItem('__jacks_list_auto_upkeep__')) applySwitchTheme(vlTrack, vlThumb, false, vlLabelText);
    applyUiTheme();
    updateListInfoBar();
    if (outputArea.style.display === 'none') {
      const topBar = document.getElementById('jacks-list-panel-top-bar');
      if (topBar) topBar.style.display = 'none';
    }
  }

  // ==========================================
  // BATTERY SORT HELPERS
  // ==========================================

  function batteryValue(vinLine) {
    const m = vinLine.match(/\((\d{1,3})%/);
    return m ? parseInt(m[1], 10) : 999;
  }

  function sortByBatteryDesc(arr) {
    const result = [...arr].sort((a, b) => {
      const av = batteryValue(a);
      const bv = batteryValue(b);
      if (av === 999 && bv === 999) return 0;
      if (av === 999) return 1;
      if (bv === 999) return -1;
      return bv - av;
    });
    return result;
  }

  function parseUpkeepHours(dueString) {
    if (!dueString || dueString === 'OVERDUE') return -1;
    const dMatch = dueString.match(/(\d+)d/i);
    const hMatch = dueString.match(/(\d+)h/i);
    const mMatch = dueString.match(/(\d+)m/i);
    let total = 0;
    if (dMatch) total += parseInt(dMatch[1], 10) * 24;
    if (hMatch) total += parseInt(hMatch[1], 10);
    if (mMatch) total += parseInt(mMatch[1], 10) / 60;
    return total;
  }

  function parseTimestampToMs(text, now, { future = false } = {}) {
    if (!text) return null;
    const t = clean(text);

    const relHM = t.match(/(?:(\d+)\s*h\s*)?(?:(\d+)\s*m\s*)?ago\b/i);
    if (relHM && (relHM[1] || relHM[2])) {
      return now - (parseInt(relHM[1] || 0) * 3600 + parseInt(relHM[2] || 0) * 60) * 1000;
    }
    const relD = t.match(/(\d+)\s*d\s*ago\b/i);
    if (relD) return now - parseInt(relD[1]) * 86400 * 1000;

    const MONTHS = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
    const abs = t.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{1,2}):(\d{2})\s*(AM|PM)\b/i);
    if (abs) {
      const mo = MONTHS[abs[1].toLowerCase().slice(0, 3)];
      const day = parseInt(abs[2]);
      let hr = parseInt(abs[3]);
      const min = parseInt(abs[4]);
      const ap = abs[5].toLowerCase();
      if (ap === 'pm' && hr !== 12) hr += 12;
      if (ap === 'am' && hr === 12) hr = 0;
      const yr = new Date(now).getFullYear();
      const d = new Date(yr, mo, day, hr, min);
      // Past timestamps (completions) that look future are last year; future
      // timestamps (reservations) that look past are next year.
      if (future) {
        if (d.getTime() < now - 86400000) d.setFullYear(yr + 1);
      } else if (d.getTime() > now + 86400000) {
        d.setFullYear(yr - 1);
      }
      return d.getTime();
    }

    const iso = t.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    if (iso) {
      const d = new Date(iso[0]);
      if (!isNaN(d.getTime())) return d.getTime();
    }

    const timeOnlyTs = timeOnlyToMs(t, now);
    if (timeOnlyTs !== null) return timeOnlyTs;

    return null;
  }

  function formatWorkCount(userCounts, summary = {}) {
    const sorted = [...userCounts.entries()].sort((a, b) => workCountBucketTotal(b[1]) - workCountBucketTotal(a[1]));
    if (!sorted.length) {
      return `=== Work count (0) ===\n\nNo completions found since shift start (${shiftStartLabel()}).`;
    }
    const total = sorted.reduce((sum, [, v]) => sum + workCountBucketTotal(v), 0);
    return [
      `=== Work count (${total}) ===`,
      '',
      ...sorted.map(([user, v]) => `${user}: ${formatWorkCountUserParts(v)}`)
    ].join('\n');
  }
  function getLines() {
    return document.body.innerText.split('\n').map(clean).filter(Boolean);
  }

  function firstItemOnPage(isUpkeep) {
    const blocks = splitVehicleBlocks(getLines(), isUpkeep);
    if (!blocks.length) return '';
    const v = parseUpkeepVehicle(blocks[0]);
    return v ? v.vin : '';
  }
  // How many rows this page is expected to hold: min(total results, page size).
  // Page size is read from the page-size selector when present so this works for
  // any total (12 VINs or 400) and any page size, not a hardcoded 100.
  function expectedPageCount(isUpkeep) {
    const results = getResultsCount();
    if (results == null) return 0;
    const sel = document.getElementById('page-size-selector');
    const selVal = sel ? parseInt(sel.value, 10) : NaN;
    const perPage = Number.isFinite(selVal) && selVal > 0 ? selVal : (isUpkeep ? 100 : 50);
    return Math.min(results, perPage);
  }

  async function waitForVehicles(isUpkeep = false) {
    const start = Date.now();
    let last = -1;
    let stable = 0;
    while (Date.now() - start < CONFIG.loadTimeoutMs) {
      if (stopScanRequested) return false;
      const n = splitVehicleBlocks(getLines(), isUpkeep).length;
      // "Results: N" is null until the page's data has actually loaded — on a
      // fresh page 1 the app shows nothing (no rows, no Results, no pager) for a
      // beat. We must NOT start scanning during that window (it produced empty /
      // "1/10 pages" scans). So we require the data to have loaded (Results seen)
      // AND the expected page-count of rows to be present before proceeding.
      const results = getResultsCount();
      const want = expectedPageCount(isUpkeep);
      if (n === last) stable++; else { stable = 0; last = n; }
      const elapsed = Date.now() - start;
      if (n > 0 && results != null && want) {
        if (n >= want) return true;                                  // full page loaded
        if (n >= Math.ceil(want * 0.9) && stable >= 4) return true;  // ~full and settled
        // else keep waiting for the remaining rows to render.
      } else if (n > 0 && results == null && stable >= 6 && elapsed > 9000) {
        // Unusual: rows rendered and settled but "Results: N" never appeared —
        // proceed after a grace so such a page can't hang forever.
        return true;
      }
      setStatus(`waiting for vehicles… (${n}${want ? '/' + want : ''})`);
      await sleep(500);
    }
    return last > 0;
  }

  // Wait for the on-screen row count to settle (used at the top of each page scan,
  // especially right after a page change) so we never scroll/collect a page while
  // it's still rendering its first few rows.
  async function waitForRowsSettle(isUpkeep = false) {
    const start = Date.now();
    let last = -1;
    let stable = 0;
    while (Date.now() - start < 8000) {
      if (stopScanRequested) return;
      const n = splitVehicleBlocks(getLines(), isUpkeep).length;
      if (n > 0) {
        if (n === last) stable++; else { stable = 0; last = n; }
        if (stable >= 3) return;
      }
      await sleep(400);
    }
  }

  function isVehicleStart(lines, i) {
    const line = lines[i];
    const next = lines[i + 1] || '';
    const after = lines[i + 2] || '';
    if (/^Unavailable$/i.test(line) && isVin(next) && CHASSIS_RE.test(after)) return true;
    return isVin(line) && CHASSIS_RE.test(next);
  }

  function isUpkeepVehicleStart(lines, i) {
    const line = clean(lines[i]);
    const next = clean(lines[i + 1] || '');
    const after = clean(lines[i + 2] || '');
    if (/^\d+$/.test(line) && isVin(next) && CHASSIS_RE.test(after)) return true;
    if (/^Unavailable$/i.test(line) && isVin(next) && CHASSIS_RE.test(after)) return true;
    if (isVin(line) && CHASSIS_RE.test(next)) return true;
    return false;
  }

  function upkeepVinIndexInBlock(block) {
    if (!block?.length) return -1;
    if (/^Unavailable$/i.test(clean(block[0]))) {
      return isVin(clean(block[1] || '')) ? 1 : -1;
    }
    if (/^\d+$/.test(clean(block[0])) && isVin(clean(block[1] || ''))) return 1;
    if (isVin(clean(block[0]))) return 0;
    return -1;
  }

  function extractBlockAroundVin(lines, vin) {
    const target = normalizeVin(vin);
    const idx = lines.findIndex(l => {
      const v = firstVin(l);
      return v && normalizeVin(v) === target;
    });
    if (idx < 0) return null;
    let start = idx;
    for (let i = idx; i >= Math.max(0, idx - 35); i--) {
      if (isUpkeepVehicleStart(lines, i)) { start = i; break; }
    }
    let end = lines.length;
    for (let i = idx + 1; i < Math.min(lines.length, idx + 45); i++) {
      if (i > start && isUpkeepVehicleStart(lines, i)) { end = i; break; }
    }
    return lines.slice(start, end);
  }

  function findReservedInBlock(block) {
    for (const raw of block) {
      const t = clean(raw);
      if (!t) continue;
      if (/^due\b/i.test(t) || (/\bdue\b/i.test(t) && /\d\s*h|\d\s*m|overdue/i.test(t))) continue;
      if (/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(t) && /\d{1,2}:\d{2}/i.test(t)) return t;
      if (/\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)/i.test(t)) return t;
    }
    return '';
  }

  function parseUpkeepDueHours(dueString) {
    if (!dueString || dueString === 'OVERDUE') return dueString === 'OVERDUE' ? 0 : null;
    const t = clean(dueString);
    const dMatch = t.match(/(\d+)\s*d/i);
    const hMatch = t.match(/(\d+)\s*h/i);
    const mMatch = t.match(/(\d+)\s*m/i);
    let totalHours = 0;
    if (dMatch) totalHours += parseInt(dMatch[1], 10) * 24;
    if (hMatch) totalHours += parseInt(hMatch[1], 10);
    if (mMatch) totalHours += parseInt(mMatch[1], 10) / 60;
    if (!dMatch && !hMatch && !mMatch) return null;
    return totalHours;
  }

  function augmentUpkeepVehicles(vehicles) {
    const map = new Map();
    for (const v of vehicles) {
      if (v?.vin) map.set(normalizeVin(v.vin), v);
    }
    const lines = getLines();
    const tryVin = (vin) => {
      const block = extractBlockAroundVin(lines, vin);
      if (!block?.length) return null;
      return parseUpkeepVehicle(block);
    };
    for (const v of vehicles) {
      if (!v?.vin || v.includeInUpkeep) continue;
      const reparsed = tryVin(v.vin);
      if (reparsed?.includeInUpkeep) map.set(normalizeVin(v.vin), reparsed);
    }
    for (const vin of getAllListVins()) {
      if (map.get(vin)?.includeInUpkeep) continue;
      if (!lines.some(l => firstVin(l) === vin || l.includes(vin))) continue;
      const reparsed = tryVin(vin);
      if (reparsed?.includeInUpkeep) map.set(vin, reparsed);
    }
    return [...map.values()];
  }

  function splitVehicleBlocks(lines, isUpkeep = false) {
    const starts = [];
    for (let i = 0; i < lines.length; i++) {
      if (isUpkeep ? isUpkeepVehicleStart(lines, i) : isVehicleStart(lines, i)) starts.push(i);
    }
    return starts.map((start, idx) => lines.slice(start, starts[idx + 1] ?? lines.length));
  }

  function batteryPercent(block) {
    const line = block.find(item => /^[0-9]{1,3}%$/.test(clean(item)));
    return line ? clean(line) : '';
  }

  function batteryAroundVin(vin, cachedLines = null) {
    const lines = cachedLines || getLines();
    const hitIndexes = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(vin)) hitIndexes.push(i);
    }
    for (const idx of hitIndexes) {
      const start = Math.max(0, idx - 35);
      const end = Math.min(lines.length, idx + 35);
      for (let i = idx; i >= start; i--) {
        const line = clean(lines[i]);
        if (/^[0-9]{1,3}%$/.test(line)) return line;
      }
      for (let i = idx + 1; i < end; i++) {
        const line = clean(lines[i]);
        if (/^[0-9]{1,3}%$/.test(line)) return line;
      }
    }
    return '';
  }

  function extractTimes(text) {
    return [...clean(text).matchAll(/\b(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(AM|PM)\b/gi)].map(m => {
      let hour = Number(m[1]);
      const minute = Number(m[2] || 0);
      const ap = m[3].toLowerCase();
      if (ap === 'pm' && hour !== 12) hour += 12;
      if (ap === 'am' && hour === 12) hour = 0;
      return { minutes: hour * 60 + minute, ap, raw: m[0] };
    });
  }

  function labelFromMinutes(minutes) {
    if (minutes == null) return '';
    const h24 = Math.floor(minutes / 60) % 24;
    const minute = minutes % 60;
    const ap = h24 >= 12 ? 'p' : 'a';
    const h12 = h24 % 12 || 12;
    return minute ? `${h12}.${String(minute).padStart(2, '0')}${ap}` : `${h12}${ap}`;
  }

  function parseMonthDay(text) {
    const months = {
      jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,
      may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,
      sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11
    };
    const match = clean(text).match(/\b([A-Za-z]+)\s+(\d{1,2})\b/);
    if (!match) return null;
    const month = months[match[1].toLowerCase()];
    if (month == null) return null;
    return { month, day: Number(match[2]), monthName: match[1] };
  }

  function ordinal(n) {
    const suffix = n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th';
    return `${n}${suffix}`;
  }

  function sortForSimpleTime(label) {
    const m = label.match(/^(\d{1,2})(?:\.(\d{2}))?([ap])$/i);
    if (!m) return 999999;
    let h = Number(m[1]);
    const min = Number(m[2] || 0);
    const ap = m[3].toLowerCase();
    if (ap === 'p' && h !== 12) h += 12;
    if (ap === 'a' && h === 12) h = 0;
    if (h >= 21) return h * 60 + min;
    if (h <= 11) return 24 * 60 + h * 60 + min;
    return 36 * 60 + h * 60 + min;
  }

  function formatProgressRemainingLine(vin, meta) {
    const m = getVinListMeta(meta, vin);
    const cc = isCybercabVin(vin) ? ' [CC]' : '';
    if (!m?.dueAt) return `${vin}${cc}`;
    if (m.kind === 'arriving') return `${vin} — arriving ${m.dueAt}${cc}`;
    if (m.kind === 'reserved') return `${vin} — reserved ${m.dueAt}${cc}`;
    return `${vin} — due ${m.dueAt}${cc}`;
  }

  function sortRemainingByListMeta(vins, meta) {
    return [...vins].sort((a, b) => {
      const la = getVinListMeta(meta, a)?.dueAt || '';
      const lb = getVinListMeta(meta, b)?.dueAt || '';
      if (!la && !lb) return a.localeCompare(b);
      if (!la) return 1;
      if (!lb) return -1;
      const sa = sortForSimpleTime(la);
      const sb = sortForSimpleTime(lb);
      if (sa !== sb) return sa - sb;
      if (sa === 999999 && lb === 999999) return la.localeCompare(lb);
      return a.localeCompare(b);
    });
  }

  function dueBucketFromAvailable(line) {
    const times = extractTimes(line);
    const minutes = times.length ? times[times.length - 1].minutes : null;
    const timeLabel = labelFromMinutes(minutes) || 'unknown';
    const monthDay = parseMonthDay(line);
    if (!monthDay) return { label: timeLabel, sort: sortForSimpleTime(timeLabel) };
    const base = reportDate();
    const due = new Date(base.getFullYear(), monthDay.month, monthDay.day);
    const tomorrow = addDays(base, 1);
    const simple = dateKey(due) === dateKey(base) || dateKey(due) === dateKey(tomorrow);
    if (simple) return { label: timeLabel, sort: sortForSimpleTime(timeLabel) };
    return { label: `${monthDay.monthName} ${ordinal(monthDay.day)} ${timeLabel}`, sort: due.getTime() + (minutes ?? 0) * 60000 };
  }

  function reservationUntilBucket(line) {
    const times = extractTimes(line);
    if (!times.length) return '2a';
    const last = times[times.length - 1];
    return labelFromMinutes(last.minutes);
  }

  // Parse a reservation duration like "8h 30m", "27h", "1d 3h" into minutes.
  function parseDurationMin(s) {
    const t = clean(s);
    let min = 0;
    let found = false;
    const d = t.match(/(\d+)\s*d/i); if (d) { min += Number(d[1]) * 1440; found = true; }
    const h = t.match(/(\d+)\s*h/i); if (h) { min += Number(h[1]) * 60; found = true; }
    const m = t.match(/(\d+)\s*m/i); if (m) { min += Number(m[1]); found = true; }
    return found ? min : 0;
  }

  // The true return time of an active reservation, handling spans that cross into
  // the next day. The admin row only shows clock times (e.g. "5:30 PM–8:30 PM"),
  // so a same-clock arrival could be tonight or a day+ later; start + duration
  // disambiguates it. Falls back to the next occurrence of the end clock.
  function computeArrivalMs(startClock, endClock, durMin, now = Date.now()) {
    if (startClock && durMin > 0) {
      const times = extractTimes(startClock);
      if (times.length) {
        const mins = times[0].minutes;
        const d = new Date(now);
        d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
        let startMs = d.getTime();
        if (startMs > now) startMs -= 86400000; // most recent occurrence at/before now
        return startMs + durMin * 60000;
      }
    }
    return parseTimestampToMs(endClock, now, { future: true });
  }

  function parseUpkeepVehicle(block) {
    const vinIdx = upkeepVinIndexInBlock(block);
    if (vinIdx < 0) return null;
    const vin = clean(block[vinIdx]).toUpperCase();
    if (!isVin(vin)) return null;

    const battery = batteryPercent(block) || batteryAroundVin(vin);
    const isProd = block.some(line => /^prod$/i.test(clean(line)));
    const backup = block.some(line => /^backup$/i.test(clean(line)));
    const reservedAt = findReservedInBlock(block);

    let dueString = '';
    for (let i = block.length - 1; i >= 0; i--) {
      const line = clean(block[i]);
      if (line === 'OVERDUE') { dueString = 'OVERDUE'; break; }
      if (/^(?:(\d+)\s*d\s*)?(?:(\d+)\s*h\s*)?(?:(\d+)\s*m\s*)?$/i.test(line) && /\d/.test(line)) {
        dueString = line;
        break;
      }
    }

    let includeInUpkeep = false;
    let displayDue = '';
    const dueHours = parseUpkeepDueHours(dueString);
    if (dueString === 'OVERDUE' || (dueHours !== null && dueHours <= CONFIG.upkeepMaxHours)) {
      includeInUpkeep = true;
      displayDue = dueString || 'OVERDUE';
    }

    if (reservedAt) {
      const reservedMs = parseTimestampToMs(reservedAt, Date.now(), { future: true });
      if (reservedMs !== null) {
        const hoursUntil = (reservedMs - Date.now()) / 3600000;
        if (hoursUntil > CONFIG.upkeepMaxHours) includeInUpkeep = false;
      }
    }

    // Admin /vehicles fields (only present when scanning the admin tab): a
    // standalone lowercase "commuter" tag line, an "Available until <time>"
    // reservation, and the leading "UNAVAILABLE" status prefix.
    const commuter = block.some(l => /^commuter$/i.test(clean(l)));
    const unavailable = /^Unavailable$/i.test(clean(block[0] || ''));
    // A standalone "training" tag line marks a car we don't work — it goes under
    // "Vins not required" and never counts toward progress / Vins left / Work Count.
    const training = block.some(l => /^training$/i.test(clean(l)));
    let availableUntil = '';
    for (const l of block) {
      const m = clean(l).match(/^Available until\s+(.+)$/i);
      if (m) { availableUntil = clean(m[1]); break; }
    }
    // Active reservation: shown as a time range "5:30 AM–2 PM · 8h 30m". The END
    // of the range is the arrival time; the START + duration tell us which day it
    // actually lands on (a span can cross into the next day).
    let arriving = '';
    let arrivingStart = '';
    let arrivingDurMin = 0;
    for (const l of block) {
      const m = clean(l).match(/(\d{1,2}(?::\d{2})?\s*[AP]M)\s*[\u2013\u2014-]\s*(\d{1,2}(?::\d{2})?\s*[AP]M)(?:\s*[\u00b7•]\s*([0-9dhm\s]+))?/i);
      if (m) {
        arrivingStart = clean(m[1]);
        arriving = clean(m[2]);
        arrivingDurMin = m[3] ? parseDurationMin(m[3]) : 0;
        break;
      }
    }

    return { vin, battery, isProd, backup, upkeep: true, includeInUpkeep, upkeepDue: displayDue, rawDue: dueString, reservedAt, commuter, unavailable, training, availableUntil, arriving, arrivingStart, arrivingDurMin };
  }

  function batteryEmoji(batteryStr) {
    const num = parseInt(batteryStr);
    if (isNaN(num)) return '';
    if (num <= 35) return ' 🪫';
    if (num <= 70) return ' 😬';
    return ' 🔋';
  }

  function displayVin(v, opts = {}) {
    if (rawMode) return v.vin;
    const cc = (!opts.noCc && isCybercabVin(v.vin)) ? ' [CC]' : '';
    const battery = (!opts.noBattery && v.battery) ? ` (${v.battery}${batteryEmoji(v.battery)})` : '';
    return `${v.vin}${battery}${cc}`;
  }

  function collectCurrentVehicles(map, isUpkeep = false) {
    const blocks = splitVehicleBlocks(getLines(), isUpkeep);
    for (const block of blocks) {
      const vehicle = parseUpkeepVehicle(block);
      if (!vehicle?.vin) continue;
      if (isExcludedVin(vehicle.vin)) continue;
      const existing = map.get(vehicle.vin);
      if (existing) {
        vehicle.battery = vehicle.battery || existing.battery || '';
        if (!vehicle.commuter && existing.commuter) vehicle.commuter = existing.commuter;
        if (!vehicle.unavailable && existing.unavailable) vehicle.unavailable = existing.unavailable;
        if (!vehicle.availableUntil && existing.availableUntil) vehicle.availableUntil = existing.availableUntil;
        if (!vehicle.arriving && existing.arriving) {
          vehicle.arriving = existing.arriving;
          vehicle.arrivingStart = existing.arrivingStart;
          vehicle.arrivingDurMin = existing.arrivingDurMin;
        }
      }
      map.set(vehicle.vin, vehicle);
      if (isUpkeep && vehicle.backup) upkeepBackupVins.add(normalizeVin(vehicle.vin));
    }
    return map.size;
  }

  function scrollContainers() {
    // Exclude our OWN panels/overlays. The styled preview is a tall scrollable
    // div, so it can be picked as "the biggest scroller" — and then the scan
    // scrolls our list instead of the upkeep/vehicles page, so the virtualized
    // rows never advance and the scan comes back nearly empty.
    const isOurUi = (el) => !!(el.closest && el.closest(
      '#jacks-list-panel, #gb-mc-panel, #gb-svc-panel, #jacks-list-confirm-overlay, [id^="jacks-list-"], [id^="gb-mc-"], [id^="gb-svc-"]'
    ));
    const items = [...document.querySelectorAll('main,[role="main"],[class*="scroll"],[class*="table"],[class*="list"],div')]
      .filter(el => el.scrollHeight > el.clientHeight + 250 && !isOurUi(el))
      .sort((a, b) => b.scrollHeight - a.scrollHeight);
    return items.length ? items : [document.scrollingElement || document.documentElement];
  }

  async function waitForVisibleBatteries(isUpkeep = false, scanState = null, scrollIndex = 0, collected = 0) {
    while (!stopScanRequested) {
      const lines = getLines();
      const blocks = splitVehicleBlocks(lines, isUpkeep);
      let missing = 0;
      for (const block of blocks) {
        const v = parseUpkeepVehicle(block);
        if (!v?.vin) continue;
        if (!batteryPercent(block) && !batteryAroundVin(v.vin, lines)) missing++;
      }
      if (missing === 0) return true;
      const p = scanBarProgress(isUpkeep, collected, scanState, scrollIndex, CONFIG.maxScrollsPerPage);
      const label = scanState?.label || 'Scanning';
      setStatus(`${label} · loading batteries (${missing} on screen)…`, p);
      await sleep(500);
    }
    return false;
  }

  async function scanCurrentPage(map, isUpkeep = false, scanState = null) {
    // Ensure this page's rows have rendered before we scroll/collect (covers the
    // just-paginated pages too), so we don't scan a half-loaded page.
    await waitForRowsSettle(isUpkeep);
    const scrollers = scrollContainers();
    scrollers.forEach(el => el.scrollTo?.(0, 0));
    window.scrollTo(0, 0);
    await sleep(CONFIG.scrollDelayMs);

    let unchanged = 0;
    let lastCount = -1;
    const maxScrolls = CONFIG.maxScrollsPerPage;
    const label = scanState?.label || (isUpkeep ? 'Vins left' : 'Scanning');
    // VINs already collected from prior pages — the map accumulates across pages,
    // so subtract this to show the count for THIS page (not the running total).
    const pageBaseline = map.size;

    for (let i = 0; i < maxScrolls; i++) {
      if (stopScanRequested) return;
      await waitForVisibleBatteries(isUpkeep, scanState, i, map.size);
      const count = collectCurrentVehicles(map, isUpkeep);
      if (isUpkeep) {
        // Task chips render a beat after the row text — collect, settle, collect
        // again so a row's completion data isn't missed before we scroll past.
        collectUpkeepTaskData(upkeepTaskData);
        await sleep(250);
        collectUpkeepTaskData(upkeepTaskData);
      }
      const pageSuffix = scanState?.pageNum
        ? ` · page ${scanState.pageNum}${scanState.pageTotal ? `/${scanState.pageTotal}` : ''}`
        : '';
      const thisPage = Math.max(0, count - pageBaseline);
      const totalPart = pageBaseline > 0 ? ` · ${count} total` : '';
      setStatus(`${label} · ${thisPage} VINs${pageSuffix}${totalPart}`, scanBarProgress(isUpkeep, count, scanState, i, maxScrolls));
      unchanged = count === lastCount ? unchanged + 1 : 0;
      lastCount = count;

      // Early exit (upkeep only): the upkeep list is non-virtualized — all its
      // rows (and their task chips) are already in the DOM — so once the collected
      // count stops growing after a scroll, we have the whole page. Stop then
      // instead of scrolling to the bottom for nothing. (If a page were ever
      // virtualized, its count keeps climbing as it scrolls, so this wouldn't trip
      // until everything was in.) `unchanged >= 2` = two scrolls with no new VINs.
      if (isUpkeep && thisPage > 0 && unchanged >= 2) break;

      const stepPx = isUpkeep ? CONFIG.upkeepScrollStepPx : CONFIG.scrollStepPx;
      let moved = false;
      for (const scroller of scrollers.slice(0, 8)) {
        const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
        const currentTop = scroller.scrollTop || 0;
        if (currentTop < maxTop - 10) {
          scroller.scrollTo?.(0, Math.min(currentTop + stepPx, maxTop));
          moved = true;
        }
      }
      window.scrollBy(0, stepPx);
      await sleep(CONFIG.scrollDelayMs);
      if (!moved && unchanged >= 2) {
        if (isDriverlessPage() && map.size === 0) {
          // No VINs yet — wait up to 30s for first ones to appear
          const waitStart = Date.now();
          let foundMore = false;
          while (Date.now() - waitStart < 30000) {
            await sleep(1000);
            const newCount = collectCurrentVehicles(map, isUpkeep);
            if (newCount > lastCount) {
              lastCount = newCount;
              foundMore = true;
              break;
            }
            setStatus(
              `Driverless: waiting for first VINs… (${Math.round((30000 - (Date.now() - waitStart)) / 1000)}s)`,
              computeScanProgress(scanState, i, maxScrolls)
            );
          }
          if (foundMore) { unchanged = 0; continue; }
          break;
        } else {
          break;
        }
      }
    }

    await waitForVisibleBatteries(isUpkeep, scanState, maxScrolls - 1, map.size);
    collectCurrentVehicles(map, isUpkeep);
    if (isUpkeep) collectUpkeepTaskData(upkeepTaskData);
  }

  function getPageInfo() {
    const input = document.querySelector('input[type="number"][min][max]');
    if (input) {
      const current = Number(input.value || input.getAttribute('value') || 1);
      const total = Number(input.max || input.getAttribute('max') || 1);
      if (Number.isFinite(current) && Number.isFinite(total)) return { current, total };
    }
    const text = document.body.innerText.split(String.fromCharCode(10)).join(' ');
    const match = text.match(new RegExp('Page +([0-9]+) +of +([0-9]+)', 'i'));
    return match ? { current: Number(match[1]), total: Number(match[2]) } : null;
  }

  function getResultsCount() {
    const text = document.body.innerText;
    const match = text.match(new RegExp('Results: *([0-9]+)', 'i'));
    return match ? Number(match[1]) : null;
  }

  function shouldCheckMorePages(info) {
    const results = getResultsCount();
    const perPage = isUpkeepPage() ? 100 : 50;
    if (results != null && results <= perPage) return false;
    if (info && info.total <= 1) return false;
    if (info && info.current >= info.total) return false;
    if (info && info.total > 1) return true;
    return results != null && results > 50;
  }

  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  }

  function isDisabled(el) {
    return el.disabled || el.getAttribute('aria-disabled') === 'true' || /disabled/i.test(el.className || '');
  }

  function clickableAncestor(el) {
    let node = el;
    for (let i = 0; i < 8 && node; i++, node = node.parentElement) {
      const tag = node.tagName?.toLowerCase();
      const role = node.getAttribute?.('role');
      if (tag === 'button' || tag === 'a' || role === 'button' || node.onclick || node.tabIndex >= 0) return node;
    }
    return el;
  }

  function realClick(el) {
    const target = clickableAncestor(el);
    if (!target) return false;
    target.scrollIntoView?.({ block: 'center', inline: 'center' });
    const r = target.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(type => {
      target.dispatchEvent(gbMouseEvent(type, { clientX: x, clientY: y }));
    });
    target.click?.();
    return true;
  }

  function findPageInput(info) {
    scrollContainers().forEach(el => el.scrollTo?.(0, el.scrollHeight));
    window.scrollTo(0, document.body.scrollHeight);
    const allNumberInputs = [...document.querySelectorAll('input[type="number"][min][max]')]
      .filter(el => isVisible(el) && !isDisabled(el));
    if (info) {
      const exact = allNumberInputs.find(input => Number(input.max) === info.total);
      if (exact) return exact;
    }
    return allNumberInputs[0] || null;
  }

  function setNumberInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(input, String(value));
    else input.value = String(value);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: String(value) }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function typePageNumber(nextPage) {
    const info = getPageInfo();
    if (!shouldCheckMorePages(info)) return false;
    const input = findPageInput(info);
    if (!input) return false;
    const current = Number(input.value || info?.current || 1);
    const total = Number(input.max || info?.total || nextPage);
    if (!Number.isFinite(current) || !Number.isFinite(total)) return false;
    if (nextPage > total) return false;

    setStatus(`page ${current} → ${nextPage}`);
    input.scrollIntoView?.({ block: 'center', inline: 'center' });
    await sleep(200);
    input.focus();
    input.click();
    await sleep(100);

    try {
      const delta = nextPage - current;
      if (delta > 0 && typeof input.stepUp === 'function') input.stepUp(delta);
      else if (delta < 0 && typeof input.stepDown === 'function') input.stepDown(Math.abs(delta));
    } catch { setNumberInputValue(input, nextPage); }

    setNumberInputValue(input, nextPage);
    input.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: String(nextPage) }));
    input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertReplacementText', data: String(nextPage) }));
    input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

    for (const type of ['keydown', 'keypress', 'keyup']) {
      input.dispatchEvent(new KeyboardEvent(type, {
        bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13
      }));
    }

    await sleep(150);
    input.blur();
    input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    return true;
  }

  function findNextPageControl() {
    const info = getPageInfo();
    if (!info || info.current >= info.total) return null;

    scrollContainers().forEach(el => el.scrollTo?.(0, el.scrollHeight));
    window.scrollTo(0, document.body.scrollHeight);

    const controls = [...document.querySelectorAll('button,a,[role="button"],[tabindex]')].filter(el => isVisible(el) && !isDisabled(el));
    const byLabel = controls.find(el => {
      const label = clean([el.innerText, el.getAttribute('aria-label'), el.title, el.getAttribute('data-testid'), el.getAttribute('class')].filter(Boolean).join(' ')).toLowerCase();
      return label.includes('next') || label.includes('chevron right') || label === '>' || label === '›' || label === '»';
    });
    if (byLabel) return byLabel;

    const pageText = `Page ${info.current} of ${info.total}`;
    const labelEl = [...document.querySelectorAll('body *')]
      .filter(el => isVisible(el) && clean(el.innerText || el.textContent || '').includes(pageText))
      .sort((a, b) => clean(a.innerText || a.textContent || '').length - clean(b.innerText || b.textContent || '').length)[0];
    if (!labelEl) return null;

    const lr = labelEl.getBoundingClientRect();
    const y = lr.top + lr.height / 2;
    return controls.filter(el => {
      const r = el.getBoundingClientRect();
      return r.left > lr.left && Math.abs((r.top + r.bottom) / 2 - y) < 90 && r.width <= 160 && r.height <= 100;
    }).sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left)[0] || null;
  }

  async function waitForPageChange(beforeInfo, beforeFirstTag, isUpkeep) {
    for (let i = 0; i < 24; i++) {
      if (stopScanRequested) return false;
      await sleep(300);
      const info = getPageInfo();
      const currentTag = firstItemOnPage(isUpkeep);
      if (info && beforeInfo && info.current !== beforeInfo.current) return true;
      if (currentTag && beforeFirstTag && currentTag !== beforeFirstTag) return true;
    }
    return false;
  }

  async function scanPagesOnCurrentUrl(isUpkeep = false, progressCtx = null) {
    if (isUpkeep) { upkeepTaskData = {}; upkeepBackupVins = new Set(); }
    const loaded = await waitForVehicles(isUpkeep);
    const map = new Map();
    if (!loaded || stopScanRequested) return [];

    const page1Tag = firstItemOnPage(isUpkeep);
    const defaultLabel = isUpkeep ? 'Upkeep' : (isDriverlessPage() ? 'Driverless' : assignmentLabel());

    for (let p = 1; p <= CONFIG.maxPages; p++) {
      if (stopScanRequested) { setStatus('stopped'); break; }

      const info = getPageInfo();
      const label = progressCtx?.label || defaultLabel;
      const pageNum = info?.current || p;
      const pageTotal = info?.total || CONFIG.maxPages;
      const scanState = {
        label,
        pageNum,
        pageTotal,
        progressCtx: isUpkeep ? { base: 0, span: 1 } : progressCtx
      };
      setStatus(
        `${label} · page ${pageNum}${info?.total ? `/${info.total}` : ''} · scanning…`,
        scanBarProgress(isUpkeep, map.size, scanState, 0, CONFIG.maxScrollsPerPage)
      );

      await scanCurrentPage(map, isUpkeep, scanState);
      setStatus(
        `${label} · page ${pageNum}${info?.total ? `/${info.total}` : ''} · done`,
        scanBarProgress(isUpkeep, map.size, scanState, CONFIG.maxScrollsPerPage - 1, CONFIG.maxScrollsPerPage)
      );
      if (isUpkeep) {
        const results = getResultsCount();
        const info = getPageInfo();
        if (!shouldCheckMorePages(info) && (results == null || results <= 100)) break;
        if (!shouldCheckMorePages(info)) break;
      }

      const afterInfo = getPageInfo();
      if (!shouldCheckMorePages(afterInfo)) break;

      const beforeTag = firstItemOnPage(isUpkeep);
      const nextPage = afterInfo ? afterInfo.current + 1 : p + 1;

      let changed = false;
      const typed = await typePageNumber(nextPage);
      if (typed) changed = await waitForPageChange(afterInfo, beforeTag, isUpkeep);

      if (!changed) {
        const next = findNextPageControl();
        if (!next) { setStatus('next page not found'); break; }
        setStatus('clicking next page');
        realClick(next);
        changed = await waitForPageChange(afterInfo, beforeTag, isUpkeep);
      }

      if (!changed) { setStatus('page did not change'); break; }

      await sleep(800);
      const stableTag = firstItemOnPage(isUpkeep);
      if (stableTag && page1Tag && stableTag === page1Tag) {
        setStatus('page bounced back to start, done');
        break;
      }

      await sleep(CONFIG.pageDelayMs);
    }
    return [...map.values()];
  }

  function startFullScan() {
    listPreviewArmed = false;
    showStatus();
    stopScanRequested = false;
    // Fresh List run: start the admin cross-reference from a clean slate.
    sessionStorage.removeItem(LIST_ADMIN_XREF_KEY);
    sessionStorage.setItem(STATE_KEY, JSON.stringify({ active: true, stage: 'upkeep_overview', asList: true, xref: true, startTime: Date.now() }));
    setActiveScan('list');
    setStatus('Loading upkeep…', 0);
    location.href = upkeepUrl();
    setTimeout(() => continueFullScan(), 500);
  }

  function startUpkeepScan() {
    upkeepPreviewArmed = false;
    stopScanRequested = false;
    sessionStorage.setItem(STATE_KEY, JSON.stringify({ active: true, stage: 'upkeep', startTime: Date.now() }));
    setActiveScan('upkeep');
    showStatus();
    setStatus('Loading upkeep…', 0);
    location.href = upkeepUrl();
  }

  function startWorkCountScan() {
    progressPreviewArmed = false;
    stopScanRequested = false;
    sessionStorage.setItem(STATE_KEY, JSON.stringify({ active: true, stage: 'work_count_scan', startTime: Date.now() }));
    setActiveScan('progress');
    showStatus();
    setStatus('Loading upkeep…', 0);
    location.href = upkeepUrl();
  }

  function startLowCcScan() {
    stopScanRequested = false;
    sessionStorage.setItem(STATE_KEY, JSON.stringify({ active: true, stage: 'low_cc', startTime: Date.now() }));
    setActiveScan('lowcc');
    showStatus();
    setStatus('Loading cybercabs…', 0);
    location.href = LOW_CC_URL;
  }

  // Info-only list: cybercabs strictly under LOW_CC_MAX_BATTERY% that are neither
  // Unavailable nor holding an (active/scheduled) reservation. Sorted lowest %
  // first. Doesn't feed progress / work count / the list at all.
  function formatLowCcList(vehicles) {
    const max = LOW_CC_MAX_BATTERY;
    const seen = new Set();
    const rows = [];
    let scanned = 0, unavailable = 0, reserved = 0, noBattery = 0, aboveMax = 0;
    for (const v of (vehicles || [])) {
      if (!v || !v.vin) continue;
      const vin = normalizeVin(v.vin);
      if (!isVin(vin) || isExcludedVin(vin) || seen.has(vin)) continue;
      if (!isCybercabVin(vin)) continue;
      seen.add(vin);
      scanned++;
      if (v.unavailable) { unavailable++; continue; }
      if (v.arriving || v.reservedAt || v.availableUntil) { reserved++; continue; }
      const pct = parseInt(v.battery, 10);
      if (!Number.isFinite(pct)) { noBattery++; continue; }
      if (pct >= max) { aboveMax++; continue; }
      rows.push({ vin, pct });
    }
    rows.sort((a, b) => a.pct - b.pct);
    const now = new Date();
    const header = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - Low CC Charge (< ${max}%)`;
    if (!rows.length) {
      return [
        header,
        `No available cybercabs under ${max}% (scanned ${scanned}: ${unavailable} unavailable, ${reserved} reserved, ${aboveMax} at/above ${max}%${noBattery ? `, ${noBattery} no charge shown` : ''}).`
      ].join('\n');
    }
    const lines = rows.map(r => rawMode ? r.vin : `${r.vin} (${r.pct}%${batteryEmoji(String(r.pct))})`);
    return [
      header,
      `Available cybercabs under ${max}% (no reservation): ${rows.length} of ${scanned} scanned`,
      '',
      ...lines
    ].join('\n');
  }

  // The List: every scanned VIN grouped into separate "Due at <time>" and
  // "Arriving at <time>" sections, plus Driverless, Commuter, Unavailable and
  // Back Ups sections. The VIN set comes from upkeep; the admin /vehicles
  // cross-reference (commuter / unavailable / due+arriving times) only
  // categorizes those VINs. Cars with no reservation aren't listed.
  function formatUpkeepOverview(vehicles) {
    const cybercabSet = getCybercabVinSet();
    const xref = getAdminXref().vins || {};
    const arriving = new Map();
    const due = new Map();
    const backups = [];
    const commuters = [];
    const unavailables = [];
    const trainings = [];
    const driverless = [];
    const reservedVins = [];
    const seen = new Set();
    const scannedSet = new Set();
    let total = 0;
    let ccCount = 0;
    let driverlessCount = 0;
    let reservedCount = 0;
    let lowBattery = 0;

    for (const v of (vehicles || [])) {
      if (!v?.vin) continue;
      const vin = normalizeVin(v.vin);
      if (!isVin(vin) || seen.has(vin) || isExcludedVin(vin)) continue;
      // Every unique, valid VIN pulled from the upkeep page — the true scanned total.
      scannedSet.add(vin);

      const xe = xref[vin];
      const battery = v.battery ? ` (${v.battery}${batteryEmoji(v.battery)})` : '';

      // Backups: own section only; not counted, not in Vins left/work count/progress.
      if (v.backup || upkeepBackupVins.has(vin)) {
        seen.add(vin);
        backups.push(rawMode ? vin : `${vin}${battery}`);
        continue;
      }

      // Admin categorization (don't count): unavailable first, then commuter.
      if (xe && xe.unavailable) {
        seen.add(vin);
        unavailables.push(rawMode ? vin : `${vin}${battery}`);
        continue;
      }
      if (xe && xe.commuter) {
        seen.add(vin);
        commuters.push(rawMode ? vin : `${vin}${battery}`);
        continue;
      }
      // Training cars (tag on the vehicle or admin) are not required — never worked.
      if (v.training || (xe && xe.training)) {
        seen.add(vin);
        trainings.push(rawMode ? vin : `${vin}${battery}`);
        continue;
      }

      // Driverless (prod) cars get their own section under "Vins at the lot",
      // pulled out of the Due at / Arriving buckets entirely.
      if (v.isProd) {
        seen.add(vin);
        driverless.push(rawMode ? vin : `${vin}${battery}`);
        reservedVins.push(vin); // still counts toward the progress bar
        driverlessCount++;
        total++;
        const bn = parseInt(v.battery, 10);
        if (!isNaN(bn) && bn < 60) lowBattery++;
        continue;
      }

      const isCc = cybercabSet.has(vin) || isCybercabVin(vin);
      // Cybercabs are only included when one of their tasks is due within 24h.
      if (isCc && !cybercabNeedsWork(upkeepTaskData[vin])) continue;

      // Admin time categorization:
      //  - active reservation        -> Arriving at <time>  (when it returns)
      //  - "Available until <time>"  -> Due at <time>       (cleaning deadline)
      const arrivingRaw = (xe && xe.arriving) ? xe.arriving : '';
      const ccTag = isCc ? ' [CC]' : '';
      const line = rawMode ? vin : `${vin}${battery}${ccTag}`;
      const countLowBattery = () => {
        const bn = parseInt(v.battery, 10);
        if (!isNaN(bn) && bn < 60) lowBattery++;
      };

      if (arrivingRaw) {
        // Compute the real return time (a span like "5:30 PM–8:30 PM · 27h"
        // can land the next day). Only keep cars back within N hours of the
        // 7:30 PM tracking start (= 5:30 AM) — later returns can't be worked.
        const arrMs = computeArrivalMs(xe.arrivingStart || '', arrivingRaw, xe.arrivingDurMin || 0, Date.now());
        const arrivingCutoff = progressShiftStartMs() + CONFIG.arrivingWindowFromShiftStartHours * 3600 * 1000;
        if (arrMs !== null && arrMs > arrivingCutoff) continue; // returns too late this shift
        seen.add(vin);
        const bucket = dueBucketFromAvailable(arrivingRaw);
        if (!arriving.has(bucket.label)) arriving.set(bucket.label, { sort: bucket.sort, vins: [] });
        arriving.get(bucket.label).vins.push(line);
        reservedVins.push(vin);
        reservedCount++;
        total++;
        if (isCc) ccCount++;
        countLowBattery();
        continue;
      }

      // Due: admin "Available until <time>" (authoritative), else upkeep reserved.
      const reservedRaw = (xe && xe.until) ? xe.until : clean(v.reservedAt || '');
      // Drop anything whose due/reservation is further out than the list window
      // (24h) — including cybercabs, even if an upkeep task is due sooner.
      if (reservedRaw) {
        const resMs = parseTimestampToMs(reservedRaw, Date.now(), { future: true });
        if (resMs !== null && (resMs - Date.now()) > CONFIG.listReservationWindowHours * 3600 * 1000) continue;
      }
      seen.add(vin);

      if (reservedRaw) {
        const bucket = dueBucketFromAvailable(reservedRaw);
        if (!due.has(bucket.label)) due.set(bucket.label, { sort: bucket.sort, vins: [] });
        due.get(bucket.label).vins.push(line);
        reservedVins.push(vin);
        reservedCount++;
        countLowBattery();
      }
      // Cars with no reservation are not listed (still counted in Total Vins).

      total++;
      if (isCc) ccCount++;
    }

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    // Bar "done" = this scan's task-complete VINs ∪ all done sets (incl. manual
    // mark-complete). Work Count is unaffected — it never reads these sets.
    const doneThisScan = new Set([
      ...upkeepCompletedEntries(upkeepTaskData).map(e => normalizeVin(e.vin)),
      ...getDoneVinSetAll()
    ]);
    const doneReservations = reservedVins.filter(v => doneThisScan.has(v)).length;
    const bar = progressBarLine(doneReservations, reservedVins.length, { now: now.getTime() });
    const lines = [
      `${now.toLocaleDateString()} ${timeString} - Jacks List Upkeep (all VINs)`
    ];
    if (bar) lines.push(bar);
    lines.push(
      '',
      `Below 60%: ${lowBattery} 🪫`,
      '',
      `Total Vins: ${scannedSet.size}`,
      `Reservations: ${reservedCount}`,
      `Cybercabs: ${ccCount}`,
      `Driverless: ${driverlessCount}`,
      `Commuter: ${commuters.length}`,
      `Unavailable: ${unavailables.length}`,
      `Training: ${trainings.length}`,
      `Back Ups: ${backups.length}`,
      ''
    );

    if (!total && !backups.length && !commuters.length && !unavailables.length && !trainings.length) {
      lines.push('', 'No VINs found on the upkeep page.');
      return lines.join('\n').trim();
    }

    const SEP_AT_LOT = '====== Vins at the lot ======';
    const SEP_ARRIVING = '========== Arriving ==========';
    const SEP_NOT_REQUIRED = '====== Vins not required ======';

    // Vins at the lot: the due-at cars plus driverless (its own section).
    if (due.size || driverless.length) {
      lines.push('', SEP_AT_LOT);
    }

    [...due.entries()].sort((a, b) => a[1].sort - b[1].sort).forEach(([label, bucket]) => {
      lines.push('', `Due at ${label} [${bucket.vins.length}]`, '');
      sortByBatteryDesc(bucket.vins).forEach(l => lines.push(l));
    });

    if (driverless.length) {
      lines.push('', `Driverless [${driverless.length}]`, '');
      sortByBatteryDesc(driverless).forEach(l => lines.push(l));
    }

    // Separator before the Arriving group (cars that aren't back yet).
    if (arriving.size) {
      lines.push('', SEP_ARRIVING);
      [...arriving.entries()].sort((a, b) => a[1].sort - b[1].sort).forEach(([label, bucket]) => {
        lines.push('', `Arriving at ${label} [${bucket.vins.length}]`, '');
        sortByBatteryDesc(bucket.vins).forEach(l => lines.push(l));
      });
    }

    // Separator before the not-required group (commuter + unavailable + training).
    if (commuters.length || unavailables.length || trainings.length) {
      lines.push('', SEP_NOT_REQUIRED);
      if (commuters.length) {
        lines.push('', `Commuter [${commuters.length}]`, '');
        sortByBatteryDesc(commuters).forEach(l => lines.push(l));
      }
      if (unavailables.length) {
        lines.push('', `Unavailable [${unavailables.length}]`, '');
        sortByBatteryDesc(unavailables).forEach(l => lines.push(l));
      }
      if (trainings.length) {
        lines.push('', `Training [${trainings.length}]`, '');
        sortByBatteryDesc(trainings).forEach(l => lines.push(l));
      }
    }

    if (backups.length) {
      lines.push('', `Back Ups [${backups.length}]`, '');
      sortByBatteryDesc(backups).forEach(l => lines.push(l));
    }

    return lines.join('\n').trim();
  }

  // Reservation shown with the list's labels (e.g. "due 5.30a"); falls back to a
  // normalized clock label for VINs not on the list.
  function upkeepReservedLabel(vin, v, listMeta) {
    const m = getVinListMeta(listMeta, normalizeVin(vin));
    if (m && m.dueAt) {
      if (m.kind === 'arriving') return `arriving ${m.dueAt}`;
      if (m.kind === 'reserved') return `reserved ${m.dueAt}`;
      return `due ${m.dueAt}`;
    }
    const raw = v && v.reservedAt ? clean(v.reservedAt) : '';
    if (!raw) return '';
    const lbl = reservationUntilBucket(raw);
    return lbl ? `reserved ${lbl}` : `reserved ${raw}`;
  }

  // Sortable "due at" value for Vins Left — the reservation/cleaning deadline
  // (the saved list's Due-at time, else the upkeep reserved time), so rows order
  // by when they're due at the lot, not by the recurring upkeep task due. Cars
  // with no due-at time sort last.
  function upkeepDueAtSort(vin, v, listMeta) {
    const m = getVinListMeta(listMeta, normalizeVin(vin));
    let label = '';
    if (m && m.dueAt) label = clean(m.dueAt);
    else if (v && v.reservedAt) label = reservationUntilBucket(clean(v.reservedAt));
    return label ? sortForSimpleTime(label) : 999999;
  }

  function formatUpkeepList(vehicles) {
    vehicles = augmentUpkeepVehicles(vehicles || []);
    const progressVinSet = new Set(getProgressVins());
    const doneSet = getDoneVinSetAll();
    const cybercabSet = getCybercabVinSet();
    const adminExcluded = getAdminExcludedVinSet();
    const listMeta = parseListVinMeta(getSavedListText());

    const onList = new Map();
    const notOnList = new Map();
    const allOnListDue = [];
    const needsWork = [];

    for (const v of vehicles) {
      if (!v.includeInUpkeep || !v.vin) continue;
      const vin = normalizeVin(v.vin);
      if (v.backup || upkeepBackupVins.has(vin)) continue; // backups aren't worked
      // Commuter / unavailable / training cars never show on Vins left.
      if (v.training || adminExcluded.has(vin)) continue;
      // Cybercabs only appear when one of their tasks is due within 24h.
      if (isCybercabVin(vin) && !cybercabNeedsWork(upkeepTaskData[vin])) continue;
      const driverlessTag = v.isProd ? ' [DRIVERLESS]' : '';
      const ccTag = cybercabSet.has(vin) ? ' [CC]' : '';
      const reservedLabel = upkeepReservedLabel(vin, v, listMeta);
      const reservedPart = reservedLabel ? ` | ${reservedLabel}` : '';
      const line = rawMode ? vin : `${vin} (${v.battery || '??%'}${v.battery ? batteryEmoji(v.battery) : ''}) - Due: ${v.upkeepDue}${reservedPart}${driverlessTag}${ccTag}`;
      const entry = { line, dueAtSort: upkeepDueAtSort(vin, v, listMeta), dueHours: parseUpkeepHours(v.upkeepDue) };
      const onOurList = progressVinSet.size === 0 || progressVinSet.has(vin);
      if (!onOurList) {
        if (!notOnList.has(vin)) notOnList.set(vin, entry);
        continue;
      }
      allOnListDue.push(vin);
      if (doneSet.has(vin)) continue; // completed — keep it off Vins Left entirely
      needsWork.push(vin);
      if (!onList.has(vin)) onList.set(vin, entry);
    }

    saveUpkeepDueScope(allOnListDue, needsWork);
    updateListInfoBar();

    const progressVins = getProgressVins();
    const upkeepDueSet = new Set(allOnListDue);
    const onUpkeepCount = progressVins.filter(v => upkeepDueSet.has(v)).length;
    const notOnUpkeepVins = progressVins.filter(v => !upkeepDueSet.has(v) && !doneSet.has(v));
    const notOnUpkeepLines = sortRemainingByListMeta(notOnUpkeepVins, listMeta).map(vin => {
      if (rawMode) return vin;
      return formatProgressRemainingLine(vin, listMeta);
    });

    const allNeedsWorkLines = [...onList.values(), ...notOnList.values()]
      .sort((a, b) => (a.dueAtSort - b.dueAtSort) || (a.dueHours - b.dueHours)).map(e => e.line);

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateString = now.toLocaleDateString();

    const doneReservations = progressVins.filter(v => doneSet.has(v)).length;
    const bar = progressBarLine(doneReservations, progressVins.length, { now: now.getTime() });
    const etaLine = progressEtaLine(doneReservations, progressVins.length, now.getTime());

    const lines = [
      `${dateString} ${timeString} - Jacks List Upkeep (due within ${CONFIG.upkeepMaxHours}h)`
    ];
    if (bar) lines.push(bar);
    if (etaLine) lines.push(etaLine);
    lines.push(
      `Reservations: ${progressVins.length} · On upkeep: ${onUpkeepCount} · Needs work: ${allNeedsWorkLines.length} · Not on upkeep: ${notOnUpkeepVins.length}`,
      ''
    );

    if (allNeedsWorkLines.length > 0) {
      lines.push(`=== Vins Left [${allNeedsWorkLines.length}] ===`);
      lines.push(...allNeedsWorkLines, '');
    } else {
      lines.push(`No VINs need work (<= ${CONFIG.upkeepMaxHours}h due, or already done in Progress).`);
    }

    if (notOnUpkeepLines.length > 0) {
      lines.push(`=== On List but Not on Upkeep [${notOnUpkeepLines.length}] ===`);
      lines.push(...notOnUpkeepLines, '');
    }

    return lines.join('\n').trim();
  }
  async function continueFullScan() {
    if (stopScanRequested) return;
    const raw = sessionStorage.getItem(STATE_KEY);
    if (!raw) return;
    let state;
    try { state = JSON.parse(raw); }
    catch { sessionStorage.removeItem(STATE_KEY); return; }
    if (!state.active) return;
    if (state.stage === 'work_count') { sessionStorage.removeItem(STATE_KEY); return; }

    if (state.stage === 'upkeep') {
      setActiveScan('upkeep');
      if (!isUpkeepStartPage()) { location.href = upkeepUrl(); return; }
      showStatus();
      setStatus('Vins left · starting…', 0.01);
      const vehicles = await scanPagesOnCurrentUrl(true, { base: 0, span: 1, label: 'Vins left' });
      if (stopScanRequested) {
        sessionStorage.removeItem(STATE_KEY);
        setActiveScan(null);
        setStatus('stopped');
        return;
      }
      if (scanLooksEmpty(vehicles)) { warnEmptyScan('Vins left', vehicles); return; }
      sessionStorage.removeItem(STATE_KEY);
      reconcileUpkeepScan(vehicles);
      saveUpkeepScanCache(vehicles, 'Vins left');
      const text = formatUpkeepList(vehicles);
      sessionStorage.setItem(UPKEEP_LAST_TEXT_KEY, text);
      try { gmSet(SHARED_VINSLEFT_KEY, text); gmSet(SHARED_VINSLEFT_TIME_KEY, Date.now()); } catch { /* ignore */ }
      sessionStorage.setItem(LAST_TEXT_KEY, text);
      await copyText(text);
      showPreview(text);
      recordScanFinish(state.startTime);
      updateListInfoBar();
      finalizeStatusBar();
      setActiveScan(null);
      return;
    }

    if (state.stage === 'upkeep_overview') {
      const asList = state.asList === true;
      setActiveScan(asList ? 'list' : 'upkeep_overview');
      if (!isUpkeepStartPage()) { location.href = upkeepUrl(); return; }
      showStatus();
      setStatus(asList ? 'List · scanning upkeep…' : 'Upkeep overview · starting…', 0.01);
      const vehicles = await scanPagesOnCurrentUrl(true, { base: 0, span: 1, label: asList ? 'List' : 'Upkeep overview' });
      if (stopScanRequested) {
        sessionStorage.removeItem(STATE_KEY);
        setActiveScan(null);
        setStatus('stopped');
        return;
      }
      if (scanLooksEmpty(vehicles)) { warnEmptyScan(asList ? 'List' : 'Upkeep', vehicles); return; }
      // Cache the upkeep scan so it survives the navigations to the admin tabs.
      saveUpkeepScanCache(vehicles, 'List');

      // List scan: hop to the admin /vehicles tabs to categorize these VINs
      // (commuter / unavailable / arriving times) before building the list.
      if (asList && state.xref) {
        sessionStorage.setItem(STATE_KEY, JSON.stringify({ ...state, stage: 'list_xref_available' }));
        setStatus('List · cross-referencing admin (Available)…', 0.01);
        location.href = ADMIN_AVAILABLE_URL;
        return;
      }

      sessionStorage.removeItem(STATE_KEY);
      const text = formatUpkeepOverview(vehicles);
      if (asList) {
        savePastedList(text); // saves it as "the list" everywhere
      } else {
        sessionStorage.setItem(UPKEEP_OVERVIEW_LAST_TEXT_KEY, text);
        sessionStorage.setItem(LAST_TEXT_KEY, text);
      }
      // savePastedList resets the shift baseline; re-seed it from this scan.
      reconcileUpkeepScan(vehicles);
      saveUpkeepScanCache(vehicles, 'List');
      await copyText(text);
      showPreview(text);
      recordScanFinish(state.startTime);
      updateListInfoBar();
      finalizeStatusBar();
      setActiveScan(null);
      return;
    }

    // List cross-reference, step 1: scan the admin "Available" tab.
    if (state.stage === 'list_xref_available') {
      setActiveScan('list');
      if (!isAdminVehiclesPage('Available')) { location.href = ADMIN_AVAILABLE_URL; return; }
      showStatus();
      setStatus('List · admin Available · starting…', 0.01);
      const vehicles = await scanPagesOnCurrentUrl(false, { base: 0, span: 1, label: 'List · Available' });
      if (stopScanRequested) {
        sessionStorage.removeItem(STATE_KEY);
        setActiveScan(null);
        setStatus('stopped');
        return;
      }
      mergeAdminXref(vehicles, { forcedUnavailable: false });
      sessionStorage.setItem(STATE_KEY, JSON.stringify({ ...state, stage: 'list_xref_unavailable' }));
      setStatus('List · cross-referencing admin (Unavailable)…', 0.01);
      location.href = ADMIN_UNAVAILABLE_URL;
      return;
    }

    // List cross-reference, step 2: scan the admin "Unavailable" tab, then build
    // the final list from the saved upkeep scan enriched with the admin data.
    if (state.stage === 'list_xref_unavailable') {
      setActiveScan('list');
      if (!isAdminVehiclesPage('Unavailable')) { location.href = ADMIN_UNAVAILABLE_URL; return; }
      showStatus();
      setStatus('List · admin Unavailable · starting…', 0.01);
      const vehicles = await scanPagesOnCurrentUrl(false, { base: 0, span: 1, label: 'List · Unavailable' });
      if (stopScanRequested) {
        sessionStorage.removeItem(STATE_KEY);
        setActiveScan(null);
        setStatus('stopped');
        return;
      }
      mergeAdminXref(vehicles, { forcedUnavailable: true });
      sessionStorage.removeItem(STATE_KEY);

      // Rebuild the upkeep vehicles + task data from the cache we saved before
      // navigating away, then format the list with admin categorization applied.
      const cache = getUpkeepScanCache();
      const upkeepVehicles = cache?.vehicles || [];
      if (cache) applyUpkeepScanCache(cache);
      const text = formatUpkeepOverview(upkeepVehicles);
      savePastedList(text);
      // savePastedList resets the shift baseline (done VINs, task history, seen
      // set, scan cache); re-seed it from this scan so Vins left / Work Count
      // stay in sync.
      reconcileUpkeepScan(upkeepVehicles);
      saveUpkeepScanCache(upkeepVehicles, 'List');
      await copyText(text);
      showPreview(text);
      recordScanFinish(state.startTime);
      updateListInfoBar();
      finalizeStatusBar();
      setActiveScan(null);
      return;
    }

    if (state.stage === 'work_count_scan') {
      setActiveScan('progress');
      if (!isUpkeepStartPage()) { location.href = upkeepUrl(); return; }
      showStatus();
      setStatus('Work Count · scanning upkeep…', 0.01);
      const vehicles = await scanPagesOnCurrentUrl(true, { base: 0, span: 1, label: 'Work Count' });
      if (stopScanRequested) {
        sessionStorage.removeItem(STATE_KEY);
        setActiveScan(null);
        setStatus('stopped');
        return;
      }
      if (scanLooksEmpty(vehicles, { needTasks: true })) { warnEmptyScan('Work Count', vehicles); return; }
      sessionStorage.removeItem(STATE_KEY);
      const merged = reconcileUpkeepScan(vehicles);
      saveUpkeepScanCache(vehicles, 'Work Count');
      const text = buildUpkeepWorkCountText(merged);
      sessionStorage.setItem(PROGRESS_LAST_TEXT_KEY, text);
      sessionStorage.setItem(LAST_TEXT_KEY, text);
      await copyText(text);
      showPreview(text);
      recordScanFinish(state.startTime);
      updateListInfoBar();
      finalizeStatusBar();
      setActiveScan(null);
      return;
    }

    // Low CC Charge: scan every cybercab, list the low-charge free ones. Info only
    // — never touches the list, progress, done set, or work count.
    if (state.stage === 'low_cc') {
      setActiveScan('lowcc');
      if (!isLowCcPage()) { location.href = LOW_CC_URL; return; }
      showStatus();
      setStatus('Low CC · scanning cybercabs…', 0.01);
      const vehicles = await scanPagesOnCurrentUrl(false, { base: 0, span: 1, label: 'Low CC' });
      if (stopScanRequested) {
        sessionStorage.removeItem(STATE_KEY);
        setActiveScan(null);
        setStatus('stopped');
        return;
      }
      sessionStorage.removeItem(STATE_KEY);
      const text = formatLowCcList(vehicles);
      sessionStorage.setItem(LAST_TEXT_KEY, text);
      await copyText(text);
      showPreview(text);
      recordScanFinish(state.startTime);
      finalizeStatusBar();
      setActiveScan(null);
      return;
    }

  }

  async function copyText(text) {
    if (typeof GM_setClipboard === 'function') { GM_setClipboard(text, 'text'); return; }
    await navigator.clipboard.writeText(text);
  }

  function collapseOutputPanel() {
    const outputArea = document.getElementById('jacks-list-output-area');
    const panel = document.getElementById('jacks-list-panel');
    const topBar = document.getElementById('jacks-list-panel-top-bar');
    if (outputArea) outputArea.style.display = 'none';
    if (topBar) topBar.style.display = 'none';
    if (panel && !panelMinimized) {
      panel.style.height = 'auto';
      panel.style.maxHeight = PANEL_DEFAULT_MAX_H;
      try {
        const raw = sessionStorage.getItem(PANEL_SIZE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          sessionStorage.setItem(PANEL_SIZE_KEY, JSON.stringify({ width: parsed.width, height: '' }));
        }
      } catch { /* ignore */ }
    }
  }

  function expandOutputPanel() {
    const outputArea = document.getElementById('jacks-list-output-area');
    const topBar = document.getElementById('jacks-list-panel-top-bar');
    if (outputArea) outputArea.style.display = 'flex';
    if (topBar && !panelMinimized) topBar.style.display = 'flex';
  }

  function toRawText(text) {
    return String(text == null ? '' : text).split('\n').map(line => {
      const m = line.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
      return m ? m[1] : line;
    }).join('\n');
  }
  // ---- Pretty (non-text) rendering of the output --------------------------
  // The list is generated as plain text (for copy / share / parsing). This
  // renders that same text into styled rows so the panel isn't a wall of text.
  // The Raw switch falls back to the plain textarea.
  function gbBatteryStyle(pct) {
    if (pct > 70) return { color: '#74c476', bg: 'rgba(116,196,118,.13)' };
    if (pct > 35) return { color: '#e3b341', bg: 'rgba(227,179,65,.13)' };
    return { color: '#e5736b', bg: 'rgba(229,115,107,.15)' };
  }
  function gbSectionDotColor(label) {
    const l = (label || '').toLowerCase();
    if (/arriving/.test(l)) return '#6aa9e9';
    if (/driverless/.test(l)) return '#b48ee8'; // prod/driverless = purple
    if (/cyber ?cab/.test(l)) return '#E8D4A8'; // cybercab = gold
    if (/commuter|unavailable|back ?ups|not on upkeep|no reservation/.test(l)) return '#8a8a92';
    return '#E8D4A8'; // due / vins left / default
  }
  function gbChip(label, val) {
    const chip = document.createElement('div');
    const low = /below 60/i.test(label);
    const muted = /back ?ups|commuter|unavailable|not on upkeep/i.test(label);
    let border = 'rgba(201,168,107,.25)', valColor = '#E8D4A8', bg = 'rgba(201,168,107,.06)';
    if (low) { border = 'rgba(229,115,107,.4)'; valColor = '#e5736b'; bg = 'rgba(229,115,107,.10)'; }
    else if (muted) { border = 'rgba(255,255,255,.09)'; valColor = '#aeaeb6'; bg = 'rgba(255,255,255,.03)'; }
    chip.style.cssText = `display:inline-flex;align-items:baseline;gap:5px;padding:4px 9px;border-radius:999px;border:1px solid ${border};background:${bg};`;
    const l = document.createElement('span');
    l.textContent = clean(label.replace(/🪫/g, ''));
    l.style.cssText = 'font:600 9px "DM Mono",monospace;color:#8a8a92;text-transform:uppercase;letter-spacing:.05em;';
    const v = document.createElement('span');
    v.textContent = clean((val || '').replace(/🪫/g, ''));
    v.style.cssText = `font:700 12px "DM Sans",system-ui,sans-serif;color:${valColor};`;
    chip.append(l, v);
    return chip;
  }
  function gbIsCountLine(line) {
    return /:\s*\d/.test(line) && /^[A-Za-z][\w %<>/]*:\s*\d/.test(line);
  }
  function gbCountChips(line) {
    return line.split('·').map(s => clean(s)).filter(Boolean).map(seg => {
      const m = seg.match(/^(.*?):\s*(.+)$/);
      return gbChip(m ? m[1] : seg, m ? m[2] : '');
    });
  }
  function gbProgressBar(done, total, pct, extra) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin:4px 0 12px;';
    const top = document.createElement('div');
    top.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px;';
    const lbl = document.createElement('span');
    lbl.textContent = `${done}/${total} done${extra ? ' · ' + extra : ''}`;
    lbl.style.cssText = 'font:600 11px "DM Mono",monospace;color:#c8c8d0;';
    const pctEl = document.createElement('span');
    pctEl.textContent = `${pct}%`;
    pctEl.style.cssText = 'font:800 14px "DM Sans",system-ui,sans-serif;color:#E8D4A8;';
    top.append(lbl, pctEl);
    const track = document.createElement('div');
    track.style.cssText = 'position:relative;width:100%;height:10px;border-radius:999px;background:rgba(0,0,0,.45);border:1px solid rgba(201,168,107,.18);overflow:hidden;';
    const fill = document.createElement('div');
    fill.style.cssText = `position:absolute;left:0;top:0;bottom:0;width:${Math.max(0, Math.min(100, pct))}%;background:linear-gradient(90deg, rgba(140,110,58,.85) 0%, #C9A86B 40%, #D4B87A 70%, #E8D4A8 100%);border-radius:999px;transition:width .6s ease;`;
    track.appendChild(fill);
    wrap.append(top, track);
    return wrap;
  }
  function gbDivider(label) {
    const clean1 = clean((label || '').replace(/\[\d+\]\s*$/, ''));
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:8px;margin:16px 0 4px;';
    const left = document.createElement('span');
    left.textContent = clean1;
    left.style.cssText = 'font:700 10px "DM Mono",monospace;color:#C9A86B;text-transform:uppercase;letter-spacing:.1em;white-space:nowrap;';
    const rule = document.createElement('div');
    rule.style.cssText = 'flex:1 1 auto;height:1px;background:linear-gradient(90deg, rgba(201,168,107,.45), rgba(201,168,107,.05));';
    wrap.append(left, rule);
    return wrap;
  }
  function gbSectionHeader(label, count) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:7px;margin:11px 0 4px;';
    const dot = document.createElement('span');
    dot.style.cssText = `flex-shrink:0;width:7px;height:7px;border-radius:50%;background:${gbSectionDotColor(label)};box-shadow:0 0 6px ${gbSectionDotColor(label)}66;`;
    const name = document.createElement('span');
    name.textContent = label;
    name.style.cssText = 'font:600 12px "DM Sans",system-ui,sans-serif;color:#dcd6c8;';
    wrap.append(dot, name);
    if (count != null && count !== '') {
      const badge = document.createElement('span');
      badge.textContent = count;
      badge.style.cssText = 'font:700 10px "DM Mono",monospace;color:#12100c;background:#C9A86B;border-radius:999px;padding:1px 7px;min-width:13px;text-align:center;';
      wrap.appendChild(badge);
    }
    return wrap;
  }
  // Toggle a VIN's manual completion, then rebuild the CURRENT view from the
  // cached scan so the progress bar + Vins-left counts update without a re-scan.
  // Work Count credit is never affected (manual completions live in their own
  // key and are never written into upkeepTaskData / task history).
  function toggleManualDoneVin(vin) {
    const v = normalizeVin(vin);
    if (!isVin(v)) return;
    if (getManualDoneVinSet().has(v)) removeManualDoneVin(v);
    else addManualDoneVin(v);
    rerenderUpkeepViewAfterManualToggle();
  }

  function rerenderUpkeepViewAfterManualToggle() {
    // Remember where the list is scrolled so marking a VIN doesn't jump to top.
    const renderEl = document.getElementById('jacks-list-output-render');
    const textEl = document.getElementById('jacks-list-output-text');
    forceRestoreTop = (renderEl && renderEl.scrollTop) || (textEl && textEl.scrollTop) || 0;
    const cur = fullOutputCache || '';
    const cache = getUpkeepScanCache();
    if (cache && Array.isArray(cache.vehicles)) {
      // Work Count: no VIN rows to click here, but keep it correct for safety.
      if (cur.includes('Jacks List Work Count')) {
        applyUpkeepScanCache(cache);
        showPreview(buildUpkeepWorkCountText(getUpkeepTaskHistory()));
        return;
      }
      // Vins Left: formatUpkeepList drops done VINs and recomputes its bar.
      if (cur.includes('Jacks List Upkeep (due within')) {
        applyUpkeepScanCache(cache);
        showPreview(formatUpkeepList(cache.vehicles));
        return;
      }
      // List overview: keeps the row but recomputes its bar (see done source).
      if (cur.includes('Jacks List Upkeep (all VINs)')) {
        applyUpkeepScanCache(cache);
        showPreview(formatUpkeepOverview(cache.vehicles));
        return;
      }
    }
    // No cached scan / unknown view: re-render the existing text so gbVinRow can
    // grey the toggled row. Counts hold until the next scan.
    showPreview(cur);
  }

  function gbVinRow(line, vin, allowComplete = false) {
    const nv = normalizeVin(vin);
    const manualDone = allowComplete && getManualDoneVinSet().has(nv);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 2px;border-bottom:1px solid rgba(255,255,255,.035);';
    const bm = line.match(/\((\d{1,3})\s*%/);
    if (bm) {
      const pct = parseInt(bm[1], 10);
      const bs = gbBatteryStyle(pct);
      const chip = document.createElement('span');
      chip.textContent = `${pct}%`;
      chip.style.cssText = `flex-shrink:0;font:700 11px "DM Mono",monospace;color:${bs.color};background:${bs.bg};border:1px solid ${bs.color}40;border-radius:6px;padding:2px 0;width:46px;text-align:center;`;
      row.appendChild(chip);
    }
    const v = document.createElement('span');
    v.textContent = vin;
    v.style.cssText = 'font:600 12px "DM Mono",monospace;color:#d0d0d8;letter-spacing:.02em;';
    row.appendChild(v);
    // Open this VIN's vehicles page in a new tab — sits right next to the VIN.
    const go = document.createElement('a');
    go.href = `https://humans.tesla.com/vehicles?vin=${encodeURIComponent(nv)}`;
    go.target = '_blank';
    go.rel = 'noopener';
    go.textContent = '↗';
    go.title = 'Open this VIN on the vehicles page';
    go.setAttribute('aria-label', go.title);
    go.style.cssText = [
      'flex-shrink:0', 'box-sizing:border-box', 'cursor:pointer', 'text-decoration:none',
      'width:20px', 'height:20px',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font:700 12px "DM Mono",monospace', 'line-height:1', 'border-radius:6px',
      'color:#6f6f78', 'background:rgba(255,255,255,.04)', 'border:1px solid #3a3a42'
    ].join(';');
    go.onmouseenter = () => { go.style.color = '#8fb7e8'; go.style.borderColor = 'rgba(106,169,233,.5)'; };
    go.onmouseleave = () => { go.style.color = '#6f6f78'; go.style.borderColor = '#3a3a42'; };
    go.onclick = (e) => { e.stopPropagation(); };
    row.appendChild(go);
    // Subtle gold ✓ (Vins Left only) marks/unmarks this VIN complete in place —
    // sits right next to the ↗ open button.
    if (allowComplete) {
      const mc = document.createElement('button');
      mc.type = 'button';
      mc.textContent = '✓';
      mc.title = manualDone ? 'Mark as not complete' : 'Mark as complete';
      mc.setAttribute('aria-label', mc.title);
      mc.style.cssText = [
        'flex-shrink:0', 'box-sizing:border-box', 'cursor:pointer', 'padding:0',
        'width:20px', 'height:20px',
        'display:flex', 'align-items:center', 'justify-content:center',
        'font:700 11px "DM Mono",monospace', 'line-height:1', 'border-radius:6px',
        manualDone ? 'color:#12100c' : 'color:#6f6f78',
        manualDone ? 'background:#C9A86B' : 'background:rgba(255,255,255,.04)',
        manualDone ? 'border:1px solid #C9A86B' : 'border:1px solid #3a3a42'
      ].join(';');
      if (!manualDone) {
        mc.onmouseenter = () => { mc.style.color = '#E8D4A8'; mc.style.borderColor = 'rgba(201,168,107,.5)'; };
        mc.onmouseleave = () => { mc.style.color = '#6f6f78'; mc.style.borderColor = '#3a3a42'; };
      }
      mc.onclick = (e) => { e.preventDefault(); e.stopPropagation(); toggleManualDoneVin(nv); };
      row.appendChild(mc);
    }
    (line.match(/\[(CC|DRIVERLESS)\]/gi) || []).forEach(tag => {
      const t = tag.replace(/[[\]]/g, '');
      const cc = /cc/i.test(t);
      const b = document.createElement('span');
      b.textContent = t;
      b.style.cssText = `flex-shrink:0;font:700 9px "DM Mono",monospace;letter-spacing:.04em;border-radius:4px;padding:1px 5px;color:${cc ? '#E8D4A8' : '#b48ee8'};background:${cc ? 'rgba(201,168,107,.14)' : 'rgba(180,142,232,.14)'};`;
      row.appendChild(b);
    });
    const after = line.split(')').slice(1).join(')');
    const label = clean(after.replace(/\[(CC|DRIVERLESS)\]/gi, '').replace(/^[-\s|]+/, ''));
    if (label) {
      const lab = document.createElement('span');
      lab.textContent = label;
      lab.style.cssText = 'margin-left:auto;font:500 10px "DM Mono",monospace;color:#8a8a92;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      row.appendChild(lab);
    }
    if (manualDone) {
      row.style.opacity = '0.5';
      v.style.textDecoration = 'line-through';
    }
    return row;
  }
  function gbPersonRow(name, val) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 2px;border-bottom:1px solid rgba(255,255,255,.035);';
    const n = document.createElement('span');
    n.textContent = name;
    n.style.cssText = 'font:600 12px "DM Sans",system-ui,sans-serif;color:#d0d0d8;';
    row.appendChild(n);
    // Right-aligned per-type pills so the work-count split reads at a glance:
    // prod/driverless = purple, cybercab = gold, dev = muted neutral.
    const group = document.createElement('span');
    group.style.cssText = 'margin-left:auto;display:flex;align-items:center;gap:5px;flex-shrink:0;';
    const pill = (text, color, bg) => {
      const s = document.createElement('span');
      s.textContent = text;
      s.style.cssText = `font:700 11px "DM Mono",monospace;color:${color};background:${bg};border-radius:6px;padding:2px 8px;white-space:nowrap;`;
      return s;
    };
    const segs = String(val == null ? '' : val).match(/\d+\s*(?:prod|cybercab|dev)/gi) || [];
    if (segs.length) {
      segs.forEach(seg => {
        const s = clean(seg);
        if (/cybercab/i.test(s)) group.appendChild(pill(s, '#E8D4A8', 'rgba(201,168,107,.14)'));
        else if (/prod/i.test(s)) group.appendChild(pill(s, '#b48ee8', 'rgba(180,142,232,.14)'));
        else group.appendChild(pill(s, '#c8c8d0', 'rgba(255,255,255,.05)'));
      });
    } else {
      group.appendChild(pill(clean(val) || '0', '#c8c8d0', 'rgba(255,255,255,.05)'));
    }
    row.appendChild(group);
    return row;
  }
  function renderListHtml(text) {
    const root = document.createElement('div');
    root.style.cssText = 'display:flex;flex-direction:column;gap:0;padding:2px 14px 16px 14px;box-sizing:border-box;';
    const lines = String(text == null ? '' : text).split('\n');
    // The mark-complete (✓) button only appears on the Vins Left view.
    const isVinsLeft = /Jacks List Upkeep \(due within/i.test(String(text || ''));
    let inSection = false;
    let chipBuf = [];
    const flushChips = () => {
      if (!chipBuf.length) return;
      const rowEl = document.createElement('div');
      rowEl.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 10px;';
      chipBuf.forEach(c => rowEl.appendChild(c));
      root.appendChild(rowEl);
      chipBuf = [];
    };
    for (let i = 0; i < lines.length; i++) {
      const line = clean(lines[i]);
      if (!line) continue;

      // Title (first meaningful line)
      if (root.childElementCount === 0 && !chipBuf.length && (/Jacks List/i.test(line) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(line))) {
        const t = document.createElement('div');
        t.textContent = line;
        t.style.cssText = 'font:700 13px "DM Sans",system-ui,sans-serif;color:#E8D4A8;margin:2px 0 9px;line-height:1.3;';
        root.appendChild(t);
        continue;
      }

      const prog = line.match(/^Progress:\s*(\d+)\s*\/\s*(\d+)\s*done\s*\((\d+)%\)(.*)$/i);
      if (prog) {
        flushChips();
        root.appendChild(gbProgressBar(parseInt(prog[1], 10), parseInt(prog[2], 10), parseInt(prog[3], 10), clean(prog[4]).replace(/^·\s*/, '')));
        continue;
      }
      if (/[█▓░]/.test(line)) continue; // old text bar -> replaced by gbProgressBar
      if (/cars\/hr/i.test(line)) {
        flushChips();
        const c = document.createElement('div');
        c.textContent = line;
        c.style.cssText = 'font:500 12px "DM Mono",monospace;color:#9a9aa2;margin:-4px 0 6px;';
        root.appendChild(c);
        continue;
      }
      if (/^Est\. finish:/i.test(line)) {
        flushChips();
        const c = document.createElement('div');
        c.textContent = line;
        const over = /\(past /i.test(line);
        c.style.cssText = `font:600 12px "DM Mono",monospace;color:${over ? '#e6a5a5' : '#8fca9c'};margin:0 0 11px;`;
        root.appendChild(c);
        continue;
      }

      const divm = line.match(/^=+\s*(.*?)\s*=+\s*$/);
      if (/^=+/.test(line) && divm) {
        flushChips();
        inSection = true;
        root.appendChild(gbDivider(divm[1] || line));
        continue;
      }

      const secm = line.match(/^(Due at .+?|Due by .+?|Arriving at .+?|Driverless|Commuter|Unavailable|Back Ups|No reservation|On List but Not on Upkeep|Vins Left)\s*(?:\[(\d+)\])?$/i);
      if (secm && !/[A-HJ-NPR-Z0-9]{17}/.test(line)) {
        flushChips();
        inSection = true;
        root.appendChild(gbSectionHeader(secm[1], secm[2]));
        continue;
      }

      const vinm = line.match(/([A-HJ-NPR-Z0-9]{17})/);
      if (vinm) {
        flushChips();
        root.appendChild(gbVinRow(line, vinm[1], isVinsLeft));
        continue;
      }

      // Count lines become chips only in the header area (before any section).
      if (!inSection && gbIsCountLine(line)) {
        gbCountChips(line).forEach(c => chipBuf.push(c));
        continue;
      }

      // Person work-count rows ("Name: 5 prod 2 dev") once inside a section.
      // Guard against sentences (e.g. "No completions found ... (7:30 PM)").
      const personm = line.match(/^(.*?):\s*(.+)$/);
      if (inSection && personm && clean(personm[1]).length <= 30 && /^\d/.test(clean(personm[2]))) {
        flushChips();
        root.appendChild(gbPersonRow(clean(personm[1]), clean(personm[2])));
        continue;
      }

      flushChips();
      const p = document.createElement('div');
      p.textContent = line;
      p.style.cssText = 'font:500 11px "DM Mono",monospace;color:#9a9aa2;padding:3px 2px;';
      root.appendChild(p);
    }
    flushChips();
    return root;
  }

  function renderPreviewInto(text) {
    const render = document.getElementById('jacks-list-output-render');
    if (!render) return;
    render.textContent = '';
    render.appendChild(renderListHtml(text));
  }

  function showPreview(text) {
    fullOutputCache = text;
    const outputArea = document.getElementById('jacks-list-output-area');
    const outputText = document.getElementById('jacks-list-output-text');
    const outputRender = document.getElementById('jacks-list-output-render');
    const outputTitle = document.getElementById('jacks-list-output-title');
    updateListInfoBar();
    if (!outputArea || !outputText) return;
    if (text.includes('Jacks List Work Count')) {
      outputTitle.textContent = 'Work Count';
    } else if (text.includes('Upkeep action')) outputTitle.textContent = 'Vins Left';
    else if (text === getSavedListText() && !text.includes('Jacks List')) outputTitle.textContent = 'Saved List';
    else outputTitle.textContent = 'Jacks List';
    outputText.value = rawMode ? toRawText(text) : text;
    // Build the styled view; if it throws or comes out empty, fall back to the
    // plain textarea so output always shows.
    let renderOk = false;
    try {
      renderPreviewInto(text);
      renderOk = !!(outputRender && outputRender.firstChild && outputRender.firstChild.childElementCount > 0);
    } catch { renderOk = false; }
    const useRender = !rawMode && renderOk;
    // Raw switch (or a render fallback) shows the plain textarea.
    if (outputRender) outputRender.style.display = useRender ? 'block' : 'none';
    outputText.style.display = useRender ? 'none' : 'block';
    expandOutputPanel();
    // Restore the prior scroll position when re-rendering the same content
    // (e.g. periodic refreshes / page navigation mid-scan); reset only when the
    // content actually changed — UNLESS a one-shot forceRestoreTop was set (a
    // manual ✓ toggle changes the content but should keep the user's place).
    let restoreTop = 0;
    if (forceRestoreTop != null) {
      restoreTop = forceRestoreTop;
      forceRestoreTop = null;
    } else {
      try {
        const saved = JSON.parse(sessionStorage.getItem(OUTPUT_SCROLL_KEY) || 'null');
        if (saved && saved.sig === outputScrollSig(text)) restoreTop = saved.top || 0;
      } catch { /* ignore */ }
    }
    requestAnimationFrame(() => { outputText.scrollTop = restoreTop; if (outputRender) outputRender.scrollTop = restoreTop; });
    // If we're resuming a scan after a page reload, don't auto-hide the status bar
    // just because `activeScan` hasn't been re-established yet.
    if (!activeScan && !statusIsFinalizing && !isResumingScan) hideStatusBar();
  }
  makePanel();
  migrateStoredProgressDoneCybercabFlags();
  showUpdateLog();
  // Push-only sync for the List: this page is the source of truth. We mirror our
  // saved list OUT to shared storage (so mission control / other pages can read
  // it), but we never pull it back in or let anything else overwrite our list.
  function syncFromSharedList() {
    try {
      if (activeScan) return false;
      const scanRaw = sessionStorage.getItem(STATE_KEY);
      try { if (scanRaw && JSON.parse(scanRaw)?.active) return false; } catch { /* ignore */ }
      const localText = (getSavedListText() || '').trim();
      if (localText) persistSharedList(getSavedListText());
    } catch { /* ignore */ }
    return false;
  }
  syncFromSharedList();
  setInterval(() => syncFromSharedList(), 3000);
  isResumingScan = shouldKeepStatusBarOnLoad();
  if (isResumingScan) {
    statusFillSkipTransition = true;
    const savedP = parseFloat(sessionStorage.getItem('__jacks_list_status_progress__') || '');
    if (Number.isFinite(savedP) && savedP >= 0) {
      showStatus();
      statusProgressValue = savedP;
      applyStatusFillWidth(savedP, false);
    }
  } else {
    hideStatusBar();
  }
  if (sessionStorage.getItem(LAST_TEXT_KEY)) {
    const savedOut = sessionStorage.getItem(LAST_TEXT_KEY);
    if (savedOut) showPreview(savedOut);
  }
  setInterval(makePanel, 3000);

  isResumingScan = false;
  continueFullScan();
})();