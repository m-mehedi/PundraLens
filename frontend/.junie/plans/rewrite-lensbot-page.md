---
sessionId: session-261021-125417-16ck
---

# Requirements

### Overview
Refactor the `@app/dashboard/lensbot/page.tsx` to properly fill all available vertical space within the dashboard layout, without overflow issues. The chat interface should adapt to the parent container's height rather than using fixed viewport calculations.

### Key Changes
- **Remove `Card` wrapper**: The `Card` and `CardContent` components add unnecessary padding and borders for a full-height chat interface.
- **Replace fixed height**: Change from `h-[calc(100vh-2rem)]` to flexbox-based layout that fills the available space in the dashboard `<main>` container.
- **Keep shadcn components**: Retain all existing shadcn AI chat components (MessageScroller, Message, Bubble, Marker, InputGroup) — they're already the correct choice.
- **Remove unused import**: The `Button` import is not used in the component.

### Current Problem
The `Card` with `h-[calc(100vh-2rem)]` doesn't account for the dashboard header, sidebar, and padding correctly, causing potential overflow or wasted space depending on the viewport and sidebar state.

# Technical Design

### Current Implementation
`app/dashboard/lensbot/page.tsx` wraps the entire chat in `<Card>` → `<CardContent>`, with a fixed `h-[calc(100vh-2rem)]` height. The dashboard layout (`app/dashboard/layout.tsx`) renders children inside `<main className="flex-1 p-6">`, which is already flex-grow within `SidebarInset`.

### Proposed Changes

1. **Remove `Card`/`CardContent` wrapper** — The chat should be a simple flex container that fills its parent (`<main>`) naturally.
2. **Use `flex flex-col h-full`** on the root container to fill the available height from the dashboard layout's `flex-1` main area.
3. **Remove unused `Button` import**.
4. **Keep all shadcn chat components** as-is (MessageScroller, Message, Bubble, Marker, InputGroup, etc.).

### Approach
The root element becomes a `div` with `flex flex-col` that fills the parent. The `MessageScrollerProvider` takes `flex-1` to fill available space, and the input area stays pinned at the bottom with `border-t`.

# Delivery Steps

### * Step 1: Refactor lensbot page to fill available height
Rewrite `app/dashboard/lensbot/page.tsx` to remove the Card wrapper and use flexbox to fill the dashboard's available height.
- Replace `<Card>` and `<CardContent>` with a simple `<div className="flex flex-col">` as the root container.
- Apply `flex-1` to the `MessageScrollerProvider` so the message list fills available space.
- Keep the input area at the bottom with `border-t p-4`.
- Remove the unused `Button` import.
- Remove the `h-[calc(100vh-2rem)]` fixed height class.