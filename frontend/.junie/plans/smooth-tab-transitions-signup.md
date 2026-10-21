---
sessionId: session-261021-104132-fmy0
---

# Technical Design

### Current Implementation
- `components/signup-form/index.tsx` — two `TabsContent` panels (account on lines 76-154, password on lines 157-196) inside a `Tabs` from `@/components/ui/tabs`.
- `components/ui/tabs.tsx` — wraps `@base-ui/react/tabs`, no animation support.
- `motion` (v14.5.0) is already installed.

### Key Decisions
1. **`AnimatePresence` with `mode="wait"`** — exit finishes before enter starts, no overlapping content.
2. **`motion.div` inside each `TabsContent`** — wraps the inner form fields with `initial`/`animate`/`exit` props.
3. **Opacity + y-axis slide** — `opacity: 0→1`, `y: 20→0` for enter; `opacity: 1→0`, `y: 0→-20` for exit. Duration 0.2s.
4. **Import from `motion/react`** — per motion skill React best practices.

### Proposed Changes
Modify only `components/signup-form/index.tsx`:
- Import `AnimatePresence` and `motion` from `motion/react`.
- Wrap the two `TabsContent` elements in `<AnimatePresence mode="wait">`.
- Inside each `TabsContent`, wrap the form fields in a `motion.div` with transition props.
- No other files changed.

# Delivery Steps

### ✓ Step 1: Import motion and add AnimatePresence wrapper
Add motion imports and wrap the tab contents in AnimatePresence.

- In `components/signup-form/index.tsx`, add `import { AnimatePresence, motion } from "motion/react"`.
- Wrap the two `TabsContent` elements inside `<AnimatePresence mode="wait">`.
- Each `TabsContent` keeps its `value` and `className` props intact.

### ✓ Step 2: Add motion.div wrappers with fade+slide transitions
Wrap the inner content of each tab in a motion.div with enter/exit animations.

- Inside the "account" `TabsContent`, wrap the FieldGroup and Next button in a `motion.div` with `initial={{ opacity: 0, y: 20 }}`, `animate={{ opacity: 1, y: 0 }}`, `exit={{ opacity: 0, y: -20 }}`, `transition={{ duration: 0.2 }}`.
- Inside the "password" `TabsContent`, wrap the PasswordField components and submit button in a `motion.div` with the same transition props.
- Verify the form still works — validation, step navigation, and submission remain functional.