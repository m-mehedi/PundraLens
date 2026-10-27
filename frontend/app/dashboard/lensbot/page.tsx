"use client"

import { useState } from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { AiBrain04Icon, SendIcon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from "@/components/ui/message-scroller"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from "@/components/ui/message"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
  InputGroupButton,
} from "@/components/ui/input-group"
import { Trace, TraceLine, TraceIcon, TraceTitle } from "@/components/ui/trace"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { readErrorDetail } from "@/lib/backend-error"
import { MarkdownContent } from "@/components/lensbot-markdown"

interface Citation {
  notice_id: number
  notice_title: string
  matching_passage: string
}

interface AnswerMeta {
  model?: { key: string; label: string; provider: string }
  found_answer?: boolean
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  parts: { type: "text"; text: string }[]
  citations?: Citation[]
  meta?: AnswerMeta
}

const suggestions = [
  "What notices are due this week?",
  "Show me all exam deadlines",
  "Any fee notices for my batch?",
  "Summarize today's announcements",
]

let messageCounter = 0

function nextId() {
  messageCounter += 1
  return `msg-${messageCounter}`
}

function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSend = input.trim().length > 0 && !isPending

  const send = async (text: string) => {
    const query = text.trim()
    if (!query || isPending) return

    setError(null)
    setInput("")
    setMessages((current) => [
      ...current,
      { id: nextId(), role: "user", parts: [{ type: "text", text: query }] },
    ])
    setIsPending(true)

    try {
      const response = await fetch("/api/lensbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      })

      if (!response.ok) {
        throw new Error(
          await readErrorDetail(response, "Failed to answer the question")
        )
      }

      const payload = (await response.json()) as {
        answer: string
        citations?: Citation[]
        model?: AnswerMeta["model"]
        found_answer?: boolean
      }

      setMessages((current) => [
        ...current,
        {
          id: nextId(),
          role: "assistant",
          parts: [{ type: "text", text: payload.answer ?? "" }],
          citations: payload.citations ?? [],
          meta: { model: payload.model, found_answer: payload.found_answer },
        },
      ])
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to answer the question"
      setError(message)
      toast.error(message)
    } finally {
      setIsPending(false)
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    void send(input)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void send(input)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-0 flex-1 flex-col gap-3"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Answers are grounded in published notices and cited below.
        </p>
        {messages.length > 0 && messages.at(-1)?.meta?.model ? (
          <Badge variant="secondary">
            {messages.at(-1)?.meta?.model?.label}
          </Badge>
        ) : null}
      </div>

      <MessageScrollerProvider autoScroll>
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent>
              {messages.length === 0 ? (
                <Empty className="border-0 p-0">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <HugeiconsIcon icon={AiBrain04Icon} strokeWidth={2} />
                    </EmptyMedia>
                    <EmptyTitle>Start a conversation</EmptyTitle>
                    <EmptyDescription>
                      Ask LensBot anything about published notices.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                messages.map((message) => {
                  const isUser = message.role === "user"
                  const text =
                    message.parts.find((p) => p.type === "text")?.text ?? ""

                  return (
                    <MessageScrollerItem
                      key={message.id}
                      messageId={message.id}
                      scrollAnchor={isUser}
                    >
                      <Message align={isUser ? "end" : "start"}>
                        {!isUser && (
                          <MessageAvatar>
                            <Avatar>
                              <AvatarFallback className="bg-primary/10 text-primary">
                                <HugeiconsIcon
                                  icon={AiBrain04Icon}
                                  strokeWidth={2}
                                />
                              </AvatarFallback>
                            </Avatar>
                          </MessageAvatar>
                        )}
                        <MessageContent>
                          <MessageHeader>
                            {isUser ? "You" : "LensBot"}
                          </MessageHeader>
                          <Bubble
                            align={isUser ? "end" : "start"}
                            variant={isUser ? "muted" : "outline"}
                          >
                            <BubbleContent
                              className={
                                isUser
                                  ? undefined
                                  : "shadow-[2px_2px_0_color-mix(in_oklab,var(--foreground)_10%,transparent)]"
                              }
                            >
                              {isUser ? text : <MarkdownContent>{text}</MarkdownContent>}
                            </BubbleContent>
                          </Bubble>

                          {!isUser && message.citations?.length ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {message.citations.map((citation) => (
                                <Link
                                  key={`${message.id}-${citation.notice_id}`}
                                  href={`/dashboard/notices/${citation.notice_id}`}
                                >
                                  <Badge
                                    variant="outline"
                                    className="text-left"
                                  >
                                    {citation.notice_title}
                                  </Badge>
                                </Link>
                              ))}
                            </div>
                          ) : null}
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                  )
                })
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton direction="end" />
        </MessageScroller>
      </MessageScrollerProvider>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {suggestions.length > 0 && (
        <div className="flex scroll-fade-x scrollbar-none gap-2 overflow-x-auto overscroll-x-contain py-1">
          {suggestions.map((suggestion, i) => (
            <Button
              key={suggestion}
              type="button"
              variant="outline"
              size="sm"
              className={`shrink-0 shadow-[2px_2px_0_color-mix(in_oklab,var(--foreground)_10%,transparent)] transition-transform hover:-translate-y-0.5 ${
                i % 2 === 0 ? "rotate-[-0.6deg]" : "rotate-[0.6deg]"
              }`}
              onClick={() => void send(suggestion)}
              disabled={isPending}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      )}

      {isPending && (
        <Trace className="mb-2">
          <TraceLine status="running">
            <TraceIcon>
              <HugeiconsIcon icon={AiBrain04Icon} strokeWidth={2} />
            </TraceIcon>
            <TraceTitle>LensBot is thinking...</TraceTitle>
          </TraceLine>
        </Trace>
      )}

      <InputGroup>
        <InputGroupTextarea
          placeholder="Ask LensBot about notices…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isPending}
          className="min-h-16 p-3"
        />
        <InputGroupAddon align="block-end">
          <InputGroupButton
            type="submit"
            size="icon-sm"
            variant="default"
            className="ml-auto rounded-full"
            disabled={!canSend}
            aria-label="Send message"
          >
            <HugeiconsIcon icon={SendIcon} strokeWidth={2} className="size-4" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
}

export default function Page() {
  return (
    <div className="flex h-[85vh] min-h-0 flex-col">
      <Chat />
    </div>
  )
}
