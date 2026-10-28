# UI animations (Wholesale dashboard)

Entrance animations for the Wholesale dashboard pages. They are **pure CSS**: no animation library, and nothing waits for JavaScript to load before it starts. Retail pages are intentionally not animated yet.

## The two building blocks

### 1. `pop-in`: fade and rise
A CSS class (`src/app/globals.css`) that fades an element in while it rises a few pixels. Stagger a page by giving each block a delay:

```tsx
import { popDelay } from "@/lib/utils/pop";

<div className="mb-6 pop-in">…header…</div>
<div className="card pop-in" style={popDelay(120)}>…table…</div>
```

- `popDelay(ms)` (`src/lib/utils/pop.ts`) sets the `--pop-delay` CSS variable.
- It uses `animation-fill-mode: backwards`, so the element is hidden during its delay but no transform is left behind afterwards. Hover effects, sticky and fixed children are unaffected once it finishes.
- It only runs when the element is first rendered. Tab, search and filter changes keep the elements mounted, so they do not replay it.

### 2. `CountUp`: a number that counts up from 0
`src/components/ui/count-up.tsx`:

```tsx
<CountUp value={52} />                 // plain whole number
<CountUp value={2014710.5} grouped />  // money: "2,014,710.5", decimals and a leading "-" supported
```

- Place it inside an element that has `pop-in`. It reads that element's `--pop-delay`, so **the number starts counting at the same instant its tile starts to appear**. Override with `delay={ms}` if needed.
- `duration` (default 900 ms) controls how long the count takes.
- The end state is exactly what `fmtMoney` shows (same `Intl.NumberFormat("en-US", { maximumFractionDigits: 2 })`).

## How it works (so it can be changed safely)
- A registered CSS property `--num` (`@property`, type `<integer>`) is animated from 0 to `--target`. Integers interpolate smoothly, and a CSS counter prints the current value.
- **Plain** (`.count-up`): `counter(num)` prints it.
- **Grouped** (`.count-up-grouped`): a CSS counter cannot insert commas, so `--num` is split into groups of three digits using CSS `round()` and `mod()`. Each group is its own counter with a custom `@counter-style`: a leading unpadded group, a comma shown only when a higher group exists, and later groups padded to three digits. Out-of-range values fall back to an invisible zero-width space, which is how a group hides itself.
- The visible digits are `aria-hidden`; the real value is in a `sr-only` span, so screen readers never read intermediate numbers.

## Behaviour and limits
- **Reduced motion and printing:** both turn all `pop-in` / count animations off, so people with "reduce motion" and anyone printing (the Income page has a Print button) always get the final numbers.
- **Browser support:** `@property` and counters work in current Chrome, Edge, Safari and Firefox. The grouped variant also needs CSS `round()`/`mod()` (Chrome/Edge 125+, Firefox 118+, Safari 15.4+); where those are missing, the normal formatted text is shown without animation (`.cg-fallback`).
- **Size limit:** CSS integers are 32-bit, so values above 2,000,000,000 are shown as plain text with no count.
- **Decimals and the minus sign** are shown from the start; only the whole-number part counts.
- After `router.refresh()` a changed number jumps to its new value rather than counting again (the animation only runs when the element first appears).

## Where it is applied
- **Dashboard:** header, 13 stat tiles (staggered, each number counts as its tile appears), Recent Receipts card.
- **Income:** header, period line, 5 summary tiles (Orders plain, four money tiles grouped), detail table.
- **Customers, Receipts, Orders, Production, Styles, Expenses, Team, Audit Log, Settings:** header, controls and main cards, staggered.
- **Filter tabs** (`FilterTableShell`, used by Receipts, Orders, Production, Expenses): every tab and the divider pops in one after another (`TAB_START_MS`, `TAB_STAGGER_MS`).

Not animated: Retail pages, customer and receipt detail pages, and the receipt builder.

## Adding it to another page
1. Add `pop-in` plus `style={popDelay(n)}` to the header, controls and main card (about 0, 80, 120–180 ms is the existing rhythm).
2. For stat tiles, put `pop-in` + `popDelay(100 + 60 * index)` on each tile and a `<CountUp>` inside.
3. Keep animation off elements that are themselves modals or are re-mounted on every interaction, or they will replay.

## How it was checked
Type check, production build, and the count-up components rendered in headless Edge with 15 values (0, 5, 27, 999, 1,000, 1,234, 650,819, 2,014,710, decimals, negative, over 2 billion) in both the final state and a paused mid-animation state. The pages themselves were not exercised in a browser during development; review them visually.
