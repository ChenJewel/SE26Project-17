/**
 * 原型期的跨页面详情目标。
 *
 * 现在用本地 state 打开详情浮层；正式接路由时，这里可以映射成动态路径：
 * user -> /users/:name
 * card -> /cards/:cardId
 * post -> /posts/:postId?comments=1
 */
export type DetailTarget =
  | { type: "user"; name: string; userId?: string }
  | { type: "card"; cardId: string }
  | { type: "post"; postId: string; commentsOpen?: boolean };
