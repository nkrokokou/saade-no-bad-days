import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { heading, body } from "../fonts";

const modules = [
  "Tableau de bord", "Caisse / POS", "Ventes & Rapports",
  "Clients & Crédits", "Catalogue produits", "Matières premières",
  "Achats MP", "Fiches techniques", "Bons de transfert",
  "Stock tampon", "Production labo", "Inventaire",
  "Pertes", "Clôture journalière", "Dégustations",
  "Tables restaurant", "Assistant IA", "Administration",
];

export const SceneOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleIn = spring({ frame: frame - 5, fps, config: { damping: 18, stiffness: 80 } });
  const titleY = interpolate(titleIn, [0, 1], [50, 0]);
  const fadeOut = interpolate(frame, [130, 150], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity: fadeOut, alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div style={{ fontFamily: body, fontSize: 18, letterSpacing: 10, color: theme.caramel, opacity: titleIn, fontWeight: 500 }}>
        TOUT EN UNE SEULE PLATEFORME
      </div>
      <div style={{ height: 24 }} />
      <div style={{
        fontFamily: heading, fontSize: 130, color: theme.cream, fontWeight: 700,
        letterSpacing: -3, opacity: titleIn, transform: `translateY(${titleY}px)`, textAlign: "center", lineHeight: 1.05,
      }}>
        18 modules, <span style={{ color: theme.gold, fontStyle: "italic", fontWeight: 400 }}>une maison</span>
      </div>
      <div style={{ height: 60 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14, maxWidth: 1500 }}>
        {modules.map((m, i) => {
          const mIn = spring({ frame: frame - (30 + i * 4), fps, config: { damping: 200 } });
          const my = interpolate(mIn, [0, 1], [20, 0]);
          return (
            <div key={i} style={{
              opacity: mIn, transform: `translateY(${my}px)`,
              padding: "14px 18px", border: `1px solid ${theme.caramel}55`, borderRadius: 8,
              background: `${theme.caramel}11`, fontFamily: body, fontSize: 16, color: theme.cream,
              textAlign: "center", fontWeight: 400,
            }}>
              {m}
            </div>
          );
        })}
      </div>
      <div style={{ height: 70 }} />
      <div style={{ fontFamily: heading, fontSize: 56, color: theme.gold, fontStyle: "italic", opacity: interpolate(frame, [110, 140], [0, 1], { extrapolateRight: "clamp" }) }}>
        SAADÉ
      </div>
      <div style={{ marginTop: 8, fontFamily: body, fontSize: 18, color: theme.cream, opacity: interpolate(frame, [120, 150], [0, 0.7], { extrapolateRight: "clamp" }), letterSpacing: 4 }}>
        LOMÉ · TOGO
      </div>
    </AbsoluteFill>
  );
};
