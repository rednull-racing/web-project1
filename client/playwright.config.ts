import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./test/integration/pages",
    testMatch: "**/*.spec.ts",
    outputDir: "./test-results/pages",
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    reporter: [["list"], ["html", { outputFolder: "playwright-report/pages", open: "never" }]],
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
        trace: "retain-on-failure",
        serviceWorkers: "block",
    },
    projects: [
        { name: "pages-chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "pages-firefox", use: { ...devices["Desktop Firefox"] } },
        { name: "pages-webkit", use: { ...devices["Desktop Safari"] } },
    ],
});
