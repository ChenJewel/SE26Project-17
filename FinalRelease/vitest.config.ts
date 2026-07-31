import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/common/mealCardVisibility.ts",
        "src/common/request.ts",
        "src/common/http.ts",
        "src/common/authToken.ts",
        "src/modules/campusEmail.ts",
        "src/modules/semanticSignals.ts",
      ],
      reporter: ["text", "text-summary", "html", "json", "json-summary"],
      reportsDirectory: "test/coverage",
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 85,
        lines: 90,
      },
    },
  },
});
