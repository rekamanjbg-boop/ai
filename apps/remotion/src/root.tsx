import { Composition } from "remotion";
import { MainComposition } from "./templates/main-composition.js";

export function RemotionRoot() {
  return (
    <Composition
      id="Main"
      component={MainComposition}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        title: "AI Media Production",
        subtitle: "Generated video"
      }}
    />
  );
}

