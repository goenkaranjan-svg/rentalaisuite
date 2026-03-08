import { useEffect, useMemo, useState } from "react";
import { Bot, MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

type AssistantIntent = "highest_rent_property" | "overdue_rent" | "maintenance_summary" | "general";

const QUICK_ACTIONS = [
  {
    label: "Highest rent property",
    prompt: "Show my highest rent property",
  },
  {
    label: "Overdue rent summary",
    prompt: "Show my overdue rent summary",
  },
  {
    label: "Maintenance summary",
    prompt: "Show my maintenance summary",
  },
];

const SUGGESTIONS_BY_INTENT: Record<AssistantIntent, { label: string; prompt: string }[]> = {
  highest_rent_property: [
    { label: "Overdue rent", prompt: "Show my overdue rent summary" },
    { label: "Maintenance", prompt: "Show my maintenance summary" },
    { label: "Highest rent details", prompt: "Break down why this is my highest rent property" },
  ],
  overdue_rent: [
    { label: "Highest rent", prompt: "Show my highest rent property" },
    { label: "Overdue list", prompt: "List my overdue rent items with property names" },
    { label: "Maintenance", prompt: "Show my maintenance summary" },
  ],
  maintenance_summary: [
    { label: "Emergency only", prompt: "Show only my emergency maintenance requests" },
    { label: "Highest rent", prompt: "Show my highest rent property" },
    { label: "Overdue rent", prompt: "Show my overdue rent summary" },
  ],
  general: [
    { label: "Highest rent", prompt: "Show my highest rent property" },
    { label: "Overdue rent", prompt: "Show my overdue rent summary" },
    { label: "Maintenance", prompt: "Show my maintenance summary" },
  ],
};

const ASSISTANT_STORAGE_KEY = "assistant-chat-history-v1";

export function AIAssistantFab() {
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followUpSuggestions, setFollowUpSuggestions] = useState(QUICK_ACTIONS);

  const history = useMemo(() => messages.map(({ role, content }) => ({ role, content })), [messages]);
  const firstName = user?.firstName?.trim() || user?.email?.split("@")[0] || "there";
  const showQuickActions = messages.length === 0;

  useEffect(() => {
    const raw = window.sessionStorage.getItem(ASSISTANT_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as ChatMessage[];
      if (!Array.isArray(parsed)) return;
      const safeMessages = parsed.filter(
        (item) =>
          typeof item?.id === "string" &&
          (item?.role === "user" || item?.role === "assistant") &&
          typeof item?.content === "string",
      );
      setMessages(safeMessages);
    } catch {
      // Ignore malformed local state.
    }
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem(ASSISTANT_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  if (!isAuthenticated || !user) {
    return null;
  }

  const sendMessage = async (overrideMessage?: string) => {
    const content = (overrideMessage ?? input).trim();
    if (!content || isSending) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setIsSending(true);

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: content,
          history: [...history, { role: "user", content }],
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Session expired. Please sign in again.");
        }
        throw new Error(typeof body?.message === "string" ? body.message : "Assistant request failed.");
      }

      const reply =
        typeof body?.reply === "string" && body.reply.trim().length > 0
          ? body.reply.trim()
          : "I could not generate a response. Please try again.";
      const intent: AssistantIntent = body?.intent;

      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          content: reply,
        },
      ]);
      setFollowUpSuggestions(SUGGESTIONS_BY_INTENT[intent] ?? SUGGESTIONS_BY_INTENT.general);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Assistant request failed.";
      setError(message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-[60]">
      {isOpen ? (
        <Card className="w-[min(92vw,24rem)] h-[30rem] shadow-2xl border-slate-200 bg-white flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Personal Assistant</p>
                <p className="text-xs text-slate-500">AI Chat</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} aria-label="Close assistant">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 px-3 py-3">
            <div className="space-y-3">
              {showQuickActions ? (
                <div className="bg-slate-100 text-slate-800 rounded-2xl rounded-bl-md px-3 py-3 text-sm">
                  <p className="font-medium">Hi {firstName}, I can help you with quick rental insights:</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {QUICK_ACTIONS.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        className="px-2.5 py-1.5 rounded-full text-xs border border-slate-300 bg-white hover:bg-slate-50 transition-colors"
                        onClick={() => {
                          void sendMessage(item.prompt);
                        }}
                        disabled={isSending}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn("max-w-[88%] rounded-2xl px-3 py-2 text-sm", {
                    "bg-blue-600 text-white ml-auto rounded-br-md": message.role === "user",
                    "bg-slate-100 text-slate-800 rounded-bl-md": message.role === "assistant",
                  })}
                >
                  {message.content}
                </div>
              ))}
              {!showQuickActions ? (
                <div className="bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl px-3 py-3 text-sm">
                  <p className="font-medium">Need help further? Try one of these:</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {followUpSuggestions.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        className="px-2.5 py-1.5 rounded-full text-xs border border-slate-300 bg-white hover:bg-slate-50 transition-colors"
                        onClick={() => {
                          void sendMessage(item.prompt);
                        }}
                        disabled={isSending}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </ScrollArea>

          <div className="p-3 border-t border-slate-200 bg-white">
            {error ? <p className="text-xs text-red-600 mb-2">{error}</p> : null}
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage();
              }}
            >
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about rent, overdue balances, or maintenance..."
                disabled={isSending}
              />
              <Button type="submit" size="icon" disabled={isSending || input.trim().length === 0} aria-label="Send message">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </Card>
      ) : null}

      {!isOpen ? (
        <Button
          type="button"
          onClick={() => setIsOpen(true)}
          size="icon"
          className="h-14 w-14 rounded-full shadow-xl shadow-blue-900/30 bg-blue-600 hover:bg-blue-700"
          aria-label="Open personal assistant"
        >
          <MessageCircle className="w-6 h-6" />
        </Button>
      ) : null}
    </div>
  );
}
