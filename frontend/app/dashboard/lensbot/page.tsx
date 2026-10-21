"use client"

import { useState } from "react"
import { useChat } from "@ai-sdk/react"
import { createChat } from "@shadcn/helpers/ai-sdk"
import { HugeiconsIcon } from "@hugeicons/react"
import { AiBrain04Icon, SendIcon } from "@hugeicons/core-free-icons"

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
  InputGroupTextarea,
  InputGroupButton,
} from "@/components/ui/input-group"
import { Trace, TraceLine, TraceIcon, TraceTitle } from "@/components/ui/trace"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const chat = createChat()
  .user("What changed in this release?")
  .assistant("The release adds keyboard shortcuts and faster search.")
  .user("Can you show me the shortcuts?")
  .assistant("Press ⌘K to search and ⌘Enter to submit.")

const initialMessages = chat.get(0)
const transport = chat.transport()

function Chat() {
  const { messages, sendMessage, status } = useChat({
    messages: initialMessages,
    transport,
  })
  const nextMessage = chat.next(messages)
  const isBusy = status === "submitted" || status === "streaming"

  const [input, setInput] = useState("")

  const handleSubmit = () => {
    if (input.trim() && !isBusy) {
      setInput("")
      void sendMessage({ text: input.trim() })
    } else if (nextMessage && !isBusy) {
      void sendMessage(nextMessage)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <MessageScrollerProvider autoScroll>
      <MessageScroller className="flex-1 min-h-0">
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
                    Ask LensBot anything about your dashboard data.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              messages.map((message) => {
                const isUser = message.role === "user"
                const text =
                  message.parts?.find((p) => p.type === "text")?.text ?? ""

                return (
                  <MessageScrollerItem
                    key={message.id}
                    scrollAnchor={isUser}
                  >
                    <Message align={isUser ? "end" : "start"}>
                      {!isUser && (
                        <MessageAvatar>
                          <Avatar>
                            <AvatarFallback>
                              <HugeiconsIcon
                                icon={AiBrain04Icon}
                                strokeWidth={2}
                              />
                            </AvatarFallback>
                          </Avatar>
                        </MessageAvatar>
                      )}
                      <MessageContent>
                        <Bubble variant={isUser ? "default" : "secondary"}>
                          <BubbleContent>{text}</BubbleContent>
                        </Bubble>
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

      {status === "streaming" && (
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
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isBusy}
          className="h-25"
        />
        <InputGroupButton
          type="submit"
          variant={"outline"}
          className={"size-10 p-2 m-2 absolute bottom-0 right-0 bg-primary"}
          disabled={(!input.trim() && !nextMessage) || isBusy}
          onClick={handleSubmit}
        >
          <HugeiconsIcon icon={SendIcon} strokeWidth={2} className="size-4"/>
        </InputGroupButton>
      </InputGroup>
    </MessageScrollerProvider>
  )
}

export default function Page() {
  return (
    <div className="flex flex-col h-[85vh]">
      <Chat />
    </div>
  )
}
