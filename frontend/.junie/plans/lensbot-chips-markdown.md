---
sessionId: session-261027-060846-1mfx
---

# Testing

### Validation Approach
Run `bun run typecheck` then `bun run lint` after changes.

### Key Scenarios
1. **Markdown rendering** — send a query that returns bold, italic, lists, code blocks, and links. Verify they render correctly in the bubble.
2. **Citation chips** — send a query that returns citations. Verify small outline badges appear below the bubble, each clickable and navigating to the correct notice page.
3. **User messages** — verify user messages still render as plain text (no markdown processing).
4. **Empty state** — verify the empty state and suggestions still work unchanged.
5. **Code blocks** — verify fenced code blocks render with the shadcn `CodeBlock` component (scrollable, with copy button).

### Edge Cases
- Markdown with nested code blocks and lists
- Citations with long titles (should wrap, not truncate)
- No citations returned (citations section should not render)
- Raw markdown that includes HTML (should be escaped by default)

# Delivery Steps

### ✓ Step 1: Install dependencies and code-block component
Add react-markdown, remark-gfm, and the shadcn code-block component.
- Run `bun add react-markdown remark-gfm` to add markdown parsing libraries
- Run `bunx --bun shadcn@latest add code-block` to install the code-block UI component
- Verify the code-block files are created in `components/ui/` and replace any icon imports with hugeicons if needed

### ✓ Step 2: Create MarkdownContent component
Build a reusable markdown renderer at `components/lensbot-markdown.tsx`.
- Wrap `react-markdown` with `remark-gfm` plugin
- Override `code` (inline) to render as `bg-muted px-1 py-0.5 rounded text-xs font-mono`
- Override `pre` to render as shadcn `CodeBlock` with `CodeBlockContent` (wrap, max-h-64)
- Override `a` to render as a styled link
- Override `table`, `ul`/`ol`, `blockquote` with clean Tailwind styling
- Keep it minimal — no custom hooks, just a presentational component

### ✓ Step 3: Update LensBot page: markdown rendering and citation chips
Modify `app/dashboard/lensbot/page.tsx` to render markdown and simplify citations.
- Import `MarkdownContent` and use it inside `BubbleContent` for assistant messages (replace `{text}` with `<MarkdownContent>{text}</MarkdownContent>`)
- Replace the citation block (lines 224-245): remove `paper`/`tape`/`paper-torn` classes, `matching_passage`, and `#{id}`
- Render citations as a `flex flex-wrap gap-1.5` row of `Link`-wrapped `Badge` chips (`variant="outline"`) showing only the notice title
- Each chip links to `/dashboard/notices/{notice_id}`
- Run `bun run typecheck` and `bun run lint` to validate

### ✓ Step 4: Fix citation chip text truncation
Remove truncation so long notice titles wrap inside the badge instead of being cut off.
- In `app/dashboard/lensbot/page.tsx`, remove `truncate max-w-[200px]` from the `Badge` className
- Add `text-left` to ensure text aligns left within the badge
- Allow the badge to grow naturally with the text width (remove fixed max-width constraint)
- Run `bun run typecheck` and `bun run lint` to validate