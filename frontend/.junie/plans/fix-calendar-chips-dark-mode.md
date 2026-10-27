---
sessionId: session-261027-062201-1mli
---

# Problem & Changes

## Problem

The calendar event chips in the dashboard (`/dashboard`) don't render well in dark mode. Two issues:

1. **Box shadow is white in dark mode** — `.notice-calendar .rbc-event` uses `box-shadow: 2px 2px 0 color-mix(in oklab, var(--foreground) 12%, transparent)`. In dark mode `--foreground` is white (`oklch(0.987 0.002 197.1)`), so the offset shadow becomes a glaring white block instead of a subtle dark shadow.

2. **Outline variant pin is invisible in dark mode** — `event-variant-outline` sets `--event-bg: var(--background)`, which the `::before` pin pseudo-element uses for its background color. In dark mode `--background` is the same dark color as the card, so the 4px colored strip disappears entirely.

## Changes

Both fixes are in `app/globals.css`:

1. Replace `var(--foreground)` in the box-shadow with a fixed dark oklch value (`oklch(0.2 0 0)`) so the shadow is always a dark offset — matching the light-mode intent.

2. Add a `.dark` override for `.notice-calendar .rbc-event.event-variant-outline` that sets `--event-bg: var(--muted-foreground)` so the outline pin remains visible in dark mode as a subtle gray strip.

# Delivery Steps

### ✓ Step 1: Fix calendar chip dark-mode styling in globals.css
Update `app/globals.css` to make calendar event chips render correctly in dark mode.
- Replace `var(--foreground)` with `oklch(0.2 0 0)` in the box-shadow of `.notice-calendar .rbc-event` (line 582) and `.notice-calendar .rbc-event:hover` (line 606) so the offset shadow is always dark.
- Add a `.dark .notice-calendar .rbc-event.event-variant-outline` rule that sets `--event-bg: var(--muted-foreground)` so the outline variant's left pin strip stays visible in dark mode.