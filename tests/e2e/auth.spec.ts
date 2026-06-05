import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL ?? "test@saade.com";
const PASSWORD = process.env.E2E_PASSWORD ?? "Test1234";

test.describe("Authentification", () => {
  test("page de login s'affiche", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /SAADÉ/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/mot de passe/i)).toBeVisible();
  });

  test("routes protégées redirigent vers /login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });

  test("connexion avec identifiants valides", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/mot de passe/i).fill(PASSWORD);
    await page.getByRole("button", { name: /se connecter/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
    expect(page.url()).not.toContain("/login");
  });

  test("connexion avec mauvais mot de passe échoue", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/mot de passe/i).fill("WrongPassword999!");
    await page.getByRole("button", { name: /se connecter/i }).click();
    await expect(page.getByText(/identifiants incorrects/i)).toBeVisible({ timeout: 10_000 });
  });
});
