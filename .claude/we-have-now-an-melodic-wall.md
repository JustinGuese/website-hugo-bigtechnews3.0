# Plan: App download CTAs + mobile app banner + "midnight" homepage redesign

## Context
BriefTechNews now has an iOS and an Android app. The Hugo homepage doesn't mention them, and its look (cream + Lora serif + copper, 25%-wide fixed hero rail) is generic and too narrow to carry prominent store buttons. Goal: make the app the primary homepage CTA (hero badges, mobile top banner, a dedicated app section, footer) and redesign the homepage to look modern and distinctive. All of it goes live by default (no flags or dry-run).

Decisions already made with the user: **dark "midnight + neon beats" direction**, **full-width hero on top**, **phone mockup built from the real app screenshots** in `../flutter-bigtechnews-swiper-app/screenshots/` (1179x2556 PNGs).

Findings that shape the work
- Site: Hugo 0.152.2 extended, theme `editor-hugo` (vendored, committed; Bootstrap 4 + jQuery + SCSS). Homepage = `themes/editor-hugo/layouts/index.html`; root `layouts/` overrides the theme. Ignore the theme's AGENTS.md (it describes a different theme: Tailwind, `_partials/`).
- SCSS vars come only from `hugo.toml [params.variables]`, injected in `themes/editor-hugo/assets/scss/style.scss`. `custom.scss` is imported last. There are no CSS custom properties on the main site (only the standalone `layouts/_default/brief.html`, which has a dark `--ink/--surface/--beat-*` precedent, beat hues: founders 15, crypto 41, devops 66, fintech 118, tech 221, it 246, ai 272).
- Fixed mobile header is 80px at z-index 1000; cookie bar is fixed bottom at z 9999; exit modal z 1080. Only EN + DE are enabled (fr.yaml is dead).
- The app itself is near-black with an **amber/gold accent** (screenshots), the cover art is navy/violet with neon. The palette bridges both: ink-violet neutrals, amber as the one signal colour, beat hues for category colour-coding.
- App Store page facts to reuse (no invented claims): "Swipe today's AI & tech news", free, no account needed, ~5 min, topic filters, read-later, daily reminder, optional Pro (ad-free + AI news analyst grounded in real articles). No rating shown yet, so no rating/review claims.

## Brief (awwwards pipeline, Hugo-adapted)
- Register: brand (marketing homepage). Audience: engineers/founders skimming tech news, ~majority on mobile.
- Aesthetic: dark midnight, grain + soft glow, one neon accent per beat. The unforgettable element: a tilting phone whose screen auto-cycles the real app screens (briefing, AI chat, read later) with floating beat chips.
- Motion lens: **Polish** (choreographed, restrained). CSS-first + ~40 lines of vanilla JS, honouring `prefers-reduced-motion`. No React/Three.js: it is a static Hugo site, so the skill's single-HTML/React branch doesn't apply.
- Palette (OKLCH tokens as `:root` CSS vars in the new SCSS partial; no pure black/white): `--bg oklch(.16 .03 285)`, `--surface oklch(.20 .035 285)`, `--line` low-chroma, `--ink oklch(.94 .01 285)`, `--muted`, `--accent` amber `oklch(.80 .15 85)` (used as signal, not fill), `--beat-*` hues from brief.html.
- Type: display **Bricolage Grotesque** (600/800), body **Instrument Sans**, mono **Geist Mono**/JetBrains Mono for eyebrows, dates, tags. Loaded via the existing webfontloader list in `themes/editor-hugo/layouts/partials/script.html` (+ `params.variables` font names).

## Implementation

1. **Config** – `hugo.toml`: add
   ```toml
   [params.app]
   name = "BriefTechNews"
   ios_url = "https://apps.apple.com/app/id6827598786"        # storefront-neutral (user's link had /do/)
   android_url = "https://play.google.com/store/apps/details?id=com.brieftechnews.app"
   banner_dismiss_days = 14
   ```
   Update `[params.variables]` colours/fonts to the new palette so legacy theme pages (post pages etc.) don't clash. Badges append a per-placement attribution (`referrer=utm_source%3Dweb%26utm_medium%3D<hero|banner|section|footer>` on Play; `?pt`-free on iOS).

2. **New partials** (root `layouts/partials/`)
   - `app-badges.html` – one source of truth for the two store buttons (dict arg: `placement`, `size`). Dark badge-style buttons with Apple/Google glyph SVGs and "Download on the App Store" / "Get it on Google Play" text, i18n'd alt/aria text, ≥44px touch target, visible focus ring.
   - `app-banner.html` – the mobile top banner: app icon (from `static/images/`), "BriefTechNews app / Swipe today's tech news, free", an **Open/Get** button, dismiss ×. Shown only at ≤767px via CSS; JS picks the store by UA (iOS → App Store, Android → Play, other mobile → both), hides it if dismissed (localStorage, 14 days, using the existing `remember/recall` helpers). Placed before `header.html` in `layouts/_default/baseof.html`; when visible it sets `--app-banner-h` so the fixed 80px header and the page offset shift down (no overlap with the cookie bar, which is at the bottom).
   - `app-phone.html` – CSS device frame with 3 stacked screens that cross-fade/slide every ~3.5s, subtle pointer-tilt, 2–3 floating beat chips.
   - `app-section.html` – "Swipe it. Ask it. Save it." three-column feature block with 3 screenshots + badges again.

3. **Homepage** – new root `layouts/index.html` overriding the theme's (keeps pagination block and `Render "article"` unchanged): full-width hero (eyebrow with latest-issue date, big H1, subhead, **store badges as primary CTA**, trust line "Free · no account needed · …", phone mockup right) → secondary "Prefer email?" panel reusing `subscribe-form.html` (id `hero`, unchanged JS/consent/beats logic) → neon beat-chip strip/marquee from `data/categories.yaml` → post grid → app section → footer (store badges + RSS-by-beat + social moved out of the old rail). `baseof.html` home wrapper adjusted so the hero spans full width.

4. **Styling** – new `themes/editor-hugo/assets/scss/_midnight.scss`, imported last from `style.scss`: tokens, dark body/surface, hero, badges, banner, phone, chips, cards (cover image lift on hover, beat-coloured tag, mono date), pagination, rail/sidenav, cookie bar, exit-intent modal, subscribe form restyle, grain overlay. Keep `custom.scss` selectors working (they are overridden, not deleted). Real focus rings, contrast ≥ AA, reduced-motion fallbacks.

5. **Assets** – resize the 4 best screenshots (briefing x2 states, AI chat, read later) from `../flutter-bigtechnews-swiper-app/screenshots/1179x2556/` to ~540px-wide WebP into `static/images/app/` (mechanical, can be delegated to a haiku subagent). App icon: look for it in the Flutter app's `assets/`/`ios/Runner` icons; fall back to `logo-transparent-square.png`.

6. **JS** – add `appBanner()` to `themes/editor-hugo/assets/js/script.js` next to `newsletterModal()` (same dismiss pattern/keys style), plus phone-cycle + tilt (skipped under reduced motion).

7. **i18n** – add `app_*` / new hero keys (EN + DE) to `i18n/en.yaml`, `i18n/de.yaml` (de is enabled; fr skipped).

## Verification
- `hugo --minify` (extended; check dart-sass/toCSS handles the `oklch()` tokens), then `hugo server`.
- Chrome DevTools MCP: screenshots at 390 / 768 / 1440 / 1920 for EN and `/de/`; emulate iPhone UA and Android UA to confirm the banner shows the right button, dismiss persists, header offset is right, and nothing collides with the cookie bar or exit-intent modal; desktop confirms the banner is hidden.
- Keyboard tab-through (badges, banner ×, chips, form), hover states, reduced-motion emulation, Lighthouse (a11y/perf/LCP: screenshots lazy-loaded except the hero phone, explicit width/height).
- Check both store links resolve to the right listings (HTTP 200), newsletter signup form still submits (UI path), post pages/other templates still render legibly on the new palette.
- Report anything I couldn't verify (e.g. real iOS/Android devices, final copy). Not committing or pushing without the user's go; a push to main deploys via GitHub Pages.
