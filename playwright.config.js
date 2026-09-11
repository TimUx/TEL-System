const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    timeout: 60000,
    retries: process.env.CI ? 1 : 0,
    use: {
        baseURL: process.env.SCREENSHOT_BASE_URL || 'http://127.0.0.1:8080',
        headless: true,
        viewport: { width: 1440, height: 900 },
    },
    reporter: [['list']],
    outputDir: 'test-results/playwright',
});
