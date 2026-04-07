# MediCount Design Guide — "The Silent Curator" (2026 Edition)

This guide is derived directly from the live codebase (`index.html`, `src/styles/index.css`, and all `src/*.js` files). It documents the exact design decisions implemented, not aspirational targets. Use it as the authoritative reference when building new pages, modals, or components.

---

## 1. Design Philosophy

**"The Silent Curator"** — sophisticated, data-first, devoid of visual noise. The interface recedes into the background so the data can speak. Every pixel has a purpose.

| Principle | Implementation |
|---|---|
| Whitespace as hierarchy | Use space, not lines, to separate sections |
| Status over color | Text labels + color indicators together (never color alone) |
| Information density | Maximize visible items at 1920×1080 while feeling calm |
| No gradients | Flat colors or very subtle opacity shifts only (exception: sidebar gradient, logo, TV dashboard) |

---

## 2. Design Tokens (CSS Variables)

Defined in `:root` in `src/styles/index.css`:

```css
--primary:       #0056D2   /* Authority Blue — CTAs, active states, links */
--primary-dim:   #0047b0   /* Hover state for primary */
--primary-dark:  #003d99   /* Active/pressed state */
--bg:            #F8FAFC   /* Main canvas — Off-white Slate-50 */
--bg-card:       #FFFFFF   /* Card surfaces */
--border:        #e2e8f0   /* All dividers and borders */
--text:          #0f172a   /* Slate-900 — primary text */
--text-2:        #64748b   /* Slate-500 — secondary text */
--text-3:        #94a3b8   /* Slate-400 — labels, placeholders, metadata */
--shadow-card:   0 1px 4px rgba(15,23,42,0.05), 0 4px 16px rgba(15,23,42,0.03)
--shadow-modal:  0 24px 64px rgba(15,23,42,0.14)
--radius:        8px        /* Standard border radius */
--font-sans:     'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif
```

---

## 3. Typography

- **Font stack:** Manrope (primary) → Inter → system sans-serif. Both fonts are loaded from Google Fonts.
- **Base:** `font-size: 13px`, `font-weight: 400`, antialiased.
- **Scale in use:**

| Use | Size | Weight | Color |
|---|---|---|---|
| Page titles | 20px | 700 | `--text` |
| Section/tab headings | 14–15px | 600–700 | `--text` |
| Modal titles | 15px | 700 | `--text` |
| Card/table body | 12–13px | 400–500 | `--text` |
| Labels (`.flbl`) | 10px | 700 | `--text-3` |
| Table headers (`.tbl th`) | 10px | 700 | `--text-3` |
| Badges / small metadata | 10–11px | 500 | varies |
| KPI values | 26–32px | 600–700 | color-per-KPI |
| TV Dashboard KPIs | 44px | 800 | `#ffffff` |

- All labels (`flbl`) are **uppercase**, wide letter-spacing (`0.09em`).
- Table headers are **uppercase**, `letter-spacing: 0.09em`.
- Page titles have **tight letter-spacing** (`-0.02em` to `-0.03em`).
- Item codes use a **monospace stack** (`'SF Mono', 'Roboto Mono', monospace`).

---

## 4. Color Palette

### Core
| Token | Hex | Usage |
|---|---|---|
| Authority Blue | `#0056D2` | Primary buttons, active nav, focus rings, links |
| Hover Blue | `#0047b0` | Button hover |
| Active Blue | `#003d99` | Button pressed |
| Canvas | `#F8FAFC` | App background |
| White | `#FFFFFF` | Cards, inputs, modal backgrounds |
| Border | `#e2e8f0` | All borders (0.5px–1px) |

### Semantic Status Colors
| Status | Background | Text | Border/Accent |
|---|---|---|---|
| Success / Present | `#EAF5EE` | `#1A6B3A` | `#C6E8D0` / `#27AE60` |
| Warning | `#FDF4E7` | `#7A4A0A` | `#D4860A` |
| Danger / Error | `#FDEDF0` | `#8C1F2A` | `#F5C6CC` / `#C0392B` |
| Info | `#dbeafe` / `#eff6ff` | `#0056D2` | `#0056D2` |
| Purple (recount) | `#F0EDFE` | `#3D2FAA` | `#C5C0F5` |
| Gray / Neutral | `#F4F4F4` | `#555555` | — |

### Item / Data Status
| Meaning | Display |
|---|---|
| Active item | `#22c55e` pill (white text) |
| Dropped item | `#9ca3af` pill (white text) |
| Counted qty | `#1A6B3A` bold |
| Damaged qty | `#7A4A0A` bold |
| Expired qty | `#8C1F2A` bold |
| Null/uncounted qty | `--text-3` weight-300 |

### Sidebar (Dark Theme)
- Background: `linear-gradient(180deg, #1b3764 0%, #0f1c3a 60%, #0a1628 100%)`
- Logo gradient: `linear-gradient(135deg, #73caf1, #1b3764)`
- Active nav indicator: `#60a5fa` left-border + `rgba(96,165,250,0.08)` background
- Tagline / accent: `#60a5fa`

---

## 5. Layout Architecture

### App Shell
```
┌─────────────────────────────────────────────┐
│  .sidebar (210px, dark)  │  .main (flex:1)  │
│                          │  .topbar (52px)  │
│  Logo                    │  .content (scroll)│
│  Nav sections            │   Pages...       │
│  User avatar (bottom)    │                  │
└─────────────────────────────────────────────┘
```

- `min-height: 720px` on `.app`
- Sidebar: fixed width 210px, dark navy gradient, `z-index: 20`
- Top bar: `52px`, `backdrop-filter: blur(12px)`, `rgba(248,250,252,0.85)` — glassmorphism effect
- Content: `padding: 24px`, vertically scrollable, `overflow-y: auto`
- Pages: `display: none` by default; `.page.active { display: block }`

### Sidebar Navigation
- **Logo area:** 26×26px gradient icon + "MediCount" bold + "Everyone Counts" uppercase tagline
- **Section headers (`.nav-sec`):** 9px, 700, uppercase, `rgba(255,255,255,0.40)`, `letter-spacing: 0.14em`
- **Nav buttons (`.nav-btn`):** `min-height: 40px`, 12px, 500, `rgba(255,255,255,0.65)`, `border-left: 2px solid transparent`
  - Hover: `rgba(255,255,255,0.95)` + subtle white background
  - Active: white text, bold, `#60a5fa` left border, `rgba(96,165,250,0.08)` background
- **User footer:** Avatar (28px circle, gradient) + name (11px, 600, white) + "Sign out" link (10px, `rgba(115,202,241,0.6)`)
- **Icons:** 13×13px SVG outlines, `opacity: 0.65`, full opacity when active

### Top Bar
- Left: breadcrumb `.bc` — "Sessions" link in `--text-2`, `›` separator, current page name
- Right: `#topbar-right` — injected per-page action buttons
- Breadcrumb links are ghost buttons (no border, no bg, color on hover)

### Content Grid System
- Main content: 12-column spirit, gutters `24px`
- Cards in grids: `repeat(auto-fill, minmax(260px, 1fr))` for pair cards; `repeat(auto-fill, minmax(280px, 1fr))` for session home cards
- Dashboard KPIs: `grid-template-columns: 190px repeat(4, 1fr)` (ring + 4 metric cards)
- Dashboard tables: `1fr 1fr` 2-column grid
- Item Master toolbar: `display:flex; flex-wrap:wrap` with inline search + selects
- Form fields inside modals: `grid-template-columns: 1fr 1fr; gap: 12px`

---

## 6. Page-by-Page Breakdown

### 6.1 Sessions Page (`page-sessions`)
**Header row:** `display:flex; justify-content:space-between`
- Left: "Sessions" heading (15px, 600)
- Right: `+ New session` — `.btn.btn-primary.btn-sm`

**Sessions table (`.tbl`):**
- Wrapped in `.card` with `padding:0; overflow:hidden`
- Columns: Session, Type, Entity, Dates, Status, Progress, Created By, Actions
- Progress: inline `.prog-bar` (3px height, `--primary` fill)
- Status: colored `.badge` pills
- Actions: row-level ghost/sm buttons

### 6.2 Session Detail Page (`page-detail`)

**Session header (`.sess-hdr`):**
- White card, `padding: 20px 24px`, `box-shadow: var(--shadow-card)`
- Top row: session title (16px, 700) + session ID (11px, `--text-3`) + action buttons (`flex-shrink:0`)
- Metadata row (`.sess-meta-row`): label/value chips (`.meta-chip`) with 9px uppercase labels and 12px 600 values, `gap: 28px`
- Action buttons: positioned top-right, uses `.btn-success`, `.btn-danger`, standard `.btn`

**Sub-tab bar (`.stab-bar`):**
- Flat, borderless, bottom-border underline style
- `border-bottom: 1px solid --border`, negative margin trick for active underline
- Active tab: `--primary` color + `border-bottom-color: --primary`, 700 weight
- Inactive: `--text-3`, 500 weight
- Tabs: Pair Assignment, Attendance, Item Master, Dashboard, New Item Gallery, Audit Trail, Pending Approval

**Pending Approval badge:** Red pill `#e53e3e` with white text, shown inline in tab label.

### 6.3 Pair Assignment Tab
- Section header: "Pair Assignment" (14px, 500) + right-aligned buttons row
- Add pair form: inline `.card` expansion (hidden by default), 2-column grid for Counter/Checker
- Counter 2: optional field labeled with `(optional)` in 10px `#94a3b8`
- Pair grid (`.pair-grid`): `repeat(auto-fill, minmax(260px, 1fr))`, `gap: 14px`
- **Pair cards (`.pcard`):** white, 1px border, `padding: 16px 18px`, hover lifts `translateY(-1px)` + shadow
- **Avatars (`.av`):** 34px circle — `.av-n` (blue, normal), `.av-a` (red-tinted with border, absent)
- Absent names: strikethrough + `.abs-tag` red pill
- **Drawer:** slides in below, table of items assigned to pair, with search + filter

### 6.4 Item Master Tab
- Toolbar (inside card): search input + 3 select filters + bulk action buttons + Columns toggle
- **Column visibility toggle (`.col-toggle-wrap`):** dropdown menu with checkboxes, right-aligned, `border-radius: 8px`, shadow
- **Bulk action bar:** shown when items selected — "Drop selected", "Recover selected", "Assign" with pair select
- **Table (`.tbl`):** column drag-reorder via `cursor: grab`, compact mode reduces row padding
- **Item status:** `.is-active` green pill, `.is-drop` gray pill
- Pagination: `← Prev / Next →` buttons at card bottom

### 6.5 Attendance Tab
- **QR Code card:** centered, white padding, border, countdown timer for admin
- **Add Attendee card:** select + "＋ Add" primary-sm button
- **Attendance grid (`.att-grid`):** `repeat(auto-fill, minmax(160px, 1fr))`, `gap: 10px`
- **Attendance cards (`.att-card`):** white, 0.5px border, centered column layout
  - Avatar (`.att-av`): 42px circle, blue bg + primary color
  - Absent cards: `opacity: 0.4`, gray avatar
  - Status pill: `present` (green), `absent` (gray)
  - Time rows: label/value pairs with inline edit inputs (`78px`, `22px` height)

### 6.6 Dashboard Tab
- **KPI grid:** dark "space" card (ring), 4 metric cards (blue/green/amber/purple themed)
- **Progress ring card:** `background: linear-gradient(145deg, #1e2e3d, #2C3E50)`, SVG circle ring, green fill
- **KPI cards (`.db-kpi-card`):** icon tile (42px, `border-radius: 11px`) + uppercase label + large number
- **Breakdown tables:** 2-column grid, each card has a primary-colored header with icon
- **Breakdown rows:** clickable, hover highlight, with mini progress bar column
- **TV Dashboard button** (in session header): opens `#tv-overlay` fullscreen

### 6.7 Audit Trail Tab
- Section header with "↺ Refresh" button
- Optional info banner
- Table wrapped in `.card`, columns: Time, Item Code, Item Name, Submitted by, Count Qty, Damaged, Expired, Warehouse, Remark

### 6.8 Pending Approval Tab
- Same layout as Audit Trail
- Columns: Time, Item Code, Item Name, Submitted by, Old Qty, New Qty, Old Bin, New Bin, Action
- Action column: Approve / Reject inline buttons

### 6.9 Scan & Count Page (`page-count`)

**Session Selection (home view):**
- Page header: "Scan & Count" (20px, 700, `-0.03em` tracking) + subtitle (12px, `#94a3b8`)
- Session cards (`.ush-card`): white, `border-radius: 8px`, `padding: 20px 22px`
  - Hover: `translateY(-1px)` + blue-tinted border `#bfdbfe`
  - Name: 15px, 700; meta info: 11px, 500, `#94a3b8`

**Active Session Bar (`.cv-active-bar`):**
- White card, `border-radius: 8px`, `padding: 10px 14px`
- Green dot pulse indicator (7px, `#22c55e`)
- Session name + "Change Session" ghost link
- Warehouse filter dropdown: compact select, `height: 26px`, `background: #f1f5f9`

**Search Block:**
- Search input: `height: 50px`, `font-size: 14px`, `border-radius: 8px`
- Action row: Scan button (primary, `flex:1`) + secondary buttons (Layout, Multi-Scan, + New)
- Action buttons: `height: 36px` compact variants

**Result Gallery (`.cv-result-grid`):**
- `repeat(auto-fill, minmax(220px, 1fr))`, gap 10px
- Item cards (`.cv-item-card`): white, border, `border-radius: 8px`, `padding: 14px 16px`
  - Item code: monospace, blue, `background: rgba(0,86,210,0.07)`, `border-radius: 4px`
  - Batch tag: gray pill, same pattern
  - Name: 13px, 600; meta: 11px, `#94a3b8`
  - Counted indicator: 11px, `#16a34a`; uncounted: 11px, `#cbd5e1`

**Count Detail / Form:**
- Back button: borderless, slate text, arrow icon, bold, hover turns primary blue
- Item header card (`.cv-detail-header`): white, border, shadow — code (monospace blue uppercase) + name (17px, 700) + batch + meta chips
- Meta chips: 9px uppercase label + 13px 600 value
- Form card (`.cv-form-section`): white, border, `padding: 12px`
- Form layout: `grid-template-columns: 1fr 1fr; gap: 8px` (full-width items span both columns)
- **Bin combo input:** custom combobox — search input + chevron button + dropdown list (fixed positioned, `border-radius: 8px`, shadow)
- **Qty inputs (`.cv-qty-input`):** `height: 40px`, centered, `font-size: 16px`, 700, `color: #0056D2`, slate bg
- **Text field inputs (`.cv-field-input`):** `height: 38px`, `font-size: 13px`, slate bg
- **Photo button:** dashed border, icon + text, hover shows blue border
- **Save button (`.cv-save-btn`):** full-width, `height: 54px`, Authority Blue, 14px 700
- **Cancel button (`.cv-cancel-btn`):** full-width, `height: 44px`, ghost, `color: #94a3b8`

### 6.10 Count History Page (`page-history`)
- Title: 15px, 700, primary blue; subtitle: 12px, `--text-3`
- Session filter: `<select>` (max-width 300px)
- Loading/empty states: centered, `padding: 32px`, `--text-3`
- History items: grouped count records per session

### 6.11 SSO Login Overlay
- Background: `#0f172a` (solid dark) — full-screen takeover, `z-index: 10000`
- Card: white, `border-radius: 16px`, `padding: 36px 32px 28px`, `width: 360px`, heavy shadow
- Logo icon: 48px, `border-radius: 12px`, gradient
- App name: 18px, 700, `#1a202c`; tagline: 12px, `#718096`
- **Step 1 (email):** standard `.input` + full-width `.btn.btn-primary`
- **Step 2 (code):** info hint box (`background: #f0f9ff`, `border: 1px solid #bae6fd`, rounded), 6-digit OTP input (20px, centered, letter-spacing 0.2em), primary button (disabled until code submitted)
- "Use a different email" link: ghost button, `color: #718096`
- Error messages: `color: #e53e3e` inline under fields
- **Mobile:** slides up from bottom, full-width card, `border-radius: 20px 20px 0 0`

### 6.12 TV Presentation Dashboard (`#tv-overlay`)
- **Full-screen dark overlay:** `background: #0a1628`, `z-index: 9999`
- **Header:** 3-column grid — brand (30px, 800 white), session center, close button
- **Layout:** `grid-template-columns: 240px 1fr 460px; gap: 24px; padding: 16px 40px`
- **Left column:** Big progress ring (152px SVG) + QR code card (click to enlarge)
  - Ring card: `background: linear-gradient(145deg, #111e30, #1e3050)`, `border-radius: 18px`
  - Green ring fill: `#4ade80`; percentage: 38px, 800, white
  - QR card: semi-transparent, clickable to fullscreen modal
- **KPI tiles:** 4 tiles per row — blue, green, amber, purple tinted dark cards — 44px, 800, white numbers
- **Tables:** semi-transparent `rgba(255,255,255,0.04)` background, white text headers at 55% opacity
  - Sticky table headers: `background: #0f1f38`
  - Progress bars: white on dark backgrounds
- **Attendance column (right):** scrolling list of attendee avatar cards
- **QR fullscreen modal:** `background: #0a1628`, `border-radius: 24px`, `90vw × 90vh`

---

## 7. Components

### 7.1 Buttons

| Class | Style | Usage |
|---|---|---|
| `.btn` | White bg, `--border` border, 12px, `min-height: 34px`, `border-radius: 8px` | Default / secondary |
| `.btn.btn-sm` | Same but `min-height: 28px`, 11px, `padding: 4px 12px` | Compact actions |
| `.btn.btn-primary` | `#0056D2` bg, white text | Create, save, confirm |
| `.btn.btn-success` | Green-tinted (`#EAF5EE` bg, `#1A6B3A` text) | Approve, positive action |
| `.btn.btn-danger` | Red-tinted (`#FDEDF0` bg, `#8C1F2A` text) | Delete, end session |
| `.cv-btn-action-primary` | `height: 36px`, solid blue, full primary style | Scan button in count view |
| `.cv-btn-action-secondary` | `height: 36px`, `background: #f1f5f9` | Layout, Multi-Scan |
| `.cv-save-btn` | Full-width, `height: 54px`, blue, 14px 700 | Save count form |
| `.cv-cancel-btn` | Full-width, `height: 44px`, ghost gray | Cancel count form |

**Button placement rules:**
- Page-level primary action: **top-right** of content area header row
- Modal footer: Primary left (`flex:1`), Cancel right — both in `display:flex; gap:8px`
- Destructive modals: Danger button left, Cancel right
- Form section: save/cancel stacked full-width below form fields

**Disabled state:** `opacity: 0.35; cursor: not-allowed`

### 7.2 Badges / Pills

```css
.badge { font-size: 10px; font-weight: 500; padding: 2px 9px; border-radius: 999px; }
```

| Class | Color | Usage |
|---|---|---|
| `.b-success` | Green tint | Active session, present status |
| `.b-warn` | Amber tint | In-progress, warning |
| `.b-danger` | Red tint | Error, absent |
| `.b-info` | Blue tint (`#dbeafe`) | Info, selected |
| `.b-gray` | `#F4F4F4` | Neutral/inactive |
| `.b-purple` | `#F0EDFE` | Recount type |

Role badges (`.role-badge`): `border-radius: 3px` (not pill) — admin = amber, user = blue.

### 7.3 Cards

```css
.card {
  background: var(--bg-card);
  border: 0.5px solid var(--border);
  border-radius: 8px;
  padding: 20px 24px;
  box-shadow: var(--shadow-card);
}
```

- **Zero-padding tables:** `.card` with `padding:0; overflow:hidden` — border and radius contain table
- **Hoverable cards:** add `transition: box-shadow 0.15s, transform 0.15s` + hover lift `translateY(-1px)`
- **KPI stat boxes (`.stat-box`):** same as card but `padding: 18px 20px`

### 7.4 Modals

**Structure:**
```html
<div class="overlay">          <!-- fixed, full-screen backdrop, blur(4px), rgba(26,26,26,0.40) -->
  <div class="modal">          <!-- white card, max-width 500px, max-height 82vh, padding 28px -->
    <div> <!-- header: flex, space-between -->
      <div>
        <div class="modal-title">Title</div>
        <div class="modal-sub">Subtitle</div>
      </div>
      <button class="btn btn-sm">✕</button>   <!-- always top-right -->
    </div>
    <!-- form content -->
    <div style="display:flex;gap:8px;"> <!-- footer -->
      <button class="btn btn-primary" style="flex:1;">Confirm</button>
      <button class="btn">Cancel</button>
    </div>
  </div>
</div>
```

- `modal-title`: 15px, 700, `--text`, `-0.01em` tracking
- `modal-sub`: 12px, 500, `--text-3`
- Close button (`✕`): always `.btn.btn-sm` top-right, `flex-shrink:0`
- `max-width` varies: 340px (small), 420–520px (standard), 640px (photo), 90vw (drilldown)
- Large modals use `display:flex; flex-direction:column` with scrollable body `flex:1; overflow-y:auto`

**Destructive confirmation modal pattern:**
- Red icon tile (36×36px, `#fef2f2`, `border-radius: 8px`) + red modal title
- Warning box: `background: #fff5f5; border: 1px solid #fed7d7`, red text
- Typed confirmation input required before delete button enables

### 7.5 Forms & Inputs

| Element | Style |
|---|---|
| `.input`, `.select` | `width:100%; padding: 8px 12px; min-height: 36px; border: 1px solid --border; border-radius: 8px; font-size: 12px; font-weight: 500` |
| Focus state | `border-color: --primary; box-shadow: 0 0 0 3px rgba(0,86,210,0.10)` |
| Error state | `.err` class → `border-color: #C0392B` |
| `.flbl` | Field label: 10px, 700, uppercase, `--text-3`, `letter-spacing: 0.09em` |
| `.flbl.req::after` | Appends ` *` in `#C0392B` |
| `.ferr` | Error message: 11px, `#C0392B`, shown when invalid |
| `.cv-qty-input` | Qty fields: `height:40px; font-size:16px; font-weight:700; color:#0056D2; text-align:center; background:#f8fafc` |
| `.cv-field-input` | Text fields: `height:38px; font-size:13px; background:#f8fafc` |
| `.cv-textarea` | Remark area: `min-height:52px; font-size:13px; background:#f8fafc; resize:vertical` |

**Grid layout for forms:**
```css
display: grid;
grid-template-columns: 1fr 1fr;
gap: 12px;
margin-bottom: 12px;
```
Full-width fields: `grid-column: 1 / -1`.

### 7.6 Dropdowns / Selects

- Native `<select>` with `.select` class (same styling as `.input`)
- Inline compact variant (toolbar): `style="width:auto;"` — auto-width
- Warehouse inline select in count bar: `.cv-wh-inline-sel` — `height: 26px`, no border, `background: #f1f5f9`
- **Bin combo (`.cv-combo-wrap`):** custom searchable combobox — slate bg, blue focus ring, chevron button with left-border separator. Dropdown: `position:fixed; z-index:300; border-radius:8px; box-shadow: 0 8px 24px rgba(0,0,0,0.08); max-height:200px`

### 7.7 Tables

```css
.tbl { width: 100%; border-collapse: collapse; font-size: 12px; }
.tbl th { font-size: 10px; font-weight: 700; color: --text-3; text-transform: uppercase; letter-spacing: 0.09em; background: #f8fafc; padding: 10px 12px; }
.tbl td { padding: 10px 12px; border-bottom: 1px solid --border; vertical-align: middle; }
.tbl tr:hover td { background: #f8fafc; }
.tbl-compact th, .tbl-compact td { padding: 5px 8px; /* td also font-size: 11px */ }
```

- Always wrapped in `.card` with `padding:0; overflow:hidden`
- Drag-to-reorder columns: `cursor: grab` on `th[data-colkey]`, drag-over highlight with dashed blue outline
- Horizontal overflow: wraps table in `<div style="overflow-x:auto">`

### 7.8 Banners / Alerts

```css
.banner { border-radius: 8px; padding: 10px 14px; font-size: 12px; margin-bottom: 12px; }
```

| Class | Style | Usage |
|---|---|---|
| `.bn-info` | Blue bg `#eff6ff`, `border-left: 2px solid --primary` | Informational messages |
| `.bn-warn` | Amber bg `#FDF4E7`, amber left border | Warnings |
| `.bn-danger` | Red bg `#FDEDF0`, red left border | Errors / critical |
| `.bn-success` | Green bg `#EAF5EE`, green left border | Success messages |
| `.bn-purple` | Purple bg `#F0EDFE`, purple left border | Recount-specific info |

### 7.9 Toast Notifications

- `#item-toast`: `position:fixed; bottom:88px; left:50%; transform:translateX(-50%)`
- `border-radius: 999px` pill shape, bold
- `.t-success` = `#22c55e` bg; `.t-warn` = `#f59e0b` bg; `.t-error` = `#ef4444` bg
- Enter animation: `toastIn` — slides up + fades in (0.18s)

### 7.10 Date Picker (Custom Cal.com Style)

- **Trigger (`.cal-pick-trigger`):** flex row, calendar icon right-aligned, 0.5px border, hover → primary border
- **Popup (`.cal-popup`):** `position:fixed; z-index:9999` — escapes modal overflow. `width:288px; border-radius:12px; padding:16px`
- Enter animation: `calIn` (scale + fade, 0.13s)
- Nav buttons: 36×36px, `border-radius:8px`, border
- Day grid: `7 × 36px` columns
- Selected day: `--primary` background, white text, `border-radius: 8px`
- Today indicator: 3px dot below day number

### 7.11 Progress Bars

```css
.prog-bar { height: 3px; background: --border; border-radius: 99px; flex: 1; }
.prog-fill { height: 100%; border-radius: 99px; background: --primary; transition: width 0.3s; }
```

Used inline in session table rows and dashboard breakdown tables.

### 7.12 Avatars

| Class | Size | Style | Usage |
|---|---|---|---|
| `.av.av-n` | 34px circle | `#dbeafe` bg, primary text | Normal user |
| `.av.av-a` | 34px circle | `#FDEDF0` bg, red border + text | Absent user |
| `.att-av` | 42px circle | `#dbeafe` bg, primary text | Attendance cards |
| Sidebar avatar | 28px circle | Gradient bg, white text, 10px | Signed-in user |

### 7.13 Pair Cards (`.pcard`)

- `border-radius: 8px`, `padding: 16px 18px`, `cursor: pointer`
- Hover: `translateY(-1px)` + Authority Blue shadow `rgba(0,86,210,0.10)`
- Avatar row + name row + progress bar row

### 7.14 Drawer

- Slides in below pair grid, contained in page flow (not floating)
- Header: `background: #f8fafc`, title + subtitle + close button
- Search + filter bar below header
- Contains a `.tbl` with item data

### 7.15 Recount Box (`.rc-box`)

- `background: #F0EDFE; border: 0.5px solid #C5C0F5; border-radius: 8px; padding: 16px`
- Title: 12px, 600, `#3D2FAA`
- Sub: 11px, 300, `#5E56C0`
- Used for recount session parent-linking UI

### 7.16 Column Toggle Menu

- Trigger (`.col-toggle-btn`): inline flex, `border-radius: 6px`, 0.5px border, 11px
- Menu (`.col-toggle-menu`): `position:absolute; right:0; border-radius:8px; min-width:190px; z-index:400`
- Items: flex row, checkbox with `accent-color: --primary`, 12px, hover slate bg

### 7.17 Loading Spinner (Import)

- Full-screen overlay with centered white card (`border-radius: 14px; padding: 32px 40px`)
- 52px SVG spinner with dual-ring (gray track + primary animated arc), CSS `spin` animation
- Title 15px 700, message 12px `--text-2`, note 11px `--text-3`

### 7.18 Scanner View

- Black background container (`border-radius: 10px`), `<video>` fills width
- Close button: `position:absolute; top:10px; right:10px; background:rgba(0,0,0,0.55)`, white text, `border-radius: 6px`

### 7.19 Multi-Scan View

- Counter badge: `background: #0056D2; border-radius: 8px; padding: 20px 24px`
  - Large number: 48px, 800, white
  - Label: 14px, 600, white; sub-label: 11px, `rgba(255,255,255,0.65)`
- Scan log header: 10px uppercase, `--text-3`
- Scan log entries: flex column, gap 6px

### 7.20 Photo Components

- **Upload button (`.cv-photo-btn`):** `border: 1.5px dashed #e2e8f0`, hover → blue border + bg
- **Preview thumbnails (`.photo-thumb`):** 72×72px, `object-fit:cover`, `border-radius:6px`
- **Gallery modal grid (`.photo-gallery-grid`):** `repeat(auto-fill, minmax(160px, 1fr))`, 4:3 aspect ratio images

---

## 8. Mobile Design (`max-width: 768px`)

### Navigation
- **Sidebar hides** completely
- **Bottom nav bar (`.mobile-nav`):** fixed, `height: 60px`, glassmorphism — `rgba(248,250,252,0.90)` + `backdrop-filter: blur(18px)`, border-top
- **Nav buttons (`.mnav-btn`):** `min-height: 48px` (touch target), icon above label, `font-size: 10px`
  - Active: primary blue color
  - 4 tabs: Layout, Sessions (admin only), Scan & Count, History

### Content Adjustments
- Content padding: `16px 16px 72px` (extra bottom for nav)
- Topbar: **hidden** on mobile
- Form grids: collapse to single column `grid-template-columns: 1fr`
- Button `min-height`: `44px` (standard), `36px` (sm) — touch-friendly
- Dashboard KPIs: 2-column grid (from 5)
- Dashboard tables: stacked single column
- Sub-tab bar: horizontally scrollable, no wrap, hidden scrollbar

### Floating Action Buttons (mobile scan)
- `#fab-row`: `position:fixed; bottom:72px; left:16px; right:16px; z-index:200`
- **Scan FAB:** `border-radius:999px; height:~54px; background:#0056D2` with blue glow shadow
- **New Item FAB:** same height, white bg + blue border + blue text
- Desktop: `display:none !important`

### Session Selection
- `.ush-grid` collapses to `1fr` (single column)

### Login Overlay
- Slides up from bottom as a sheet
- Card: `border-radius: 20px 20px 0 0; padding: 32px 24px 36px; width:100%`

### Active Bar & Search
- `.cv-active-bar`: stacks vertically on mobile
- `.cv-wh-group .cv-wh-inline-sel`: full-width on mobile
- Inline Scan/MultiScan/+New/Layout buttons: hidden (FABs and bottom nav replace them)

---

## 9. Interaction Patterns

### Transitions
- All transitions: `0.12s–0.15s` — fast and snappy
- Button hover: `background 0.12s`
- Card hover: `box-shadow 0.15s, transform 0.15s`
- Input focus: `border-color 0.15s, box-shadow 0.15s`
- Nav active: `color 0.12s, background 0.12s`

### Active States
- Buttons scale: `transform: scale(0.99)` on `:active`
- Progress ring: `transition: stroke-dasharray 0.7s cubic-bezier(0.4,0,0.2,1)`

### Hover Lift Pattern
```css
:hover { box-shadow: 0 4px 20px rgba(0,86,210,0.10); transform: translateY(-1px); }
```
Used on: pair cards, session home cards, item result cards, layout image cards.

### Disabled State
```css
:disabled { opacity: 0.35; cursor: not-allowed; }
```

### Focus Ring (Authority Blue)
```css
:focus { border-color: #0056D2; box-shadow: 0 0 0 3px rgba(0,86,210,0.10); }
```
Applied consistently on all inputs, selects, and custom combos.

---

## 10. Iconography

- All icons: **SVG outlines only** — no filled icons except status dots and certain UI elements
- Standard size: **13×13px** in nav and table contexts, **15×15px** for medium contexts, **17–20×20px** for larger UI elements
- Stroke width: `1.3–1.5` (fine, precise), `2.0–2.2` (medium for KPI icons)
- Color: inherits `currentColor` — adjusts with parent text color
- No icon libraries — all SVGs are inline paths

---

## 11. Animation Keyframes

```css
@keyframes spin     { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes toastIn  { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
@keyframes calIn    { from { opacity:0; transform:translateY(-6px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } }
```

---

## 12. Z-Index Stack

| Layer | z-index | Element |
|---|---|---|
| Base | 0 | Content, cards |
| Sidebar | 20 | `.sidebar` |
| Topbar | 10 | `.topbar` |
| Dropdowns | 300–400 | Bin combo, column toggle |
| Drawer | inline | In-page, no z-index needed |
| Mobile nav | 100 | `.mobile-nav` |
| FABs | 200 | `#fab-row` |
| Modals | 1000 | `.overlay` |
| Toast | 10000 | `#item-toast` |
| TV Dashboard | 9999 | `#tv-overlay` |
| TV QR Modal | 10000 | nested in TV overlay |
| Login overlay | 10000 | `#sso-overlay` |
| Date picker | 9999 | `.cal-popup` (fixed) |

---

## 13. Do's and Don'ts

**Do:**
- Use `--primary` (#0056D2) only for CTAs, active states, and interactive elements
- Use `8px` border-radius universally (32px only for SSO mobile sheet)
- Use `0.5px` borders for cards/drawers; `1px` for inputs and modals
- Keep button text concise — action verbs only (Create, Save, Import, Approve)
- Label ALL form fields with `.flbl` — never use placeholder as the only label
- Use semantic banner colors with left-border accent (not just background color)
- Keep table header text uppercase + wide tracking
- Use the `✕` character (not ×) for close buttons

**Don't:**
- Don't use gradients except in: sidebar, logo icon, TV dashboard progress cards
- Don't use pill-shaped buttons (999px radius) — use 8px. Pills are for status badges and toast only
- Don't add borders to `.card` that compete with the subtle shadow
- Don't use color alone to convey status — always pair with a text label
- Don't skip the focus ring on interactive elements
- Don't use font-size above 20px in the main app (TV Dashboard is the exception)
- Don't add horizontal scroll to main layout — use compact patterns or column toggle
