import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./E2E",
    testMatch: "**/*.spec.ts",
    outputDir: "./test-results",
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
        trace: "retain-on-failure",
    },
    projects: [
        { name: "e2e-chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "e2e-firefox", use: { ...devices["Desktop Firefox"] } },
        { name: "e2e-webkit", use: { ...devices["Desktop Safari"] } },
    ],
});
