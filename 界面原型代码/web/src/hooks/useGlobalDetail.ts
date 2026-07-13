/**
 * 全局搜索、详情浮层、关注关系和个人偏好状态。
 *
 * 当前详情仍用 `DetailTarget` 和昵称打开，属于原型阶段。
 * 正式迁移时应把 `name` 替换为 `userId`，并用动态路由加载用户/帖子/卡片详情。
 */
import { useState } from "react";
import type { DetailTarget } from "@/types/navigation";
import type { UserSummary } from "@/types/user";

export function useGlobalDetail() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null);
  const [profileTags, setProfileTags] = useState<string[]>(["晚饭更常用", "不吃辣", "安静一点", "二食堂", "社恐友好"]);
  const [followedUsers, setFollowedUsers] = useState<UserSummary[]>([]);

  const followUser = (user: UserSummary) => {
    // TODO(user-id): 正式版必须用 userId 去重，昵称只适合作为原型展示字段。
    if (user.name === "我") return;
    setFollowedUsers((current) => {
      if (current.some((item) => item.name === user.name)) return current;
      return [user, ...current];
    });
  };

  const openUserDetail = (name: string) => {
    // TODO(user-id): 迁移时改为 openUserDetail(userId) 或 route `/users/:userId`。
    setDetailTarget({ type: "user", name });
  };
  const openCardDetail = (cardId: string) => setDetailTarget({ type: "card", cardId });
  const openPostDetail = (postId: string, commentsOpen?: boolean) =>
    setDetailTarget({ type: "post", postId, commentsOpen });

  return {
    searchOpen,
    setSearchOpen,
    detailTarget,
    setDetailTarget,
    profileTags,
    setProfileTags,
    followedUsers,
    followUser,
    openUserDetail,
    openCardDetail,
    openPostDetail,
  };
}
