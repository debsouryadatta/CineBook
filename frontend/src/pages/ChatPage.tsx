import { Bot, Braces, CheckCircle2, Loader2, MessageSquare, Send, Sparkles, Wrench } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Textarea } from "../components/ui/textarea";
import { api } from "../lib/api";
import { API_URL } from "../lib/config";

type ChatTool = {
  toolName: string;
  toolDescription: string;
  toolParameters?: Record<string, unknown>;
  args?: unknown;
  result?: unknown;
};

type ToolRun = {
  id: string;
  toolName: string;
  toolDescription: string;
  args?: unknown;
  result?: unknown;
  status: "running" | "complete";
};

type ChatTurn = {
  id: string;
  sender: "USER" | "ASSISTANT";
  content: string;
  tools?: ToolRun[];
  assistantMode?: string;
  streaming?: boolean;
};

type ChatStreamEvent =
  | { type: "conversation"; conversationId: string }
  | { type: "assistant_mode"; assistantMode: string }
  | { type: "tool_start"; tool: ChatTool }
  | { type: "tool_result"; tool: ChatTool }
  | { type: "message_delta"; delta: string }
  | { type: "message_done"; conversationId: string; assistantMode: string; tools?: ChatTool[]; message: string }
  | { type: "error"; message: string };

const prompts = [
  "Find sci-fi shows this weekend in recliner seats",
  "Pick the best movie for a tense but beautiful night",
  "Show my pending tickets and payment status"
];

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function modeLabel(mode?: string) {
  return mode?.replace(/_/g, " ") ?? "main assistant";
}

function previewJson(value: unknown) {
  if (value === undefined) return "Waiting for result...";
  try {
    const text = JSON.stringify(value, null, 2);
    return text.length > 900 ? `${text.slice(0, 900)}\n...` : text;
  } catch {
    return String(value);
  }
}

function normalizeTool(tool: ChatTool, status: ToolRun["status"]): ToolRun {
  return {
    id: uid(tool.toolName),
    toolName: tool.toolName,
    toolDescription: tool.toolDescription,
    args: tool.args ?? tool.toolParameters,
    result: tool.result,
    status
  };
}

function ToolTrace({ tool, index }: { tool: ToolRun; index: number }) {
  return (
    <Accordion type="single" collapsible defaultValue={tool.status === "running" ? tool.id : undefined} className="min-w-0 max-w-full">
      <AccordionItem value={tool.id} className="overflow-hidden rounded-md border border-border bg-muted/25 px-0">
        <AccordionTrigger className="min-w-0 px-3 py-2 hover:no-underline [&>svg]:ml-2">
          <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-background text-primary">
              {tool.status === "complete" ? <CheckCircle2 className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold lg:text-sm">
                Step {index + 1}: {tool.status === "complete" ? "Finished" : "Calling"} {tool.toolName}
              </p>
              <p className="truncate text-xs text-muted-foreground">{tool.toolDescription}</p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="border-t border-border bg-card p-0">
          <div className="grid min-w-0 gap-0 md:grid-cols-2">
            <div className="min-w-0 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-muted-foreground">
                <Braces className="h-3.5 w-3.5" />
                Input
              </p>
              <pre className="max-h-44 max-w-full overflow-auto rounded-md bg-background p-3 text-xs leading-5 text-foreground">{previewJson(tool.args)}</pre>
            </div>
            <div className="min-w-0 border-t border-border/70 p-3 md:border-l md:border-t-0">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-muted-foreground">
                <Wrench className="h-3.5 w-3.5" />
                Output
              </p>
              <pre className="max-h-44 max-w-full overflow-auto rounded-md bg-background p-3 text-xs leading-5 text-foreground">{previewJson(tool.result)}</pre>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function ChatPage() {
  const [message, setMessage] = useState("Book 2 tickets for a sci-fi movie this weekend with recliner seats and offers");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  function updateTurn(id: string, updater: (turn: ChatTurn) => ChatTurn) {
    setTurns((current) => current.map((turn) => (turn.id === id ? updater(turn) : turn)));
  }

  async function streamMessage(outgoing: string, assistantId: string) {
    const token = localStorage.getItem("cinebook-token");
    const response = await fetch(`${API_URL}/chat/messages/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ conversationId: conversationId ?? undefined, message: outgoing })
    });

    if (!response.ok || !response.body) throw new Error("Streaming chat is not available yet.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const eventText of events) {
        const line = eventText.split("\n").find((item) => item.startsWith("data: "));
        if (!line) continue;
        const event = JSON.parse(line.slice(6)) as ChatStreamEvent;
        if (event.type === "conversation") {
          setConversationId(event.conversationId);
        }
        if (event.type === "assistant_mode") {
          updateTurn(assistantId, (turn) => ({ ...turn, assistantMode: event.assistantMode }));
        }
        if (event.type === "tool_start") {
          updateTurn(assistantId, (turn) => ({ ...turn, tools: [...(turn.tools ?? []), normalizeTool(event.tool, "running")] }));
        }
        if (event.type === "tool_result") {
          updateTurn(assistantId, (turn) => {
            const nextTools = [...(turn.tools ?? [])];
            const index = [...nextTools].reverse().findIndex((tool) => tool.toolName === event.tool.toolName && tool.status === "running");
            const actualIndex = index === -1 ? -1 : nextTools.length - 1 - index;
            if (actualIndex >= 0) {
              nextTools[actualIndex] = { ...nextTools[actualIndex], result: event.tool.result, status: "complete" };
            } else {
              nextTools.push(normalizeTool(event.tool, "complete"));
            }
            return { ...turn, tools: nextTools };
          });
        }
        if (event.type === "message_delta") {
          updateTurn(assistantId, (turn) => ({ ...turn, content: `${turn.content}${event.delta}` }));
        }
        if (event.type === "message_done") {
          setConversationId(event.conversationId);
          updateTurn(assistantId, (turn) => ({
            ...turn,
            content: event.message,
            assistantMode: event.assistantMode,
            streaming: false,
            tools: event.tools?.map((tool) => normalizeTool(tool, "complete")) ?? turn.tools
          }));
        }
        if (event.type === "error") throw new Error(event.message);
      }
    }
  }

  async function fallbackMessage(outgoing: string, assistantId: string) {
    const response = await api<{ conversationId: string; message: string; assistantMode: string; tools: ChatTool[]; toolRuns?: ChatTool[] }>("/chat/messages", {
      method: "POST",
      body: JSON.stringify({ conversationId: conversationId ?? undefined, message: outgoing })
    });
    setConversationId(response.conversationId);
    const runs =
      response.toolRuns?.length
        ? response.toolRuns.map((tool) => normalizeTool(tool, "complete"))
        : response.tools.map((tool) => ({
            ...normalizeTool(tool, "complete"),
            args: { parameters: tool.toolParameters ?? {} },
            result: { status: "completed", message: "Restart the backend to stream full tool result payloads." }
          }));
    updateTurn(assistantId, (turn) => ({
      ...turn,
      content: response.message,
      assistantMode: response.assistantMode,
      streaming: false,
      tools: runs
    }));
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    if (!message.trim() || loading) return;
    const outgoing = message.trim();
    const assistantId = uid("assistant");
    setTurns((current) => [
      ...current,
      { id: uid("user"), sender: "USER", content: outgoing },
      { id: assistantId, sender: "ASSISTANT", content: "", tools: [], assistantMode: "main_assistant", streaming: true }
    ]);
    setMessage("");
    setError("");
    setLoading(true);
    try {
      await streamMessage(outgoing, assistantId);
    } catch {
      try {
        await fallbackMessage(outgoing, assistantId);
      } catch (err) {
        updateTurn(assistantId, (turn) => ({ ...turn, streaming: false, content: "I could not reach the assistant service. Please try again." }));
        setError(err instanceof Error ? err.message : "Unable to send message");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto grid h-[calc(100svh-65px)] max-w-7xl grid-rows-1 gap-2 overflow-hidden px-2 py-2 sm:px-3 sm:py-3 lg:grid-cols-[300px_1fr] lg:gap-4 lg:px-6 lg:py-4">
      <aside className="hidden overflow-hidden rounded-md border border-border bg-foreground p-5 text-background shadow-xl shadow-black/10 lg:block lg:h-full">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase">Assistant</span>
        </div>
        <h1 className="mt-2 text-xl font-black tracking-tight text-balance sm:text-2xl lg:mt-3 lg:text-3xl">
          <span className="sm:hidden">Agent booking.</span>
          <span className="hidden sm:inline">Book with an agent that shows its work.</span>
        </h1>
        <p className="mt-2 hidden text-sm leading-6 text-background/72 sm:block">
          Ask for movies, seats, offers, checkout, cancellations, or booking history.
        </p>
        <Separator className="my-2 bg-background/14 sm:my-3 lg:my-5" />
        <div className="grid gap-2 sm:grid-cols-3 lg:block lg:space-y-2">
          {prompts.map((item) => (
            <Button
              key={item}
              type="button"
              variant="outline"
              onClick={() => setMessage(item)}
              className="h-auto w-full justify-start whitespace-normal border-background/14 bg-background/8 px-3 py-1.5 text-left text-xs text-background hover:bg-background/14 hover:text-background sm:py-2 lg:py-3 lg:text-sm"
            >
              <MessageSquare className="h-4 w-4 shrink-0 text-primary" />
              <span>{item}</span>
            </Button>
          ))}
        </div>
      </aside>

      <section className="min-h-0 min-w-0">
        <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-md shadow-sm">
          <CardHeader className="shrink-0 border-b border-border bg-card px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-sm lg:text-base">
                <Bot className="h-4 w-4 text-primary" />
                CineBook concierge
              </CardTitle>
              <Badge variant={loading ? "secondary" : "outline"}>{loading ? "Streaming" : "Ready"}</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-muted/25">
              {!turns.length && (
                <div className="grid min-h-48 place-items-center px-4 text-center sm:min-h-[460px]">
                  <div>
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-primary/12 text-primary">
                      <Sparkles className="h-6 w-6" />
                    </span>
                    <h2 className="mt-3 text-2xl font-black tracking-tight">What should we book?</h2>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                      Try a mood, a city, a seat preference, or a full checkout request.
                    </p>
                  </div>
                </div>
              )}
              <div className="min-w-0 space-y-3 p-3 sm:space-y-4 sm:p-4">
                {turns.map((turn) => (
                  <article
                    key={turn.id}
                    className={
                      turn.sender === "USER"
                        ? "ml-auto w-full max-w-full overflow-hidden rounded-md bg-foreground p-3 text-background shadow-sm sm:p-4 lg:max-w-2xl"
                        : "w-full max-w-full overflow-hidden rounded-md border border-border bg-card p-3 shadow-sm sm:p-4 lg:max-w-4xl"
                    }
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase opacity-70">
                        {turn.sender === "ASSISTANT" && <Bot className="h-4 w-4" />}
                        {turn.sender === "ASSISTANT" ? modeLabel(turn.assistantMode) : "You"}
                      </div>
                      {turn.streaming && <Badge variant="secondary"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Thinking</Badge>}
                    </div>
                    {turn.sender === "ASSISTANT" && !!turn.tools?.length && (
                      <div className="mt-3 min-w-0 space-y-2 sm:mt-4">
                        {turn.tools.map((tool, toolIndex) => (
                          <ToolTrace key={tool.id} tool={tool} index={toolIndex} />
                        ))}
                      </div>
                    )}
                    {turn.sender === "ASSISTANT" ? (
                      <div className="mt-3 max-w-full overflow-hidden rounded-md border border-border bg-background p-3 sm:mt-4 sm:p-4">
                        <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Answer</p>
                        {turn.content ? (
                          <p className="whitespace-pre-wrap break-words text-[13px] leading-5 [overflow-wrap:anywhere] lg:text-sm lg:leading-6">
                            {turn.content}
                            {turn.streaming && <span className="ml-1 inline-block h-4 w-1 translate-y-0.5 animate-pulse rounded-sm bg-primary" />}
                          </p>
                        ) : (
                          <p className="break-words text-[13px] leading-5 text-muted-foreground [overflow-wrap:anywhere] lg:text-sm lg:leading-6">
                            {turn.tools?.length ? "Waiting for the assistant answer..." : "Planning the next step..."}
                            {turn.streaming && <span className="ml-1 inline-block h-4 w-1 translate-y-0.5 animate-pulse rounded-sm bg-primary" />}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-5 [overflow-wrap:anywhere] lg:text-sm lg:leading-6">{turn.content}</p>
                    )}
                  </article>
                ))}
                <div ref={scrollRef} />
              </div>
            </div>
            <form onSubmit={send} className="shrink-0 border-t border-border bg-card p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  aria-label="Chat message"
                  className="min-h-16 resize-none bg-background text-[13px] text-foreground sm:min-h-20 lg:text-sm"
                  placeholder="Ask for a movie, seats, offers, or a booking update"
                />
                <Button type="button" onClick={() => void send()} disabled={loading || message.trim().length < 1} className="h-10 text-sm sm:w-32 lg:h-11">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {loading ? "Sending" : "Send"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        {error && (
          <Alert variant="destructive" className="mt-3">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </section>
    </main>
  );
}
