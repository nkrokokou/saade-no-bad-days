import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { heading, body } from "../fonts";

export const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = spring({ frame: frame - 10, fps, config: { damping: 18, stiffness: 80 } });
  const sub = spring({ frame: frame - 35, fps, config: { damping: 200 } });
  const lineW = interpolate(frame, [25, 70], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [100, 120], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const yMega = interpolate(reveal, [0, 1], [60, 0]);

  return (
    <AbsoluteFill style={{ opacity: fadeOut, alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: body, color: theme.caramel, letterSpacing: 12, fontSize: 22, opacity: sub, fontWeight: 500 }}>
          PÂTISSERIE · BOUTIQUE · LABORATOIRE
        </div>
        <div style={{ height: 24 }} />
        <div style={{
          fontFamily: heading, color: theme.cream, fontSize: 280, fontWeight: 700,
          letterSpacing: -4, lineHeight: 1, transform: `translateY(${yMega}px)`, opacity: reveal,
        }}>
          SAADÉ
        </div>
        <div style={{ marginTop: 24, height: 2, width: 520, background: theme.caramel, marginLeft: "auto", marginRight: "auto",
          transform: `scaleX(${lineW})`, transformOrigin: "left" }} />
        <div style={{ marginTop: 28, fontFamily: heading, color: theme.gold, fontSize: 36, fontStyle: "italic", opacity: sub, fontWeight: 400 }}>
          La gestion complète de votre maison
        </div>
      </div>
    </AbsoluteFill>
  );
};
