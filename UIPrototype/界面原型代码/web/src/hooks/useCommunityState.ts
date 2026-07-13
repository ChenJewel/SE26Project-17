/**
 * 社区原型 store。
 *
 * 这里集中保存帖子、评论和互动状态。正式版建议把它替换为：
 * posts service、comments service、interactions service，或者统一状态管理 store。
 */
import { useState } from "react";
import {
  initialCommunityComments,
  initialCommunityInteractions,
  initialCommunityPosts,
  type CommunityComment,
  type CommunityInteractionState,
  type CommunityPost,
} from "@/data/community";

export function useCommunityState() {
  const [posts, setPosts] = useState<CommunityPost[]>(initialCommunityPosts);
  const [comments, setComments] = useState<CommunityComment[]>(initialCommunityComments);
  const [interactions, setInteractions] = useState<CommunityInteractionState>(initialCommunityInteractions);

  return {
    posts,
    comments,
    interactions,
    setPosts,
    setComments,
    setInteractions,
  };
}
