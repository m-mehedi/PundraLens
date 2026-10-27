import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { CodeBlock, CodeBlockContent } from "@/components/ui/code-block"

export function MarkdownContent({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Inline code
        code({ className, children, ...props }) {
          // Fenced code blocks are rendered via `pre` > `code`, handled below
          const match = /language-(\w+)/.exec(className || "")
          if (match) {
            return (
              <code className={className} {...props}>
                {children}
              </code>
            )
          }
          return (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              {children}
            </code>
          )
        },
        // Fenced code blocks
        pre({ children }) {
          return (
            <CodeBlock className="my-2 max-h-64">
              <CodeBlockContent wrap>{children}</CodeBlockContent>
            </CodeBlock>
          )
        },
        // Links
        a({ children, ...props }) {
          return (
            <a
              className="text-primary underline underline-offset-4 hover:text-primary/80"
              {...props}
            >
              {children}
            </a>
          )
        },
        // Headings
        h1({ children, ...props }) {
          return (
            <h1 className="mt-2 mb-1 text-base font-semibold" {...props}>
              {children}
            </h1>
          )
        },
        h2({ children, ...props }) {
          return (
            <h2 className="mt-2 mb-1 text-sm font-semibold" {...props}>
              {children}
            </h2>
          )
        },
        h3({ children, ...props }) {
          return (
            <h3 className="mt-1.5 mb-0.5 text-sm font-semibold" {...props}>
              {children}
            </h3>
          )
        },
        // Lists
        ul({ children, ...props }) {
          return (
            <ul className="my-1 list-inside list-disc pl-2" {...props}>
              {children}
            </ul>
          )
        },
        ol({ children, ...props }) {
          return (
            <ol className="my-1 list-inside list-decimal pl-2" {...props}>
              {children}
            </ol>
          )
        },
        li({ children, ...props }) {
          return (
            <li className="my-0.5" {...props}>
              {children}
            </li>
          )
        },
        // Blockquotes
        blockquote({ children, ...props }) {
          return (
            <blockquote
              className="my-1 border-l-2 border-muted-foreground/30 pl-3 text-muted-foreground italic"
              {...props}
            >
              {children}
            </blockquote>
          )
        },
        // Tables
        table({ children, ...props }) {
          return (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-sm" {...props}>
                {children}
              </table>
            </div>
          )
        },
        th({ children, ...props }) {
          return (
            <th
              className="border border-muted bg-muted/50 px-2 py-1 text-left font-medium"
              {...props}
            >
              {children}
            </th>
          )
        },
        td({ children, ...props }) {
          return (
            <td className="border border-muted px-2 py-1" {...props}>
              {children}
            </td>
          )
        },
        // Paragraphs
        p({ children, ...props }) {
          return (
            <p className="my-1 last:my-0" {...props}>
              {children}
            </p>
          )
        },
        // Horizontal rules
        hr({ ...props }) {
          return <hr className="my-2 border-muted" {...props} />
        },
      }}
    >
      {children}
    </ReactMarkdown>
  )
}
