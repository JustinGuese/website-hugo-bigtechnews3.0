# PLAN.md (gembuild batches): App CTAs + mobile app banner + "midnight" homepage redesign

Source plan: `.claude/we-have-now-an-melodic-wall.md` (dark midnight + neon beats, full-width hero, phone mockup from real app screenshots). Everything ships live by default, no flags. Hugo site: no pytest applies, so acceptance = `hugo --minify` builds clean plus the checks listed per step. Ignore `themes/editor-hugo/AGENTS.md` (wrong theme).

## Batch 0: shared contracts (sequential, run first; 3 steps in parallel, disjoint files)

**Contract** (every later step relies on these exact names):
- Params: `site.Params.app.{name,ios_url,android_url,banner_dismiss_days}`.
- Partials (root `layouts/partials/`): `app-badges.html` (dict: `placement` = hero|banner|section|footer, `size` = lg|md), `app-banner.html`, `app-phone.html`, `app-section.html`.
- i18n ids: `app_eyebrow, hero_h1, hero_sub, hero_trust, app_ios_label, app_android_label, app_ios_top, app_android_top, app_banner_title, app_banner_sub, app_banner_cta, app_banner_close, app_section_title, app_feat_swipe_t, app_feat_swipe_d, app_feat_ai_t, app_feat_ai_d, app_feat_save_t, app_feat_save_d, email_panel_title, email_panel_sub`.
- CSS custom props (defined in `_midnight.scss`): `--bg --surface --surface-2 --line --ink --muted --accent --accent-ink --beat-ai --beat-crypto --beat-devops --beat-fintech --beat-founders --beat-it --beat-tech --app-banner-h --font-display --font-body --font-mono`.
- DOM/class names: `.app-banner[hidden]`, `.app-banner-close`, `.store-badge`, `.store-badge--ios`, `.store-badge--android`, `.hero-app`, `.hero-app-copy`, `.hero-app-visual`, `.phone`, `.phone-screen`, `.phone-chip`, `.beat-strip`, `.app-section`, `.email-panel`, `html.has-app-banner`, `.site-footer-app`. JS hooks: `data-app-banner`, `data-ios-url`, `data-android-url`, `data-dismiss-days`, `data-phone`.
- Screenshot files: `static/images/app/screen-briefing.webp`, `screen-briefing-2.webp`, `screen-chat.webp`, `screen-readlater.webp`, `app-icon.png`.

### Step 0A: config + i18n
Files: `hugo.toml`, `i18n/en.yaml`, `i18n/de.yaml`.
- Add `[params.app]` (iOS `https://apps.apple.com/app/id6827598786`, Android `https://play.google.com/store/apps/details?id=com.brieftechnews.app`, `banner_dismiss_days = 14`). Update `[params.variables]` palette/fonts (primary amber, dark ink; fonts Bricolage Grotesque / Instrument Sans). Add all i18n ids above in EN and DE (copy based on the App Store page: "Swipe today's AI & tech news", free, no account needed, ~5 minutes, AI analyst grounded in real articles; no rating claims).
- Accept: `hugo --minify` ok; every id exists in both files.

### Step 0B: assets
Files: `static/images/app/*` only.
- Resize 4 screenshots from `../flutter-bigtechnews-swiper-app/screenshots/1179x2556/` (briefing, briefing 2nd state, AI chat, read later = files `...201640`, `...201642`, `...201632`, `...201654`) to 540px wide WebP; produce `app-icon.png` (search the Flutter app's icon assets, else crop from `static/images/logo-transparent-square.png`). Mechanical: Haiku-suitable.
- Accept: files exist, each <120 KB.

### Step 0C: font loading
Files: `themes/editor-hugo/layouts/partials/script.html` (webfontloader family list only).
- Replace Lora/Work Sans with `Bricolage Grotesque:wght@600;800`, `Instrument Sans:wght@400;500;600`, `Geist Mono:wght@400;500` (JetBrains Mono fallback in CSS).
- Accept: build ok.

## Batch 1: features (4 steps in parallel, disjoint files)

### Step 1A: store badges + mobile banner + JS
Files: `layouts/partials/app-badges.html`, `layouts/partials/app-banner.html`, `layouts/_default/baseof.html`, `themes/editor-hugo/assets/js/script.js`.
- `app-badges`: two dark badge-style links (Apple/Google glyph inline SVG + "Download on the / App Store", "Get it on / Google Play"), ≥44px, aria-labels via i18n, per-placement attribution (`referrer=utm_source%3Dweb%26utm_medium%3D<placement>` on the Play URL), `rel="noopener"`.
- `app-banner`: top banner, mobile only (≤767px), icon, title/sub, one CTA button, ×. Included in `baseof.html` right after `<body>` before `header.html`.
- JS: `appBanner()` next to `newsletterModal()`: UA detect (iOS→App Store, Android→Play, other mobile→both links), dismissal via existing `remember/recall` (key `btn-app-banner-dismissed-until`, 14 days), toggles `html.has-app-banner` and sets `--app-banner-h`. Also `phone()` auto-cycle (every ~3.5s) + pointer tilt, disabled under `prefers-reduced-motion`. Called where `newsletterModal()` is called.
- Accept: build ok; JS has no syntax errors (`node --check`); banner hidden at desktop widths by CSS, `hidden` attr removed only if not dismissed and UA is mobile.

### Step 1B: phone + app section partials
Files: `layouts/partials/app-phone.html`, `layouts/partials/app-section.html`.
- `app-phone`: `.phone` frame with 3 stacked `<img class="phone-screen">` (first eager with width/height, others lazy), 2–3 `.phone-chip` floating beat chips, `data-phone`. `app-section`: 3 columns (swipe / AI analyst / save) with screenshots + `app-badges` (placement `section`).
- Accept: build ok when included; alt text i18n'd/descriptive.

### Step 1C: homepage template
Files: `layouts/index.html` (new root override of the theme's), nothing else.
- Full-width `.hero-app` (eyebrow with latest-issue date, `hero_h1`, `hero_sub`, `app-badges` size lg placement hero as primary CTA, `hero_trust`, `app-phone`) → `.email-panel` containing `subscribe-form.html` (id `hero`, variant `compact`, unchanged) → `.beat-strip` from `data/categories.yaml` → post grid + pagination copied unchanged from the theme (`.Render "article"`) → `app-section` → `.site-footer-app` (badges placement footer, RSS-by-beat pills, social pills, theme footer partial).
- Accept: `hugo --minify` ok; EN and `/de/` homepages render all sections; pagination links still work.

### Step 1D: styling
Files: `themes/editor-hugo/assets/scss/_midnight.scss` (new), `themes/editor-hugo/assets/scss/style.scss` (add last `@import 'midnight'` only).
- `:root` OKLCH tokens (contract list), dark body/grain, header rail and mobile top bar offset by `--app-banner-h`, `.app-banner`, `.store-badge`, hero layout (full width, 2 columns ≥992px, stacked below), `.phone` frame/screens crossfade/chips float, `.beat-strip` neon chips by beat hue, article cards (cover lift, mono date, beat-coloured tag), pagination, subscribe form/consent/exit-intent modal/cookie bar dark restyle, focus rings, ≥AA contrast, reduced-motion fallbacks. Keep `custom.scss` untouched.
- Accept: SCSS compiles (dart-sass handles `oklch()`), no horizontal scroll at 320px.

## Batch 2: integration + verification (done by Claude, not agy)
- `hugo --minify`, then `hugo server` + Chrome DevTools: screenshots at 390/768/1440/1920 (EN + DE); iPhone and Android UA emulation (right store button, dismiss persists, header offset, no collision with cookie bar/exit modal); desktop hides banner; keyboard tab-through; reduced-motion; Lighthouse; store URLs return 200; newsletter signup UI still works; post pages legible on the new palette.
- Fix small integration issues directly; re-run agy with specific feedback for real defects (max 2 rounds).
- Final: `git diff pre-agy` against this plan; confirm nothing in configs weakened; delete PLAN.md; merge `agy/work` into `main` per gembuild step 5. Note: pushing `main` deploys via GitHub Pages; the merge is local only.

## Notes
- Gembuild's pytest requirement does not apply (no test suite here); verification is by build + browser checks in Batch 2.
- Checkpoint commit `pre-agy` will include the pending `.github/workflows/hugo.yml` change and untracked `.vscode/`; exclude `.vscode/` from `git add -A` if you do not want it committed.
