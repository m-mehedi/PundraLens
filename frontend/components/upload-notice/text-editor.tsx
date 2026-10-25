"use client"

import * as React from "react"
import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { TableKit } from "@tiptap/extension-table"
import { Markdown } from "@tiptap/markdown"
import { Placeholder } from "@tiptap/extensions"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  BoldIcon,
  GridTableIcon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface TextEditorProps {
  value: string
  onChange: (value: string) => void
  /** The name of the file the text came from. */
  fileName: string | null
  disabled?: boolean
}

/**
 * One button of the formatting bar.
 *
 * The mouse down is swallowed so the notice keeps the caret and the
 * selection the button is about to work on.
 */
function ToolbarButton({
  label,
  icon,
  onClick,
  disabled,
  active,
}: {
  label: string
  icon: IconSvgElement
  onClick: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={label}
            aria-pressed={active}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
            className={active ? "bg-muted text-foreground" : undefined}
          >
            <HugeiconsIcon icon={icon} />
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * The editor for a notice that was typed rather than photographed.
 *
 * The notice is edited the way it will be read — the staff member types
 * into the notice itself and the toolbar formats what they have
 * selected. There is no raw text anywhere: markdown is what the notice
 * is kept and sent as, so the draft, the extraction and the notice on
 * the board all carry the same structure.
 *
 * The text is set in the same face as the rest of the app, with Purno
 * behind it for the Bangla, so a Bengali notice reads the way it will on
 * the board.
 */
export function TextEditor({
  value,
  onChange,
  fileName,
  disabled,
}: TextEditorProps) {
  const onChangeRef = React.useRef(onChange)
  React.useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // The markdown the editor last produced. The text that comes back from
  // the parent is the same string, so it is not put into the editor
  // again — only text that came from somewhere else is.
  const emittedRef = React.useRef<string | null>(null)

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ link: { openOnClick: false } }),
        TableKit.configure({ table: { resizable: false } }),
        Placeholder.configure({
          placeholder: "এখানে নোটিশের লেখা বসান… Type the notice here.",
        }),
        Markdown,
      ],
      content: value,
      contentType: "markdown",
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: "notice-body",
          lang: "bn",
          "aria-label": "The notice",
        },
      },
      onUpdate: ({ editor: instance }) => {
        const markdown = instance.getMarkdown()
        emittedRef.current = markdown
        onChangeRef.current(markdown)
      },
    },
    []
  )

  // Text that came from outside — a draft that was restored, a file that
  // was replaced — is put into the notice.
  React.useEffect(() => {
    if (!editor) return
    if (emittedRef.current === null) {
      // The notice was created with this text.
      emittedRef.current = value
      return
    }
    if (emittedRef.current === value) return
    emittedRef.current = value
    editor
      .chain()
      .setContent(value, { contentType: "markdown", emitUpdate: false })
      .setMeta("addToHistory", false)
      .run()
  }, [editor, value])

  // While the notice is being read by the model it cannot be edited.
  React.useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [disabled, editor])

  const format = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      bold: instance?.isActive("bold") ?? false,
      italic: instance?.isActive("italic") ?? false,
      heading1: instance?.isActive("heading", { level: 1 }) ?? false,
      heading2: instance?.isActive("heading", { level: 2 }) ?? false,
      heading3: instance?.isActive("heading", { level: 3 }) ?? false,
      bulletList: instance?.isActive("bulletList") ?? false,
      orderedList: instance?.isActive("orderedList") ?? false,
    }),
  })

  const heading = format?.heading1
    ? "1"
    : format?.heading2
      ? "2"
      : format?.heading3
        ? "3"
        : ""

  const words = value.trim() ? value.trim().split(/\s+/).length : 0
  const lines = value ? value.split("\n").length : 0

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-[62vh] min-h-[440px] flex-col overflow-hidden rounded-xl border border-input bg-background">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div
            role="toolbar"
            aria-label="Formatting"
            className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-border bg-background/95 px-2 py-1.5 backdrop-blur"
          >
            <ToggleGroup
              value={heading ? [heading] : []}
              onValueChange={(group) => {
                const level = group[0]
                if (!level) {
                  editor?.chain().focus().setParagraph().run()
                  return
                }
                editor
                  ?.chain()
                  .focus()
                  .toggleHeading({ level: Number(level) as 1 | 2 | 3 })
                  .run()
              }}
              variant="outline"
              size="sm"
              spacing={0}
            >
              <ToggleGroupItem
                value="1"
                disabled={disabled}
                onMouseDown={(event) => event.preventDefault()}
                className="px-2.5"
              >
                H1
              </ToggleGroupItem>
              <ToggleGroupItem
                value="2"
                disabled={disabled}
                onMouseDown={(event) => event.preventDefault()}
                className="px-2.5"
              >
                H2
              </ToggleGroupItem>
              <ToggleGroupItem
                value="3"
                disabled={disabled}
                onMouseDown={(event) => event.preventDefault()}
                className="px-2.5"
              >
                H3
              </ToggleGroupItem>
            </ToggleGroup>

            <Separator orientation="vertical" className="mx-1 h-6" />

            <ToolbarButton
              label="Bold"
              icon={BoldIcon}
              disabled={disabled}
              active={format?.bold}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            />
            <ToolbarButton
              label="Italic"
              icon={ItalicIcon}
              disabled={disabled}
              active={format?.italic}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            />

            <Separator orientation="vertical" className="mx-1 h-6" />

            <ToolbarButton
              label="Bulleted list"
              icon={ListIcon}
              disabled={disabled}
              active={format?.bulletList}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            />
            <ToolbarButton
              label="Numbered list"
              icon={ListOrderedIcon}
              disabled={disabled}
              active={format?.orderedList}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            />
            <ToolbarButton
              label="Table"
              icon={GridTableIcon}
              disabled={disabled}
              onClick={() =>
                editor
                  ?.chain()
                  .focus()
                  .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                  .run()
              }
            />
          </div>

          <div className="px-4 py-3">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{fileName ?? "Untitled text"}</span>
        <span className="tabular-nums">
          {words} {words === 1 ? "word" : "words"} · {value.length}{" "}
          {value.length === 1 ? "character" : "characters"} · {lines}{" "}
          {lines === 1 ? "line" : "lines"}
        </span>
      </div>
    </div>
  )
}
