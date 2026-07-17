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
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useCapacitorBackButton } from "@/hooks/useCapacitorBackButton";
import { subscribeRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { runtimeConfig } from "@/config/runtime";
import { ApiError } from "@/services/apiClient";
import { fetchConversationMessages, fetchConversationMembers, revokeChatMessage, sendCallSignal, sendChatMessage, sendTypingState, updateGroupConversation } from "@/services/chatApi";
import { reportContent } from "@/services/reportsApi";
import { uploadMedia } from "@/services/uploadApi";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import type { ChatMember, ChatMessage, Conversation } from "@/types/chat";
import type { MealExchangeRequest } from "@/types/exchange";
import { ChatAvatar } from "./ChatAvatar";
import { MealExchangeBubble } from "./MealExchangeBubble";

type VoiceCallState =
  | { status: "idle"; error?: string }
  | { status: "calling" | "incoming" | "connecting" | "active" | "ended"; callId: string; peerName: string; error?: string };

type CallSignalData = {
  conversationId?: string;
  callId?: string;
  fromUserId?: string;
  action?: "offer" | "answer" | "ice" | "hangup" | "reject";
  payload?: Record<string, unknown>;
};

const voiceRtcConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function ChatDetail({
  conversation,
  exchangeRequests,
  onExchangeRespond,
  onOpenUser,
  onOpenPost,
  onOpenCard,
  currentUserId,
  onChatChanged,
  onBack,
}: {
  conversation: Conversation;
  exchangeRequests: MealExchangeRequest[];
  onExchangeRespond: (requestId: string, status: "rejected" | "accepted") => void;
  onOpenUser: (name: string, userId?: string) => void;
  onOpenPost: (postId: string, commentsOpen?: boolean) => void;
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
  const [sendNotice, setSendNotice] = useState("");
  const [conversationMembers, setConversationMembers] = useState<ChatMember[]>([]);
  const [localSettings, setLocalSettings] = useState(() => loadLocalChatSettings(conversation.id));
  const [voiceCall, setVoiceCall] = useState<VoiceCallState>({ status: "idle" });
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const typingStopTimer = useRef<number | undefined>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordStartedAtRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localAudioStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);

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

  const cleanupVoiceCall = useCallback((nextState: VoiceCallState = { status: "idle" }) => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localAudioStreamRef.current?.getTracks().forEach((track) => track.stop());
    localAudioStreamRef.current = null;
    pendingOfferRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    setVoiceCall(nextState);
  }, []);

  const getLocalAudioStream = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("media-devices-unavailable");
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localAudioStreamRef.current = stream;
    return stream;
  }, []);

  const createPeerConnection = useCallback((callId: string) => {
    const peer = new RTCPeerConnection(voiceRtcConfig);
    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      sendCallSignal({
        conversationId: conversation.id,
        callId,
        action: "ice",
        payload: { candidate: event.candidate.toJSON() },
      }).catch((error) => console.warn("Failed to send ICE candidate.", error));
    };
    peer.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch(() => undefined);
      }
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") {
        setVoiceCall((current) => current.status !== "idle" && current.callId === callId ? { ...current, status: "active" } : current);
      }
      if (peer.connectionState === "failed") {
        cleanupVoiceCall({ status: "ended", callId, peerName: conversation.name, error: "语音连接中断，请重新发起通话。" });
      }
    };
    peerConnectionRef.current = peer;
    return peer;
  }, [cleanupVoiceCall, conversation.id, conversation.name]);

  const startVoiceCall = useCallback(async () => {
    if (!isCloudConversation) {
      setVoiceCall({ status: "ended", callId: "local", peerName: conversation.name, error: "当前会话暂不能语音通话。" });
      return;
    }
    if (conversation.group) {
      setVoiceCall({ status: "ended", callId: "group", peerName: conversation.name, error: "群聊语音通话暂未开放，请先使用私聊。" });
      return;
    }
    if (voiceCall.status !== "idle" && voiceCall.status !== "ended") return;

    const callId = `${conversation.id}-${Date.now()}`;
    setVoiceCall({ status: "calling", callId, peerName: conversation.name });
    try {
      const stream = await getLocalAudioStream();
      const peer = createPeerConnection(callId);
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await sendCallSignal({ conversationId: conversation.id, callId, action: "offer", payload: { offer } });
    } catch (error) {
      console.warn("Failed to start voice call.", error);
      cleanupVoiceCall({ status: "ended", callId, peerName: conversation.name, error: "无法发起语音通话，请检查麦克风权限。" });
    }
  }, [cleanupVoiceCall, conversation.group, conversation.id, conversation.name, createPeerConnection, getLocalAudioStream, isCloudConversation, voiceCall.status]);

  const acceptVoiceCall = useCallback(async () => {
    if (voiceCall.status !== "incoming" || !pendingOfferRef.current) return;
    const currentCall = voiceCall;
    setVoiceCall({ ...currentCall, status: "connecting" });
    try {
      const stream = await getLocalAudioStream();
      const peer = createPeerConnection(currentCall.callId);
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      await peer.setRemoteDescription(pendingOfferRef.current);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await sendCallSignal({ conversationId: conversation.id, callId: currentCall.callId, action: "answer", payload: { answer } });
      setVoiceCall({ ...currentCall, status: "active" });
    } catch (error) {
      console.warn("Failed to accept voice call.", error);
      cleanupVoiceCall({ status: "ended", callId: currentCall.callId, peerName: currentCall.peerName, error: "接听失败，请检查麦克风权限。" });
    }
  }, [cleanupVoiceCall, conversation.id, createPeerConnection, getLocalAudioStream, voiceCall]);

  const rejectVoiceCall = useCallback(() => {
    if (voiceCall.status !== "incoming") return;
    sendCallSignal({ conversationId: conversation.id, callId: voiceCall.callId, action: "reject" }).catch(() => undefined);
    cleanupVoiceCall({ status: "ended", callId: voiceCall.callId, peerName: voiceCall.peerName, error: "已拒绝语音通话。" });
  }, [cleanupVoiceCall, conversation.id, voiceCall]);

  const hangupVoiceCall = useCallback(() => {
    if (voiceCall.status === "idle" || voiceCall.status === "ended") return;
    sendCallSignal({ conversationId: conversation.id, callId: voiceCall.callId, action: "hangup" }).catch(() => undefined);
    cleanupVoiceCall({ status: "ended", callId: voiceCall.callId, peerName: voiceCall.peerName, error: "语音通话已结束。" });
  }, [cleanupVoiceCall, conversation.id, voiceCall]);

  const handleCallSignal = useCallback(async (data: CallSignalData) => {
    if (!data.callId || !data.action || data.fromUserId === currentUserId) return;

    if (data.action === "offer") {
      const offer = readSessionDescription(data.payload?.offer);
      if (!offer) return;
      if (voiceCall.status !== "idle" && voiceCall.status !== "ended") {
        await sendCallSignal({ conversationId: conversation.id, callId: data.callId, action: "reject" }).catch(() => undefined);
        return;
      }
      pendingOfferRef.current = offer;
      setVoiceCall({ status: "incoming", callId: data.callId, peerName: conversation.name });
      return;
    }

    if (data.action === "answer") {
      const answer = readSessionDescription(data.payload?.answer);
      if (!answer || !peerConnectionRef.current) return;
      await peerConnectionRef.current.setRemoteDescription(answer).catch((error) => console.warn("Failed to apply call answer.", error));
      setVoiceCall((current) => current.status !== "idle" && current.callId === data.callId ? { ...current, status: "active" } : current);
      return;
    }

    if (data.action === "ice") {
      const candidate = readIceCandidate(data.payload?.candidate);
      if (candidate && peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(candidate).catch((error) => console.warn("Failed to apply ICE candidate.", error));
      }
      return;
    }

    if (data.action === "hangup" || data.action === "reject") {
      cleanupVoiceCall({
        status: "ended",
        callId: data.callId,
        peerName: conversation.name,
        error: data.action === "reject" ? "对方已拒绝语音通话。" : "对方已结束语音通话。",
      });
    }
  }, [cleanupVoiceCall, conversation.id, conversation.name, currentUserId, voiceCall.status]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    let cancelled = false;
    if (!conversation.group || !isCloudConversation) {
      setConversationMembers([]);
      return;
    }

    fetchConversationMembers(conversation.id)
      .then((members) => {
        if (!cancelled) setConversationMembers(members);
      })
      .catch((error) => {
        if (!cancelled) console.warn("Failed to load group members for messages.", error);
      });

    return () => {
      cancelled = true;
    };
  }, [conversation.group, conversation.id, isCloudConversation]);

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

      if (event.type === "chat.call.signal") {
        void handleCallSignal(event.data as CallSignalData);
        return;
      }

      if (event.type.startsWith("chat.")) {
        loadMessages();
      }
    });
  }, [conversation.id, currentUserId, handleCallSignal, isCloudConversation, loadMessages]);

  useEffect(() => {
    if (!isCloudConversation) return;
    const timer = window.setInterval(loadMessages, 30000);
    return () => window.clearInterval(timer);
  }, [isCloudConversation, loadMessages]);

  useEffect(() => {
    setTyping(false);
    setDraft("");
    setSendNotice("");
    setLocalSettings(loadLocalChatSettings(conversation.id));
    return () => {
      if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      cleanupVoiceCall();
    };
  }, [cleanupVoiceCall, conversation.id]);

  useEffect(() => {
    window.localStorage.setItem(chatSettingsKey(conversation.id), JSON.stringify(localSettings));
  }, [conversation.id, localSettings]);

  const handleDraftChange = (value: string) => {
    setDraft(value);
    setSendNotice("");
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
      setSendNotice(readApiErrorMessage(error) ?? "发送失败，请稍后再试。");
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

  const visibleExchangeRequests = mergeExchangeRequests(exchangeRequests, cloudExchangeRequests);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, visibleExchangeRequests.length, typing]);

  const revokeMessage = async (messageId: string) => {
    try {
      const revoked = await revokeChatMessage(messageId);
      setMessages((current) => current.map((message) => message.id === messageId ? revoked : message));
      onChatChanged();
    } catch (error) {
      console.warn("Failed to revoke message.", error);
    }
  };

  return (
    <div className="app-screen-push chat-detail-shell relative text-[var(--text-main)]">

      <header className="chat-detail-header relative z-20">
        <div className="mx-auto flex max-w-md items-center gap-2 px-3 py-3">
          <button onClick={onBack} className="safe-tap flex items-center justify-center rounded-lg text-[#1b2924]" aria-label="返回消息列表">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <button
            onClick={() => conversation.group ? setSettingsOpen(true) : onOpenUser(conversation.name, conversation.otherUserId)}
            aria-label={conversation.group ? "打开群聊设置" : `查看${conversation.name}主页`}
          >
            <ChatAvatar text={conversation.avatar} imageUrl={conversation.avatarUrl} group={conversation.group} compact />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[16px] font-black text-[#111b16]">{conversation.name}</h1>
              <span className={`h-2 w-2 rounded-full ${conversation.online ? "bg-[#75a64b]" : "bg-black/20"}`} />
            </div>
            <p className="truncate text-[12px] font-semibold text-[rgba(23,35,31,0.56)]">
              {typing ? "正在输入..." : conversation.online ? "在线 · 通常几分钟内回复" : "离线 · 会收到你的消息"}
            </p>
          </div>
          <button className="safe-tap flex items-center justify-center rounded-lg text-[#1b2924] max-[370px]:hidden" aria-label="视频通话">
            <Video className="h-[21px] w-[21px]" />
          </button>
          <button onClick={startVoiceCall} className="safe-tap flex items-center justify-center rounded-lg text-[#1b2924]" aria-label="语音通话">
            <Phone className="h-[20px] w-[20px]" />
          </button>
          <button onClick={() => setSettingsOpen(true)} className="safe-tap flex items-center justify-center rounded-lg text-[#1b2924]" aria-label="聊天设置">
            <MoreHorizontal className="h-[22px] w-[22px]" />
          </button>
        </div>
      </header>

      <main className="app-chat-scroll relative z-10 mx-auto flex w-full min-h-0 max-w-md flex-1 flex-col gap-2 overflow-y-auto px-3 py-4">
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
        <VoiceCallPanel
          call={voiceCall}
          onAccept={acceptVoiceCall}
          onReject={rejectVoiceCall}
          onHangup={hangupVoiceCall}
          onDismiss={() => cleanupVoiceCall()}
        />
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            currentUserId={currentUserId}
            showSender={Boolean(conversation.group)}
            sender={conversationMembers.find((member) => member.id === message.senderUserId)}
            exchangeRequests={visibleExchangeRequests}
            onExchangeRespond={onExchangeRespond}
            onOpenUser={onOpenUser}
            onOpenPost={onOpenPost}
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
            <div className="chat-bubble-other rounded-lg rounded-bl-sm px-3 py-2 text-[13px] font-semibold text-black/55">
              对方正在输入...
            </div>
          </div>
        ) : null}
        <div ref={messagesEndRef} className="h-1" />
        {!visibleExchangeRequests.length && !messages.length ? (
          <div className="chat-detail-empty mx-auto mt-6 max-w-[280px] rounded-lg px-4 py-3 text-center text-sm font-semibold text-black/55">
            还没有消息。
          </div>
        ) : null}
      </main>

      <footer className="app-chat-input-bar chat-detail-toolbar relative z-30 shrink-0 px-3 pt-2">
        {sendNotice ? (
          <div className="mx-auto mb-2 max-w-md rounded-lg bg-[#e0dbd0] px-3 py-2 text-center text-xs font-black text-[#324a36] ring-1 ring-[rgba(126,149,112,0.28)]">
            {sendNotice}
          </div>
        ) : null}
        <div className="mx-auto flex max-w-md items-center gap-2">
          <button className="safe-tap flex items-center justify-center rounded-full text-[#2a3b34]" aria-label="键盘"><Keyboard className="h-5 w-5" /></button>
          <label className="chat-detail-input flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full px-3">
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
            className={`safe-tap flex items-center justify-center rounded-full disabled:opacity-40 ${recording ? "bg-[var(--coral)] text-white" : "text-[#2a3b34]"}`}
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
          messages={messages}
          settings={localSettings}
          onSettingsChange={setLocalSettings}
          onBack={() => setSettingsOpen(false)}
          onOpenUser={() => onOpenUser(conversation.name, conversation.otherUserId)}
          onGroupUpdated={onChatChanged}
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
  messages,
  settings,
  onSettingsChange,
  onBack,
  onOpenUser,
  onGroupUpdated,
  onClearMessages,
}: {
  conversation: Conversation;
  currentUserId?: string;
  messages: ChatMessage[];
  settings: LocalChatSettings;
  onSettingsChange: (settings: LocalChatSettings) => void;
  onBack: () => void;
  onOpenUser: () => void;
  onGroupUpdated: () => void;
  onClearMessages: () => void;
}) {
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [editing, setEditing] = useState<null | "remark" | "groupNickname" | "groupRemark" | "announcement">(null);
  const [draft, setDraft] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [groupAvatarUploading, setGroupAvatarUploading] = useState(false);

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

  useEffect(() => {
    if (!actionStatus) return;
    const timer = window.setTimeout(() => setActionStatus(""), 1800);
    return () => window.clearTimeout(timer);
  }, [actionStatus]);

  const update = (patch: Partial<LocalChatSettings>, status?: string) => {
    onSettingsChange({ ...settings, ...patch });
    if (status) setActionStatus(status);
  };
  const openEdit = (key: NonNullable<typeof editing>, value: string) => {
    setDraft(value);
    setEditing(key);
  };
  const saveEdit = () => {
    if (!editing) return;
    update({ [editing]: draft.trim() } as Partial<LocalChatSettings>);
    setActionStatus("已保存");
    setEditing(null);
    setDraft("");
  };

  const copyGroupLink = async (status: string) => {
    try {
      await navigator.clipboard?.writeText(`${getPublicAppOrigin()}/chat/groups/${conversation.id}`);
      setActionStatus(status);
    } catch {
      setActionStatus("复制失败，请稍后再试");
    }
  };

  const reportConversation = async () => {
    try {
      await reportContent({
        targetType: "user",
        targetId: conversation.otherUserId || conversation.id,
        reason: conversation.group ? `举报群聊：${conversation.name}` : `举报聊天对象：${conversation.name}`,
      });
      setActionStatus("举报已提交");
    } catch (error) {
      console.warn("Failed to report conversation.", error);
      setActionStatus("举报提交失败");
    }
  };

  const uploadGroupAvatar = async (file: File) => {
    if (!conversation.group || groupAvatarUploading) return;
    if (conversation.ownerUserId && conversation.ownerUserId !== currentUserId) {
      setActionStatus("只有群主可以更换群头像");
      return;
    }

    try {
      setGroupAvatarUploading(true);
      const asset = await uploadMedia({
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
        dataBase64: await fileToBase64(file),
        purpose: "group-avatar",
      });
      await updateGroupConversation(conversation.id, { avatarUrl: asset.url });
      setActionStatus("群头像已更新");
      onGroupUpdated();
    } catch (error) {
      console.warn("Failed to update group avatar.", error);
      setActionStatus(readApiErrorMessage(error) ?? "群头像更新失败");
    } finally {
      setGroupAvatarUploading(false);
    }
  };

  const filteredMessages = messages.filter((message) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query || message.revokedAt) return false;
    return message.text.toLowerCase().includes(query);
  });
  const canEditGroupProfile = conversation.group && (!conversation.ownerUserId || conversation.ownerUserId === currentUserId);

  if (searchOpen) {
    return (
      <div className="app-screen-overlay app-screen-push fixed inset-0 z-[95] bg-[#f7faf5]">
        <section className="mx-auto flex h-full max-w-md flex-col px-4 pb-5 pt-4">
          <SettingsHeader title="查找聊天记录" onBack={() => setSearchOpen(false)} />
          <label className="mt-3 flex h-11 items-center gap-2 rounded-lg bg-white/86 px-3 ring-1 ring-[var(--line-soft)]">
            <Search className="h-4 w-4 text-[var(--text-faint)]" />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none" placeholder="搜索消息内容" autoFocus />
          </label>
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
            {filteredMessages.map((message) => (
              <div key={message.id} className="mb-2 rounded-lg bg-white/82 p-3 ring-1 ring-[var(--line-soft)]">
                <p className="whitespace-pre-wrap text-sm font-semibold leading-5 text-[var(--text-main)]">{message.text}</p>
                <p className="mt-2 text-xs font-bold text-[var(--text-faint)]">{formatMessageTime(message.createdAt)}</p>
              </div>
            ))}
            {searchQuery.trim() && !filteredMessages.length ? (
              <p className="rounded-lg bg-white/82 p-5 text-center text-sm font-semibold text-[var(--text-muted)] ring-1 ring-[var(--line-soft)]">没有找到相关消息</p>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  if (rulesOpen) {
    return (
      <div className="app-screen-overlay app-screen-push fixed inset-0 z-[95] bg-[#f7faf5]">
        <section className="mx-auto h-full max-w-md overflow-y-auto px-4 pb-8 pt-4">
          <SettingsHeader title="群聊公约" onBack={() => setRulesOpen(false)} />
          <div className="mt-4 rounded-lg bg-white/82 p-4 text-sm font-semibold leading-7 text-[var(--text-main)] ring-1 ring-[var(--line-soft)]">
            <p>1. 不发布骚扰、辱骂、歧视和人身攻击内容。</p>
            <p>2. 不泄露他人隐私，不转发未经允许的联系方式。</p>
            <p>3. 约饭和线下见面请优先选择公共场所，保留必要安全边界。</p>
            <p>4. 广告、刷屏、诱导交易等内容会被举报处理。</p>
          </div>
        </section>
      </div>
    );
  }

  if (editing) {
    const titleMap: Record<NonNullable<typeof editing>, string> = {
      remark: "设置备注名",
      groupNickname: "我在本群的昵称",
      groupRemark: "群备注",
      announcement: "群公告",
    };
    return (
      <div className="app-screen-overlay app-screen-push fixed inset-0 z-[95] bg-[#f7faf5]">
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
    <div className="app-screen-overlay app-screen-push fixed inset-0 z-[90] bg-[#f7faf5]">
      <section className="mx-auto h-full max-w-md overflow-y-auto px-4 pb-8 pt-4">
        <SettingsHeader title={conversation.group ? "群聊设置" : "聊天设置"} onBack={onBack} />
        {actionStatus ? (
          <p className="mt-2 rounded-lg bg-[rgba(209,228,221,0.72)] px-3 py-2 text-center text-xs font-black text-[var(--pine)]">{actionStatus}</p>
        ) : null}

        {conversation.group ? (
          <section className="mt-4 rounded-lg bg-white/82 p-4 ring-1 ring-[var(--line-soft)]">
            <label className={`flex w-full items-center gap-3 text-left ${canEditGroupProfile ? "cursor-pointer" : ""}`}>
              <ChatAvatar text={conversation.avatar} imageUrl={conversation.avatarUrl} group />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-black text-[var(--text-main)]">{conversation.name}</h2>
                <p className="mt-1 truncate text-sm font-semibold text-[var(--text-muted)]">
                  {groupAvatarUploading ? "群头像上传中" : canEditGroupProfile ? "点击更换群头像" : conversation.description || "欢迎来到这个群聊"}
                </p>
              </div>
              {canEditGroupProfile ? (
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={groupAvatarUploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadGroupAvatar(file);
                    event.target.value = "";
                  }}
                />
              ) : null}
              <ChevronRight className="h-5 w-5 text-[var(--text-faint)]" />
            </label>
            <div className="mt-4 border-t border-[var(--line-soft)] pt-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-black text-[var(--text-main)]">群成员({conversation.memberCount ?? (members.length || 1)})</h3>
                <button onClick={() => setActionStatus(`当前显示 ${members.length} 位成员`)} className="text-sm font-black text-[var(--text-muted)]">全部</button>
              </div>
              <div className="grid grid-cols-5 gap-3">
                {members.slice(0, 9).map((member) => (
                  <button key={member.id} className="min-w-0 text-center">
                    <span className="mx-auto block h-12 w-12 overflow-hidden rounded-full bg-[rgba(209,228,221,0.86)]">
                      {member.avatarUrl ? <img src={resolveMediaUrl(member.avatarUrl)} alt={member.nickname} className="h-full w-full object-cover" /> : (
                        <span className="display-cn flex h-full w-full items-center justify-center text-[var(--pine)]">{member.avatarText}</span>
                      )}
                    </span>
                    <span className="mt-1 block truncate text-xs font-bold text-[var(--text-muted)]">{member.id === currentUserId ? "我" : member.nickname}</span>
                  </button>
                ))}
                <button onClick={() => copyGroupLink("群邀请链接已复制")} className="text-center">
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
            <button onClick={onOpenUser} className="display-cn flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#b4dbca] text-3xl text-[#2d584b]">
              {conversation.avatarUrl ? <img src={resolveMediaUrl(conversation.avatarUrl)} alt={conversation.name} className="h-full w-full object-cover" /> : conversation.avatar}
            </button>
            <h2 className="mt-4 text-2xl font-black text-[var(--text-main)]">{settings.remark || conversation.name}</h2>
            <p className="mt-2 rounded-full bg-white/72 px-4 py-2 text-sm font-black text-[var(--pine)] ring-1 ring-[var(--line-soft)]">{conversation.online ? "在线" : "离线"}</p>
          </section>
        )}

        <SettingsBlock>
          {conversation.group ? (
            <>
              <SettingsRow label="分享群邀请" value="链接/二维码" onClick={() => copyGroupLink("群邀请链接已复制")} />
              <SettingsRow label="生成评论区群链接" description="可直接粘贴到笔记评论区" onClick={() => copyGroupLink("评论区群链接已复制")} />
              <SettingsRow label="群二维码" value="保存" onClick={() => copyGroupLink("二维码保存待接入，已先复制群链接")} />
            </>
          ) : (
            <>
              <SettingsRow label="设置备注名" value={settings.remark || "未设置"} onClick={() => openEdit("remark", settings.remark)} />
              <SettingsRow label="查找聊天记录" icon={<Search className="h-4 w-4" />} onClick={() => setSearchOpen(true)} />
            </>
          )}
        </SettingsBlock>

        {conversation.group ? (
          <SettingsBlock>
            <SettingsRow label="群公告" value={settings.announcement || "未设置"} onClick={() => openEdit("announcement", settings.announcement)} />
            <SettingsRow label="我在本群的昵称" value={settings.groupNickname || "未设置"} onClick={() => openEdit("groupNickname", settings.groupNickname)} />
            <SettingsRow label="群备注" value={settings.groupRemark || "未设置"} onClick={() => openEdit("groupRemark", settings.groupRemark)} />
            <SettingsRow label="查找聊天记录" onClick={() => setSearchOpen(true)} />
          </SettingsBlock>
        ) : null}

        <SettingsBlock>
          <ToggleSettingsRow label="置顶聊天" enabled={settings.pinned} onToggle={() => update({ pinned: !settings.pinned }, settings.pinned ? "已取消置顶" : "已置顶聊天")} />
          <ToggleSettingsRow label="消息免打扰" description={settings.muted ? "仅通知重要消息" : undefined} enabled={settings.muted} onToggle={() => update({ muted: !settings.muted }, settings.muted ? "已关闭消息免打扰" : "已开启消息免打扰")} />
        </SettingsBlock>

        <SettingsBlock>
          {!conversation.group ? <ToggleSettingsRow label="加入黑名单" enabled={settings.blocked} onToggle={() => update({ blocked: !settings.blocked }, settings.blocked ? "已移出黑名单" : "已加入黑名单")} /> : null}
          <SettingsRow label="举报" icon={<BellOff className="h-4 w-4" />} onClick={reportConversation} />
          {conversation.group ? <SettingsRow label="群聊公约" onClick={() => setRulesOpen(true)} /> : null}
          <SettingsRow label="临时清空当前视图" description="重新进入会话后会从云端重新加载" danger icon={<Trash2 className="h-4 w-4" />} onClick={onClearMessages} />
        </SettingsBlock>

        {conversation.group ? <button onClick={() => setActionStatus("退群接口待接入，暂未退出群聊")} className="mt-5 h-12 w-full rounded-lg bg-white/82 text-sm font-black text-[var(--coral)] ring-1 ring-[var(--line-soft)]">删除并退出</button> : null}
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
        <span className={`app-toggle-knob block h-5 w-5 rounded-full bg-white shadow-sm ${enabled ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}

function VoiceCallPanel({
  call,
  onAccept,
  onReject,
  onHangup,
  onDismiss,
}: {
  call: VoiceCallState;
  onAccept: () => void;
  onReject: () => void;
  onHangup: () => void;
  onDismiss: () => void;
}) {
  if (call.status === "idle") return null;

  const statusText: Record<Exclude<VoiceCallState["status"], "idle">, string> = {
    calling: "正在呼叫",
    incoming: "邀请你语音通话",
    connecting: "正在连接",
    active: "语音通话中",
    ended: "通话已结束",
  };

  return (
    <div className="sticky top-0 z-20 rounded-lg bg-[rgba(251,250,245,0.94)] p-3 shadow-[0_10px_26px_rgba(18,30,25,0.16)] ring-1 ring-[rgba(63,111,96,0.2)] backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(63,111,96,0.12)] text-[var(--pine)]">
          <Phone className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-[#17231f]">{call.peerName}</p>
          <p className="mt-0.5 text-xs font-semibold text-[#6a7a73]">{call.error ?? statusText[call.status]}</p>
        </div>
        {call.status === "incoming" ? (
          <>
            <button onClick={onReject} className="h-9 rounded-lg bg-[#f4eee8] px-3 text-xs font-black text-[#a74f43]">拒绝</button>
            <button onClick={onAccept} className="h-9 rounded-lg bg-[var(--pine)] px-3 text-xs font-black text-white">接听</button>
          </>
        ) : call.status === "ended" ? (
          <button onClick={onDismiss} className="h-9 rounded-lg bg-[#edf4ef] px-3 text-xs font-black text-[var(--pine)]">知道了</button>
        ) : (
          <button onClick={onHangup} className="h-9 rounded-lg bg-[#f4eee8] px-3 text-xs font-black text-[#a74f43]">挂断</button>
        )}
      </div>
    </div>
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

function readApiErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return undefined;
  const payload = error.payload as { error?: { code?: unknown; message?: unknown } } | undefined;
  if (payload?.error?.code === "STRANGER_MESSAGE_LIMIT") {
    return typeof payload.error.message === "string" ? payload.error.message : "你们还不是互相关注好友，24 小时内最多发送 3 条普通消息。";
  }
  return typeof payload?.error?.message === "string" ? payload.error.message : undefined;
}

function MessageBubble({
  message,
  currentUserId,
  showSender,
  sender,
  exchangeRequests,
  onExchangeRespond,
  onOpenUser,
  onOpenPost,
  onOpenCard,
  onRevoke,
}: {
  message: ChatMessage;
  currentUserId?: string;
  showSender?: boolean;
  sender?: ChatMember;
  exchangeRequests: MealExchangeRequest[];
  onExchangeRespond: (requestId: string, status: "rejected" | "accepted") => void;
  onOpenUser: (name: string, userId?: string) => void;
  onOpenPost: (postId: string, commentsOpen?: boolean) => void;
  onOpenCard: (cardId: string) => void;
  onRevoke: (messageId: string) => void;
}) {
  const mine = message.senderUserId === currentUserId;
  const shouldShowSender = Boolean(showSender && !mine);
  const senderName = sender?.nickname ?? "群成员";
  const senderAvatarText = sender?.avatarText ?? senderName.slice(0, 1);
  const senderAvatarUrl = resolveMediaUrl(sender?.avatarUrl);

  if (message.type === "meal-card-exchange") {
    const requestId = typeof message.metadata?.exchangeRequestId === "string" ? message.metadata.exchangeRequestId : "";
    const request = exchangeRequests.find((item) => item.id === requestId);
    if (!request) {
      return (
        <div className="chat-system-pill mx-auto mb-2 max-w-[310px] rounded-lg px-4 py-3 text-center text-[13px] font-semibold leading-5 text-[#4f592f]">
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
      <div className="chat-system-pill mx-auto mb-2 max-w-[310px] rounded-lg px-4 py-3 text-center text-[13px] font-semibold leading-5 text-[#4f592f]">
        {message.text}
      </div>
    );
  }

  const readByOther = mine && message.readByUserIds.some((userId) => userId !== currentUserId);

  return (
    <div className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
      {shouldShowSender ? (
        <button
          onClick={() => onOpenUser(senderName, sender?.id)}
          className="display-cn mt-1 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#b4dbca] text-sm font-black text-[#2d584b]"
          aria-label={`查看${senderName}主页`}
        >
          {senderAvatarUrl ? <img src={senderAvatarUrl} alt={senderName} className="h-full w-full object-cover" /> : senderAvatarText}
        </button>
      ) : null}
      <div className={`max-w-[78%] rounded-lg px-3 py-2 ${mine ? "chat-bubble-mine rounded-br-sm" : "chat-bubble-other rounded-bl-sm"}`}>
        {shouldShowSender ? <p className="mb-1 truncate text-[11px] font-black text-black/45">{senderName}</p> : null}
        <MessageContent message={message} onOpenPost={onOpenPost} />
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

function MessageContent({ message, onOpenPost }: { message: ChatMessage; onOpenPost: (postId: string, commentsOpen?: boolean) => void }) {
  if (message.revokedAt) {
    return <p className="text-[14px] font-semibold text-black/45">消息已撤回</p>;
  }

  const commentSnapshot = readCommentSnapshot(message.metadata);
  if (commentSnapshot) {
    return <SharedCommentCard snapshot={commentSnapshot} note={typeof message.metadata?.note === "string" ? message.metadata.note : ""} onOpenPost={onOpenPost} />;
  }

  const postSnapshot = readPostSnapshot(message.metadata);
  if (postSnapshot) {
    return <SharedPostCard snapshot={postSnapshot} note={typeof message.metadata?.note === "string" ? message.metadata.note : ""} onOpenPost={onOpenPost} />;
  }

  if (message.type === "image") {
    const url = resolveMediaUrl(typeof message.metadata?.url === "string" ? message.metadata.url : "");
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
    const url = resolveMediaUrl(typeof message.metadata?.url === "string" ? message.metadata.url : "");
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

type SharedPostSnapshot = {
  id: string;
  title: string;
  text: string;
  author: string;
  avatar: string;
  topic: string;
  mediaType: "text" | "photo" | "video";
  mediaUrl?: string;
  imageTone?: string;
  place?: string;
};

type SharedCommentSnapshot = {
  id: string;
  postId: string;
  text: string;
  author: string;
  avatar: string;
  postTitle: string;
  postAuthor: string;
  postMediaUrl?: string;
  postMediaType?: "text" | "photo" | "video";
};

function SharedPostCard({
  snapshot,
  note,
  onOpenPost,
}: {
  snapshot: SharedPostSnapshot;
  note: string;
  onOpenPost: (postId: string, commentsOpen?: boolean) => void;
}) {
  return (
    <button onClick={() => onOpenPost(snapshot.id)} className="block w-[260px] overflow-hidden rounded-lg bg-[#fbfdf9] text-left ring-1 ring-black/8">
      {note ? <p className="border-b border-black/5 px-3 py-2 text-[13px] font-semibold leading-5 text-[#31463e]">{note}</p> : null}
      <div className="p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#d1e4dd] text-xs font-black text-[var(--pine)]">{snapshot.avatar}</span>
          <span className="min-w-0 flex-1 truncate text-xs font-black text-[#53635c]">{snapshot.author}</span>
          <span className="rounded-md bg-[#edf4ef] px-2 py-1 text-[10px] font-black text-[var(--pine)]">{snapshot.topic}</span>
        </div>
        {snapshot.mediaType !== "text" ? (
          <div className="mb-2 h-28 overflow-hidden rounded-md bg-black/5">
            {snapshot.mediaUrl ? (
              snapshot.mediaType === "video" ? (
                <div className="relative h-full">
                  <video src={snapshot.mediaUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                  <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/38 text-white">
                    <Video className="h-4 w-4" />
                  </span>
                </div>
              ) : (
                <img src={snapshot.mediaUrl} alt={snapshot.title} className="h-full w-full object-cover" loading="lazy" />
              )
            ) : (
              <div className="flex h-full items-center justify-center text-[#6a7a73]">
                <ImageIcon className="h-6 w-6" />
              </div>
            )}
          </div>
        ) : null}
        <h3 className="line-clamp-2 text-[15px] font-black leading-5 text-[#17231f]">{snapshot.title}</h3>
        <p className="mt-1 line-clamp-2 text-[12px] font-semibold leading-5 text-[#66736d]">{snapshot.text}</p>
        <p className="mt-2 text-[11px] font-black text-[var(--pine)]">查看社区帖子</p>
      </div>
    </button>
  );
}

function getPublicAppOrigin() {
  try {
    const origin = new URL(runtimeConfig.apiBaseUrl).origin;
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
      return "http://10.119.5.83";
    }
    return origin;
  } catch {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(window.location.origin)) {
      return "http://10.119.5.83";
    }
    return window.location.origin;
  }
}

function SharedCommentCard({
  snapshot,
  note,
  onOpenPost,
}: {
  snapshot: SharedCommentSnapshot;
  note: string;
  onOpenPost: (postId: string, commentsOpen?: boolean) => void;
}) {
  return (
    <button onClick={() => onOpenPost(snapshot.postId, true)} className="block w-[260px] overflow-hidden rounded-lg bg-[#fbfdf9] text-left ring-1 ring-black/8">
      {note ? <p className="border-b border-black/5 px-3 py-2 text-[13px] font-semibold leading-5 text-[#31463e]">{note}</p> : null}
      <div className="p-3">
        <p className="text-[12px] font-black text-[#66736d]">分享 @{snapshot.author} 的评论</p>
        <p className="mt-2 rounded-md bg-[#f2f6f3] px-3 py-2 text-[17px] font-black leading-6 text-[#17231f]">{snapshot.text}</p>
        <div className="mt-3 flex gap-2 border-t border-black/5 pt-3">
          {snapshot.postMediaUrl && snapshot.postMediaType !== "text" ? (
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-black/5">
              {snapshot.postMediaType === "video" ? (
                <video src={snapshot.postMediaUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
              ) : (
                <img src={snapshot.postMediaUrl} alt={snapshot.postTitle} className="h-full w-full object-cover" loading="lazy" />
              )}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-[11px] font-bold text-[#8a9790]">来自 {snapshot.postAuthor} 的帖子</p>
            <p className="line-clamp-2 text-[13px] font-black leading-5 text-[#31463e]">{snapshot.postTitle}</p>
          </div>
        </div>
        <p className="mt-2 text-[11px] font-black text-[var(--pine)]">查看原评论</p>
      </div>
    </button>
  );
}

function readPostSnapshot(metadata: ChatMessage["metadata"]): SharedPostSnapshot | null {
  const raw = metadata?.postSnapshot;
  if (!raw || typeof raw !== "object") return null;
  const snapshot = raw as Record<string, unknown>;
  if (typeof snapshot.id !== "string" || typeof snapshot.title !== "string") return null;
  return {
    id: snapshot.id,
    title: snapshot.title,
    text: typeof snapshot.text === "string" ? snapshot.text : "",
    author: typeof snapshot.author === "string" ? snapshot.author : "ueat",
    avatar: typeof snapshot.avatar === "string" ? snapshot.avatar : "U",
    topic: typeof snapshot.topic === "string" ? snapshot.topic : "社区",
    mediaType: snapshot.mediaType === "photo" || snapshot.mediaType === "video" ? snapshot.mediaType : "text",
    mediaUrl: resolveMediaUrl(typeof snapshot.mediaUrl === "string" ? snapshot.mediaUrl : undefined),
    imageTone: typeof snapshot.imageTone === "string" ? snapshot.imageTone : undefined,
    place: typeof snapshot.place === "string" ? snapshot.place : undefined,
  };
}

function readCommentSnapshot(metadata: ChatMessage["metadata"]): SharedCommentSnapshot | null {
  const raw = metadata?.commentSnapshot;
  if (!raw || typeof raw !== "object") return null;
  const snapshot = raw as Record<string, unknown>;
  if (typeof snapshot.id !== "string" || typeof snapshot.postId !== "string" || typeof snapshot.text !== "string") return null;
  return {
    id: snapshot.id,
    postId: snapshot.postId,
    text: snapshot.text,
    author: typeof snapshot.author === "string" ? snapshot.author : "ueat",
    avatar: typeof snapshot.avatar === "string" ? snapshot.avatar : "U",
    postTitle: typeof snapshot.postTitle === "string" ? snapshot.postTitle : "社区帖子",
    postAuthor: typeof snapshot.postAuthor === "string" ? snapshot.postAuthor : "ueat",
    postMediaUrl: resolveMediaUrl(typeof snapshot.postMediaUrl === "string" ? snapshot.postMediaUrl : undefined),
    postMediaType: snapshot.postMediaType === "photo" || snapshot.postMediaType === "video" ? snapshot.postMediaType : "text",
  };
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

function readSessionDescription(value: unknown): RTCSessionDescriptionInit | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if ((raw.type === "offer" || raw.type === "answer") && typeof raw.sdp === "string") {
    return { type: raw.type, sdp: raw.sdp };
  }
  return null;
}

function readIceCandidate(value: unknown): RTCIceCandidateInit | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.candidate !== "string") return null;
  return {
    candidate: raw.candidate,
    sdpMid: typeof raw.sdpMid === "string" ? raw.sdpMid : null,
    sdpMLineIndex: typeof raw.sdpMLineIndex === "number" ? raw.sdpMLineIndex : null,
    usernameFragment: typeof raw.usernameFragment === "string" ? raw.usernameFragment : undefined,
  };
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
