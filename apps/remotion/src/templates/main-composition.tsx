import { AbsoluteFill } from "remotion";

type MainCompositionProps = {
  title: string;
  subtitle: string;
};

export function MainComposition({ title, subtitle }: MainCompositionProps) {
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        backgroundColor: "#111827",
        color: "white",
        display: "flex",
        fontFamily: "Inter, Arial, sans-serif",
        justifyContent: "center",
        padding: 80,
        textAlign: "center"
      }}
    >
      <h1 style={{ fontSize: 84, margin: 0 }}>{title}</h1>
      <p style={{ color: "#A7F3D0", fontSize: 38 }}>{subtitle}</p>
    </AbsoluteFill>
  );
}

