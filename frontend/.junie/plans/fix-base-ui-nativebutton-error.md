---
sessionId: session-261021-133633-10hr
---

# Problem & Fix

### Root Cause
Base UI's `Button` component defaults to `nativeButton={true}`, meaning when using the `render` prop, it expects the rendered element to be a native `<button>`. Passing a `<Link>` (which renders as `<a>`) triggers the console error.

The `nativeButton` prop is **specific to Base UI's `Button`** — it is **not** supported by `SidebarMenuButton`, which uses `useRender` internally without exposing that prop. Passing `nativeButton` to `SidebarMenuButton` causes React to warn about an unknown DOM attribute because the prop leaks through to the rendered element.

### Affected Locations
1. **`app/page.tsx`** (lines 81–82): Two `<Button>` components use `render={<Link>}` — needs `nativeButton={false}`.
2. **`components/dashboard/sidebar-nav.tsx`** (lines 83, 103, 124): Three `<SidebarMenuButton>` components use `render={<Link>}` — **no change needed**, `nativeButton` is not a valid prop.

### Fix
Add `nativeButton={false}` only to the `Button` components in `app/page.tsx`. Remove `nativeButton={false}` from `SidebarMenuButton` in `sidebar-nav.tsx` if it was previously added.

#### `app/page.tsx`
```
// Before
<Button size="lg" render={<Link href="/login">Log In</Link>} />
<Button variant="outline" size="lg" render={<Link href="/signup">Sign Up</Link>} />

// After
<Button size="lg" nativeButton={false} render={<Link href="/login">Log In</Link>} />
<Button variant="outline" size="lg" nativeButton={false} render={<Link href="/signup">Sign Up</Link>} />
```

#### `components/dashboard/sidebar-nav.tsx`
Remove `nativeButton={false}` from each `<SidebarMenuButton>` that uses `render={<Link>}` (3 instances). The `render` prop with `<Link>` works correctly without `nativeButton`.

# Delivery Steps

### ✓ Step 1: Fix Button nativeButton error in app/page.tsx
Add `nativeButton={false}` to the two Button components that render Next.js Link elements.

### ✓ Step 2: Remove nativeButton from SidebarMenuButton in sidebar-nav.tsx
Remove `nativeButton={false}` from the three SidebarMenuButton components that render Next.js Link elements, as that prop is not supported and causes React DOM warnings.