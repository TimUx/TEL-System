const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const screenshotDir = path.join('test-results', 'screenshots');
fs.mkdirSync(screenshotDir, { recursive: true });

async function save(page, name) {
    await page.screenshot({ path: path.join(screenshotDir, name), fullPage: true });
}

test('capture TEL screenshots', async ({ page, context }) => {
    page.on('dialog', async (dialog) => dialog.dismiss());

    await page.goto('/');
    await expect(page.locator('[data-testid="operation-info"]')).toContainText('Aktive Einsatzlage');
    await save(page, '01-hauptseite-auftraege.png');

    await page.getByRole('button', { name: 'Einsatztagebuch' }).click();
    await expect(page.locator('[data-testid="journal-list"]')).toContainText('System');
    await save(page, '02-einsatztagebuch.png');

    const mapPage = await context.newPage();
    await mapPage.goto('/map.html?assignment=3');
    await expect(mapPage.locator('#selectedAssignmentInfo')).not.toBeEmpty();
    await save(mapPage, '03-lagekarte.png');

    const dashboardPage = await context.newPage();
    await dashboardPage.goto('/dashboard.html');
    await expect(dashboardPage.locator('[data-testid="dashboard-stats"]')).toContainText('Aufträge');
    await save(dashboardPage, '04-dashboard.png');

    const historyPage = await context.newPage();
    await historyPage.goto('/history.html');
    await expect(historyPage.locator('#historyTableBody')).toContainText('2025-014');
    await save(historyPage, '05-historie.png');

    await page.goto('/');
    await page.getByRole('button', { name: '⚙️ Einstellungen' }).click();
    await page.locator('#locationsConfigBtn').click();
    await page.getByRole('button', { name: 'Neuer Standort' }).click();
    await expect(page.locator('#locationModal')).toBeVisible();
    await save(page, '06-standort-formular.png');

    await page.goto('/');
    await page.getByRole('button', { name: '⚙️ Einstellungen' }).click();
    await page.locator('#vehiclesConfigBtn').click();
    await page.getByRole('button', { name: 'Neues Fahrzeug' }).click();
    await expect(page.locator('#vehicleModal')).toBeVisible();
    await save(page, '07-fahrzeug-formular.png');
});
