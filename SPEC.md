# button-press — Product & Technical Spec

Status: **Draft v0.2** — product design (§1-§12) not yet implemented;
infrastructure and deployment pipeline (§13-§15) built and verified live.

## 0. Current Status (as of 2026-08-09)

**Application code:** scaffold only. The Angular workspace (§13) builds,
lints, and tests clean, but the UI is still the placeholder screen from
scaffolding (`src/app/app.html`) — none of the actual product functionality
in §7-§10 (button/paper size selection, layout generation, image upload and
per-site editing, preview, PDF export) has been built yet.

**CI/CD & hosting: built and verified end-to-end.**
- `main` → production is live and confirmed working: the `Deploy
  production` GitHub Actions run succeeded (build → lint → test → `aws s3
  sync` → CloudFront invalidation), and https://button-press.com/ serves
  the current placeholder app (verified both by `curl` — HTTP 200 — and by
  the user loading the page directly).
- `develop` → staging is provisioned (CloudFront distribution
  `E30NVLWVF1DEWB`, DNS record `dev.button-press.com`) but **not yet
  deployed to** — no `develop` branch exists yet, so `dev.button-press.com`
  currently 403s. Nothing broken here, just not exercised yet; see §15.1.
- The 2 CloudFront distributions are under CloudFormation management
  (`button-press-cdn` stack) for rollback safety; the shared S3 bucket,
  Origin Access Identity, ACM cert, IAM deploy user, and Route53 records
  remain intentionally hand-managed outside any IaC — see §15.7-§15.8.

**Next likely step:** start implementing the actual product UI (§7 user
flow), starting with button-size/page-size selection and layout generation
(§8.1-§8.2), since everything below it currently has nothing to render into.

## 1. Overview

button-press is a web app that lets a user turn arbitrary photos/images into
print-ready sheets of circular artwork sized for a pin-back button press
(e.g. a Badge-A-Minit / Tecre style press with a cutting die). The user
picks a button size and a paper size, the app lays out as many circular
"sites" as will fit on the sheet with safe spacing for a die cutter, and the
user assigns and positions an image into each site using a live preview with
concentric-circle alignment guides. The final output is a print-ready PDF
sized to the chosen paper, at the correct physical scale, ready to print,
die-cut, and press.

## 2. Goals (v1)

- Upload one or more images.
- Choose a button size (starter presets below; more sizes added later).
- Choose a paper size (Letter, A4, Legal).
- Auto-generate a dense grid layout of circular sites that fits the chosen
  button size on the chosen paper, with configurable spacing between sites
  so a die cutter can be positioned without damaging neighboring artwork.
- Assign images per site with three supported modes, freely mixable:
  - one image applied to every site,
  - a distinct image per site,
  - some sites intentionally left empty.
- Per-site image editing against a concentric-circle guide: reposition
  (pan), scale (uniform), and stretch (independent X/Y scale) to fit the
  circle.
- Live preview of both the single-site editor and the full sheet, with
  support for multiple sheets when a project needs more sites than one
  page holds.
- Export a print-ready, potentially multi-page PDF at true physical scale.
- No accounts, no server-side storage. Single browser session, but
  in-progress work survives a refresh via local, on-device storage
  (IndexedDB) — still nothing leaves the browser.

## 3. Non-Goals (v1)

- User accounts, login, saved/shared projects across devices.
- Non-circular button shapes, custom die shapes.
- Commercial print-shop features (CMYK color management, ICC profiles,
  bleed/crop marks for third-party printers).
- Hexagonal/staggered packing (denser than a grid) — noted as a future
  enhancement, see §12.
- Fully automatic sheet-count growth. Multi-sheet is supported (see §8.2),
  but the number of sheets is an explicit, user-controlled value — the app
  suggests adding a sheet when it would help, it doesn't silently create
  one.

## 4. Domain Concepts

**Button anatomy** (per site):

- **Cut Line (outer circle)** — the diameter the die actually cuts. Artwork
  must fully cover this circle (no white gaps at the edge).
- **Wrap Area** — the ring between the cut line and the live area. This
  paper gets curled over the metal button shell edge by the press. Content
  here is only partially visible and gets distorted by the curl, but must
  still be filled with image (no blank edge).
- **Live Area (inner circle)** — the flat, fully visible face of the
  finished button once pressed. Important content (faces, text) must stay
  inside this circle.
- **Site** — one position in the sheet layout where a button's circular
  artwork is placed.
- **Sheet / Layout** — the full page of sites generated for a given
  button size + paper size + spacing.
- **Site Padding** — minimum gap enforced between the outer cut lines of
  adjacent sites, to leave room to position a physical die cutter without
  damaging neighboring artwork. Default **5mm**, user-adjustable.
- **Sheet Margin** — minimum gap enforced between the outer cut line of any
  site and the physical paper edge (printers typically can't print edge to
  edge anyway). Default **5mm**, user-adjustable, and should also be
  clamped to the printer's known unprintable margin if we detect/assume one.

## 5. Button Size Presets

| Name | Live Area (inner) | Cut Line (outer) |
|---|---|---|
| 1" | 25mm (1.00") | 35mm (1.38") |
| 1.25" | 32mm (1.25") | 44mm (1.73") |
| 2.25" | 58mm (2.25") | 70mm (2.76") |

These are seed data, not hardcoded constants — see §9 data model. Adding a
new button size later should require no code changes, just a new entry.

## 6. Page Size Presets

| Name | Dimensions |
|---|---|
| US Letter | 8.5" × 11" (215.9mm × 279.4mm) |
| A4 | 210mm × 297mm |
| US Legal | 8.5" × 14" (215.9mm × 355.6mm) |

Orientation: portrait for v1 (landscape as a later toggle — packing math is
orientation-agnostic, just swap W/H).

## 7. User Flow

1. **Select button size** from presets.
2. **Select paper size** from presets.
3. App computes and renders the sheet layout: a grid of empty circular
   sites (outer cut line + inner live-area guide shown for each), respecting
   site padding and sheet margin. Site padding/margin are adjustable, with
   the layout recomputing live. The project starts with one sheet; more
   sheets can be added explicitly (§8.2).
4. **Upload image(s)** — drag/drop or file picker, multiple files at once.
5. **Assign images to sites**:
   - Assign one uploaded image to "all sites" as a default fill (applies
     across every sheet currently in the project), and/or
   - drag/assign specific images onto specific sites on any sheet,
     overriding the default, and/or
   - leave any site unassigned (empty).
   - If more images are uploaded than there are empty sites across the
     current sheet(s), the app surfaces a suggestion to add another sheet;
     the user decides whether to accept it.
6. **Edit each site's image** in a focused editor view showing the
   concentric circle guide (live area + cut line) overlaid on the image:
   - drag to pan/reposition,
   - scale uniformly (zoom in/out to crop, or zoom out with an
     auto-fill-to-cut-line floor so the wrap area is never left blank),
   - stretch independently on X and/or Y to fit non-matching aspect ratios.
   - Per-site edits are independent even when multiple sites share the same
     source image (i.e. "same image, different crop/zoom per site" is
     allowed).
7. **Preview** any sheet at any time (thumbnail-per-site composite, with a
   sheet switcher/tabs once there's more than one sheet), and preview an
   individual site full-size.
8. **Export PDF** — generates a print-ready, true-scale PDF covering every
   sheet in the project (one PDF page per sheet). Empty sites render as
   blank (no cut/guide marks printed by default; see §8.6 for an optional
   guide-lines toggle).

## 8. Functional Requirements

### 8.1 Button & Page Selection
- Preset pickers for button size and page size (§5, §6).
- Selecting either recomputes the layout immediately (§8.2).
- Changing button/page size after images are assigned should preserve
  assignments where possible by site index, and simply drop/leave-empty any
  sites that no longer exist (with a confirmation if it would discard
  in-progress edits).

### 8.2 Layout Generation
- Sites are arranged in a rectangular grid (see §10 for the packing
  formula). Grid packing is the v1 approach; hex packing is future work
  (§12).
- Given the chosen button's cut-line diameter `D`, site padding `P`, and
  sheet margin `M`, the layout must guarantee:
  - distance between the cut lines of any two horizontally/vertically
    adjacent sites ≥ `P`,
  - distance between any site's cut line and the paper edge ≥ `M`.
- Layout recomputes live as button size, page size, padding, or margin
  change.
- If the chosen button doesn't fit on the chosen paper even once (cut line
  + 2×margin > page dimension), show a clear error state instead of an
  empty/broken layout.
- **Sheets:** a project has one or more sheets, all sharing the same
  layout (button size, page size, padding, margin). Sheet count is an
  explicit value the user controls directly (add/remove sheet), starting
  at 1. The app does not silently grow the sheet count on its own, but
  proactively suggests adding one when the user has more unassigned
  images than empty sites across existing sheets (§8.3). Removing a sheet
  that still has assignments should require confirmation.

### 8.3 Image Assignment
- Support all three assignment modes described in §7 step 5, freely mixed,
  across all sheets in the project.
- "Apply to all" only fills sites that don't already have an explicit
  per-site override, unless the user explicitly chooses to overwrite all;
  it applies to every sheet currently in the project, not just one.
- Unassigning/clearing a single site must not affect others.
- When the count of uploaded-but-unassigned images exceeds the count of
  empty sites across all current sheets, show a non-blocking prompt
  offering to add another sheet (§8.2). Declining leaves the extra images
  available to assign manually or use later.
- Supported input formats: JPEG, PNG (including transparency), WebP.
  Transparent regions are composited onto a solid backing color (default
  white, user-selectable) at export time, since the final physical medium
  has no transparency.

### 8.4 Image Editing / Fit Controls
- Per-site transform state: offset (x, y), scale X, scale Y, and (nice-to-have,
  not required v1) rotation.
- Editor overlays the two guide circles (live area + cut line) at their
  true relative proportions for the selected button size.
- **Coverage rule: warning, not a hard constraint.** The user can freely
  scale/position an image so it no longer fully covers the outer cut-line
  circle. When that happens, the editor shows a clear visual warning
  (e.g. highlighting the exposed gap) on that site, both in the single-site
  editor and as a badge/indicator in the full-sheet preview, so a gap is
  never discovered only after printing. Export is still allowed with
  warnings present — it's the user's call.
- Independent X/Y scale explicitly supports "stretch/shrink to fit" as
  requested, in addition to plain uniform resize/crop.
- Image-quality assist (should-have): compute effective print resolution
  (px ÷ printed-size-in-inches) for the current crop and warn if it falls
  below a print-quality threshold (e.g. below 150 PPI warn, below 300 PPI
  hint), so users don't discover a blurry button after printing.

### 8.5 Preview
- Single-site preview: shows the image as it will actually print, guides
  optionally toggled on/off, at a size large enough to judge composition,
  including the coverage-gap warning from §8.4 if applicable.
- Full-sheet preview: composite thumbnail of every site in its actual grid
  position, reflecting current assignments/edits, updating live.
- Sheet switcher: once a project has more than one sheet, a tab/selector
  lets the user move between sheets in both the full-sheet preview and the
  assignment view. Each sheet shows a summary (e.g. "9/12 sites filled") so
  gaps and coverage warnings are visible without opening every sheet.

### 8.6 PDF Export
- Client-side generation (no server round-trip).
- Output page size in the PDF must exactly match the selected paper preset
  in physical units.
- Every site renders at true physical scale/position per the computed
  layout — what you see in the full-sheet preview is what prints.
- **Multi-sheet projects export as a single multi-page PDF**, one page per
  sheet, in sheet order.
- Empty sites render as blank space by default.
- Optional toggle: include faint cut-line guide circles in the exported PDF
  (useful if the user is hand-cutting or manually aligning a die without a
  jig). Off by default.
- Sites with an active coverage-gap warning (§8.4) still export as-is —
  the warning is an editor-time aid, not an export blocker.
- Filename should be descriptive/date-stamped by default (exact convention
  TBD, not user-facing-critical).

## 9. Data Model (conceptual)

```ts
interface ButtonSizePreset {
  id: string;              // e.g. "1in"
  label: string;           // "1\""
  liveAreaDiameterMm: number;  // 25
  cutLineDiameterMm: number;   // 35
}

interface PageSizePreset {
  id: string;               // e.g. "letter"
  label: string;            // "US Letter"
  widthMm: number;
  heightMm: number;
}

interface LayoutConfig {
  buttonSize: ButtonSizePreset;
  pageSize: PageSizePreset;
  sitePaddingMm: number;    // default 5
  sheetMarginMm: number;    // default 5
}

interface Layout {
  config: LayoutConfig;
  columns: number;
  rows: number;
  sites: SitePosition[];    // one sheet's worth of site slots, shared template for every sheet
}

interface SitePosition {
  index: number;        // local index within a sheet (0..columns*rows-1)
  row: number;
  col: number;
  centerXMm: number;
  centerYMm: number;
}

interface ImageAsset {
  id: string;
  fileName: string;
  bitmap: ImageBitmap | HTMLImageElement;
  naturalWidthPx: number;
  naturalHeightPx: number;
}

interface Sheet {
  id: string;
  order: number;               // sheet position in the exported PDF
  assignments: SiteAssignment[]; // keyed by local site index within this sheet
}

interface SiteAssignment {
  siteIndex: number;           // local index, matches Layout.sites[].index
  imageId: string | null;      // null = empty site
  transform: ImageTransform | null;
  hasCoverageGap: boolean;     // derived, not stored — computed from transform vs. cut line
}

interface ImageTransform {
  offsetXMm: number;
  offsetYMm: number;
  scaleX: number;
  scaleY: number;
  rotationDeg?: number;   // future
}

interface Project {
  layout: Layout;          // shared by every sheet
  images: ImageAsset[];
  sheets: Sheet[];          // length = current sheet count, order-significant
  backingColor: string;     // for transparent-image compositing
}
```

**Persistence:** `Project` (minus in-memory-only `ImageBitmap`/`HTMLImageElement`
handles) plus the original image bytes are serialized into `IndexedDB` on
change (debounced), keyed to a single local "current project" record — there's
only ever one active project since there are no accounts. On load, image
bytes are decoded back into bitmaps before the UI renders. `localStorage` is
not used for this — image bytes are too large for it.

## 10. Layout / Packing Algorithm (v1 — grid)

Given cut-line diameter `D`, site padding `P`, sheet margin `M`, and usable
page dimensions `W × H`:

```
cols = floor((W - 2*M - D) / (D + P)) + 1   (0 if negative)
rows = floor((H - 2*M - D) / (D + P)) + 1   (0 if negative)
```

Site centers are placed on a regular grid starting at
`(M + D/2, M + D/2)`, stepping by `D + P` in each direction. Any leftover
space (from the floor rounding) is distributed as extra centered margin
rather than extra padding, so the whole grid is centered on the page.

Total sites per sheet = `cols * rows`.

## 11. Decisions Log & Open Questions

### Resolved

1. **Multi-sheet support — yes, in v1.** A project can have multiple
   sheets sharing one layout; sheet count is explicit and user-controlled
   (not auto-grown), with the app suggesting a new sheet when unassigned
   images outnumber empty sites. Export produces one multi-page PDF. See
   §8.2, §8.3, §8.6, §9.
2. **Wrap-area coverage — warning only, not a hard constraint.** Users can
   scale/position an image so it leaves a gap inside the cut line; the
   editor flags it clearly (per-site warning + full-sheet indicator) but
   never blocks editing or export. See §8.4, §8.5, §8.6.
3. **Persistence — yes, via IndexedDB.** In-progress work (images,
   assignments, transforms) survives a refresh. Still no accounts, still
   fully local to the device — see §9 for the persistence model.

4. **Angular Router scaffolded, decision deferred.** Routing was set up
   during project scaffolding (standalone, `--routing`), and CloudFront's
   SPA-fallback error handling (§15.5) is configured accordingly. Whether
   the app actually ends up using multiple routes vs. one view with
   internal state is still open, but costs nothing either way at the infra
   level.
5. **`www` vs. apex canonicalization — no redirect, both serve identical
   content.** Originally planned as a 301 redirect (`www` → apex) via a
   CloudFront Function; simplified to just adding `www.button-press.com`
   as a second alias on the same distribution. See §15.5. Revisit if
   canonicalization starts to matter (e.g. SEO).
6. **Infra approach — hand-provisioned, not Terraform.** See §15.7 for the
   full reasoning: the real hosting target turned out to be an existing,
   shared, hand-managed bucket used by ~10 other personal sites, so
   matching that existing pattern won out over introducing a
   project-scoped IaC layer.
7. **The 2 CloudFront distributions were then imported into a
   CloudFormation stack** (`button-press-cdn`) for rollback/rebuild
   safety, without disturbing the resources or bringing the shared
   bucket/OAI/cert/IAM user/DNS records into that stack too. See §15.7 and
   `cloudformation/README.md`.
8. **Component library — Angular Material.** Used for standard UI chrome
   (pickers, inputs, tabs, dialogs, snackbars) so v1 UI work isn't spent
   reinventing basic controls; the custom circular-guide editor and
   canvas-based previews remain hand-rolled since Material doesn't cover
   that surface. See §13. Not yet installed — first `ng add` when product
   UI work begins.

### Remaining

7. **Print scale correctness across browsers/printers.** Browsers'
   PDF-to-physical-paper handling is generally reliable via `pdf-lib`
   generating a PDF with correctly-sized `MediaBox`, but we should
   explicitly test actual printed output against a ruler before calling
   this done — "true scale" is the whole point of the app. This is a
   pre-launch acceptance check, not a design decision.

## 12. Future Enhancements (explicitly out of scope for v1)

- Hexagonal/staggered site packing for higher density than a grid.
- Custom/arbitrary button size entry (not just presets).
- Non-circular dies (square, oval).
- Landscape page orientation toggle.
- Saved projects / accounts / cross-device sync.
- Rotation control in the per-site image editor.
- Text/sticker overlay tools (not just photo placement).

## 13. Architecture & Tech Stack

**Stack:** Angular + TypeScript (per project decision).

**Proposed architecture: client-only SPA.** No backend service for v1 —
image handling, layout computation, live preview rendering, and PDF
generation all happen in the browser:

- Component library: **Angular Material**, for the standard chrome around
  the custom canvas work — preset pickers, sliders/inputs for
  padding/margin, buttons, tabs (sheet switcher), file upload affordance,
  dialogs (e.g. remove-sheet confirmation), snackbars (e.g. the
  add-a-sheet suggestion in §8.3). The circular-guide editor, site grid,
  and full-sheet preview stay hand-rolled `<canvas>` — Material has
  nothing to offer there. Not yet installed (`ng add @angular/material`
  is the next step when UI work starts).
- Rendering: HTML5 `<canvas>` per site editor and for the full-sheet
  preview composite.
- PDF generation: a client-side PDF library capable of precise physical
  units and embedding raster images (e.g. `pdf-lib` or `jsPDF`) — pick
  based on how much control we need over unit precision and image
  compositing; `pdf-lib` generally gives more direct control over the
  document's `MediaBox`/unit math.
- State management: standard Angular services + signals/RxJS; no need for
  a heavier state library at this scope.
- No backend, no database. `IndexedDB` for local session persistence
  (required for v1, see §9 and §11 Decisions Log).

This keeps hosting trivial (static site), keeps user images entirely on
their own machine (privacy-friendly, no upload infra to build), and matches
the "single session, no accounts" product decision. If accounts/saved
projects become a real requirement later, a backend can be introduced
without changing the core layout/editing/export logic, since none of it
depends on server state today.

Being a pure static build (`ng build` output is just HTML/CSS/JS/assets)
is also what makes the S3+CloudFront deployment in §15 a clean fit — no
server runtime to host anywhere.

## 14. Non-Functional Requirements

- Runs in current versions of Chrome, Firefox, Safari, Edge.
- Layout/preview recompute should feel instant (<100ms) for typical sheet
  sizes (dozens of sites).
- Reasonable image size limits to avoid browser memory issues (exact cap
  TBD — should downsample very large uploads for in-editor preview while
  keeping the original for export-time rendering).
- Fully keyboard-operable is a nice-to-have, not a v1 requirement, but
  avoid accessibility regressions where cheap to avoid (labeled controls,
  sufficient contrast on guide lines, etc).

## 15. CI/CD & Deployment

The app is a pure static build (§13), so hosting is **Amazon S3 (storage) +
CloudFront (CDN/HTTPS)**, deployed via **GitHub Actions**. Infrastructure is
**hand-provisioned, not IaC** — see §15.7 for why, and the resource
reference table for what exists and where.

### 15.1 Environments

Two environments, sharing the existing multi-site `kjr-static-content` S3
bucket (see §15.4) under their own key prefix, each with their own
CloudFront distribution and domain:

| Environment | Branch | Domain | S3 prefix |
|---|---|---|---|
| Production | `main` | `button-press.com` + `www.button-press.com` (same content, no redirect) | `sites/button-press.com/prod/` |
| Staging | `develop` | `dev.button-press.com` | `sites/button-press.com/dev/` |

(`dev.<domain>`, not `staging.<domain>` — matches the convention already
used by this account's other sites, e.g. `dev.victorynachos.com`. The
public hostname is `dev`; the internal environment/GitHub-Environment name
stays `staging` for clarity against `production`.)

`main` and `develop` are protected branches requiring PRs and passing
status checks. Normal flow: feature branches → PR into `develop` → verify
on staging → PR `develop` → `main` → verify on production. Each
environment builds and deploys independently from its own branch (not a
single promoted artifact) — simpler to operate at this project's scale.

### 15.2 GitHub Actions Workflows

- **`build-test.yml`** (reusable) — checkout → setup Node → `npm ci` →
  lint → unit tests → production build (`ng build`, which also
  type-checks) → uploads the `dist/button-press/browser` artifact.
- **`ci.yml`** — calls `build-test.yml` on every pull request; this is the
  required status check for merging into `develop`/`main`. (Not run on
  direct pushes to those branches — the deploy workflows below cover that
  by running the same build/test job before deploying, so nothing is
  skipped.)
- **`deploy.yml`** (reusable) — runs `build-test.yml`, downloads the
  artifact, then syncs it to the target environment's S3 prefix and
  invalidates its CloudFront distribution.
- **`deploy-staging.yml`** / **`deploy-production.yml`** — thin triggers
  (`push` to `develop` / `main`) that call `deploy.yml` with
  `environment: staging` / `environment: production`.
- Deploy workflows use GitHub **Environments** (`staging`, `production`)
  so each has its own scoped secrets/variables and a visible deployment
  history; production can later have a required-reviewer approval gate
  added via environment protection rules without any workflow changes.

### 15.3 AWS Credentials

- Authentication is via the **existing shared `static-deploy-user` IAM
  user** (long-lived access key, per project decision — simpler than OIDC
  at the cost of being a standing credential), not a new
  per-project/per-environment user. This account already runs ~10 personal
  static sites off this one user, and it already has exactly the
  permissions this project needs:
  - `s3:ListBucket` on `kjr-static-content`, `s3:PutObject`/`GetObject`/
    `DeleteObject`/`PutObjectAcl`/`GetObjectVersion` on
    `kjr-static-content/sites/*` (managed policy `s3-deploy-sites`),
  - `cloudfront:CreateInvalidation` on any distribution in the account
    (managed policy `deploy-cf-invalidate`).
- This user is capped at 2 IAM access keys (the AWS account-wide max per
  user) and both were already in use by other sites, so button-press.com
  **reuses one of those two existing keys** rather than minting a new one
  — no new IAM user, no key rotation performed as part of this setup.
- The key is stored as `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
  secrets on both the `staging` and `production` GitHub Environments
  (added directly via the GitHub UI, never pasted through any chat/session
  transcript).
- Because the credential is shared account-wide (not scoped to this
  project's S3 prefix or distributions alone), a compromised secret here
  has a bigger blast radius than a dedicated per-project user would —
  accepted tradeoff for consistency with how every other site in this
  account already works. Rotating either of the 2 keys is a manual,
  cross-site-coordinated operation (would break whichever other sites'
  CI currently hold that key) — not something to do casually.

### 15.4 S3 (shared bucket, existing)

- `kjr-static-content` is a private bucket (full Block Public Access)
  shared by many personal sites, each under its own `sites/<domain>/`
  prefix — **not owned or managed by this project**. button-press.com's
  slice is `sites/button-press.com/{dev,prod}/`.
- Read access for CloudFront is via the bucket's existing (2019-era)
  Origin Access Identity (`origin-access-identity/cloudfront/E8XZ915T7W6UI`),
  which the bucket policy already trusts for the whole bucket — this
  project's distributions reuse that same OAI rather than provisioning a
  new Origin Access Control and a new bucket-policy statement. **No
  changes to the shared bucket policy were needed.**
- Deploy step uses `aws s3 sync --delete` scoped to this project's own
  prefix only, so it can never touch another site's objects.
- Cache-Control set at upload time: long `max-age` + `immutable` for
  content-hashed static assets (Angular CLI hashes JS/CSS/etc. filenames
  by default), `no-cache` on `index.html`/`favicon.ico` so a new deploy is
  picked up immediately instead of being served from a stale cached shell.

### 15.5 CloudFront

- Origin: `kjr-static-content.s3.us-east-1.amazonaws.com`, with
  `OriginPath` set to this environment's prefix — this is exactly the
  pattern this account's other multi-env sites already use (confirmed
  against a live example) to serve different prefixes of the same bucket
  from different distributions.
- Viewer protocol policy: redirect HTTP → HTTPS. Cache policy:
  AWS-managed `Managed-CachingOptimized`. Response headers policy:
  AWS-managed `Managed-SimpleCORS` (matches convention; not otherwise
  required). Methods: GET/HEAD/OPTIONS. Price class: `PriceClass_100`.
- Certificate: the account's existing ACM cert for `button-press.com` +
  `*.button-press.com` (already ISSUED, us-east-1) — covers apex, `www`,
  and `dev.button-press.com` in one wildcard cert, so nothing new was
  requested/validated.
- SPA-fallback error handling: custom error responses map **both** 403
  and 404 to `/index.html` with an HTTP 200 (private S3 without
  `ListBucket` returns 403 for a missing key, not 404 — this account's
  other sites only map 404, which is a latent gap for any of them using
  client-side routing; button-press.com's Angular Router makes this
  correctness-relevant here, so both are mapped).
- No `www`-redirect function: `www.button-press.com` is just a second
  alias on the production distribution serving identical content, rather
  than 301-redirecting to the apex. Simpler; revisit if canonicalization
  ever matters (e.g. for SEO).
- Cache invalidation per deploy: invalidate `index.html` and other
  unhashed root files only (not `/*`) — content-hashed assets are
  immutable and never need invalidating.

### 15.6 DNS (Route53)

- `button-press.com` has **two** hosted zones in this account — only one
  (`Z02922719IU6F5XAOBF6`) is the one the domain's registrar nameservers
  actually point to (confirmed by comparing NS records against
  `route53domains get-domain-detail`); the other is an unused stray. All
  records for this project were added to the real one. The stray zone was
  left alone (not this project's call to delete).
- Alias A/AAAA records added in that zone: `button-press.com`,
  `www.button-press.com` → production distribution; `dev.button-press.com`
  → staging distribution.

### 15.7 Why no Terraform (but yes CloudFormation, for part of it)

An earlier draft of this section specified per-environment Terraform-
managed S3 buckets, ACM certs, and IAM users. In practice, once real AWS
access was available, it turned out:

- the actual hosting target is a shared, already-existing, hand-managed
  bucket used by ~10 other sites (not something this project should own
  in its own Terraform state),
- a working IAM identity, ACM cert, and Route53 zone already existed,
- and every other site in this account was provisioned the same
  hand-configured way, with no IaC.

Introducing Terraform here would mean managing a thin, project-specific
layer on top of infrastructure this project doesn't otherwise own — more
process for less benefit than just matching the established pattern.
Resources were created directly via `aws cloudfront create-distribution`
and `aws route53 change-resource-record-sets`, mirroring an existing
site's live distribution config pulled via `aws cloudfront
get-distribution-config` as a template.

Once created, though, the 2 CloudFront distributions (the resources where
an accidental delete/replace is actually painful — a new distribution
means a new `*.cloudfront.net` domain) were brought under **CloudFormation**
management via a resource **import** (not recreated) — see
`cloudformation/README.md` for exactly how, and why CloudFormation rather
than Terraform for just this slice: no remote-state bootstrap
chicken-and-egg problem (AWS hosts the state), and resource import is a
first-class, well-supported operation for adopting already-live resources
without disturbing them, which is what was actually needed here. The
shared bucket, OAI, ACM cert, IAM user, and Route53 records are still
deliberately outside this stack — see that README's "what this stack owns"
section. If a Terraform (or other IaC) pass over the whole
`kjr-static-content` account ever happens, it should cover all sites at
once, not be bootstrapped piecemeal by whichever site adds it first.

### 15.8 Provisioned Resource Reference

| Resource | Value |
|---|---|
| S3 bucket | `kjr-static-content` (shared, existing) |
| S3 prefix — staging | `sites/button-press.com/dev/` |
| S3 prefix — production | `sites/button-press.com/prod/` |
| Origin Access Identity | `E8XZ915T7W6UI` (shared, existing) |
| ACM certificate (us-east-1) | `button-press.com` + `*.button-press.com`, existing |
| Route53 hosted zone | `Z02922719IU6F5XAOBF6` (the real one — see §15.6) |
| CloudFront distribution — staging | `E30NVLWVF1DEWB` (`dwdfilv91xpuv.cloudfront.net`) |
| CloudFront distribution — production | `E294FWDQR4JR8D` (`d3t81jfi2p3d08.cloudfront.net`) |
| Deploy IAM user | `static-deploy-user` (shared, existing) |
| CloudFormation stack | `button-press-cdn` (us-east-1) — manages the 2 distributions above only, see `cloudformation/README.md` |

GitHub Environment secrets/variables mirror this table — see the header
comment in `.github/workflows/deploy.yml` for the exact names.
