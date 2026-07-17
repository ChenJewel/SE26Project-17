import { Play, Utensils } from "lucide-react";
import type { MealExchangeRequest } from "@/types/exchange";

/**
 * 聊天中的交换约饭卡系统消息。
 *
 * 当前直接展示本地 request；正式版建议作为一种 message type，
 * 由后端返回 `exchangeRequestId`、双方 userId、status，并通过实时事件更新状态。
 */
export function MealExchangeBubble({
  request,
  onRespond,
  onOpenCard,
}: {
  request: MealExchangeRequest;
  onRespond: (status: "rejected" | "accepted") => void;
  onOpenCard?: (cardId: string) => void;
}) {
  return (
    <div className="my-2 flex justify-center">
      <section className="w-full max-w-[330px] overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/10">
        <div className="bg-[rgba(209,228,221,0.72)] px-3 py-2 text-center text-xs font-black text-[var(--pine)]">
          系统已发送约饭邀请，等待对方选择
        </div>
        <div className="p-3">
          {request.ownCard ? (
            <button
              onClick={() => onOpenCard?.(request.ownCard?.id ?? "")}
              className="meal-card w-full rounded-lg p-3 text-left"
              aria-label="查看已发送的约饭卡详情"
            >
              <div className="card-content flex items-center gap-2">
                <span className="display-cn flex h-10 w-10 items-center justify-center rounded-lg bg-white/18 text-lg text-[#fffdf3]">
                  {request.ownCard.avatarText}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-[#fffdf3]">{request.ownCard.nickname}的约饭卡</p>
                  <p className="truncate text-xs font-bold text-[#d8eade]">{request.ownCard.place} · {request.ownCard.time}</p>
                </div>
                <Utensils className="h-5 w-5 text-[#daede4]" />
              </div>
              {request.ownCard.mediaUrl && request.ownCard.mediaType ? (
                <div className="card-content relative mt-3 h-28 overflow-hidden rounded-lg bg-black/20 ring-1 ring-white/15">
                  {request.ownCard.mediaType === "video" ? (
                    <>
                      <video src={request.ownCard.mediaUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                      <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white">
                        <Play className="h-4 w-4 fill-current" />
                      </span>
                    </>
                  ) : (
                    <img src={request.ownCard.mediaUrl} alt="约饭卡媒体" className="h-full w-full object-cover" />
                  )}
                </div>
              ) : null}
              <p className="card-content mt-3 line-clamp-2 text-sm font-black leading-5 text-[#fffdf3]">{request.ownCard.text}</p>
            </button>
          ) : (
            <div className="rounded-lg bg-[var(--surface-soft)] p-3 text-sm font-semibold text-[var(--text-muted)]">
              邀请已记录到云端会话。你可以继续在这里沟通时间、地点和口味偏好。
            </div>
          )}

          {request.status === "pending" ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => onRespond("rejected")} className="h-10 rounded-lg bg-[#f4f1eb] text-sm font-black text-[#7c6b58]">
                拒绝
                <span className="ml-1 text-xs font-semibold">不好意思下次哦</span>
              </button>
              <button onClick={() => onRespond("accepted")} className="h-10 rounded-lg bg-[var(--pine)] text-sm font-black text-white">
                聊聊看
              </button>
            </div>
          ) : (
            <div
              className={`mt-3 rounded-lg px-3 py-2 text-center text-sm font-black ${
                request.status === "accepted"
                  ? "bg-[rgba(209,228,221,0.72)] text-[var(--pine)]"
                  : "bg-[#f4f1eb] text-[#7c6b58]"
              }`}
            >
              {request.status === "accepted" ? "双方都已确认，可以继续聊约饭细节" : "对方已婉拒，本次交换卡片结束"}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
