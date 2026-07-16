import { defineConfig, type UserConfigExport } from "@tarojs/cli";

export default defineConfig(async () => {
  const isH5 = process.env.TARO_ENV === "h5";
  const config: UserConfigExport = {
    projectName: "ueat-cross",
    date: "2026-07-10",
    designWidth: 375,
    deviceRatio: {
      375: 1,
      640: 2.34 / 2,
      750: 1,
      828: 1.81 / 2
    },
    sourceRoot: "src",
    outputRoot: "dist",
    framework: "react",
    compiler: {
      type: "webpack5",
      prebundle: {
        enable: false
      }
    },
    cache: {
      enable: false
    },
    alias: {
      "@": require("path").resolve(__dirname, "..", "src"),
      ...(isH5
        ? {}
        : {
            "lucide-react": require("path").resolve(__dirname, "..", "src", "components", "LucideShim.tsx")
          })
    },
    plugins: ["@tarojs/plugin-html"],
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
          config: {}
        },
        cssModules: {
          enable: false,
          config: {
            namingPattern: "module",
            generateScopedName: "[name]__[local]___[hash:base64:5]"
          }
        }
      }
    },
    h5: {
      publicPath: "/",
      staticDirectory: "static",
      router: {
        mode: "hash"
      },
      devServer: {
        port: 10087,
        host: "0.0.0.0"
      }
    }
  };

  return config;
});
