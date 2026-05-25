// Global type declarations for asset files
declare module "*.svg" {
  import {SvgProps} from "react-native-svg";
  const content: React.FC<SvgProps>;
  export default content;
}

declare module "*.wav" {
  const content: number;
  export default content;
}

declare module "*.mp3" {
  const content: number;
  export default content;
}

declare module "*.m4a" {
  const content: number;
  export default content;
}

declare module "*.aac" {
  const content: number;
  export default content;
}

declare module "*.ogg" {
  const content: number;
  export default content;
}
