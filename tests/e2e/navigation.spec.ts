import { test, expect } from "../../playwright-fixture";

const EMAIL = process.env.E2E_EMAIL ?? "test@saade.com";
const PASSWORD = process.env.E2E_PASSWORD ?? "Test1234";

async function login(page: any) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/mot de passe/i).fill(PASSWORD);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForURL((url: URL) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
}

test.describe("Navigation modules critiques (CEO)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  const routes = [
    { path: "/dashboard", label: /dashboard|tableau/i },
    { path: "/pos", label: /caisse|pos|panier|encaisser/i },
    { path: "/ventes", label: /vente/i },
    { path: "/catalogue", label: /catalogue|produit/i },
    { path: "/clients", label: /client/i },
    { path: "/cloture", label: /cl[oô]ture/i },
    { path: "/rapports-ceo", label: /rapport/i },
    { path: "/admin", label: /admin|utilisateur|permission/i },
    { path: "/audit", label: /audit|journal/i },
  ];

  for (const { path, label } of routes) {
    test(`charge ${path} sans erreur`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e: Error) => errors.push(e.message));
      page.on("console", (msg: any) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      await page.goto(path);
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      expect(page.url()).toContain(path);
      // Pas d'écran "unauthorized" pour un CEO
      expect(page.url()).not.toContain("/unauthorized");
      // Filtrer les erreurs non-bloquantes (favicon, websocket, etc.)
      const blocking = errors.filter(
        (e) =>
          !/favicon|websocket|net::ERR_|ResizeObserver|Failed to fetch dynamically imported/i.test(e),
      );
      expect(blocking, `Erreurs sur ${path}: ${blocking.join(" | ")}`).toHaveLength(0);
    });
  }
});
