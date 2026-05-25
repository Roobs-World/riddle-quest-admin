import type {AudioSource} from "expo-audio";

declare module "*.wav" {
  const src: AudioSource;
  export default src;
}

declare module "*.mp3" {
  const src: AudioSource;
  export default src;
}

declare module "*.m4a" {
  const src: AudioSource;
  export default src;
}
