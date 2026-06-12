// Registration garde-fou du service worker PWA.
// Refuse l'enregistrement en dev, dans une iframe (preview Lovable), sur les hôtes preview, et sur ?sw=off.
// Sur ?sw=off, désinstalle aussi tout SW existant pour permettre une reprise propre.

const SW_PATH = "/sw.js";

function shouldSkipRegistration(): boolean {
  if (!import.meta.env.PROD) return true;
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  const params = new URLSearchParams(window.location.search);
  if (params.get("sw") === "off") return true;
  return false;
}

async function unregisterAll(): Promise<void> {
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.();
    if (regs) await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    /* ignore */
  }
}

export function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  if (shouldSkipRegistration()) {
    // Si on est en preview/dev ou explicitement désactivé, nettoie tout SW résiduel.
    void unregisterAll();
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(SW_PATH, { updateViaCache: "none" })
      .then((reg) => {
        // Vérifie une mise à jour toutes les 30 min tant que l'onglet est ouvert.
        setInterval(() => {
          reg.update().catch(() => {});
        }, 30 * 60 * 1000);
      })
      .catch(() => {
        /* silent */
      });

    // Quand un nouveau SW prend le contrôle, recharge la page pour servir la version fraîche.
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}
