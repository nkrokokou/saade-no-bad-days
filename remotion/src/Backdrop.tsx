import { AbsoluteFill, useCurrentFrame, interpolate, useVideoConfig } from "remotion";
import { theme } from "./theme";

export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const drift = interpolate(frame, [0, durationInFrames], [0, 60]);
  const drift2 = interpolate(frame, [0, durationInFrames], [0, -80]);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 30% 20%, ${theme.espresso} 0%, ${theme.espressoDeep} 60%, ${theme.ink} 100%)` }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.5,
        background: `radial-gradient(circle at ${50 + drift / 4}% ${30 + drift2 / 6}%, ${theme.caramel}33 0%, transparent 40%)` }} />
      <div style={{ position: "absolute", inset: 0, opacity: 0.35,
        background: `radial-gradient(circle at ${20 + drift2 / 5}% ${80 + drift / 8}%, ${theme.gold}22 0%, transparent 45%)` }} />
      {/* grain */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.05, backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
    </AbsoluteFill>
  );
};
