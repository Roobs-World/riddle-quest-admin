/**
 * @fileoverview Solar System Configuration
 *
 * Configuration data for the 3D solar system, defining planets, moons,
 * their properties, and orbital characteristics. This file serves as the
 * central source of truth for all celestial body parameters used in the
 * SolarSystem3D component.
 *
 * **Configuration Parameters:**
 * - Celestial body sizes and orbital distances
 * - Rotation and orbital speeds
 * - Texture mappings for visual appearance
 * - Starting positions and orbital planes
 * - Moon systems with their own parameters
 *
 * **Design Considerations:**
 * - Balanced visual appeal with performance
 * - Proper spacing to prevent visual collisions
 * - Varied orbital planes for 3D depth perception
 * - Optimized texture usage across celestial bodies
 *
 * @author Riddle Quest Development Team
 * @version 1.0.0
 * @since 2024
 */

import planetATexture from "../../../assets/3d/tex_planet_a.png";
import planetVTexture from "../../../assets/3d/tex_planet_v.png";
import planetDTexture from "../../../assets/3d/tex_planet_d.png";
import planetRTexture from "../../../assets/3d/tex_planet_r.png";
import planetKTexture from "../../../assets/3d/tex_planet_k.png";
import planetSTexture from "../../../assets/3d/tex_planet_s.png";
import planetUTexture from "../../../assets/3d/tex_planet_u.png";
import moonCTexture from "../../../assets/3d/tex_moon_c.png";
import moonDTexture from "../../../assets/3d/tex_moon_d.png";
import moonFTexture from "../../../assets/3d/tex_moon_f.png";
import moonGTexture from "../../../assets/3d/tex_moon_g.png";
import moonHTexture from "../../../assets/3d/tex_moon_h.png";
import ringATexture from "../../../assets/3d/tex_ring_a.png";
import ringBTexture from "../../../assets/3d/tex_ring_b.png";

/**
 * Moon configuration interface defining properties for moons
 * that orbit planets in the solar system.
 *
 * @property {number} size - Radius of the moon in arbitrary units
 * @property {number} distance - Orbital distance from parent planet
 * @property {number} orbitSpeed - Angular velocity of orbit
 * @property {number} color - Hexadecimal color value for the moon
 * @property {number} textureModule - Asset module for the moon's texture
 * @property {number} startAngle - Initial orbital position in radians
 */
interface MoonConfig {
  size: number;
  distance: number;
  orbitSpeed: number;
  color: number;
  textureKey: string;
  textureModule: number;
  startAngle: number;
}

/**
 * Ring configuration interface defining properties for textured rings
 * that render around selected planets.
 *
 * @property {number} innerRadius - Inner radius of the ring geometry
 * @property {number} outerRadius - Outer radius of the ring geometry
 * @property {number} textureModule - Asset module for the ring texture
 * @property {number} tiltRadians - X-axis tilt applied to the ring plane
 */
interface RingConfig {
  innerRadius: number;
  outerRadius: number;
  textureModule: number;
  tiltRadians: number;
}

/**
 * Planet configuration interface defining properties for planets
 * that orbit the sun in the solar system.
 *
 * @property {string} name - Name of the planet
 * @property {number} size - Radius of the planet in arbitrary units
 * @property {number} distance - Orbital distance from the sun
 * @property {number} orbitSpeed - Angular velocity of orbit around sun
 * @property {number} rotationSpeed - Speed of planet's self-rotation
 * @property {number} color - Hexadecimal color value for the planet
 * @property {number} textureModule - Asset module for the planet's texture
 * @property {number} startAngle - Initial orbital position in radians
 * @property {number} yPosition - Y-axis position for 3D depth effect
 * @property {MoonConfig[]} moons - Array of moons orbiting this planet
 * @property {RingConfig} ring - Optional textured ring rendered around this planet
 */
interface PlanetConfig {
  name: string;
  size: number;
  distance: number;
  orbitSpeed: number;
  rotationSpeed: number;
  color: number;
  atmosphereColor: string;
  textureKey: string;
  textureModule: number;
  startAngle: number;
  yPosition: number;
  moons: MoonConfig[];
  ring?: RingConfig;
}

/**
 * Complete solar system configuration defining all planets
 * and their properties for the 3D solar system visualization.
 *
 * Key design principles:
 * 1. Planets orbit with configurable Y positions for 3D depth
 * 2. Different orbital distances for visual depth - adjusted to prevent collisions
 * 3. All planets orbit in the same direction around the sun
 * 4. Each planet uses a unique texture for visual variety
 * 5. Enhanced lighting to show planetary details
 * 6. Orbital distances increased to prevent planet and moon collisions
 * 7. Y positions create visual depth and separation between planetary orbits
 * 8. All moon textures used for maximum visual variety and brightness
 */
export const SOLAR_SYSTEM_CONFIG: PlanetConfig[] = [
  // Inner rocky planets - increased distances for better spacing
  {
    name: "Mercury",
    size: 2.2,
    distance: 18, // Increased from 15
    orbitSpeed: 0.02,
    rotationSpeed: 0.01,
    color: 0x8c7853,
    atmosphereColor: "#aa9977",
    textureKey: "planet_a",
    textureModule: planetATexture,
    startAngle: 0,
    yPosition: 30, // Earth's plane
    moons: [],
  },
  {
    name: "Venus",
    size: 3.0,
    distance: 26, // Increased from 20
    orbitSpeed: 0.018,
    rotationSpeed: 0.008,
    color: 0xffd700,
    atmosphereColor: "#ffcc44",
    textureKey: "planet_d",
    textureModule: planetDTexture,
    startAngle: Math.PI / 3,
    yPosition: 30, // Slightly below Earth's plane
    moons: [],
  },
  {
    name: "Earth",
    size: 3.5,
    distance: 30, // Increased from 25
    orbitSpeed: 0.015,
    rotationSpeed: 0.02,
    color: 0x4169e1,
    atmosphereColor: "#4488ff",
    textureKey: "planet_v",
    textureModule: planetVTexture,
    startAngle: (Math.PI * 2) / 3,
    yPosition: 30, // Main orbital plane
    moons: [
      {
        size: 1, // Balanced size for visibility
        distance: 7, // Further increased orbital distance
        orbitSpeed: 0.06,
        color: 0xc0c0c0,
        textureKey: "moon_d",
        textureModule: moonDTexture, // Updated to use moon D texture
        startAngle: 0,
      },
    ],
    ring: {
      innerRadius: 4.5,
      outerRadius: 6.1,
      textureModule: ringATexture,
      tiltRadians: Math.PI / 2.45,
    },
  },
  {
    name: "Mars",
    size: 2.6,
    distance: 35, // Increased from 32
    orbitSpeed: 0.015,
    rotationSpeed: 0.015,
    color: 0xcd5c5c,
    atmosphereColor: "#ff5533",
    textureKey: "planet_r",
    textureModule: planetRTexture,
    startAngle: Math.PI,
    yPosition: 28, // Above Earth's plane
    moons: [
      {
        size: 0.8, // Balanced size for visibility
        distance: 7, // Further increased orbital distance
        orbitSpeed: 0.08,
        color: 0x8b7355,
        textureKey: "moon_g",
        textureModule: moonGTexture, // Updated to use moon G texture
        startAngle: 0,
      },
    ],
  },

  // Gas giants - increased distances for better spacing
  {
    name: "Jupiter",
    size: 10.0,
    distance: 70, // Increased from 55
    orbitSpeed: 0.004,
    rotationSpeed: 0.025,
    color: 0xdaa520,
    atmosphereColor: "#ddaa44",
    textureKey: "planet_k",
    textureModule: planetKTexture,
    startAngle: Math.PI * 1.2,
    yPosition: 30, // Further below Earth's plane for depth
    moons: [
      {
        size: 1.3, // Balanced size for visibility
        distance: 13, // Further increased orbital distance
        orbitSpeed: 0.03,
        color: 0xaaaaaa,
        textureKey: "moon_h",
        textureModule: moonHTexture, // Keep moon H texture
        startAngle: 0,
      },
      {
        size: 1, // Balanced size for visibility
        distance: 11.5, // Further increased orbital distance with more separation
        orbitSpeed: 0.032,
        color: 0xc0c0c0,
        textureKey: "moon_c",
        textureModule: moonCTexture, // Updated to use moon C texture
        startAngle: Math.PI / 3,
      },
    ],
  },
  {
    name: "Saturn",
    size: 8.5,
    distance: 90, // Increased from 70
    orbitSpeed: 0.005,
    rotationSpeed: 0.022,
    color: 0xffd700,
    atmosphereColor: "#ffee88",
    textureKey: "planet_s",
    textureModule: planetSTexture,
    startAngle: Math.PI * 1.7,
    yPosition: 30, // Above Earth's plane for depth
    moons: [
      {
        size: 2.0, // Balanced size for visibility
        distance: 12, // Further increased orbital distance
        orbitSpeed: 0.038,
        color: 0xc0c0c0,
        textureKey: "moon_f",
        textureModule: moonFTexture, // Updated to use moon F texture
        startAngle: 0,
      },
      {
        size: 1.6, // Balanced size for visibility
        distance: 12, // Further increased orbital distance with more separation
        orbitSpeed: 0.03,
        color: 0xaaaaaa,
        textureKey: "moon_d",
        textureModule: moonDTexture, // Updated to use moon D texture (different from Earth's moon)
        startAngle: Math.PI / 2,
      },
    ],
    ring: {
      innerRadius: 11.5,
      outerRadius: 16.5,
      textureModule: ringBTexture,
      tiltRadians: Math.PI / 2.25,
    },
  },

  // Ice giants - increased distance for better spacing
  {
    name: "Uranus",
    size: 7.0,
    distance: 150, // Increased from 85
    orbitSpeed: 0.004,
    rotationSpeed: 0.018,
    color: 0x4fd0e3,
    atmosphereColor: "#44ddee",
    textureKey: "planet_u",
    textureModule: planetUTexture,
    startAngle: Math.PI * 0.3,
    yPosition: 30, // Slight deviation below Earth's plane
    moons: [],
  },
];
