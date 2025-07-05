import planetATexture from "../../../assets/3d/tex_planet_a.png";
import planetVTexture from "../../../assets/3d/tex_planet_v.png";
import planetDTexture from "../../../assets/3d/tex_planet_d.png";
import planetRTexture from "../../../assets/3d/tex_planet_r.png";
import planetKTexture from "../../../assets/3d/tex_planet_k.png";
import moonCTexture from "../../../assets/3d/tex_moon_c.png";
import moonDTexture from "../../../assets/3d/tex_moon_d.png";
import moonFTexture from "../../../assets/3d/tex_moon_f.png";
import moonGTexture from "../../../assets/3d/tex_moon_g.png";
import moonHTexture from "../../../assets/3d/tex_moon_h.png";

export const SOLAR_SYSTEM_CONFIG = [
  // Inner rocky planets - increased distances for better spacing
  {
    name: "Mercury",
    size: 2.2,
    distance: 18, // Increased from 15
    orbitSpeed: 0.02,
    rotationSpeed: 0.01,
    color: 0x8c7853,
    texture: planetATexture,
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
    texture: planetDTexture,
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
    texture: planetVTexture,
    startAngle: (Math.PI * 2) / 3,
    yPosition: 30, // Main orbital plane
    moons: [
      {
        size: 1, // Balanced size for visibility
        distance: 7, // Further increased orbital distance
        orbitSpeed: 0.06,
        color: 0xc0c0c0,
        texture: moonDTexture, // Updated to use moon D texture
        startAngle: 0,
      },
    ],
  },
  {
    name: "Mars",
    size: 2.6,
    distance: 35, // Increased from 32
    orbitSpeed: 0.015,
    rotationSpeed: 0.015,
    color: 0xcd5c5c,
    texture: planetRTexture,
    startAngle: Math.PI,
    yPosition: 28, // Above Earth's plane
    moons: [
      {
        size: 0.8, // Balanced size for visibility
        distance: 7, // Further increased orbital distance
        orbitSpeed: 0.08,
        color: 0x8b7355,
        texture: moonGTexture, // Updated to use moon G texture
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
    texture: planetKTexture,
    startAngle: Math.PI * 1.2,
    yPosition: 30, // Further below Earth's plane for depth
    moons: [
      {
        size: 1.3, // Balanced size for visibility
        distance: 13, // Further increased orbital distance
        orbitSpeed: 0.03,
        color: 0xaaaaaa,
        texture: moonHTexture, // Keep moon H texture
        startAngle: 0,
      },
      {
        size: 1, // Balanced size for visibility
        distance: 11.5, // Further increased orbital distance with more separation
        orbitSpeed: 0.032,
        color: 0xc0c0c0,
        texture: moonCTexture, // Updated to use moon C texture
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
    texture: moonCTexture,
    startAngle: Math.PI * 1.7,
    yPosition: 30, // Above Earth's plane for depth
    moons: [
      {
        size: 2.0, // Balanced size for visibility
        distance: 12, // Further increased orbital distance
        orbitSpeed: 0.038,
        color: 0xc0c0c0,
        texture: moonFTexture, // Updated to use moon F texture
        startAngle: 0,
      },
      {
        size: 1.6, // Balanced size for visibility
        distance: 12, // Further increased orbital distance with more separation
        orbitSpeed: 0.03,
        color: 0xaaaaaa,
        texture: moonDTexture, // Updated to use moon D texture (different from Earth's moon)
        startAngle: Math.PI / 2,
      },
    ],
  },

  // Ice giants - increased distance for better spacing
  {
    name: "Uranus",
    size: 7.0,
    distance: 150, // Increased from 85
    orbitSpeed: 0.004,
    rotationSpeed: 0.018,
    color: 0x4fd0e3,
    texture: moonGTexture,
    startAngle: Math.PI * 0.3,
    yPosition: 30, // Slight deviation below Earth's plane
    moons: [],
  },
];
