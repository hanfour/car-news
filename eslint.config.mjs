import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // React 19 Compiler 的 advisory 警告：避免阻擋 CI；真正需要處理時會再個別升級
  {
    rules: {
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
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
]);

export default eslintConfig;
