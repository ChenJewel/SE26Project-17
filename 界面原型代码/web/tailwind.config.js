/**
 * Tailwind 配置。
 *
 * 当前项目主要用 Tailwind utility class 写界面。
 * 主题 token 大多在 src/index.css 的 CSS variables 中维护，这里只保留扫描路径和基础扩展点。
 */
/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {},
  },
  plugins: [],
};
