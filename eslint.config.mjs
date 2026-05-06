import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Ignore JavaScript files (CommonJS scripts)
    "*.js",
    "check-images.js",
    "jest.config.js",
    // Ignore utility scripts (one-off tools)
    "scripts/**",
  ]),
  // 限制只有 src/lib/ai/ 與 src/lib/experiments/ 底下能直接 import AI SDK；
  // 其他地方必須走 src/lib/ai/provider.ts 的抽象層，
  // 確保 fallback / logger / 成本控制統一。
  // experiments/ 是 Gemini Vision（圖片評分）的合法封裝點。
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/ai/**", "src/lib/experiments/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@anthropic-ai/sdk",
              message:
                "請改用 @/lib/ai/provider 的抽象層（generateText / moderateContent / generateWithFallback），勿直接呼叫 Anthropic SDK。",
            },
            {
              name: "@google/generative-ai",
              message:
                "請改用 @/lib/ai/provider 的抽象層，勿直接呼叫 Gemini SDK。",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
