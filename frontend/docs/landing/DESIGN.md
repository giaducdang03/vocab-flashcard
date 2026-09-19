---
name: Editorial Focus
colors:
  surface: '#fef9ee'
  surface-dim: '#dedacf'
  surface-bright: '#fef9ee'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f8f3e8'
  surface-container: '#f2eee2'
  surface-container-high: '#ece8dd'
  surface-container-highest: '#e6e2d7'
  on-surface: '#1d1c15'
  on-surface-variant: '#5c4038'
  inverse-surface: '#323129'
  inverse-on-surface: '#f5f0e5'
  outline: '#907066'
  outline-variant: '#e5beb2'
  surface-tint: '#ac3400'
  primary: '#a83300'
  on-primary: '#ffffff'
  primary-container: '#d24200'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb59d'
  secondary: '#006c4c'
  on-secondary: '#ffffff'
  secondary-container: '#91f3c7'
  on-secondary-container: '#007150'
  tertiary: '#5e5c56'
  on-tertiary: '#ffffff'
  tertiary-container: '#77746e'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbd0'
  primary-fixed-dim: '#ffb59d'
  on-primary-fixed: '#390b00'
  on-primary-fixed-variant: '#832600'
  secondary-fixed: '#94f6ca'
  secondary-fixed-dim: '#78d9af'
  on-secondary-fixed: '#002115'
  on-secondary-fixed-variant: '#005139'
  tertiary-fixed: '#e6e2da'
  tertiary-fixed-dim: '#cac6be'
  on-tertiary-fixed: '#1d1c17'
  on-tertiary-fixed-variant: '#484741'
  background: '#fef9ee'
  on-background: '#1d1c15'
  surface-variant: '#e6e2d7'
  canvas: '#f7f7f4'
  canvas-soft: '#fafaf7'
  surface-card: '#ffffff'
  hairline: '#e6e5e0'
  hairline-soft: '#efeee8'
  hairline-strong: '#cfcdc4'
  ink: '#26251e'
  body: '#5a5852'
  muted: '#807d72'
  muted-soft: '#a09c92'
  primary-active: '#d04200'
  learned-surface: '#ebf6f1'
  semantic-error: '#cf2d56'
typography:
  display-hero:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '400'
    lineHeight: 54px
    letterSpacing: -0.03em
  display-hero-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '400'
    lineHeight: 30px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '500'
    lineHeight: 28px
    letterSpacing: -0.01em
  title-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  title-sm:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  caption-uppercase:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.08em
  code-phonetic:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  button:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.25rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system embodies an editorial, distraction-free atmosphere created for rigorous language acquisition and deep study. Drawing visual cues from modern intellectual tools such as Claude.ai and Cursor, the aesthetic combines the tactile calmness of broadsheet print with the precision of high-performance developer tools.

### Emotional Tone
- **Calm & Contemplative:** Warm cream foundations eliminate glare and optical fatigue during prolonged study sessions.
- **Editorial Precision:** Typographic clarity, disciplined hierarchy, and generous negative space evoke a premium book or scholarly journal.
- **Frictionless Utility:** High-voltage warm orange accents are applied sparingly to punctuate clear next actions, while emerald accents reward retention and mastery.

### Design Movement
The interface lives at the intersection of **Minimalism** and **Tactile Editorial**. Rather than leaning on drop shadows or complex blur effects, depth and structure are established strictly through paper-like surface layering and ultra-delicate hairlines.

## Colors

The color palette establishes a tranquil, warm paper workspace (`canvas`: `#f7f7f4`) punctuated by deep charcoal ink (`ink`: `#26251e`) for maximum legibility without the harshness of pure black-on-white.

### Application Rules
- **The Single Voltage Rule:** Brand warm orange (`#f54e00`) is strictly reserved for primary forward progress (e.g., "Add Session", "Add Card", "Next", active progress indicators). It must never be applied to incidental UI surfaces or passive icons.
- **Mastery Semantics:** Emerald green (`#1f8a65`) paired with a muted mint surface (`#ebf6f1`) denotes retained knowledge, successful reviews, and mastery tags.
- **Surfaces and Borders:** Depth is generated through `#ffffff` cards sitting on the `#f7f7f4` canvas, bounded by crisp `1px` hairlines (`#e6e5e0`).
- **Typography Shades:** Primary headers use `#26251e`, secondary body copy uses `#5a5852`, and metadata/microcopy utilizes `#807d72`.

## Typography

Typography delivers an intentional bookish cadence using a dual-font pairing: **Inter** handles clear editorial narrative and clean UI labels, while **JetBrains Mono** renders technical data, phonetic transcriptions (IPA notation), and shortcuts.

### Editorial Hierarchies
- **Light Large Headings:** Hero and display headings feature light weights (400) with slight negative tracking to capture the feel of a fine modern periodical.
- **Micro Eyebrows:** Section labels, stat headers, and overline indicators always employ `caption-uppercase` (11px, weight 600, `text-transform: uppercase`, letter-spacing `0.08em`) in `#807d72`.
- **Phonetics & Metadata:** All pronunciation brackets (`/maɪˈɡreɪʃən/`), keyboard instructions, and index counters (`1 / 46`) are anchored in monospace for mechanical precision.

## Layout & Spacing

Layouts follow a modular grid calibrated around a standard 4px baseline rhythm, emphasizing unhurried whitespace and structured alignment.

### Grid & Canvas Structure
- **Max Application Width:** Constrained to `1120px` for focused dashboard views and `800px` for the core distraction-free study flashcard arena.
- **Desktop (1024px+):** 12-column fluid grid, `2rem` outer margins, `1.25rem` gutters. Metric cards span 3 columns each (4 across).
- **Tablet (640px–1023px):** 6-column fluid grid, `1.5rem` margins. Metric cards arrange 2x2.
- **Mobile (<640px):** Single-column stack, `1rem` outer canvas padding, `0.75rem` vertical rhythm between card elements.

## Elevation & Depth

This design system dismisses synthetic drop shadows, skeuomorphic gradients, and heavy drop elevation. Visual depth is strictly atmospheric and tectonic.

### Depth Hierarchy
1. **Canvas Layer (Base):** The foundation is the warm cream ground (`#f7f7f4`).
2. **Surface Layer (Cards & Panels):** Interactive content units use pure white (`#ffffff`) or subdued tinted fills bounded by a crisp 1px `#e6e5e0` hairline border.
3. **Ghost Inset (Internal Well):** Secondary panes, such as search fields or inactive toggle backgrounds, adopt `#fafaf7` or `#efeee8` with an inset hairline.
4. **Active/Overlay Layer:** Modal overlays use a subtle translucent wash (`rgba(38, 37, 30, 0.2)`) with direct, unblurred hairline-bordered white dialogue sheets.

## Shapes

The geometric logic uses deliberate differences in border radius to distinguish functional controls from structural enclosures.

### Geometry Rules
- **Interactive Controls (Buttons, Inputs, Selectors):** `8px` (`rounded-md`). Sharp enough to convey functional utility while maintaining warmth.
- **Content Cards & Main Study Views:** `16px` (`rounded-xl`) to `20px`. Generously rounded enclosures that produce soft paper card planes.
- **Status Pills & Tags:** `9999px` (`full-round`). Badges, study status indicators ("Learned"), and segment filter pills use complete capsule geometry.

## Components

### Buttons
- **Primary CTA:** Background `#f54e00`, label text `#ffffff` (`button` typography, 14px weight 500), border-radius `8px`, height `40px`, padding `10px 18px`. Active state transitions to `#d04200`. No drop shadows.
- **Secondary / Ghost:** Background `#ffffff`, border `1px solid #cfcdc4`, text color `#26251e`, padding `9px 17px`. On hover, surface shifts to `#fafaf7`.
- **Text Action:** Borderless, zero-padding text button in `#5a5852` with smooth hover transition to `#26251e`.

### Flashcard Stage (Core Component)
- **Container:** Pure `#ffffff` or light cream `#fafaf7` background, `1px solid #e6e5e0`, border-radius `20px`, minimum height `440px`.
- **Vocabulary Presentation:** Center-aligned prominent word rendered at `headline-lg` (32px), with the phonetic transcription set underneath in `code-phonetic` (`#807d72`).
- **Inline Flip Trigger:** Top-right pill button with label "Flip", border-radius `8px`, border `1px solid #e6e5e0`.
- **Navigation Controls:** Docked below the stage card with back/next chevron triggers and a centered monospace counter (`1 of 46`).

### Badges & Status Pills
- **Learned / Mastered:** Capsule pill (`padding: 4px 10px`), background `#ebf6f1`, border `1px solid #c3e2d5`, text `#1f8a65`, accompanied by a checkmark icon.
- **Category / Part of Speech:** Solid dark capsule (`#26251e`), white uppercase text (`caption-uppercase`), height `22px`.
- **Synonym / Related Tag:** Background `#ffffff`, border `1px solid #e6e5e0`, text `#5a5852` in `12px` typography.

### Progress Bars
- **Track:** Height `6px`, background `#efeee8`, border-radius `9999px`.
- **Fill:** High-voltage orange `#f54e00` for active session tracking; emerald `#1f8a65` when representing complete mastery.

### Form Inputs & Search Fields
- **Container:** Pure white background, `1px solid #cfcdc4` border, border-radius `8px`, height `42px`, padding `0 14px`.
- **Focus State:** Border changes to `#26251e` with a delicate `0 0 0 1px #26251e` outline ring. No colored glow.