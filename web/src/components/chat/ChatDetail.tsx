import {
  ArrowLeft,
  BellOff,
  Camera,
  ChevronRight,
  Image as ImageIcon,
  Keyboard,
  Mic,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Send,
  Smile,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useCapacitorBackButton } from "@/hooks/useCapacitorBackButton";
import { subscribeRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { fetchConversationMessages, fetchConversationMembers, revokeChatMessage, sendChatMessage, sendTypingState } from "@/services/chatApi";
import { uploadMedia } from "@/services/uploadApi";
import type { ChatMember, ChatMessage, Conversation } from "@/types/chat";
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState(() => loadLocalChatSettings(conversation.id));
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const typingStopTimer = useRef<number | undefined>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordStartedAtRef = useRef(0);

  const isCloudConversation = conversation.id !== "system" && !conversation.id.startsWith("invite-");

  useCapacitorBackButton(() => {
    if (!settingsOpen) return false;
    setSettingsOpen(false);
    return true;
  }, settingsOpen);

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
    setLocalSettings(loadLocalChatSettings(conversation.id));
    return () => {
      if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    };
  }, [conversation.id]);

  useEffect(() => {
    window.localStorage.setItem(chatSettingsKey(conversation.id), JSON.stringify(localSettings));
  }, [conversation.id, localSettings]);

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
          <button onClick={() => setSettingsOpen(true)} className="safe-tap flex items-center justify-center rounded-lg text-[#1b2924]" aria-label="聊天设置">
            <MoreHorizontal className="h-[22px] w-[22px]" />
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
      {settingsOpen ? (
        <ChatSettingsView
          conversation={conversation}
          currentUserId={currentUserId}
          settings={localSettings}
          onSettingsChange={setLocalSettings}
          onBack={() => setSettingsOpen(false)}
          onOpenUser={() => onOpenUser(conversation.name)}
          onClearMessages={() => setMessages([])}
        />
      ) : null}
    </div>
  );
}

type LocalChatSettings = {
  remark: string;
  muted: boolean;
  pinned: boolean;
  blocked: boolean;
  groupNickname: string;
  groupRemark: string;
  announcement: string;
};

function ChatSettingsView({
  conversation,
  currentUserId,
  settings,
  onSettingsChange,
  onBack,
  onOpenUser,
  onClearMessages,
}: {
  conversation: Conversation;
  currentUserId?: string;
  settings: LocalChatSettings;
  onSettingsChange: (settings: LocalChatSettings) => void;
  onBack: () => void;
  onOpenUser: () => void;
  onClearMessages: () => void;
}) {
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [editing, setEditing] = useState<null | "remark" | "groupNickname" | "groupRemark" | "announcement">(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!conversation.group) return;
    let cancelled = false;
    fetchConversationMembers(conversation.id)
      .then((items) => {
        if (!cancelled) setMembers(items);
      })
      .catch((error) => {
        if (!cancelled) console.warn("Failed to load group members.", error);
      });
    return () => {
      cancelled = true;
    };
  }, [conversation.group, conversation.id]);

  const update = (patch: Partial<LocalChatSettings>) => onSettingsChange({ ...settings, ...patch });
  const openEdit = (key: NonNullable<typeof editing>, value: string) => {
    setDraft(value);
    setEditing(key);
  };
  const saveEdit = () => {
    if (!editing) return;
    update({ [editing]: draft.trim() } as Partial<LocalChatSettings>);
    setEditing(null);
    setDraft("");
  };

  if (editing) {
    const titleMap: Record<NonNullable<typeof editing>, string> = {
      remark: "设置备注名",
      groupNickname: "我在本群的昵称",
      groupRemark: "群备注",
      announcement: "群公告",
    };
    return (
      <div className="fixed inset-0 z-[95] bg-[#f7faf5]">
        <section className="mx-auto flex h-full max-w-md flex-col px-4 pb-5 pt-4">
          <SettingsHeader title={titleMap[editing]} onBack={() => setEditing(null)} />
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="mt-4 min-h-32 resize-none rounded-lg bg-white/86 p-4 text-[16px] font-semibold leading-6 outline-none ring-1 ring-[var(--line-soft)]"
            placeholder="请输入"
          />
          <button onClick={saveEdit} className="mt-4 h-11 rounded-lg bg-[var(--pine)] text-sm font-black text-white">保存</button>
        </section>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] bg-[#f7faf5]">
      <section className="mx-auto h-full max-w-md overflow-y-auto px-4 pb-8 pt-4">
        <SettingsHeader title={conversation.group ? "群聊设置" : "聊天设置"} onBack={onBack} />

        {conversation.group ? (
          <section className="mt-4 rounded-lg bg-white/82 p-4 ring-1 ring-[var(--line-soft)]">
            <button className="flex w-full items-center gap-3 text-left">
              <ChatAvatar text={conversation.avatar} group />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-black text-[var(--text-main)]">{conversation.name}</h2>
                <p className="mt-1 truncate text-sm font-semibold text-[var(--text-muted)]">{conversation.description || "欢迎来到这个群聊"}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-[var(--text-faint)]" />
            </button>
            <div className="mt-4 border-t border-[var(--line-soft)] pt-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-black text-[var(--text-main)]">群成员({conversation.memberCount ?? (members.length || 1)})</h3>
                <button className="text-sm font-black text-[var(--text-muted)]">全部</button>
              </div>
              <div className="grid grid-cols-5 gap-3">
                {members.slice(0, 9).map((member) => (
                  <button key={member.id} className="min-w-0 text-center">
                    <span className="mx-auto block h-12 w-12 overflow-hidden rounded-full bg-[rgba(209,228,221,0.86)]">
                      {member.avatarUrl ? <img src={member.avatarUrl} alt={member.nickname} className="h-full w-full object-cover" /> : (
                        <span className="display-cn flex h-full w-full items-center justify-center text-[var(--pine)]">{member.avatarText}</span>
                      )}
                    </span>
                    <span className="mt-1 block truncate text-xs font-bold text-[var(--text-muted)]">{member.id === currentUserId ? "我" : member.nickname}</span>
                  </button>
                ))}
                <button className="text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(244,248,244,0.92)] text-[var(--text-faint)]">
                    <Plus className="h-5 w-5" />
                  </span>
                  <span className="mt-1 block text-xs font-bold text-[var(--text-muted)]">邀请好友</span>
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="mt-4 flex flex-col items-center py-8">
            <button onClick={onOpenUser} className="display-cn flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#d1e4dd] via-[#d5b66f] to-[#92b8a7] text-3xl text-[#28483f]">{conversation.avatar}</button>
            <h2 className="mt-4 text-2xl font-black text-[var(--text-main)]">{settings.remark || conversation.name}</h2>
            <p className="mt-2 rounded-full bg-white/72 px-4 py-2 text-sm font-black text-[var(--pine)] ring-1 ring-[var(--line-soft)]">{conversation.online ? "在线" : "离线"}</p>
          </section>
        )}

        <SettingsBlock>
          {conversation.group ? (
            <>
              <SettingsRow label="分享群邀请" value="链接/二维码" />
              <SettingsRow label="生成评论区群链接" description="可直接粘贴到笔记评论区" />
              <SettingsRow label="群二维码" value="保存" />
            </>
          ) : (
            <>
              <SettingsRow label="设置备注名" value={settings.remark || "未设置"} onClick={() => openEdit("remark", settings.remark)} />
              <SettingsRow label="查找聊天记录" icon={<Search className="h-4 w-4" />} />
            </>
          )}
        </SettingsBlock>

        {conversation.group ? (
          <SettingsBlock>
            <SettingsRow label="群公告" value={settings.announcement || "未设置"} onClick={() => openEdit("announcement", settings.announcement)} />
            <SettingsRow label="我在本群的昵称" value={settings.groupNickname || "未设置"} onClick={() => openEdit("groupNickname", settings.groupNickname)} />
            <SettingsRow label="群备注" value={settings.groupRemark || "未设置"} onClick={() => openEdit("groupRemark", settings.groupRemark)} />
            <SettingsRow label="查找聊天记录" />
          </SettingsBlock>
        ) : null}

        <SettingsBlock>
          <ToggleSettingsRow label="置顶聊天" enabled={settings.pinned} onToggle={() => update({ pinned: !settings.pinned })} />
          <ToggleSettingsRow label="消息免打扰" description={settings.muted ? "仅通知重要消息" : undefined} enabled={settings.muted} onToggle={() => update({ muted: !settings.muted })} />
        </SettingsBlock>

        <SettingsBlock>
          {!conversation.group ? <ToggleSettingsRow label="加入黑名单" enabled={settings.blocked} onToggle={() => update({ blocked: !settings.blocked })} /> : null}
          <SettingsRow label="举报" icon={<BellOff className="h-4 w-4" />} />
          {conversation.group ? <SettingsRow label="群聊公约" /> : null}
          <SettingsRow label="临时清空当前视图" description="重新进入会话后会从云端重新加载" danger icon={<Trash2 className="h-4 w-4" />} onClick={onClearMessages} />
        </SettingsBlock>

        {conversation.group ? <button className="mt-5 h-12 w-full rounded-lg bg-white/82 text-sm font-black text-[var(--coral)] ring-1 ring-[var(--line-soft)]">删除并退出</button> : null}
      </section>
    </div>
  );
}

function SettingsHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="relative flex h-14 items-center justify-center">
      <button onClick={onBack} className="absolute left-0 safe-tap flex items-center justify-center rounded-lg text-[var(--pine)]" aria-label="返回">
        <ArrowLeft className="h-6 w-6" />
      </button>
      <h1 className="display-cn text-[22px] text-[var(--text-main)]">{title}</h1>
      <button onClick={onBack} className="absolute right-0 safe-tap flex items-center justify-center rounded-lg text-[var(--pine)]" aria-label="关闭">
        <X className="h-5 w-5" />
      </button>
    </header>
  );
}

function SettingsBlock({ children }: { children: ReactNode }) {
  return <section className="mt-4 overflow-hidden rounded-lg bg-white/82 ring-1 ring-[var(--line-soft)]">{children}</section>;
}

function SettingsRow({
  label,
  value,
  description,
  icon,
  danger,
  onClick,
}: {
  label: string;
  value?: string;
  description?: string;
  icon?: ReactNode;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 border-b border-[var(--line-soft)] px-4 py-4 text-left last:border-b-0">
      <span className="min-w-0 flex-1">
        <span className={`block text-[16px] font-black ${danger ? "text-[var(--coral)]" : "text-[var(--text-main)]"}`}>{label}</span>
        {description ? <span className="mt-1 block text-xs font-semibold text-[var(--text-muted)]">{description}</span> : null}
      </span>
      {icon}
      {value ? <span className="max-w-[150px] truncate text-sm font-bold text-[var(--text-faint)]">{value}</span> : null}
      <ChevronRight className="h-5 w-5 shrink-0 text-[var(--text-faint)]" />
    </button>
  );
}

function ToggleSettingsRow({ label, description, enabled, onToggle }: { label: string; description?: string; enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex w-full items-center justify-between gap-3 border-b border-[var(--line-soft)] px-4 py-4 text-left last:border-b-0">
      <span className="min-w-0">
        <span className="block text-[16px] font-black text-[var(--text-main)]">{label}</span>
        {description ? <span className="mt-1 block text-xs font-semibold text-[var(--text-muted)]">{description}</span> : null}
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full p-1 ${enabled ? "bg-[var(--pine)]" : "bg-[rgba(159,174,166,0.34)]"}`}>
        <span className={`block h-5 w-5 rounded-full bg-white shadow-sm transition ${enabled ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}

function defaultLocalChatSettings(): LocalChatSettings {
  return {
    remark: "",
    muted: false,
    pinned: false,
    blocked: false,
    groupNickname: "",
    groupRemark: "",
    announcement: "",
  };
}

function chatSettingsKey(conversationId: string) {
  return `ueat-chat-settings-${conversationId}`;
}

function loadLocalChatSettings(conversationId: string): LocalChatSettings {
  try {
    const raw = window.localStorage.getItem(chatSettingsKey(conversationId));
    if (!raw) return defaultLocalChatSettings();
    return { ...defaultLocalChatSettings(), ...JSON.parse(raw) };
  } catch {
    return defaultLocalChatSettings();
  }
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
