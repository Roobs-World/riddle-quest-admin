export type PlanetAtmosphere = {
  color: number;
  scale: number;
  opacity: number;
  falloff: number;
  surfaceHaze: number;
};

export const PLANET_ATMOSPHERES = {
  Mercury: {color: 0xb8c6d1, scale: 1.055, opacity: 0.2, falloff: 3.4, surfaceHaze: 0.015},
  Venus: {color: 0xffbd5e, scale: 1.13, opacity: 0.55, falloff: 1.45, surfaceHaze: 0.22},
  Earth: {color: 0x4aafff, scale: 1.105, opacity: 0.58, falloff: 2.1, surfaceHaze: 0.08},
  Mars: {color: 0xff7047, scale: 1.075, opacity: 0.32, falloff: 2.8, surfaceHaze: 0.035},
  Jupiter: {color: 0xffd4a0, scale: 1.07, opacity: 0.34, falloff: 1.8, surfaceHaze: 0.08},
  Saturn: {color: 0xffdf91, scale: 1.075, opacity: 0.3, falloff: 2, surfaceHaze: 0.06},
  Uranus: {color: 0x70edff, scale: 1.11, opacity: 0.42, falloff: 1.6, surfaceHaze: 0.15},
} as const satisfies Record<string, PlanetAtmosphere>;
