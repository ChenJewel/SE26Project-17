/**
 * 全局搜索、详情浮层、关注关系和个人偏好状态。
 *
 * 当前详情仍用 `DetailTarget` 和昵称打开，属于原型阶段。
 * 正式迁移时应把 `name` 替换为 `userId`，并用动态路由加载用户/帖子/卡片详情。
 */
import { useEffect, useRef, useState } from "react";
import { fetchMyProfile, followUser as followUserById, updateMyProfile } from "@/services/userApi";
import type { DetailTarget } from "@/types/navigation";
import type { UserSummary } from "@/types/user";

export function useGlobalDetail(currentUserId?: string) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null);
  const [profileTags, setProfileTags] = useState<string[]>([]);
  const [followedUsers, setFollowedUsers] = useState<UserSummary[]>([]);
  const [profileSnapshot, setProfileSnapshot] = useState<Awaited<ReturnType<typeof fetchMyProfile>> | null>(null);
  const lastUserId = useRef<string | undefined>(currentUserId);

  useEffect(() => {
    if (lastUserId.current === currentUserId) return;
    lastUserId.current = currentUserId;
    setSearchOpen(false);
    setDetailTarget(null);
    setProfileTags([]);
    setFollowedUsers([]);
    setProfileSnapshot(null);
  }, [currentUserId]);

  useEffect(() => {
    let cancelled = false;
    if (!currentUserId) return;

    fetchMyProfile()
      .then((profile) => {
        if (cancelled) return;
        setProfileTags(profile.preferenceTags);
        setFollowedUsers(profile.followedUsers);
        setProfileSnapshot(profile);
      })
      .catch((error) => {
        console.warn("Failed to load profile state.", error);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  const saveProfileTags = async (tags: string[]) => {
    setProfileTags(tags);
    try {
      await updateMyProfile({ preferenceTags: tags });
    } catch (error) {
      console.warn("Failed to save profile tags.", error);
    }
  };

  const followUser = (user: UserSummary) => {
    // TODO(user-id): 正式版必须用 userId 去重，昵称只适合作为原型展示字段。
    if (user.name === "我") return;
    setFollowedUsers((current) => {
      if (current.some((item) => item.name === user.name)) return current;
      return [user, ...current];
    });
    if (user.userId) {
      followUserById(user.userId).catch((error) => {
        console.warn("Failed to follow user.", error);
      });
    }
  };

  const openUserDetail = (name: string, userId?: string) => {
    // TODO(user-id): 迁移时改为 openUserDetail(userId) 或 route `/users/:userId`。
    setDetailTarget({ type: "user", name, userId });
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
    setProfileTags: saveProfileTags,
    followedUsers,
    profileSnapshot,
    followUser,
    openUserDetail,
    openCardDetail,
    openPostDetail,
  };
}
