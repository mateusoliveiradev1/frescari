# UI/UX Improvements Audit

## Context

This audit focused on elevating the Frescari frontend to a more premium standard across visual craft, UX clarity, conversion support, and accessibility. The review concentrated on shared UI primitives, global navigation, catalog browsing, cart and checkout support, product detail flow, authentication, and producer inventory empty states.

## Audit Scope

- Global layout and navigation
- Shared UI primitives in `packages/ui`
- Homepage anchor and footer consistency
- Catalog page and product cards
- Product details sheet
- Cart drawer and farm-by-farm checkout framing
- Login and registration pages
- Producer inventory empty state
- Dashboard feedback infrastructure

## Main Issues Found

### Visual consistency

- Shared cards and buttons still used generic surface and transition patterns, which made the interface feel interchangeable with default SaaS templates.
- Some components relied on `transition-all`, creating noisy motion and weak interaction discipline.
- Product cards lacked refined image fallbacks and had weak surface hierarchy.
- Empty states in the catalog, cart, and inventory felt utilitarian rather than premium.
- The cart header, close affordances, and quantity controls did not fully match the rest of the visual system.

### UX friction

- The global feedback layer was fragmented because dashboard routes rendered local `Toaster` instances instead of a single app-level feedback source.
- Catalog browsing lacked a stronger trust and context frame for B2B decision making.
- Authentication pages worked functionally but looked too generic for a premium operational product.
- Product detail flow mixed useful information with visually inconsistent layout blocks.
- The cart empty state did not help the user recover or continue the journey.

### Accessibility and semantics

- The application lacked a global skip link.
- Main content did not have a stable focus target for keyboard users.
- The mobile menu trigger needed explicit labeling.
- Navigation anchor structure was inconsistent because the homepage did not expose the target section used by the nav.
- Several interactive controls needed stronger focus-visible styling.

## Changes Implemented

### Global foundation

- Added a skip link and a focusable main-content target in `apps/web/src/app/layout.tsx`.
- Moved toast rendering to the global layout using a single `Toaster` instance.
- Added reusable visual utility classes in `apps/web/src/app/globals.css`:
  - `.skip-link`
  - `.surface-panel`
  - `.surface-muted`
  - `.field-label`
  - `.input-shell`
- Improved global background treatment, selection state, and scroll behavior.

### Shared design system polish

- Refined button transitions and focus rings in `packages/ui/src/components/Button.tsx`.
- Elevated card surfaces, spacing, typography, and shadows in `packages/ui/src/components/Card.tsx`.
- Removed generic motion patterns from shared badge styling in `packages/ui/src/components/Badge.tsx`.
- Rebuilt `packages/ui/src/components/ProductCard.tsx` with:
  - stronger visual hierarchy
  - better availability and price framing
  - premium hover response
  - image fallback handling
  - more intentional CTA states

### Navigation and homepage

- Rebuilt `apps/web/src/components/global-nav.tsx` for:
  - better desktop and mobile active states
  - stronger focus-visible behavior
  - explicit `aria-label`, `aria-current`, `aria-expanded`, and `aria-haspopup`
  - cleaner mobile drawer presentation
- Added `id="como-funciona"` to the homepage section targeted by the nav.
- Replaced the hardcoded homepage footer year with a dynamic `currentYear`.

### Catalog and CRO framing

- Upgraded `apps/web/src/app/catalogo/page.tsx` with:
  - a stronger hero section
  - clearer B2B purchase framing
  - improved trust and context blocks
  - better empty state recovery paths
  - more structured separation between urgent lots and standard fresh lots

### Product detail experience

- Rebuilt `apps/web/src/components/ProductDetailsSheet.tsx` to:
  - reset quantity correctly when the selected lot changes
  - improve information density without clutter
  - add better fallback imagery
  - reinforce pricing, quantity, and harvest information
  - improve focus states and CTA treatment
  - provide clearer messaging for weight-based products

### Cart and checkout support

- Polished `apps/web/src/components/CartDrawer.tsx` with:
  - a premium empty state and recovery CTA
  - better cart header and close control styling
  - stronger summary panel surfaces
  - improved quantity steppers and remove actions
  - better explanatory copy for per-farm checkout and freight context
  - stronger keyboard focus handling on interactive elements
- Restored cart visibility to buyer sessions only in `apps/web/src/components/global-nav.tsx`, so the cart trigger and drawer no longer appear for guests or non-buyer accounts.
- Added `apps/web/src/components/CatalogReserveNotice.tsx` to explain that reserving lots and using the cart requires a logged-in buyer account.
- Added explicit reserve gating in:
  - `apps/web/src/components/ProductCardWrapper.tsx`
  - `apps/web/src/components/ProductDetailsSheet.tsx`
- Replaced the earlier session hook usage in the catalog reserve flow with a client-side session lookup helper in `apps/web/src/lib/buyer-access.ts`, preventing the runtime crash that forced client rendering fallback on `/catalogo`.

### Authentication

- Rebuilt login and registration pages:
  - `apps/web/src/app/auth/login/page.tsx`
  - `apps/web/src/app/auth/register/page.tsx`
- Improvements include:
  - more intentional split-layout composition
  - stronger form hierarchy
  - reusable premium field styling
  - better inline feedback surfaces
  - clearer conversion copy
  - more semantic field attributes (`name`, `autoComplete`, `spellCheck`, `autoCapitalize`)

### Producer inventory onboarding state

- Upgraded `apps/web/src/app/dashboard/inventario/inventory-client.tsx` empty state with:
  - more intentional visual hierarchy
  - better explanation of what becomes visible after the first lot is created
  - stronger CTA styling
  - supporting operational context blocks

### Feedback consistency

- Removed duplicated local `Toaster` instances from dashboard routes:
  - `apps/web/src/app/dashboard/vendas/page.tsx`
  - `apps/web/src/app/dashboard/entregas/deliveries-page-client.tsx`
  - `apps/web/src/app/dashboard/fazenda/farm-page-client.tsx`
  - `apps/web/src/app/dashboard/pedidos/page.tsx`
  - `apps/web/src/app/dashboard/admin/admin-client.tsx`

## Accessibility Improvements

- Added skip navigation support.
- Moved the skip link fully off-screen until keyboard focus so it no longer leaks visually in the default state.
- Added a focusable main content container for keyboard navigation.
- Improved mobile menu accessibility labeling.
- Strengthened focus-visible styling on shared and local interactive controls.
- Improved semantic clarity in authentication forms and product detail actions.
- Fixed homepage anchor semantics used by the global navigation.

## Conversion Impact Expectations

- Stronger catalog framing should improve trust and help buyers understand the B2B nature of the flow faster.
- The new cart empty state should reduce dead-end behavior and route users back into browsing.
- Authentication screens now better communicate product value during entry, which should reduce visual distrust at a key decision point.
- Product cards and detail sheets now expose freshness, availability, and price information with less cognitive friction.

## Remaining Opportunities

- Some untouched routes still use `transition-all` and could be normalized in a second pass.
- Dashboard cards on `pedidos`, `entregas`, and some onboarding sections could be further aligned with the upgraded premium surface language.
- A full keyboard traversal audit across every dashboard route is still recommended after QA.
- Additional form-level validation messaging could be standardized into a shared component to reduce duplication.

## Suggested Future Micro-Interactions

- Add a subtle stagger reveal for catalog cards on first load, capped to avoid motion fatigue.
- Animate the cart badge with a short scale-and-settle transition when an item is added.
- Add gentle progress feedback when freight calculations finish for each farm group.
- Introduce inline success affirmation in product detail and cart flows, tied to the global toast system.
- Add focus-preserving sheet transitions for product detail and mobile navigation to strengthen perceived polish.

## Verification Notes

- Global toast duplication was removed in favor of a single app-level feedback layer.
- Shared UI primitives were updated to reduce generic styling and improve focus affordances.
- `pnpm lint` passed after the final accessibility and reserve-flow fixes.
- Runtime validation confirmed:
  - the skip link stays off-screen until focused
  - the catalog no longer throws the previous recoverable render error tied to `useSession()` inside `ProductCardWrapper`
  - guests no longer see the cart in the global navigation
  - guests see a catalog notice explaining that reserving lots requires a buyer login
  - guest reserve CTAs now show an explicit toast with a login action instead of opening the cart
