import {
  ArrowLeft,
  Camera,
  Image as ImageIcon,
  Keyboard,
  Mic,
  MoreHorizontal,
  Phone,
  Send,
  Smile,
  Video,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { fetchConversationMessages, revokeChatMessage, sendChatMessage, sendTypingState } from "@/services/chatApi";
import { uploadMedia } from "@/services/uploadApi";
import type { ChatMessage, Conversation } from "@/types/chat";
import type { MealExchangeRequest } from "@/types/exchange";
import { ChatAvatar } from "./ChatAvatar";
import { MealExchangeBubble } from "./MealExchangeBubble";

export function ChatDetail({
  conversation,
  exchangeRequests,
  onExchangeRespond,
  onOpenUser,
  onOpenCard,
  currentUserId,
  onChatChanged,
  onBack,
}: {
  conversation: Conversation;
  exchangeRequests: MealExchangeRequest[];
  onExchangeRespond: (requestId: string, status: "rejected" | "accepted") => void;
  onOpenUser: (name: string) => void;
  onOpenCard: (cardId: string) => void;
  currentUserId?: string;
  onChatChanged: () => void;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [cloudExchangeRequests, setCloudExchangeRequests] = useState<MealExchangeRequest[]>([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [recording, setRecording] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const typingStopTimer = useRef<number | undefined>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordStartedAtRef = useRef(0);

  const isCloudConversation = conversation.id !== "system" && !conversation.id.startsWith("invite-");

  const loadMessages = useCallback(async () => {
    if (!isCloudConversation) {
      setMessages([]);
      setCloudExchangeRequests([]);
      return;
    }

    try {
      const result = await fetchConversationMessages(conversation.id);
      setMessages(result.messages);
      setCloudExchangeRequests(mapCloudExchangeRequests(result.exchangeRequests ?? [], result.cards ?? []));
      onChatChanged();
    } catch (error) {
      console.warn("Failed to load messages.", error);
      setMessages([]);
      setCloudExchangeRequests([]);
    }
  }, [conversation.id, isCloudConversation, onChatChanged]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!isCloudConversation) return;
    return subscribeRealtimeEvents((event) => {
      if (!isConversationEvent(event.data, conversation.id)) return;

      if (event.type === "chat.typing") {
        const data = event.data as { userId?: string; typing?: boolean };
        if (data.userId && data.userId !== currentUserId) {
          setTyping(Boolean(data.typing));
        }
        return;
      }

      if (event.type === "chat.conversation.read") {
        const data = event.data as { userId?: string; messageIds?: string[] };
        if (!data.userId) return;
        setMessages((current) =>
          current.map((message) => {
            if (data.messageIds?.length && !data.messageIds.includes(message.id)) return message;
            if (message.readByUserIds.includes(data.userId!)) return message;
            return { ...message, readByUserIds: [...message.readByUserIds, data.userId!] };
          })
        );
        onChatChanged();
        return;
      }

      if (event.type.startsWith("chat.")) {
        loadMessages();
      }
    });
  }, [conversation.id, currentUserId, isCloudConversation, loadMessages]);

  useEffect(() => {
    if (!isCloudConversation) return;
    const timer = window.setInterval(loadMessages, 30000);
    return () => window.clearInterval(timer);
  }, [isCloudConversation, loadMessages]);

  useEffect(() => {
    setTyping(false);
    setDraft("");
    return () => {
      if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    };
  }, [conversation.id]);

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (!isCloudConversation) return;

    sendTypingState(conversation.id, Boolean(value.trim())).catch(() => undefined);
    if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
    typingStopTimer.current = window.setTimeout(() => {
      sendTypingState(conversation.id, false).catch(() => undefined);
    }, 1400);
  };

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || !isCloudConversation) return;

    setDraft("");
    try {
      await sendTypingState(conversation.id, false);
      const message = await sendChatMessage({ conversationId: conversation.id, text });
      setMessages((current) => [...current, message]);
      onChatChanged();
      loadMessages();
    } catch (error) {
      console.warn("Failed to send message.", error);
      setDraft(text);
    }
  };

  const sendImageMessage = async (file: File) => {
    if (!isCloudConversation) return;
    setSendingMedia(true);
    try {
      const asset = await uploadMedia({
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
        dataBase64: await fileToBase64(file),
        purpose: "chat-image",
      });
      const message = await sendChatMessage({
        conversationId: conversation.id,
        type: "image",
        text: "[图片]",
        metadata: { url: asset.url, name: file.name, mimeType: asset.mimeType, size: asset.size },
      });
      setMessages((current) => [...current, message]);
      onChatChanged();
      loadMessages();
    } catch (error) {
      console.warn("Failed to send image message.", error);
    } finally {
      setSendingMedia(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const sendAudioBlob = async (blob: Blob, duration: number) => {
    if (!isCloudConversation) return;
    setSendingMedia(true);
    try {
      const asset = await uploadMedia({
        fileName: `voice-${Date.now()}.webm`,
        mimeType: blob.type || "audio/webm",
        dataBase64: await blobToBase64(blob),
        purpose: "chat-audio",
      });
      const message = await sendChatMessage({
        conversationId: conversation.id,
        type: "audio",
        text: "[语音]",
        metadata: { url: asset.url, duration: Math.max(1, Math.round(duration)), mimeType: asset.mimeType, size: asset.size },
      });
      setMessages((current) => [...current, message]);
      onChatChanged();
      loadMessages();
    } catch (error) {
      console.warn("Failed to send audio message.", error);
    } finally {
      setSendingMedia(false);
    }
  };

  const startAudioRecording = async () => {
    if (!isCloudConversation || recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recordStartedAtRef.current = Date.now();
      mediaRecorderRef.current = recorder;
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        const duration = (Date.now() - recordStartedAtRef.current) / 1000;
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        setRecording(false);
        if (blob.size > 0) sendAudioBlob(blob, duration);
      });
      recorder.start();
      setRecording(true);
    } catch (error) {
      console.warn("Failed to start audio recording.", error);
      setRecording(false);
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const revokeMessage = async (messageId: string) => {
    try {
      const revoked = await revokeChatMessage(messageId);
      setMessages((current) => current.map((message) => message.id === messageId ? revoked : message));
      onChatChanged();
    } catch (error) {
      console.warn("Failed to revoke message.", error);
    }
  };

  const visibleExchangeRequests = mergeExchangeRequests(exchangeRequests, cloudExchangeRequests);

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[#efece4] pb-[calc(132px+env(safe-area-inset-bottom))] text-[#17231f]">
      <div className="absolute inset-0 opacity-[0.38]">
        <div className="h-full w-full bg-[radial-gradient(circle_at_12%_16%,rgba(63,111,96,0.14)_0_2px,transparent_3px),radial-gradient(circle_at_82%_22%,rgba(213,182,111,0.18)_0_3px,transparent_4px),radial-gradient(circle_at_42%_72%,rgba(217,154,136,0.16)_0_2px,transparent_3px),linear-gradient(45deg,transparent_0_46%,rgba(63,111,96,0.08)_47%_48%,transparent_49%)] bg-[length:42px_42px,58px_58px,54px_54px,36px_36px]" />
      </div>

      <header className="relative z-20 border-b border-[rgba(115,95,70,0.12)] bg-[rgba(251,250,245,0.9)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-2 px-3 py-3">
          <button onClick={onBack} className="safe-tap flex items-center justify-center rounded-lg text-[#1b2924]" aria-label="返回消息列表">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <button onClick={() => onOpenUser(conversation.name)} aria-label={`查看${conversation.name}主页`}>
            <ChatAvatar text={conversation.avatar} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[16px] font-black text-[#111b16]">{conversation.name}</h1>
              <span className={`h-2 w-2 rounded-full ${conversation.online ? "bg-[#62b27d]" : "bg-black/20"}`} />
            </div>
            <p className="truncate text-[12px] font-semibold text-[rgba(23,35,31,0.56)]">
              {typing ? "正在输入..." : conversation.online ? "在线 · 通常几分钟内回复" : "离线 · 会收到你的消息"}
            </p>
          </div>
          <button className="safe-tap flex items-center justify-center rounded-lg text-[#1b2924]" aria-label="视频通话">
            <Video className="h-[21px] w-[21px]" />
          </button>
          <button className="safe-tap flex items-center justify-center rounded-lg text-[#1b2924]" aria-label="语音通话">
            <Phone className="h-[20px] w-[20px]" />
          </button>
        </div>
      </header>

      <main className="app-chat-scroll relative z-10 mx-auto flex max-w-md flex-col gap-2 overflow-y-auto px-3 py-4">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            currentUserId={currentUserId}
            exchangeRequests={visibleExchangeRequests}
            onExchangeRespond={onExchangeRespond}
            onOpenCard={onOpenCard}
            onRevoke={revokeMessage}
          />
        ))}
        {visibleExchangeRequests
          .filter((request) => !messages.some((message) => message.metadata?.exchangeRequestId === request.id))
          .map((request) => (
            <MealExchangeBubble
              key={request.id}
              request={request}
              onRespond={(status) => onExchangeRespond(request.id, status)}
              onOpenCard={(cardId) => onOpenCard(cardId)}
            />
          ))}
        {typing ? (
          <div className="flex justify-start">
            <div className="rounded-lg rounded-bl-sm bg-white px-3 py-2 text-[13px] font-semibold text-black/50 shadow-sm">
              对方正在输入...
            </div>
          </div>
        ) : null}
        {!visibleExchangeRequests.length && !messages.length ? (
          <div className="mx-auto mt-6 max-w-[280px] rounded-lg bg-white/78 px-4 py-3 text-center text-sm font-semibold text-black/50 shadow-sm">
            还没有消息。
          </div>
        ) : null}
      </main>

      <footer className="app-chat-input-bar fixed inset-x-0 z-30 bg-[rgba(239,236,228,0.86)] px-3 pt-2 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <button className="safe-tap flex items-center justify-center rounded-full text-[#2a3b34]" aria-label="键盘"><Keyboard className="h-5 w-5" /></button>
          <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-3 shadow-sm ring-1 ring-black/10">
            <Smile className="h-5 w-5 shrink-0 text-black/50" />
            <input
              value={draft}
              disabled={!isCloudConversation}
              onChange={(event) => handleDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") sendMessage();
              }}
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:text-black/40 disabled:cursor-not-allowed"
              placeholder={isCloudConversation ? "输入消息" : "选择一个云端会话后聊天"}
            />
            <MoreHorizontal className="h-5 w-5 shrink-0 text-black/50" />
          </label>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) sendImageMessage(file);
            }}
          />
          <button
            disabled={!isCloudConversation || sendingMedia}
            onClick={() => imageInputRef.current?.click()}
            className="safe-tap flex items-center justify-center rounded-full text-[#2a3b34] disabled:opacity-40"
            aria-label="发送图片"
          >
            <Camera className="h-5 w-5" />
          </button>
          <button
            disabled={!isCloudConversation || sendingMedia}
            onClick={recording ? stopAudioRecording : startAudioRecording}
            className={`safe-tap flex items-center justify-center rounded-full disabled:opacity-40 ${recording ? "bg-[#d99a88] text-white" : "text-[#2a3b34]"}`}
            aria-label={recording ? "停止录音并发送" : "录制语音"}
          >
            <Mic className="h-5 w-5" />
          </button>
          <button onClick={sendMessage} disabled={!draft.trim() || !isCloudConversation} className="safe-tap flex items-center justify-center rounded-full bg-[var(--pine)] text-white shadow-[0_8px_18px_rgba(63,111,96,0.24)] disabled:opacity-50" aria-label="发送">
            <Send className="h-[18px] w-[18px]" />
          </button>
        </div>
      </footer>
    </div>
  );
}

function MessageBubble({
  message,
  currentUserId,
  exchangeRequests,
  onExchangeRespond,
  onOpenCard,
  onRevoke,
}: {
  message: ChatMessage;
  currentUserId?: string;
  exchangeRequests: MealExchangeRequest[];
  onExchangeRespond: (requestId: string, status: "rejected" | "accepted") => void;
  onOpenCard: (cardId: string) => void;
  onRevoke: (messageId: string) => void;
}) {
  const mine = message.senderUserId === currentUserId;

  if (message.type === "meal-card-exchange") {
    const requestId = typeof message.metadata?.exchangeRequestId === "string" ? message.metadata.exchangeRequestId : "";
    const request = exchangeRequests.find((item) => item.id === requestId);
    if (!request) {
      return (
        <div className="mx-auto mb-2 max-w-[310px] rounded-lg bg-[#fff4dc] px-4 py-3 text-center text-[13px] font-semibold leading-5 text-[#4f4634] shadow-sm">
          约饭邀请已发送。
        </div>
      );
    }

    return (
      <MealExchangeBubble
        request={request}
        onRespond={(status) => onExchangeRespond(request.id, status)}
        onOpenCard={(cardId) => onOpenCard(cardId)}
      />
    );
  }

  if (message.type === "system") {
    return (
      <div className="mx-auto mb-2 max-w-[310px] rounded-lg bg-[#fff4dc] px-4 py-3 text-center text-[13px] font-semibold leading-5 text-[#4f4634] shadow-sm">
        {message.text}
      </div>
    );
  }

  const readByOther = mine && message.readByUserIds.some((userId) => userId !== currentUserId);

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[78%] rounded-lg px-3 py-2 shadow-sm ${mine ? "rounded-br-sm bg-[#d8ffd5]" : "rounded-bl-sm bg-white"}`}>
        <MessageContent message={message} />
        <div className={`mt-1 flex items-center gap-2 ${mine ? "justify-end" : "justify-start"}`}>
          <span className="text-[11px] font-semibold text-black/50">{formatMessageTime(message.createdAt)}</span>
          {mine ? <span className="text-[11px] font-black text-black/45">{readByOther ? "已读" : "已发送"}</span> : null}
          {mine && !message.revokedAt ? (
            <button onClick={() => onRevoke(message.id)} className="text-[11px] font-black text-black/45">
              撤回
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MessageContent({ message }: { message: ChatMessage }) {
  if (message.revokedAt) {
    return <p className="text-[14px] font-semibold text-black/45">消息已撤回</p>;
  }

  if (message.type === "image") {
    const url = typeof message.metadata?.url === "string" ? message.metadata.url : "";
    return (
      <div className="min-w-[160px] overflow-hidden rounded-md bg-black/5">
        {url ? (
          <img src={url} alt="聊天图片" className="max-h-56 w-full object-cover" />
        ) : (
          <div className="flex h-28 items-center justify-center gap-2 text-sm font-black text-black/45">
            <ImageIcon className="h-5 w-5" />
            图片消息
          </div>
        )}
      </div>
    );
  }

  if (message.type === "audio") {
    const duration = typeof message.metadata?.duration === "number" ? message.metadata.duration : 0;
    const url = typeof message.metadata?.url === "string" ? message.metadata.url : "";
    return (
      <div className="min-w-[180px]">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-[var(--pine)]" />
          <div className="h-2 flex-1 rounded-full bg-[rgba(63,111,96,0.24)]">
            <div className="h-full w-2/3 rounded-full bg-[var(--pine)]" />
          </div>
          <span className="text-xs font-black text-black/55">{duration || 1}s</span>
        </div>
        {url ? <audio controls src={url} className="mt-2 h-8 w-full" /> : null}
      </div>
    );
  }

  return <p className="whitespace-pre-wrap text-[15px] font-semibold leading-[1.45]">{message.text}</p>;
}

function mapCloudExchangeRequests(
  requests: Array<{
    id: string;
    conversationId: string;
    targetCardId: string;
    ownCardId?: string;
    status: "pending" | "accepted" | "rejected";
  }>,
  cards: Array<MealExchangeRequest["targetCard"]>
): MealExchangeRequest[] {
  return requests.flatMap((request) => {
    const targetCard = cards.find((card) => card.id === request.targetCardId);
    if (!targetCard) return [];
    const ownCard = request.ownCardId ? cards.find((card) => card.id === request.ownCardId) : undefined;
    return [{
      id: request.id,
      conversationId: request.conversationId,
      targetName: targetCard.nickname,
      targetCard,
      ownCard,
      status: request.status,
    }];
  });
}

function mergeExchangeRequests(localRequests: MealExchangeRequest[], cloudRequests: MealExchangeRequest[]) {
  return Array.from(
    new Map([...cloudRequests, ...localRequests].map((request) => [request.id, request])).values()
  );
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isConversationEvent(data: unknown, conversationId: string) {
  return (
    typeof data === "object" &&
    data !== null &&
    "conversationId" in data &&
    (data as { conversationId?: unknown }).conversationId === conversationId
  );
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
