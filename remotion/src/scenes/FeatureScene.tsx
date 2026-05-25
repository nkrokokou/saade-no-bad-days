import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { heading, body } from "../fonts";

interface Props {
  number: string;
  title: string;
  subtitle: string;
  bullets: string[];
  accentColor?: string;
}

export const FeatureScene: React.FC<Props> = ({ number, title, subtitle, bullets, accentColor = theme.caramel }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const numIn = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const titleIn = spring({ frame: frame - 18, fps, config: { damping: 18, stiffness: 90 } });
  const subIn = interpolate(frame, [30, 55], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [100, 120], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(titleIn, [0, 1], [40, 0]);

  return (
    <AbsoluteFill style={{ opacity: fadeOut, padding: "120px 140px", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 28, opacity: numIn }}>
        <div style={{ fontFamily: heading, fontSize: 120, color: accentColor, fontWeight: 400, lineHeight: 1, fontStyle: "italic" }}>
          {number}
        </div>
        <div style={{ height: 2, flex: 1, background: accentColor, opacity: 0.4 }} />
        <div style={{ fontFamily: body, fontSize: 18, color: theme.cream, letterSpacing: 8, opacity: 0.6 }}>
          MODULE
        </div>
      </div>
      <div style={{ height: 32 }} />
      <div style={{
        fontFamily: heading, fontSize: 130, color: theme.cream, fontWeight: 600,
        lineHeight: 1.05, letterSpacing: -2, opacity: titleIn, transform: `translateY(${titleY}px)`,
      }}>
        {title}
      </div>
      <div style={{ height: 28 }} />
      <div style={{ fontFamily: heading, fontSize: 38, color: theme.gold, fontStyle: "italic", opacity: subIn, fontWeight: 400 }}>
        {subtitle}
      </div>
      <div style={{ height: 60 }} />
      <div style={{ display: "flex", gap: 60, flexWrap: "wrap" }}>
        {bullets.map((b, i) => {
          const bIn = spring({ frame: frame - (50 + i * 10), fps, config: { damping: 200 } });
          const by = interpolate(bIn, [0, 1], [25, 0]);
          return (
            <div key={i} style={{ opacity: bIn, transform: `translateY(${by}px)`, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: accentColor }} />
              <span style={{ fontFamily: body, fontSize: 28, color: theme.cream, fontWeight: 400 }}>{b}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
