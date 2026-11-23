# hikma-mens-suit-frontend

Website and Telegram Mini App for Hikma Men's Fashion, built from one codebase. React 19 · Vite · Tailwind CSS 4 · React Router · TanStack Query · Zustand · Motion.

See the [root README](../README.md) for setup and deployment.

- `npm run dev`: http://localhost:5173 (proxies `/api` to the backend on :5050)
- `npm run build`: typecheck + production build into `dist/`

## How the Mini App works
`src/lib/telegram.ts` wraps `window.Telegram.WebApp`. When opened inside Telegram:
- The customer is signed in silently from `initData` (`store/auth.ts`).
- The page's main action drives Telegram's native MainButton (`components/layout/PrimaryAction.tsx`), and inner pages show the BackButton.
- `startapp=p_<slug>` deep links open a product directly; `c_<category>` opens a category and `o_<order>` an order.
- Phone numbers can be shared with one tap (`requestContact`); haptics confirm actions.

In a normal browser the same screens use a sticky action bar and the Telegram Login Widget.

## Design tokens
Defined in `src/index.css`:
- Colours: ink `#0D1015`, wool `#161A21`, chalk `#ECE9E3`, steel `#7F8894`, and camel `#B98B57` as the only accent.
- Type: Archivo Expanded for display, Hanken Grotesk for body, IBM Plex Mono for sizes and prices, Noto Sans Ethiopic for Amharic.
- Signature element: the tape-measure size picker (`components/product/TapeSizePicker.tsx`).

## Structure
```
src/
  pages/        Home, Shop (+search), Product, Bag, Checkout, Orders, Info
  admin/        lazy-loaded dashboard: overview, orders, products + editor, customers, admins, settings
  components/   layout (shell, primary action, Telegram login), product, ui, brand mark
  lib/          api client, i18n (en/am), Telegram bridge, formatting, types
  store/        auth (customer + staff sessions), cart
  hooks/        data queries
```
