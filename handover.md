# PundraNoticeLens — Notice Workbench Handover

A working reference for the **Upload Notice** screen: the page where university
staff turn a photo, a PDF or a typed notice into a published notice.

It covers the two panels (**Edit** and **Extract**), the data model underneath
them, the exact contract with the backend, and the handful of things that will
break the screen if they are changed carelessly.

Read this before touching anything in `frontend/components/upload-notice/`.

---

## 1. What the screen does

```
upload a photo / PDF / text file
        ↓
EDIT  panel   wrap the page (4 corners), crop it, hide parts of it,
              sharpen / grayscale it — page by page, in the page panel
        ↓
EXTRACT panel read the page(s) with the model, correct every field by hand,
              save the notice as a draft or publish it
```

The work is kept in the browser (IndexedDB) while it is unsaved, so a refresh
does not lose it.

---

## 2. Where the code lives

### The panels — `frontend/components/upload-notice/`

| File | Lines | What it is |
|---|---|---|
| `upload-notice-workbench.tsx` | 371 | The two-tab shell. Owns the layout of the Edit tab and wires every prop down. |
| `use-upload-notice.ts` | 1170 | **The state machine.** All document state, the ops pipeline, the tools, the extraction. |
| `types.ts` | 263 | `NoticeItem`, `EditOp`, `MaskShape`, `ItemResult`, `Corner`, `Rect`, `PreviewImage`. |
| `tool-dock.tsx` | 81 | The icon rail (Move / Corners / Crop / Hide / Adjust). |
| `tool-options.tsx` | 318 | The options bar under the rail; it swaps with the active tool. |
| `notice-canvas.tsx` | 501 | The canvas: a fixed-size window onto an infinite scene. |
| `polygon-overlay.tsx` | 104 | The four corners of the notice. |
| `crop-overlay.tsx` | 235 | The crop rectangle, with aspect locking. |
| `mask-overlay.tsx` | 464 | The regions to hide (rectangle, circle, triangle, freehand, polygon). |
| `page-panel.tsx` | 236 | The pages of the document, in the panel beside the canvas. |
| `editor-context-bar.tsx` | 148 | Reset the page, hold-to-compare, zoom, page counter. |
| `upload-progress.tsx` | 99 | The upload toast: the bar that says how far along the files are. |
| `middle-truncate.tsx` | 59 | Shortens a file name in the middle. |
| `upload-dropzone.tsx` | 94 | The empty state. |
| `text-editor.tsx` | 296 | The editor for a typed notice — the notice itself, edited. |
| `extract-panel.tsx` | 422 | The Extract tab. |
| `notice-sheet.tsx` | 237 | What the machine saw: the rectified page, the metadata, the raw text. |
| `notice-form.tsx` | 515 | The editable form — every field the model produced. |
| `use-notice-form.ts` | 309 | The form's state, `missing`, `isDirty`, and the save payload. |
| `save-notice-panel.tsx` | 219 | Save as draft / publish. |
| `extraction-progress.tsx` | 141 | The progress clock and the Extract button. |
| `draft-restore-prompt.tsx` | 128 | The toast that offers the unsaved work back. |
| `deadline-stamp.tsx` | 94 | The nearest deadline, as a stamp. |
| `field-meta.ts` | 48 | Category labels, currencies, date helpers. |
| `use-image-drag.ts` | 43 | The shared pointer-drag primitive. |

### The libraries — `frontend/lib/`

| File | What it is |
|---|---|
| `image-ops.ts` | The pixel work: decode (with EXIF), crop, grayscale, sharpen, bake the hidden regions, encode. |
| `corner-geometry.ts` | Percent clamping, rect conversion, and the crop-chain remapping for corners and shapes. |
| `pdf-pages.ts` | Renders a PDF into pages, and makes the panel thumbnails. |
| `pdf-builder.ts` | Puts the pages of a document into one PDF, for the model to read. |
| `draft-store.ts` | The IndexedDB draft store. |
| `truncate-middle.ts` | The macOS-style middle truncation. |
| `backend.ts` | `callBackend` / `forwardBackend` / `backendUnreachable` — how the browser talks to the FastAPI app. |

### The backend — `backend/`

| File | What it is |
|---|---|
| `api.py` | `POST /api/align`, `POST /api/render`, `POST /api/extract`. |
| `pipeline/ingestion.py` | `render_pdf_pages`, `render_pdf_pages_with_total`, `process_pages`, `process_document`. |
| `pipeline/align.py` | `detect_corners` (the DocAligner model) and the corner clamping. |
| `pipeline/preprocess.py` | The denoise / binarise steps before OCR. |

---

## 3. The data model

### `NoticeItem` — one page of the document

```ts
{
  id: string
  label: string            // "Page 2", "Photo", or the file name
  sourceFile: File         // the bytes as they arrived (a rendered page, or the photo)
  sourceUrl: string        // blob: URL of the untouched original — hold-to-compare
  thumbUrl: string         // blob: URL of the panel thumbnail
  sourceWidth: number      // the natural size of the original
  sourceHeight: number
  baseFile: File           // the confirmed working image
  ops: EditOp[]            // the pending changes, in order
  points: Corner[]         // the four corners, as percentages
  autoFilled: boolean[]    // which corners the detector could not find
  preview?: PreviewImage   // the rendered current state
  previewRevision?: number // the revision the preview was rendered from
  revision: number         // bumped on every change; drives the re-render
  edited: boolean
}
```

### `EditOp` — the pending changes on a page

```ts
{ id, kind: "crop",      rect: Rect, frameWidth, frameHeight }
{ id, kind: "grayscale" }
{ id, kind: "sharpen" }
{ id, kind: "mask",      shapes: MaskShape[], frameWidth, frameHeight }
```

The ops are **replayed in order** over the decoded `baseFile` every time the
page changes. `frameWidth`/`frameHeight` record the frame the op was drawn on,
so an op still makes sense after the frame has changed.

### `MaskShape` — a region to hide

```ts
{ id, kind: "rect",     x, y, width, height }
{ id, kind: "circle",   cx, cy, radius }        // radius is % of the WIDTH
{ id, kind: "triangle", points: [x, y][] }
{ id, kind: "polygon",  points: [x, y][] }
{ id, kind: "stroke",   points: [x, y][], width } // freehand
```

### The three coordinate systems — the most important thing to get right

| What | Unit | Notes |
|---|---|---|
| Corners | **% of the natural image** (0–100) | This is what the backend expects. |
| The crop rectangle | **% of the natural image** | |
| The mask shapes | **% of the natural image** | A circle's radius is % of the *width*, so it stays round. |
| The ops' `rect` | **% of the frame the op was drawn on** | Converted to pixels at replay time. |
| The canvas | image px → screen px via `zoom` + `scrollX/scrollY` | `useCanvas()` exposes `zoom`, `scrollX`, `scrollY`, `box`, `toImage()`, `toWorld()`. |

**The corners are percentages. The backend already returns percentages. Never
divide them by the image size again** — that was a real bug once.

---

## 4. The Edit panel

### The shell — `upload-notice-workbench.tsx`

```
<Tabs value={activeTab}>                     // "edit" | "extract"
  <TabsList variant="line" grid-cols-2>      // Edit | Extract
  <TabsContent value="edit">
      isTextMode   → <TextEditor> + "Open a photo or PDF instead"
      !hasPages    → <UploadDropzone>
      hasPages     → ① dock row      <ToolDock> … <EditorContextBar>
                    ② options bar   <ToolOptions>
                    ③ canvas card   <NoticeCanvas> + the three overlays
                    ④ page panel    <PagePanel> (beside the canvas)
  <TabsContent value="extract">
      <ExtractPanel>
```

Two effects live in the shell:

- **Arrow keys** move between pages (`←` / `→`), ignored while typing in a field.
- **The draft autosave** — 1500 ms debounce, writes the document to IndexedDB.

### The typed notice — `text-editor.tsx`

A notice that was typed rather than photographed is edited **as the notice
itself**: there is no raw text anywhere. The staff member types into the
notice and the toolbar formats what they have selected.

- The editor is **TipTap** (`@tiptap/react`, `StarterKit`, `TableKit`,
  `@tiptap/markdown`). The notice is **markdown on the way in and markdown
  on the way out** — `editor.getMarkdown()` is what `onChange` carries, so
  the draft, the extraction (`plain_text`) and the stored `raw_text` all
  keep the structure the staff member gave the notice.
- The toolbar: **H1 · H2 · H3 · Bold · Italic · Bullet list · Numbered list
  · Table**. The table button is TipTap's own `insertTable` (3 × 3, with a
  header row). The active buttons come from `useEditorState`, so typing
  does not re-render the toolbar.
- The box is bounded (`h-[62vh] min-h-[440px]`, like the canvas row) and
  **scrolls**; the toolbar is `sticky top-0` inside it, so it stays put
  while the notice scrolls under it. The notice is set at `lg` (18 px).
- Text that comes from **outside** the editor — a draft that was restored,
  a file that was replaced — is put back with
  `editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false })`.
  It is only done when the incoming text is not the text the editor last
  produced (a ref remembers it), so the caret never jumps while typing.
- While the notice is being read by the model it cannot be edited:
  `editor.setEditable(false)`.
- The styles live in `.notice-body` (`app/globals.css`), on the element
  TipTap gives the editor through `editorProps.attributes.class`.

### The tool dock — `tool-dock.tsx`

Five icon-only buttons in a `role="toolbar"`, each in a `Tooltip` (the name
appears on hover). `aria-pressed` marks the active one.

| id | Label | What it does |
|---|---|---|
| `move` | Move the page | Drag to move the page. The only tool that does not draw. |
| `corners` | Corners | Place the four corners of the notice, then wrap it. |
| `crop` | Crop | Draw a crop rectangle. |
| `hide` | Hide a part | Cover a region with black. |
| `adjust` | Adjust | Sharpen, grayscale. |

`setTool` records the tool the user came from in `toolHistoryRef` (max 10), and
`goBackToPreviousTool()` pops it — that is how *Apply crop* and *Confirm* return
you to where you were.

### The options bar — `tool-options.tsx`

One bar that swaps with the tool. Every tool also gets the shared strip on the
right: the number of pending changes, **Discard all**, and **Reset the page**.

| Tool | Controls |
|---|---|
| `move` | Nothing — the tool itself is the hint. |
| `corners` | **Auto-detect** · **Add 4 corners** · **Remove all** · **Wrap** |
| `crop` | Aspect **Free / 1:1 / 1:2 / 2:1**, then **Apply crop** (and **Cancel** while a draft exists). |
| `hide` | Shape **Rectangle / Circle / Triangle**, **Clear all**, and **Confirm**. |
| `adjust` | **Sharpen** · **Grayscale**. |

### The canvas — `notice-canvas.tsx`

The canvas is **Excalidraw's model**: a fixed-size window onto an infinite
scene. The window never grows — the page is drawn at `zoom` and placed at
`scrollX`/`scrollY`, and whatever falls outside the window is simply not
drawn.

- `scrollX`/`scrollY` are **scene units** (image pixels) and `zoom` is the
  scale. `scene → viewport: v = (s + scroll) · zoom`, and back again
  `s = v / zoom − scroll`. This is Excalidraw's arithmetic
  (`packages/common/src/utils.ts` in the Excalidraw repo).
- **The wheel zooms to the cursor**, the way a photo editor does. A native
  non-passive listener is used so `preventDefault` works, and the canvas keeps
  the wheel: the page underneath does not scroll while the pointer is over
  the photo.
- **Dragging moves the page** with the Move tool, with space held, or with the
  middle button. The move is applied once per frame. Space and the middle
  button are caught in the *capture* phase, so the overlay never sees the
  pointer and the page moves instead of being drawn on.
- A zoom keeps the point under the cursor still:
  `scroll' = scroll + p/next − p/current`.
- The zoom runs from 10 % to 3000 % in steps of ten points (Excalidraw's
  `MIN_ZOOM`, `MAX_ZOOM` and `ZOOM_STEP`).
- **Fit** puts the whole page into the canvas without blowing it up past its
  own size (Excalidraw's "scale-down"). A page is fitted when it opens, so it
  is never out of sight.
- `useCanvas()` gives the overlays
  `{ zoom, scrollX, scrollY, box, toImage(), toWorld() }`. Overlays convert
  with plain multiplication, which is why the cropper's
  `visibleArea`/`boundary` maths is gone.
- The imperative handle `NoticeCanvasHandle` exposes `zoomIn()`, `zoomOut()`
  and `fit()` to the context bar.

### The overlays

All three live inside the canvas and work in image pixels.

- **Corners** (`polygon-overlay.tsx`) — the four corners as percentages, drawn
  as an SVG polygon plus four handles at a fixed screen size. Dragging one
  clamps it to 0–100.
- **Crop** (`crop-overlay.tsx`) — drag on the page to draw one, drag it to
  move, drag a corner to resize. The aspect lock is applied by `fitAspect()`.
  Drawn with a dimmed surround and a rule-of-thirds grid.
- **Hide** (`mask-overlay.tsx`) — drag to draw a rectangle, circle, triangle or
  freehand stroke; a polygon is drawn corner by corner (click the first corner
  again, or double-click, to close it). Every shape can be moved and resized
  until it is confirmed. The shapes are shown as a dark wash so it is obvious
  what will be covered — **nothing is burned into the image until *Confirm*.**

`use-image-drag.ts` is the shared drag primitive: `useImageDrag()` returns a
factory, so one hook serves every handle.

### The page panel — `page-panel.tsx`

A column **beside** the canvas, so nothing ever covers the photo or its
handles. The pages are numbered by their place in the document — "1", "2",
"3" — and the file a page came from is its tooltip.

- Thumbnails keep the page's own aspect: a fixed 68 px height, the width from
  `sourceWidth / sourceHeight`.
- The number is **middle-truncated** so it can never stretch the cell.
- An **×** removes the page; a **+** after the pages appends more photos or a
  PDF.
- The active thumbnail gets a `motion` `layoutId` ring; an amber dot means
  "changed", a green tick means "read".
- `scrollIntoView({ block: "nearest" })` brings the active page into view only
  as far as it has to — using `"center"` scrolled the other pages out of sight.
- The list **scrolls**, and the scrollbar is visible (`.page-scroll` in
  `app/globals.css`). The row that holds the canvas and the panel has a
  **definite height** (`h-[62vh] min-h-[440px]`) — without one, the panel's
  content decides the height of the row, the list never gets a bounded box,
  and a long document pushes the whole page off the screen.

### The hook — `use-upload-notice.ts`

Everything lives here. The important parts:

**The preview effect.** When the open page's `revision` changes, the ops are
replayed and the result is written back as `preview` + `previewRevision`. If
the preview is already current it is skipped, so switching pages does not
re-decode an image that is already rendered.

**`renderPreview`** replays the ops over the decoded base:

```
crop  → cropImage(image, pixel rect from the op's percentages)
grayscale → grayscaleImage(image)
sharpen → sharpenImage(image)
mask  → bakeMaskShapes(image, op.shapes)
```

With **no ops at all** it returns the original bytes, so an untouched photo is
uploaded byte-for-byte as it was picked.

**The history.** The hook remembers the document as it is before every
change, so **undo and redo** work across the whole document, not just the open
page. A snapshot holds every page's `ops`, `points`, `baseFile` and its
preview **as a blob** — a URL that was revoked would come back as a broken
image. `recordHistory()` is called *before* a change; a drag of a corner
records one step, not one step per pixel (`onGestureStart` on the corner
overlay). Typing is one step per burst (`COALESCE_MS`). The buttons live in
the workbench, and ⌘Z / Ctrl Z and ⇧⌘Z / Ctrl Y work anywhere that is not a
text field.

**Reading the files.** `readFiles` turns a pile of files into pages and
tells the world how far along it is: the total is the number of files, `done`
grows as each one is read, and the label names the file. The progress lives
in a small store (`upload-progress.tsx`) rather than in React state, because
the toast is rendered by sonner in its own tree. A PDF says "Rendering
notice.pdf" while the backend works.

**Wrapping.** `applyWarp` posts the page and the four corners (`POST
/api/pipeline/warp`) and the **server** wraps it — OpenCV's
`warpPerspective`, the same `warp_with_corners` the extraction uses. The
picture that comes back becomes the page: the pending changes are baked in,
the corners become the whole rectangle, and the thumbnail is drawn again.
One history step, so an undo puts the crooked page back.

The wrap used to be done in the browser, by drawing the page as a mesh of
triangles (a canvas only knows affine transforms, so a projective warp has
to be faked). Every triangle's clip edge left a hairline seam, and a page
came out looking scratched. Do not put it back: one resampling on the
server has no seams, the browser's does.

**The actions** (all in the hook's return): `handleFiles`, `appendFiles`,
`removeItem`, `restoreDraft`, `resetAll`, `selectItem` / `selectNext` /
`selectPrevious`, `handlePointChange`, `detectCorners`, `addFourCorners`,
`clearCorners`, `setCrop` / `applyCrop` / `cancelCrop`, `addMaskShape` /
`updateMaskShapes` / `removeMaskShape` / `clearMaskShapes` / `applyMask`,
`addGrayscale`, `addSharpen`, `removeOp`, `discardOps`, `confirmEdits`,
`resetImage`, `applyWarp`, `refreshThumbnail`, `extractText`, `undo` / `redo` /
`beginEdit`.

---

## 5. The Extract panel

### The shell — `extract-panel.tsx`

```
① header      "Ready to extract" + what will happen
              [Choose a file] [Adjust the page] [Extract / Extract again]
② results     one button per notice that was read (when there is more than one)
③ progress    the stage and the clock
④ two columns
   left       <NoticeSheet> — the rectified page, the deadlines, the raw text
   right      <NoticeForm> — every field, editable
              <SaveNoticePanel> — save as draft / publish
```

### One file, one notice

The browser puts every page of the document into **one PDF**
(`lib/pdf-builder.ts`, `pdf-lib`) and posts that single file to
`POST /api/extract`. The pages are already wrapped in the editor, so
**no corners are sent** — the backend reads the PDF as it is.

One notice comes back for the whole document. The backend reads up to thirty
pages of a scanned document (`MAX_OCR_PAGES`) and says how many it read, so
the panel can tell the user when a document was too long.

### The results and staleness

Each result carries a **fingerprint** of the document when it was read
(`preview url | corners | model`). If the page has moved on since, the Extract
tab shows a red dot on the tab and an *"The photo changed after this
extraction"* alert with an *Extract again* button.

### The notice form — `notice-form.tsx` / `use-notice-form.ts`

Six sections — Heading, When, Who and where, What to do, Money and contact,
Summary. Everything the model produced is copied in, so a staff member can
correct it. A field the model could not read is marked **"not found"**; it is
only "missing" while it is still empty, and `missingCount` is what the save bar
uses to warn before publishing.

The Bangla summary uses `font-bengali` and `lang="bn"` (see §7).

### The draft offer — `draft-restore-prompt.tsx`

The unsaved work is offered in a **toast in the corner**, not in a dialog in
the face: the workbench stays usable while the question is pending. "Load
draft" puts it back, "Start fresh" throws it away, and closing the toast
leaves it alone — the autosave overwrites it anyway.

**The question is asked once.** The draft carries a `prompted` flag, and it
is set the moment the offer is shown, so a draft that has been offered is
never offered again — whether the person answered it or walked away from
it. `saveDraft` carries the flag over when the autosave rewrites the
draft, so it survives. Only a *new* draft (started fresh later) is
offered again.

### The save flow — `save-notice-panel.tsx`

`saveNoticeAction` / `publishSavedNoticeAction` are server actions in
`frontend/lib/notice-actions.ts`. The panel shows a "fields still need a check"
dialog before publishing. `onSaved` fires once the notice is on the board — that
is when the browser draft is deleted.

---

## 6. The backend contract

The browser never talks to FastAPI directly. Every call goes through
`frontend/app/api/pipeline/<name>/route.ts`, which forwards to
`{BACKEND_URL}/api/<name>` and adds the `X-API-Key` header.

### `POST /api/pipeline/align` — find the corners

```
file: <the current preview as a JPEG>
→ { success, data: { corners: [{x, y} | null] × 4, count, image_width, image_height } }
```

The corners are **percentages**. A `null` slot means the detector could not
find that corner; the frontend fills it with the inset corner and flags it.

### `POST /api/pipeline/warp` — pull the notice back into a rectangle

```
file:    <one image>
corners: '[[x,y],[x,y],[x,y],[x,y]]'   (percentages, TL/TR/BR/BL or any order)
→ { success, data: { image: <a JPEG data URL>, width, height } }
```

Images only (a PDF cannot be wrapped). The four points are the same shape
`/api/extract` takes, and the backend orders them itself. The warp is
OpenCV's `warpPerspective` in one pass, so there are no seams.

### `POST /api/pipeline/render` — a PDF into pages

```
file: <the PDF>   dpi: 200 (default)   max_pages: 30 (default)
→ { success, data: { dpi, page_count, total_pages,
                     pages: [{ page, width, height, image: <base64 PNG> }] } }
```

The pages are rendered **server-side with PyMuPDF at 200 DPI** — the same DPI
the OCR pipeline reads, so the page the staff member edits is the page the
model sees. Rendering client-side was rejected: `pdfjs-dist` costs ~550 kB
gzipped and its modern build needs Chrome 145, and the rasterisers disagree.

### `POST /api/pipeline/extract` — read the notice

```
file:      <one image or one PDF>         ← what the editor sends
files:     <several images, one per page>  ← several pages
plain_text: <the typed text>               ← a typed notice
corners:   '[[x,y],[x,y],[x,y],[x,y]]'                (single page, percentages)
           '[[[x,y]×4], null, [[x,y]×4]]'            (per page; null = as it is)
model:     <the catalogue key>
→ { success, data: { …NoticeExtract…, raw_text, preview_image_base64,
                     potential_duplicates, ocr_unavailable, page_count,
                     pages_read, model } }
```

`file` and `files` are mutually exclusive. `plain_text` needs neither.

**The editor sends a PDF, so it sends no corners.** A PDF cannot be
perspective-corrected by the backend — it refuses corners for PDFs — and it
does not need to: the pages were wrapped in the editor, with
`applyWarp`.

**The corners are validated as 0–100.** A negative corner used to make this
endpoint answer `400` — which is why the backend now clamps the detected
corners into the image bounds (`backend/pipeline/align.py`, `_clamp_corners`).

---

## 7. Do not break these

1. **The corners are percentages, everywhere.** The backend returns 0–100 and
   `/api/extract` validates 0–100. Dividing by the image size again is the bug
   that was already made once.
2. **Clamp anything that becomes a corner.** `clampCorner` /
   `clampPercent` in `lib/corner-geometry.ts`.
3. **A crop changes the frame.** The ops after it are positioned against the
   smaller frame, so removing a crop also drops everything after it, and both
   the corners and the mask shapes have to be remapped (`remapPoints`,
   `remapShapes`).
4. **Baking the hidden regions: the image goes down first.** `writeCanvas`
   uses `putImageData`, which replaces pixels wholesale — anything drawn
   before it is erased.
5. **`blob:` URLs cannot be persisted.** IndexedDB rejects them, and they are
   useless after a reload. The draft stores the `File` and rebuilds the URLs.
6. **The draft key must carry the user id.** IndexedDB belongs to the browser,
   not to the person in front of it — a shared office machine would otherwise
   show one member another's draft.
7. **The canvas is a fixed-size window, not a scrolling box.** The viewport
   element keeps the size of the card and clips whatever is outside it; the
   page is drawn at `zoom` and placed at `scrollX`/`scrollY`. Nothing about
   the zoom changes the layout, so nothing can push the page out of the card.
8. **The scene offset is in image pixels, not screen pixels.** `scrollX` and
   `scrollY` are scene units, so a pan divides the pointer's travel by the
   zoom: `scroll -= delta / zoom`. Mixing the two up makes the page drift
   away from the pointer as you zoom in.
9. **Purno reads small.** The font face carries `size-adjust: 125%`
   (`frontend/app/fonts.ts`) so 20 px of Purno matches 16 px of Inter, and the
   global stacks put Purno behind Inter (`frontend/app/globals.css`) so every
   Bengali character in the app — including the monospace raw-text block —
   falls back to Purno while the Latin text stays in Inter.
10. **The PDF pages are rendered by the backend.** The PNG that comes back is
    what is uploaded, so the OCR reads the same pixels the editor shows.
11. **The lint rules are the React Compiler's.** No writing to a ref during
    render, and no `setState` synchronously in an effect body. The draft
    lookup sets its state from an async callback for exactly this reason.
12. **Never touch `indexedDB` at module scope.** A `"use client"` file is still
    rendered on the server, where `indexedDB` does not exist.
13. **Release only the preview a preview replaces.** Every page keeps its own
    preview URL; the preview effect revokes the URL of the page it is
    re-rendering, and nothing else. Revoking "the last one that was
    rendered" left the other pages pointing at a dead URL, and the page came
    back as a broken image the second time it was opened.
14. **The pages are numbered by their place in the document.** `withPageNumbers`
    renumbers them whenever the list changes, so there is never a gap and
    never a "Page 1" twice. The file a page came from is on the page itself
    (`sourceFile.name`).
15. **The photo is not capped by the canvas.** Tailwind's preflight sets
    `img { max-width: 100% }`, which squashes the absolutely-positioned photo
    into the width of the canvas while its height keeps growing. The photo
    carries `max-w-none` for exactly that reason.
16. **The wrapped page is the whole page.** After `applyWarp` the corners
    are the whole rectangle, so nothing about the picture has to be told to
    the model. A warp is one history step, not a pile of ops.
17. **The typed notice is markdown, not raw text.** The editor hands
    `onChange` the markdown of the notice (`editor.getMarkdown()`), and the
    text that comes back from the parent is put into the editor **only**
    when it is not the text the editor last produced. Putting the text
    back on every change resets the caret on every keystroke.

---

## 8. Known gaps and dead code

**Dead code** (safe to remove, or to wire up):

| Symbol | Where | Note |
|---|---|---|
| `maskImage` | `lib/image-ops.ts` | The single-rectangle masker; superseded by `maskShapes`. |
| `rectToPixels` | `lib/corner-geometry.ts` | Unused; `rectFromPixels` is used. |
| `confirmEdits` | `use-upload-notice.ts` | Nothing calls it — the tools apply directly now. |
| `addMaskShape` | `use-upload-notice.ts` | The overlay commits through `updateMaskShapes`. |
| `handleFileSelect` | `use-upload-notice.ts` | The workbench uses `handleFiles`. |
| `discardOps` | `use-upload-notice.ts` | The undo button throws the changes away now. |

**Gaps:**

- The frontend has **no tests**. The suites are `bun run typecheck` and
  `bun run lint`; the canvas zoom and fit maths was checked with throwaway
  scripts. The wrap is covered by a backend test instead
  (`test_warp_with_corners_returns_the_rectangle_the_corners_describe`).
- `frontend/app/fonts/*.ttf` (the Purno files) are **untracked in git** — they
  must be committed or the Bangla font dies on a fresh checkout.
- The hidden regions are baked when they are *confirmed*, so they cannot be
  edited afterwards — the op has to be discarded and redrawn.
- A typed notice cannot be mixed with pages: uploading a `.txt` switches the
  whole workbench into the text mode.
- The document is read as one notice. A document that holds several notices
  is read as one long notice — the pages are joined, not told apart.
- The hidden regions cannot be edited after they are confirmed, and the
  wrapped page cannot be wrapped twice.

---

## 9. How to verify

```bash
# frontend
cd frontend && bun run typecheck   # must be clean
cd frontend && bun run lint        # baseline: 12 problems (6 errors, 6 warnings)
cd frontend && bun run build       # must succeed

# backend
cd backend && uv run pytest -v     # 21 passed, 3 pre-existing failures
```

The three backend failures are known and pre-existing:
`test_calendar_generation`, `test_duplicate_detection_and_diff` and
`test_benchmark_evaluation` (the last one needs `GOOGLE_API_KEY` and a live
model call).

**Worth clicking through after a change:** upload a PDF → switch pages 1→2→3
(the others stay visible) → place the four corners on a page and *Wrap*
it → crop with a 1:1 lock → *Apply* → hide a region → *Confirm* → sharpen →
scroll to zoom (the photo must grow, not squash) → extract (one PDF, one
notice) → refresh → the toast in the corner offers the unsaved work back →
the pages, the corners and the hidden regions are all back.
