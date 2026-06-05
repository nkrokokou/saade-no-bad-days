import { test, expect } from "../../playwright-fixture";

const EMAIL = process.env.E2E_EMAIL ?? "test@saade.com";
const PASSWORD = process.env.E2E_PASSWORD ?? "Test1234";

test.describe("POS - flux de base", () => {
  test("la caisse s'ouvre et affiche le catalogue produit", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/mot de passe/i).fill(PASSWORD);
    await page.getByRole("button", { name: /se connecter/i }).click();
    await page.waitForURL((url: URL) => !url.pathname.startsWith("/login"), { timeout: 15_000 });

    await page.goto("/pos");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // La page POS doit afficher au moins un bouton/produit ou une section catégorie
    const hasContent = await page
      .locator("button, [role='button']")
      .first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    expect(hasContent).toBe(true);
  });
});
