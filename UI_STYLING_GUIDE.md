# UI styling guide (dashboard / main app parity)

Pass this file in prompts when you want changes aligned with the product visual language.

## UI parity checklist

| Area | Standard |
|------|----------|
| Font | Mulish (`font-sans`), from `globals.css` |
| Base radius | `0.75rem` → Tailwind `rounded-lg` maps to `--radius`; prefer `rounded-xl` / `rounded-2xl` for surfaces |
| Primary | `#0D3C6F` → `bg-primary`, `text-primary`, `ring-ring` |
| Page background | `#fdfcf8` → `bg-background` |
| Cards | `bg-card`, `text-card-foreground`, `border-border`, `shadow-sm` |
| Body text | `text-foreground` (slate-900 family) |
| Borders | `border-border` (slate-200 equivalent) |
| Semantic accents | `blue`, `purple`/`violet`, `emerald`, `amber`, `rose` Tailwind families — no ad-hoc hex |
| Buttons | `<Button />`: `rounded-xl`, `lg` → `rounded-2xl`; motion tap ≈ `0.97` |
| Icon buttons | `size="icon"` → `h-10 w-10` |
| Icons in chrome | Default `size-4` (16px); inline status `size-3.5` (14px); empty/hero blocks `size-10` |
| Phosphor weight | Use one weight per surface (dashboard + ATS score: **`duotone`**); keep **`CircleNotchIcon`** default for spinners |
| Inputs | `<Input />`: `rounded-xl`, `h-10` |
| Badges | `<Badge />`: compact, `font-semibold`, `rounded-full` pill |
| Spacing | 4/8px rhythm (`gap-2`, `p-4`, `space-y-2`) |
| Motion | `duration-200`–`300`; `active:scale-[0.97]` on custom controls; respect `prefers-reduced-motion` (global) |
| Avoid | One-off `indigo-*` for brand actions — use `primary` tokens |

## Source of truth

1. **CSS variables** — `src/styles/globals.css` (`:root`, `@theme inline`)
2. **Reusable class strings** — `src/utils/ui-tokens.ts` (`uiSurface`, `uiControl`, `uiTypography`)
3. **Primitives** — `src/components/ui/button.tsx`, `input.tsx`, `badge.tsx`, `card.tsx`

## Patterns

- **Primary CTA**: `<Button>…</Button>` default variant, or `uiControl.primaryButton` for raw `<button>`.
- **Card block**: `<Card><CardHeader>…</CardHeader><CardContent>…</CardContent></Card>` or `uiSurface.card` on a `div`.
- **Empty state**: `uiSurface.empty` + `text-muted-foreground` for copy.
- **Score / status chips**: `<Badge variant="emerald" />` etc., or shared `bg-*-100 text-*-800` semantic classes.

## Dark mode

Dark tokens live in `globals.css` under `.dark`. New surfaces should work in both or be documented as light-only.
