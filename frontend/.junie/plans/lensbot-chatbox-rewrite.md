---
sessionId: session-261021-131517-1hos
---

# Requirements

### Overview
Rewrite `app/dashboard/lensbot/page.tsx` to use shadcn chat components (`MessageScroller`, `Message`, `Bubble`, `Empty`, `InputGroup`, etc.) instead of hand-rolled `<div>` elements. The chat should fill the remaining height of the dashboard layout without overflowing.

### Scope
**In Scope:**
- Rewrite `app/dashboard/lensbot/page.tsx` with shadcn chat components
- Use `MessageScroller` for scrollable message thread with auto-scroll and jump-to-latest
- Use `Message` + `Bubble` for rendering user and assistant messages
- Use `InputGroup` + `InputGroupTextarea` + `InputGroupButton` for the input area
- Use `Empty` for the initial empty state (before messages are sent)
- Use `Trace` for streaming/thinking indicators
- Height: fill the remaining viewport height without overflow (using `flex-1` / `h-full`)

**Out of Scope:**
- Adding new shadcn components (all needed components are already installed)
- Backend AI integration changes (keeping the existing `createChat` placeholder transport)
- Authentication or routing changes

### Key Constraints
- Do **not** introduce custom components — only use existing shadcn components
- The chat container must fill the remaining height of the dashboard `main` area (which has `flex-1 p-6`)
- Use `hugeicons` for icons (project's icon library)
- Project uses shadcn `base` style with `maia` preset

# Technical Design

### Current Implementation
`app/dashboard/lensbot/page.tsx` is a `"use client"` component that:
1. Uses `createChat()` from `@shadcn/helpers/ai-sdk` for a placeholder transport with 4 pre-seeded messages
2. Uses `useChat()` from `@ai-sdk/react` with `initialMessages` and `transport`
3. Renders messages as plain `<div>` + `<span>` elements — no shadcn components
4. Has a raw `<button>` for sending the next placeholder message
5. The `Page` component wraps everything in a bare `<div>` with no layout styling

### Key Decisions
- **Layout**: The page wrapper uses `flex flex-col h-full` so the `MessageScroller` can take `flex-1` and fill remaining height. The input stays pinned at the bottom.
- **Empty state**: Show an `Empty` component with the `AiBrain04Icon` (matching the sidebar nav icon for LensBot) when no messages exist, replaced by the message thread once messages are present.
- **Message rendering**: User messages use `align="end"` with `Bubble variant="default"`. Assistant messages use `align="start"` with `Bubble variant="secondary"`. Each message is wrapped in `MessageScrollerItem` with `scrollAnchor` on user messages.
- **Streaming indicator**: A `TraceLine` with `status="running"` shows while `status === "streaming"`.
- **Input**: `InputGroup` with `InputGroupTextarea` for multi-line input and `InputGroupButton` (submit type) with a send icon. Disabled while streaming.
- **Icons**: `Send01Icon` from `@hugeicons/core-free-icons` for the send button, `AiBrain04Icon` for the empty state and assistant avatar.

### Proposed Changes
**File: `app/dashboard/lensbot/page.tsx`** — Full rewrite:

1. **Imports**: Add shadcn components (`MessageScrollerProvider`, `MessageScroller`, `MessageScrollerViewport`, `MessageScrollerContent`, `MessageScrollerItem`, `MessageScrollerButton`, `Message`, `MessageContent`, `MessageAvatar`, `Bubble`, `BubbleContent`, `Empty`, `EmptyHeader`, `EmptyMedia`, `EmptyTitle`, `EmptyDescription`, `InputGroup`, `InputGroupTextarea`, `InputGroupButton`, `Trace`, `TraceLine`, `TraceIcon`, `TraceTitle`, `Avatar`, `AvatarFallback`, `Button`, `Spinner`). Add icons (`AiBrain04Icon`, `Send01Icon`) from `@hugeicons/core-free-icons` and `HugeiconsIcon` from `@hugeicons/react`.

2. **`Chat` component**: Replace hand-rolled message list with:
   - `MessageScrollerProvider autoScroll` wrapping the chat
   - `MessageScroller` (flex-1) containing `MessageScrollerViewport` > `MessageScrollerContent` > mapped `MessageScrollerItem`s
   - Each `MessageScrollerItem` wraps a `Message` with `MessageAvatar` (for assistant), `MessageContent`, and `Bubble`/`BubbleContent`
   - `MessageScrollerButton` for jump-to-latest
   - `Trace` with `TraceLine status="running"` while streaming
   - `Empty` state when messages are empty

3. **Input area**: `InputGroup` with `InputGroupTextarea` (controlled, with `onKeyDown` for Enter to submit) and `InputGroupButton` (type="submit", disabled while streaming or no input).

4. **`Page` component**: Wrapper with `flex flex-col h-full` to fill the dashboard main area.

### Components Used (all already installed)
| Component | Purpose |
|---|---|
| `MessageScrollerProvider` | Auto-scroll context |
| `MessageScroller` / `Viewport` / `Content` / `Item` | Scrollable thread |
| `MessageScrollerButton` | Jump-to-latest button |
| `Message` / `MessageContent` / `MessageAvatar` | Message row layout |
| `Bubble` / `BubbleContent` | Message bubble surface |
| `Empty` / `EmptyHeader` / `EmptyMedia` / `EmptyTitle` / `EmptyDescription` | Empty state |
| `InputGroup` / `InputGroupTextarea` / `InputGroupButton` | Input area |
| `Trace` / `TraceLine` / `TraceIcon` / `TraceTitle` | Streaming indicator |
| `Avatar` / `AvatarFallback` | Assistant avatar |
| `Button` / `Spinner` | Loading state on button |
| `HugeiconsIcon` | Icons (AiBrain04Icon, Send01Icon) |

# Delivery Steps

### ✓ Step 1: Rewrite lensbot/page.tsx with shadcn chat components
Replace the hand-rolled chat UI in `app/dashboard/lensbot/page.tsx` with a full shadcn chat composition.

- Rewrite the `Page` component to use `flex flex-col h-full` layout filling the dashboard main area
- Rewrite the `Chat` component with:
  - `MessageScrollerProvider` with `autoScroll` wrapping the entire chat
  - `MessageScroller` (with `flex-1 min-h-0`) containing `MessageScrollerViewport` > `MessageScrollerContent` > `MessageScrollerItem` for each message
  - `Message` rows with `MessageAvatar` (assistant avatar using `Avatar` + `AiBrain04Icon`), `MessageContent`, and `Bubble`/`BubbleContent` for the text
  - User messages with `align="end"` and `Bubble variant="default"`; assistant messages with `align="start"` and `Bubble variant="secondary"`
  - `scrollAnchor` on user message items for proper anchoring
  - `MessageScrollerButton` for jump-to-latest
  - `Trace` with `TraceLine status="running"` shown while `status === "streaming"`
  - `Empty` state (with `AiBrain04Icon`, title, and description) when no messages are present
- Add an input area using `InputGroup` with `InputGroupTextarea` (controlled via `useState`) and `InputGroupButton` with `Send01Icon` (disabled while streaming or input is empty), supporting Enter key to submit
- Keep the existing `createChat` placeholder transport and `useChat` integration unchanged
- Use `HugeiconsIcon` from `@hugeicons/react` with icons from `@hugeicons/core-free-icons`

### ✓ Step 2: Verify layout, height behavior, and component correctness
Validate that the rewritten page renders correctly and respects the height constraint.

- Confirm the chat fills the remaining height of the dashboard `main` area (`flex-1`) without overflowing
- Verify `MessageScroller` properly handles scrolling, auto-follow, and the jump-to-latest button
- Check that the `Empty` state displays correctly when no messages exist
- Verify message rendering: user messages aligned right with primary bubble, assistant messages aligned left with secondary bubble and avatar
- Confirm the input area stays pinned at the bottom with proper disabled state during streaming
- Ensure no custom components are introduced — only existing shadcn components are used
- Check that icons use the project's `hugeicons` library consistently