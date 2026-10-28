import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
    root: fileURLToPath(new URL(".", import.meta.url)),
    plugins: [react(), tsconfigPaths()],
    // DOMテストでは本番用PostCSSを実行せず、CSS Modulesの識別子だけを扱う。
    css: { postcss: { plugins: [] } },
    test: {
        environment: "jsdom",
        setupFiles: ["./test/fixtures/setup.ts"],
        clearMocks: true,
        restoreMocks: true,
        unstubEnvs: true,
        unstubGlobals: true,
        projects: [
            {
                extends: true,
                test: {
                    name: "unit",
                    include: ["src/**/test/**/*.test.{ts,tsx}"],
                },
            },
            {
                extends: true,
                test: {
                    name: "integration",
                    include: ["test/integration/**/*.test.{ts,tsx}"],
                },
            },
        ],
    },
});
