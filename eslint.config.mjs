import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import globals from "globals";
import tseslint from "typescript-eslint";

const CODE_GLOB = "**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}";
const NON_WEB_ROOTS = ["packages", "scripts"];
const NON_WEB_CODE_FILES = NON_WEB_ROOTS.map((root) => `${root}/${CODE_GLOB}`);
const NON_WEB_JS_FILES = NON_WEB_ROOTS.map(
  (root) => `${root}/**/*.{js,jsx,mjs,cjs}`,
);

function scopeConfigs(configs, roots) {
  const scopedCodeFiles = roots.map((root) => `${root}/${CODE_GLOB}`);

  return configs.map((config) => {
    const scopedConfig = {
      ...config,
      files: config.files
        ? roots.flatMap((root) => config.files.map((pattern) => `${root}/${pattern}`))
        : scopedCodeFiles,
    };

    if (config.ignores) {
      scopedConfig.ignores = roots.flatMap((root) =>
        config.ignores.map((pattern) => `${root}/${pattern}`),
      );
    }

    return scopedConfig;
  });
}

const webConfigs = [
  ...scopeConfigs(nextTs, ["apps/web"]),
  ...scopeConfigs(nextVitals, ["apps/web"]),
  {
    files: ["apps/web/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
];

export default defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/.git/**",
    "**/.next/**",
    "**/.turbo/**",
    "**/build/**",
    "**/coverage/**",
    "**/dist/**",
    "**/out/**",
  ]),
  {
    files: NON_WEB_CODE_FILES,
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.es2024,
        ...globals.node,
      },
      sourceType: "module",
    },
  },
  {
    ...js.configs.recommended,
    files: NON_WEB_JS_FILES,
  },
  ...scopeConfigs(tseslint.configs.recommended, NON_WEB_ROOTS),
  ...webConfigs,
]);
