import {
  ArrowLeft,
  Camera,
  CheckCheck,
  Keyboard,
  Mic,
  MoreHorizontal,
  Phone,
  PhoneMissed,
  PhoneOutgoing,
  Send,
  Smile,
  Video,
} from "lucide-react";
import { chatItems, type Conversation } from "@/data/chat";
import type { MealExchangeRequest } from "@/types/exchange";
import { ChatAvatar } from "./ChatAvatar";
import { MealExchangeBubble } from "./MealExchangeBubble";

/**
 * 单个聊天详情。
 *
 * 当前聊天记录读取 `data/chat.ts` 的 mock；正式版这里应按 conversationId 拉取消息，
 * 并把交换约饭卡作为消息流中的一种卡片消息渲染。
 */
export function ChatDetail({
  conversation,
  exchangeRequests,
  onExchangeRespond,
  onOpenUser,
  onOpenCard,
  onBack,
}: {
  conversation: Conversation;
  exchangeRequests: MealExchangeRequest[];
  onExchangeRespond: (requestId: string, status: "rejected" | "accepted") => void;
  onOpenUser: (name: string) => void;
  onOpenCard: (cardId: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[#efece4] pb-[74px] text-[#17231f]">
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
              {conversation.online && <span className="h-2 w-2 rounded-full bg-[#62b27d]" />}
            </div>
            <p className="truncate text-[12px] font-semibold text-[rgba(23,35,31,0.56)]">校园认证 · 通常几分钟内回复</p>
          </div>
          <button className="safe-tap flex items-center justify-center rounded-lg text-[#1b2924]" aria-label="视频通话">
            <Video className="h-[21px] w-[21px]" />
          </button>
          <button className="safe-tap flex items-center justify-center rounded-lg text-[#1b2924]" aria-label="语音通话">
            <Phone className="h-[20px] w-[20px]" />
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex h-[calc(100dvh-148px)] max-w-md flex-col gap-2 overflow-y-auto px-3 py-4">
        {chatItems.map((item) => {
          if (item.type === "divider") {
            return <div key={item.id} className="my-1 flex justify-center"><span className="rounded-lg bg-white/86 px-4 py-1 text-[12px] font-black">{item.text}</span></div>;
          }
          if (item.type === "notice") {
            return <div key={item.id} className="mx-auto mb-2 max-w-[310px] rounded-lg bg-[#fff4dc] px-4 py-3 text-center text-[13px] font-semibold leading-5 text-[#4f4634] shadow-sm">{item.text}</div>;
          }
          if (item.type === "call") {
            const mine = item.from === "me";
            return (
              <div key={item.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`flex min-w-[210px] max-w-[78%] items-center gap-3 rounded-lg px-3 py-2.5 shadow-sm ${mine ? "bg-[#d8ffd5]" : "bg-white"}`}>
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${item.missed ? "bg-[#fff0f3] text-[#e64c6a]" : "bg-[rgba(63,111,96,0.1)] text-[var(--pine)]"}`}>
                    {item.missed ? <PhoneMissed className="h-5 w-5" /> : <PhoneOutgoing className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0 flex-1"><span className="block text-[14px] font-black">{item.title}</span><span className="block text-[13px] font-semibold text-black/60">{item.subtitle}</span></span>
                  <span className="self-end text-[11px] font-semibold text-black/50">{item.time}</span>
                </div>
              </div>
            );
          }
          const mine = item.from === "me";
          return (
            <div key={item.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] rounded-lg px-3 py-2 shadow-sm ${mine ? "rounded-br-sm bg-[#d8ffd5]" : "rounded-bl-sm bg-white"}`}>
                <p className="text-[15px] font-semibold leading-[1.45]">{item.text}</p>
                <div className={`mt-1 flex items-center gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                  <span className="text-[11px] font-semibold text-black/50">{item.time}</span>
                  {mine && item.read && <CheckCheck className="h-3.5 w-3.5 text-[#4a8f7b]" />}
                </div>
              </div>
            </div>
          );
        })}
        {exchangeRequests.map((request) => (
          <MealExchangeBubble
            key={request.id}
            request={request}
            onRespond={(status) => onExchangeRespond(request.id, status)}
            onOpenCard={(cardId) => onOpenCard(cardId)}
          />
        ))}
      </main>

      <footer className="fixed inset-x-0 bottom-[74px] z-30 bg-[rgba(239,236,228,0.86)] px-3 py-2 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <button className="safe-tap flex items-center justify-center rounded-full text-[#2a3b34]" aria-label="键盘"><Keyboard className="h-5 w-5" /></button>
          <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-3 shadow-sm ring-1 ring-black/10">
            <Smile className="h-5 w-5 shrink-0 text-black/50" />
            <input className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:text-black/40" placeholder="输入消息" />
            <MoreHorizontal className="h-5 w-5 shrink-0 text-black/50" />
          </label>
          <button className="safe-tap flex items-center justify-center rounded-full text-[#2a3b34]" aria-label="拍照"><Camera className="h-5 w-5" /></button>
          <button className="safe-tap flex items-center justify-center rounded-full text-[#2a3b34]" aria-label="语音"><Mic className="h-5 w-5" /></button>
          <button className="safe-tap flex items-center justify-center rounded-full bg-[var(--pine)] text-white shadow-[0_8px_18px_rgba(63,111,96,0.24)]" aria-label="发送"><Send className="h-[18px] w-[18px]" /></button>
        </div>
      </footer>
    </div>
  );
}
