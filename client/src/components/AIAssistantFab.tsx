import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, MessageCircle, Mic, MicOff, Send, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import type { AssistantAvatarExpression, AssistantAvatarMode } from "@/components/AssistantAvatarScene";

type UserRole = "manager" | "tenant" | "investor";
type TenantTopicId = "lease" | "maintenance" | "rent-payment";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

type AssistantIntent =
  | "highest_rent_property"
  | "overdue_rent"
  | "rent_payment_details"
  | "maintenance_summary"
  | "create_maintenance_request"
  | "general";
type AssistantAction = {
  type?: string;
  status?: string;
  requestId?: number;
};
type SuggestionItem = {
  label: string;
  prompt: string;
};

type TenantTopic = {
  id: TenantTopicId;
  label: string;
  description: string;
  questions: SuggestionItem[];
};

type SpeechRecognitionAlternative = {
  transcript: string;
};

type SpeechRecognitionResult = {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
};

type SpeechRecognitionEvent = Event & {
  results: ArrayLike<SpeechRecognitionResult>;
};

type BrowserSpeechRecognition = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;
type MicPermissionState = "unknown" | "prompt" | "granted" | "denied" | "unsupported";

const QUICK_ACTIONS_BY_ROLE: Record<UserRole, { label: string; prompt: string }[]> = {
  manager: [
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
  ],
  tenant: [],
  investor: [
    {
      label: "Investor portal help",
      prompt: "How do I use the investor portal?",
    },
    {
      label: "Portfolio docs",
      prompt: "Show investor document guidance for my portfolio.",
    },
    {
      label: "Deal questions",
      prompt: "What investor-specific questions can you answer for me?",
    },
  ],
};

const TENANT_TOPIC_GROUPS: TenantTopic[] = [
  {
    id: "lease",
    label: "Lease",
    description: "Term, clauses, notice, and responsibilities.",
    questions: [
      { label: "Lease summary", prompt: "Summarize my current lease in 4 short bullet points." },
      { label: "Maintenance clause", prompt: "What does my lease say about maintenance responsibilities?" },
      { label: "Move-out notice", prompt: "What notice period should I plan for before move-out?" },
      { label: "Key lease terms", prompt: "What are the most important lease terms I should know right now?" },
    ],
  },
  {
    id: "maintenance",
    label: "Maintenance",
    description: "Repairs, reporting, and who is responsible.",
    questions: [
      { label: "My responsibilities", prompt: "What does my lease say about maintenance responsibilities?" },
      { label: "Report issue", prompt: "I'll help you report a maintenance issue. Let's create a maintenance request." },
      { label: "Who handles what", prompt: "What maintenance issues are usually my responsibility versus the property's responsibility?" },
      { label: "Urgent repair", prompt: "What should I do first if I have an urgent repair issue?" },
    ],
  },
  {
    id: "rent-payment",
    label: "Rent Payment",
    description: "Due dates, late fees, balance, and timing.",
    questions: [
      { label: "Due date and late fees", prompt: "When is my rent due, and what happens if it is late?" },
      { label: "Current balance", prompt: "Summarize my current rent balance and payment status." },
      { label: "Payment help", prompt: "What payment questions can you answer about my account?" },
      { label: "Next payment", prompt: "What should I know before making my next rent payment?" },
    ],
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
  rent_payment_details: [
    { label: "Current balance", prompt: "Summarize my current rent balance and payment status." },
    { label: "Rent due", prompt: "When is my rent due?" },
    { label: "Maintenance", prompt: "Show my maintenance summary" },
  ],
  maintenance_summary: [
    { label: "Emergency only", prompt: "Show only my emergency maintenance requests" },
    { label: "Highest rent", prompt: "Show my highest rent property" },
    { label: "Overdue rent", prompt: "Show my overdue rent summary" },
  ],
  create_maintenance_request: [
    { label: "Describe issue", prompt: "The kitchen sink is leaking under the cabinet." },
    { label: "Add property", prompt: "It's for my Duluth property." },
    { label: "Maintenance summary", prompt: "Show my maintenance summary" },
  ],
  general: [
    { label: "Highest rent", prompt: "Show my highest rent property" },
    { label: "Overdue rent", prompt: "Show my overdue rent summary" },
    { label: "Maintenance", prompt: "Show my maintenance summary" },
  ],
};

const ROLE_SCOPE_COPY: Record<UserRole, string> = {
  manager: "Manager-only account help for your properties, leases, payments, maintenance, and documents.",
  tenant: "Tenant-only account help for your lease, rent, payments, maintenance, and renter documents.",
  investor: "Investor-only account help for your portfolio, deals, investor portal, and investor documents.",
};

function normalizeUserRole(role?: string): UserRole {
  if (role === "manager" || role === "tenant" || role === "investor") {
    return role;
  }
  return "tenant";
}

function getRoleSuggestions(role: UserRole, intent: AssistantIntent) {
  const suggestions = SUGGESTIONS_BY_INTENT[intent] ?? SUGGESTIONS_BY_INTENT.general;
  const allowedPrompts = new Set(QUICK_ACTIONS_BY_ROLE[role].map((item) => item.prompt));
  const filtered = suggestions.filter((item) => allowedPrompts.has(item.prompt));
  return filtered.length > 0 ? filtered : QUICK_ACTIONS_BY_ROLE[role];
}

function getTenantTopicById(topicId: TenantTopicId | null) {
  return TENANT_TOPIC_GROUPS.find((topic) => topic.id === topicId) ?? null;
}

const ASSISTANT_STORAGE_KEY = "assistant-chat-history-v1";
const ASSISTANT_NAME = "Aster";
const REPLY_REVEAL_INTERVAL_MS = 18;
const PERSONALITIES = ["Friendly", "Formal", "Witty"] as const;
const MAX_ASSISTANT_HISTORY = 20;
const AssistantAvatarScene = lazy(() =>
  import("@/components/AssistantAvatarScene").then((module) => ({ default: module.AssistantAvatarScene })),
);

class AvatarErrorBoundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Avatar scene crashed:", error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function AvatarPanelFallback() {
  return (
    <div className="h-60 rounded-[1.8rem] border border-emerald-200/70 bg-emerald-50/80 px-5 py-5 shadow-inner shadow-emerald-950/5">
      <div className="flex h-full flex-col justify-between rounded-[1.4rem] border border-white/80 bg-white/65 px-4 py-4 backdrop-blur-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-900/60">Aster</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">Avatar unavailable</p>
          <p className="mt-2 text-sm text-slate-600">
            The 3D avatar runtime failed, but chat is still available. You can keep using the assistant normally.
          </p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-900/80">
          If this keeps happening, restart the dev server and refresh the page.
        </div>
      </div>
    </div>
  );
}

function getMicCapabilityMessage(params: {
  isSecureContext: boolean;
  hasMediaDevices: boolean;
  hasGetUserMedia: boolean;
  hasSpeechRecognition: boolean;
}) {
  if (!params.isSecureContext) {
    return "Microphone requires a secure context (HTTPS or localhost).";
  }
  if (!params.hasMediaDevices) {
    return "navigator.mediaDevices is unavailable in this runtime.";
  }
  if (!params.hasGetUserMedia) {
    return "getUserMedia is unavailable in this browser runtime.";
  }
  if (!params.hasSpeechRecognition) {
    return "SpeechRecognition is unavailable in this browser runtime.";
  }
  return "Microphone access is not supported in this browser.";
}

function getMicPromptCopy(permission: MicPermissionState, capabilityMessage: string) {
  if (permission === "denied") {
    return {
      title: "Microphone blocked",
      body: "Chrome will not show the mic prompt again until you change this site's microphone setting to Allow, then reload the page.",
      button: "Retry after allowing",
    };
  }

  if (permission === "unsupported") {
    return {
      title: "Microphone unavailable",
      body: capabilityMessage,
      button: "Unavailable",
    };
  }

  return {
    title: "Enable microphone access",
    body: "Let Aster hear your voice so you can speak requests instead of typing them.",
    button: "Allow mic",
  };
}

function getExpressionFromReply(reply: string): AssistantAvatarExpression {
  const normalized = reply.toLowerCase();

  if (
    normalized.includes("great") ||
    normalized.includes("done") ||
    normalized.includes("created") ||
    normalized.includes("completed") ||
    normalized.includes("approved") ||
    normalized.includes("good news") ||
    normalized.includes("all set")
  ) {
    return "happy";
  }

  if (
    normalized.includes("important") ||
    normalized.includes("alert") ||
    normalized.includes("emergency") ||
    normalized.includes("immediately") ||
    normalized.includes("surprising") ||
    normalized.includes("unexpected")
  ) {
    return "surprised";
  }

  if (
    normalized.includes("unclear") ||
    normalized.includes("i need") ||
    normalized.includes("missing") ||
    normalized.includes("not enough") ||
    normalized.includes("could not") ||
    normalized.includes("please provide") ||
    normalized.includes("which property")
  ) {
    return "confused";
  }

  return "neutral";
}

export function AIAssistantFab() {
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followUpSuggestions, setFollowUpSuggestions] = useState<{ label: string; prompt: string }[]>([]);
  const [avatarMode, setAvatarMode] = useState<AssistantAvatarMode>("idle");
  const [avatarExpression, setAvatarExpression] = useState<AssistantAvatarExpression>("neutral");
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isRevealingReply, setIsRevealingReply] = useState(false);
  const [micPermission, setMicPermission] = useState<MicPermissionState>("unknown");
  const [speechText, setSpeechText] = useState("");
  const [speechCursor, setSpeechCursor] = useState(0);
  const [selectedPersonality, setSelectedPersonality] = useState<(typeof PERSONALITIES)[number]>("Friendly");
  const [hasRestoredHistory, setHasRestoredHistory] = useState(false);
  const [selectedTenantTopicId, setSelectedTenantTopicId] = useState<TenantTopicId | null>(null);
  const [isBrowsingTenantTopics, setIsBrowsingTenantTopics] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const lastSpokenReplyRef = useRef<string>("");
  const revealTimerRef = useRef<number | null>(null);
  const previousUserIdRef = useRef<string | null>(null);

  const history = useMemo(() => messages.map(({ role, content }) => ({ role, content })), [messages]);
  const assistantStorageKey = useMemo(
    () => `${ASSISTANT_STORAGE_KEY}:${user?.id ?? "anonymous"}`,
    [user?.id],
  );
  const firstName = user?.firstName?.trim() || user?.email?.split("@")[0] || "there";
  const currentRole = normalizeUserRole(user?.role);
  const quickActions = user ? QUICK_ACTIONS_BY_ROLE[currentRole] : [];
  const selectedTenantTopic = getTenantTopicById(selectedTenantTopicId);
  const showQuickActions = messages.length === 0;
  const showTenantTopicChooser =
    currentRole === "tenant" && (showQuickActions || isBrowsingTenantTopics || selectedTenantTopic !== null);
  const isSecureContextAvailable = typeof window !== "undefined" ? window.isSecureContext : false;
  const hasMediaDevices = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices);
  const hasGetUserMedia = typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";
  const supportsSpeechSynthesis = typeof window !== "undefined" && "speechSynthesis" in window;
  const supportsSpeechRecognition =
    typeof window !== "undefined" &&
    Boolean((window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ||
      (window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition);
  const micCapabilityMessage = getMicCapabilityMessage({
    isSecureContext: isSecureContextAvailable,
    hasMediaDevices,
    hasGetUserMedia,
    hasSpeechRecognition: supportsSpeechRecognition,
  });
  const micPromptCopy = getMicPromptCopy(micPermission, micCapabilityMessage);

  useEffect(() => {
    if (!supportsSpeechRecognition || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || !isSecureContextAvailable) {
      setMicPermission("unsupported");
      return;
    }

    const permissionsApi = (navigator as Navigator & {
      permissions?: {
        query: (descriptor: { name: "microphone" }) => Promise<{ state: PermissionState; onchange: (() => void) | null }>;
      };
    }).permissions;

    if (!permissionsApi?.query) {
      setMicPermission("prompt");
      return;
    }

    let cancelled = false;
    let statusRef: { onchange: (() => void) | null } | null = null;

    void permissionsApi
      .query({ name: "microphone" })
      .then((status) => {
        if (cancelled) return;
        statusRef = status;
        setMicPermission(status.state as MicPermissionState);
        status.onchange = () => {
          setMicPermission(status.state as MicPermissionState);
        };
      })
      .catch(() => {
        setMicPermission("prompt");
      });

    return () => {
      cancelled = true;
      if (statusRef) statusRef.onchange = null;
    };
  }, [isSecureContextAvailable, supportsSpeechRecognition]);

  useEffect(() => {
    if (!user) return;
    setFollowUpSuggestions(QUICK_ACTIONS_BY_ROLE[currentRole]);
  }, [currentRole, user]);

  useEffect(() => {
    const currentUserId = user?.id ?? null;
    const previousUserId = previousUserIdRef.current;
    const shouldClearStoredHistory =
      currentUserId !== null && previousUserId !== currentUserId;

    previousUserIdRef.current = currentUserId;

    if (shouldClearStoredHistory) {
      window.sessionStorage.removeItem(assistantStorageKey);
    }

    setMessages([]);
    setSpeechText("");
    setSpeechCursor(0);
    setSelectedTenantTopicId(null);
    setIsBrowsingTenantTopics(false);
    lastSpokenReplyRef.current = "";
    setHasRestoredHistory(false);

    if (shouldClearStoredHistory) {
      setHasRestoredHistory(true);
      return;
    }

    const raw = window.sessionStorage.getItem(assistantStorageKey);
    if (!raw) {
      setHasRestoredHistory(true);
      return;
    }
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
      const lastAssistantMessage = [...safeMessages].reverse().find((item) => item.role === "assistant");
      if (lastAssistantMessage) {
        lastSpokenReplyRef.current = lastAssistantMessage.content;
        setSpeechText(lastAssistantMessage.content);
        setSpeechCursor(lastAssistantMessage.content.length);
      }
    } catch {
      // Ignore malformed local state.
    } finally {
      setHasRestoredHistory(true);
    }
  }, [assistantStorageKey]);

  useEffect(() => {
    if (!hasRestoredHistory) return;
    window.sessionStorage.setItem(assistantStorageKey, JSON.stringify(messages));
  }, [assistantStorageKey, hasRestoredHistory, messages]);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current !== null) {
        window.clearInterval(revealTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!supportsSpeechSynthesis || !hasRestoredHistory) return;
    if (!voiceEnabled) {
      window.speechSynthesis.cancel();
      lastSpokenReplyRef.current = "";
      setSpeechCursor(0);
      return;
    }

    const latest = messages[messages.length - 1];
    if (latest?.role !== "assistant" || isRevealingReply) return;
    if (latest.content === lastSpokenReplyRef.current) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(latest.content);
    utterance.rate = 1.02;
    utterance.pitch = 1.04;
    utterance.lang = "en-US";
    utterance.onstart = () => {
      setAvatarMode("speaking");
      setSpeechText(latest.content);
      setSpeechCursor(0);
    };
    utterance.onboundary = (event) => {
      if ("charIndex" in event && typeof event.charIndex === "number") {
        setSpeechCursor(event.charIndex);
      }
    };
    utterance.onend = () => {
      setAvatarMode("idle");
      setSpeechCursor(latest.content.length);
      lastSpokenReplyRef.current = latest.content;
    };
    utterance.onerror = () => {
      setSpeechCursor(latest.content.length);
      lastSpokenReplyRef.current = latest.content;
    };
    window.speechSynthesis.speak(utterance);

    return () => {
      window.speechSynthesis.cancel();
    };
  }, [hasRestoredHistory, isRevealingReply, messages, supportsSpeechSynthesis, voiceEnabled]);

  useEffect(() => {
    if (!isOpen) {
      setAvatarMode("idle");
      setAvatarExpression("neutral");
      return;
    }
    if (isSending) {
      setAvatarMode("thinking");
      return;
    }
    if (isRevealingReply) {
      setAvatarMode("speaking");
      return;
    }
    const latest = messages[messages.length - 1];
    if (latest?.role === "assistant") {
      setAvatarMode("speaking");
      setAvatarExpression(getExpressionFromReply(latest.content));
      const timer = window.setTimeout(() => setAvatarMode("idle"), 2400);
      return () => window.clearTimeout(timer);
    }
    setAvatarMode("idle");
  }, [isOpen, isRevealingReply, isSending, messages]);

  if (!isAuthenticated || !user) {
    return null;
  }

  const revealAssistantReply = useCallback((reply: string, intent: AssistantIntent) => {
    if (revealTimerRef.current !== null) {
      window.clearInterval(revealTimerRef.current);
    }

    const messageId = `${Date.now()}-assistant`;
    setIsRevealingReply(true);
    setAvatarMode("speaking");
    setAvatarExpression(getExpressionFromReply(reply));
    setSpeechText(reply);
    setSpeechCursor(0);
    if (user) {
      setFollowUpSuggestions(getRoleSuggestions(currentRole, intent));
    }

    setMessages((prev) => [
      ...prev,
      {
        id: messageId,
        role: "assistant",
        content: "",
      },
    ]);

    let index = 0;
    revealTimerRef.current = window.setInterval(() => {
      index = Math.min(index + 2, reply.length);
      const nextContent = reply.slice(0, index);
      setSpeechCursor(index);

      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId
            ? {
                ...message,
                content: nextContent,
              }
            : message,
        ),
      );

      if (index >= reply.length) {
        if (revealTimerRef.current !== null) {
          window.clearInterval(revealTimerRef.current);
          revealTimerRef.current = null;
        }
        setIsRevealingReply(false);
      }
    }, REPLY_REVEAL_INTERVAL_MS);
  }, [currentRole, user]);

  const sendMessage = useCallback(async (overrideMessage?: string) => {
    const content = (overrideMessage ?? input).trim();
    if (!content || isSending || isRevealingReply) return;
    setSelectedTenantTopicId(null);
    setIsBrowsingTenantTopics(false);

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
          history: [...history, { role: "user", content }].slice(-MAX_ASSISTANT_HISTORY),
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
      setAvatarExpression("neutral");
      revealAssistantReply(reply, intent);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Assistant request failed.";
      setError(message);
    } finally {
      setIsSending(false);
    }
  }, [history, input, isRevealingReply, isSending, revealAssistantReply]);

  useEffect(() => {
    const handleAssistantPrompt = (event: Event) => {
      const detail = (event as CustomEvent<{ prompt?: string; open?: boolean }>).detail;
      const prompt = detail?.prompt?.trim();
      if (!prompt) return;
      setIsOpen(detail?.open ?? true);
      void sendMessage(prompt);
    };

    window.addEventListener("assistant:prompt", handleAssistantPrompt);
    return () => {
      window.removeEventListener("assistant:prompt", handleAssistantPrompt);
    };
  }, [sendMessage]);

  useEffect(() => {
    if (!supportsSpeechRecognition) return;
    const SpeechRecognitionApi =
      (window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ||
      (window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;
    if (!SpeechRecognitionApi) return;

    const recognition = new SpeechRecognitionApi();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      setInput(transcript);

      const finalResult = Array.from(event.results).some((result) => result.isFinal);
      if (finalResult && transcript.length > 0) {
        void sendMessage(transcript);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      setError("Voice input failed. Check microphone permissions and try again.");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [sendMessage, supportsSpeechRecognition]);

  const toggleListening = () => {
    if (!supportsSpeechRecognition || !recognitionRef.current || isSending || isRevealingReply) return;
    setError(null);

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      recognitionRef.current.start();
      setIsListening(true);
      setAvatarMode("thinking");
    } catch {
      setError("Microphone input could not be started.");
      setIsListening(false);
    }
  };

  const requestMicrophonePermission = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMicPermission("unsupported");
      setError(micCapabilityMessage);
      return false;
    }
    if (!isSecureContextAvailable) {
      setMicPermission("unsupported");
      setError(micCapabilityMessage);
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicPermission("granted");
      setError(null);
      return true;
    } catch {
      setMicPermission("denied");
      setError("Microphone permission was denied. Allow microphone access in the browser and try again.");
      return false;
    }
  }, [isSecureContextAvailable, micCapabilityMessage]);

  const handleMicButton = async () => {
    if (isListening) {
      toggleListening();
      return;
    }

    if (micPermission !== "granted") {
      const granted = await requestMicrophonePermission();
      if (!granted) return;
    }

    toggleListening();
  };

  const toggleVoice = () => {
    setVoiceEnabled((current) => {
      const next = !current;
      if (!next && supportsSpeechSynthesis) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  };

  return (
    <div className="fixed bottom-5 right-5 z-[60]">
      {isOpen ? (
        <Card className="w-[min(92vw,48rem)] h-[min(76vh,34rem)] overflow-hidden rounded-[1.5rem] border border-stone-200 bg-stone-50/95 shadow-[0_16px_42px_rgba(19,17,34,0.14)] backdrop-blur-sm">
          <div className="grid h-full md:grid-cols-[0.4fr_0.6fr]">
            <aside className="relative flex min-h-[14rem] flex-col overflow-hidden bg-[linear-gradient(180deg,#2b2a45_0%,#2d2c53_68%,#343262_100%)] px-4 py-5 text-white">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                aria-label="Close assistant"
                className="absolute right-4 top-4 z-10 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>

              <div className="mx-auto flex w-full max-w-[15rem] flex-1 flex-col items-center text-center">
                <div className="relative mt-1 w-full">
                  <div className="absolute inset-6 rounded-full border border-white/10" />
                  <div className="rounded-[1.2rem] p-1.5">
                    <AvatarErrorBoundary fallback={<AvatarPanelFallback />}>
                      <Suspense
                        fallback={<div className="h-44 rounded-[1.15rem] border border-white/10 bg-white/5" />}
                      >
                        <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                          <AssistantAvatarScene
                            mode={avatarMode}
                            expression={avatarExpression}
                            name={ASSISTANT_NAME}
                            speechText={speechText}
                            speechCursor={speechCursor}
                          />
                        </div>
                      </Suspense>
                    </AvatarErrorBoundary>
                  </div>
                </div>

                <div className="mt-4">
                  <h2 className="font-display text-3xl leading-none tracking-tight text-white">{ASSISTANT_NAME}</h2>
                  <p className="mt-2 text-xs uppercase tracking-[0.34em] text-white/45">AI Assistant</p>
                </div>

                <div className="mt-5 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <span className={cn("h-2.5 w-2.5 rounded-full", {
                    "bg-emerald-400": !isSending && !isListening,
                    "bg-amber-300": isSending || isListening,
                  })} />
                  <span>{isListening ? "Listening" : isSending || isRevealingReply ? "Thinking" : "Ready"}</span>
                </div>

                {micPermission !== "granted" && micPermission !== "unsupported" ? (
                  <div className="mt-4 w-full rounded-[1rem] border border-white/10 bg-white/8 p-3 text-left text-xs text-white/80">
                    <p className="font-medium text-white">{micPromptCopy.title}</p>
                    <p className="mt-2 text-xs leading-5 text-white/65">{micPromptCopy.body}</p>
                    {micPermission === "denied" ? (
                      <p className="mt-2 text-[11px] text-white/55">
                        Chrome: address bar icon / Site settings / Microphone / Allow.
                      </p>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      className="mt-4 rounded-full border border-white/15 bg-white/10 px-5 text-white hover:bg-white/15"
                      onClick={() => {
                        void requestMicrophonePermission();
                      }}
                      disabled={isSending || isRevealingReply}
                    >
                      {micPromptCopy.button}
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {PERSONALITIES.map((personality) => (
                  <button
                    key={personality}
                    type="button"
                    onClick={() => setSelectedPersonality(personality)}
                    className={cn(
                      "rounded-[0.85rem] border px-3.5 py-2 text-[11px] transition-all",
                      selectedPersonality === personality
                        ? "border-white/25 bg-white/14 text-white shadow-[0_8px_18px_rgba(6,7,18,0.22)]"
                        : "border-black/15 bg-black/8 text-white/70 hover:border-white/15 hover:bg-white/8 hover:text-white",
                    )}
                  >
                    {personality}
                  </button>
                ))}
              </div>
            </aside>

            <section className="flex min-h-0 flex-col bg-[#f8f6f1]">
              <header className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
                <div>
                  <h3 className="font-display text-xl leading-none tracking-tight text-stone-950">Chat with {ASSISTANT_NAME}</h3>
                  <p className="mt-1.5 text-xs text-stone-400">
                    Rental operations concierge
                    <span className="mx-2 text-stone-300">•</span>
                    {selectedPersonality}
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3.5 py-1 text-xs text-emerald-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  Online
                </div>
              </header>

              <ScrollArea className="min-h-0 flex-1 px-4 py-4">
                <div className="mx-auto flex h-full w-full max-w-3xl flex-col justify-end space-y-4">
                  {showQuickActions ? (
                    <div className="rounded-[1.7rem] border border-stone-200 bg-white/90 px-5 py-5 text-sm text-stone-700 shadow-sm">
                      <p className="font-medium text-stone-900">
                        Hi {firstName}, I&apos;m {ASSISTANT_NAME}.
                        {currentRole === "tenant"
                          ? " What would you like help with?"
                          : quickActions.length > 0
                            ? " Here's what I can help with right now."
                            : " Ask a question within your account scope."}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-stone-500">{user ? ROLE_SCOPE_COPY[currentRole] : null}</p>
                    </div>
                  ) : null}

                  {messages.length === 0 ? (
                    <div className="flex-1" />
                  ) : null}

                  {messages.map((message) => (
                    <div
                  key={message.id}
                  className={cn("max-w-[84%] whitespace-pre-wrap rounded-[1.2rem] px-3.5 py-2.5 text-sm leading-5 shadow-sm", {
                    "ml-auto rounded-br-md bg-[#2f8f67] text-white": message.role === "user",
                    "rounded-bl-md border border-stone-200 bg-white text-stone-800": message.role === "assistant",
                  })}
                >
                      {message.content}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="border-t border-stone-200 bg-[#f5f2ec] px-4 py-3">
                <div className="mx-auto w-full max-w-3xl">
                  {error ? <p className="mb-3 text-xs text-red-600">{error}</p> : null}

                  <div className="mb-2.5 flex flex-wrap gap-2">
                    {showTenantTopicChooser ? (
                      selectedTenantTopic ? (
                        <div className="w-full rounded-[1rem] border border-emerald-200 bg-white px-3.5 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="mt-1 text-sm font-medium text-stone-900">
                                Here are some {selectedTenantTopic.label.toLowerCase()} questions I can help with.
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedTenantTopicId(null)}
                                disabled={isSending || isRevealingReply}
                              >
                                Back
                              </Button>
                              {!showQuickActions ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTenantTopicId(null);
                                    setIsBrowsingTenantTopics(false);
                                  }}
                                  disabled={isSending || isRevealingReply}
                                >
                                  Close
                                </Button>
                              ) : null}
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {selectedTenantTopic.questions.map((item) => (
                              <button
                                key={item.label}
                                type="button"
                                className="rounded-[0.9rem] border border-stone-300 bg-stone-50 px-3.5 py-2 text-xs text-stone-900 transition-colors hover:bg-white"
                                onClick={() => {
                                  void sendMessage(item.prompt);
                                }}
                                disabled={isSending || isRevealingReply}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="w-full rounded-[1rem] border border-stone-300 bg-white px-3.5 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-stone-900">What would you like help with?</p>
                            {!showQuickActions ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsBrowsingTenantTopics(false)}
                                disabled={isSending || isRevealingReply}
                              >
                                Close
                              </Button>
                            ) : null}
                          </div>
                          <div className="mt-3 grid gap-2 md:grid-cols-3">
                            {TENANT_TOPIC_GROUPS.map((topic) => (
                              <button
                                key={topic.id}
                                type="button"
                                className="rounded-[1rem] border border-stone-300 bg-stone-50 px-4 py-3 text-left transition-colors hover:bg-white"
                                onClick={() => setSelectedTenantTopicId(topic.id)}
                                disabled={isSending || isRevealingReply}
                              >
                                <p className="text-sm font-medium text-stone-900">{topic.label}</p>
                                <p className="mt-1 text-xs leading-5 text-stone-500">{topic.description}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    ) : (
                      <>
                        {!showQuickActions && currentRole === "tenant" ? (
                          <button
                            type="button"
                            className="rounded-[0.9rem] border border-stone-300 bg-stone-50 px-3.5 py-2 text-xs text-stone-900 transition-colors hover:bg-white"
                            onClick={() => setIsBrowsingTenantTopics(true)}
                            disabled={isSending || isRevealingReply}
                          >
                            Browse topics
                          </button>
                        ) : null}
                        {(showQuickActions ? quickActions : followUpSuggestions).map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            className="rounded-[0.9rem] border border-stone-300 bg-stone-50 px-3.5 py-2 text-xs text-stone-900 transition-colors hover:bg-white"
                            onClick={() => {
                              void sendMessage(item.prompt);
                            }}
                            disabled={isSending || isRevealingReply}
                          >
                            {item.label}
                          </button>
                        ))}
                      </>
                    )}
                  </div>

                  <div className="flex items-end gap-3">
                    <div className="flex-1 rounded-[1.15rem] border border-stone-300 bg-white px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                      <form
                        className="flex items-center gap-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void sendMessage();
                        }}
                      >
                        <Input
                          value={input}
                          onChange={(event) => setInput(event.target.value)}
                          placeholder={`Message ${ASSISTANT_NAME}...`}
                          disabled={isSending || isListening || isRevealingReply}
                          className="h-auto border-0 bg-transparent px-0 text-lg text-stone-900 shadow-none placeholder:text-stone-400 focus-visible:ring-0"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              void handleMicButton();
                            }}
                            disabled={!supportsSpeechRecognition || isSending || isRevealingReply}
                            aria-label={
                              isListening
                                ? "Stop microphone input"
                                : micPermission === "granted"
                                  ? "Start microphone input"
                                  : "Allow microphone access"
                            }
                            className="rounded-full border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100"
                          >
                            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={toggleVoice}
                            disabled={!supportsSpeechSynthesis}
                            aria-label={voiceEnabled ? "Mute assistant voice" : "Enable assistant voice"}
                            className="rounded-full border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100"
                          >
                            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                          </Button>
                        </div>
                      </form>
                    </div>

                    <Button
                      type="button"
                      onClick={() => {
                        void sendMessage();
                      }}
                      size="icon"
                      disabled={isSending || isRevealingReply || input.trim().length === 0}
                      aria-label="Send message"
                      className="h-[3.4rem] w-[3.4rem] rounded-[0.95rem] border border-stone-300 bg-white text-stone-900 shadow-sm hover:bg-stone-100"
                    >
                      <Send className="w-5 h-5" />
                    </Button>
                  </div>

                  <div className="mt-2 flex items-center justify-between px-2 text-xs text-stone-400">
                    <span>
                      {isListening
                        ? "Listening..."
                        : micPermission === "granted"
                          ? "Microphone ready"
                          : micPermission === "denied"
                            ? "Microphone blocked"
                            : micPermission === "unsupported"
                              ? "Microphone unavailable"
                              : "Microphone permission needed"}
                    </span>
                    <span>Press Enter to send</span>
                  </div>
                </div>
              </div>
            </section>
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
