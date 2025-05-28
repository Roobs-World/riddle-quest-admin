import { AVPlaybackSource } from "expo-av";

declare module "*.wav" {
  const src: AVPlaybackSource;
  export default src;
}

declare module "*.mp3" {
  const src: AVPlaybackSource;
  export default src;
}

declare module "*.m4a" {
  const src: AVPlaybackSource;
  export default src;
}
