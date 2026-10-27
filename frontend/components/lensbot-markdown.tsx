import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import {
  CodeBlock,
  CodeBlockContent,
} from "@/components/ui/code-block"

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
            <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
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
            <h1 className="text-base font-semibold mt-2 mb-1" {...props}>
              {children}
            </h1>
          )
        },
        h2({ children, ...props }) {
          return (
            <h2 className="text-sm font-semibold mt-2 mb-1" {...props}>
              {children}
            </h2>
          )
        },
        h3({ children, ...props }) {
          return (
            <h3 className="text-sm font-semibold mt-1.5 mb-0.5" {...props}>
              {children}
            </h3>
          )
        },
        // Lists
        ul({ children, ...props }) {
          return (
            <ul className="list-inside list-disc pl-2 my-1" {...props}>
              {children}
            </ul>
          )
        },
        ol({ children, ...props }) {
          return (
            <ol className="list-inside list-decimal pl-2 my-1" {...props}>
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
              className="border-l-2 border-muted-foreground/30 pl-3 italic text-muted-foreground my-1"
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
              <table
                className="w-full border-collapse text-sm"
                {...props}
              >
                {children}
              </table>
            </div>
          )
        },
        th({ children, ...props }) {
          return (
            <th className="border border-muted px-2 py-1 bg-muted/50 font-medium text-left" {...props}>
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
          return <hr className="border-muted my-2" {...props} />
        },
      }}
    >
      {children}
    </ReactMarkdown>
  )
}
