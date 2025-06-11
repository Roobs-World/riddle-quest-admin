// 3D Planet Texture Asset Mapping
// Based on assets/3d/notes.txt specifications

import mercuryTexture from "../../assets/images/planets/tex_planet_r.png";
import venusTexture from "../../assets/images/planets/tex_planet_v.png";
import earthTexture from "../../assets/images/planets/tex_planet_a.png";
import marsTexture from "../../assets/images/planets/tex_planet_d.png";
import jupiterTexture from "../../assets/images/planets/tex_planet_k.png";

import moonAH from "../../assets/images/moons/tex_moon_h.png";
import moonDF from "../../assets/images/moons/tex_moon_f.png";
import moonDG from "../../assets/images/moons/tex_moon_g.png";
import moonKC from "../../assets/images/moons/tex_moon_c.png";
import moonKD from "../../assets/images/moons/tex_moon_d.png";

import ringA from "../../assets/images/rings/tex_ring_a.png";
import ringB from "../../assets/images/rings/tex_ring_b.png";

import sunTexture from "../../assets/images/sun/tex_gradient_circle_sun.png";
import sunGlowTexture from "../../assets/images/sun/tex_gradient_circle_sun_i.png";

import glowEffect from "../../assets/images/effects/tex_gradient_circle.png";
import glowEffectIntense from "../../assets/images/effects/tex_gradient_circle_i.png";

export const PLANET_TEXTURES = {
  // planet_r - grey/green planet with no moons (Mercury)
  mercury: mercuryTexture,

  // planet_v - blue planet with small ring (Venus)
  venus: venusTexture,

  // planet_a - red planet with 1 moon: moon_a_h (Earth)
  earth: earthTexture,

  // planet_d - large orange planet with 2 moons: moon_d_f + moon_d_g (Mars)
  mars: marsTexture,

  // planet_k - green planet with large ring and 2 moons: moon_k_c + moon_k_d (Jupiter)
  jupiter: jupiterTexture,
} as const;

export const MOON_TEXTURES = {
  // Moon for planet_a (Earth)
  moon_a_h: moonAH,

  // Moons for planet_d (Mars)
  moon_d_f: moonDF,
  moon_d_g: moonDG,

  // Moons for planet_k (Jupiter)
  moon_k_c: moonKC,
  moon_k_d: moonKD,
} as const;

export const RING_TEXTURES = {
  // Small ring for planet_v (Venus)
  ring_a: ringA,

  // Large ring for planet_k (Jupiter)
  ring_b: ringB,
} as const;

export const SUN_TEXTURES = {
  // Main sun texture with corona
  sun: sunTexture,

  // Enhanced sun glow texture
  sunGlow: sunGlowTexture,
} as const;

export const GLOW_EFFECTS = {
  // Standard glow effect for planets
  standard: glowEffect,

  // Intense glow effect for sun/bright objects
  intense: glowEffectIntense,
} as const;

// Type-safe texture references
export type PlanetTextureKey = keyof typeof PLANET_TEXTURES;
export type MoonTextureKey = keyof typeof MOON_TEXTURES;
export type RingTextureKey = keyof typeof RING_TEXTURES;
export type SunTextureKey = keyof typeof SUN_TEXTURES;
export type GlowEffectKey = keyof typeof GLOW_EFFECTS;
