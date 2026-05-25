# 3D Planet Texture Integration Guide

## Overview

This guide explains how to integrate your high-quality 3D planet textures into the existing SolarSystemBackground component in Riddle Quest.

## Asset Analysis

Based on your `assets/3d/notes.txt` and available textures:

### Available 3D Assets

#### Planet Textures (4-10MB each)

- `tex_planet_r.png` - Grey/green planet (Mercury)
- `tex_planet_a.png` - Red planet with moon (Earth)
- `tex_planet_d.png` - Large orange planet with 2 moons (Mars)
- `tex_planet_v.png` - Blue planet with small ring (Venus)
- `tex_planet_k.png` - Green planet with large ring and 2 moons (Jupiter)

#### Moon Textures

- `tex_moon_h.png` - Moon for planet_a
- `tex_moon_f.png` - First moon for planet_d
- `tex_moon_g.png` - Second moon for planet_d
- `tex_moon_c.png` - First moon for planet_k
- `tex_moon_d.png` - Second moon for planet_k

#### Ring Textures

- `tex_ring_a.png` - Small ring for planet_v
- `tex_ring_b.png` - Large ring for planet_k

#### Glow Effects

- `tex_gradient_circle_i.png` - Planet glow effect
- `tex_gradient_circle_sun_i.png` - Sun glow effect

## Integration Strategy

### Phase 1: Texture Enhancement (Recommended)

Replace the current SVG gradient planets with high-quality PNG textures while maintaining the existing animation system.

#### Current System Analysis

- Location: `src/components/background/StarryBackground.tsx`
- Current rendering: SVG circles with gradients
- Animation: React Native Reanimated with orbital mechanics
- Performance: Optimized with star pooling (20 stars)

#### Implementation Steps

1. **Copy Textures to React Native Assets**

   ```bash
   # Create asset directory structure
   mkdir -p assets/images/planets
   mkdir -p assets/images/moons
   mkdir -p assets/images/rings

   # Copy textures (adjust paths as needed)
   cp assets/3d/tex/tex_planet_*.png assets/images/planets/
   cp assets/3d/tex/tex_moon_*.png assets/images/moons/
   cp assets/3d/tex/tex_ring_*.png assets/images/rings/
   ```

2. **Update Planet Interface**

   ```typescript
   interface Planet {
     // ... existing properties
     textureImage?: string; // Path to planet texture
     moonTextures?: string[]; // Array of moon texture paths
     ringTexture?: string; // Ring texture path
   }
   ```

3. **Modify Planet Data**

   ```typescript
   const planetData: Planet[] = [
     {
       id: 1,
       name: "Mercury",
       // ... existing properties
       textureImage: require("../../../assets/images/planets/tex_planet_r.png"),
     },
     {
       id: 2,
       name: "Venus",
       // ... existing properties
       textureImage: require("../../../assets/images/planets/tex_planet_v.png"),
       hasRings: true,
       ringTexture: require("../../../assets/images/rings/tex_ring_a.png"),
     },
     // ... continue for all planets
   ];
   ```

4. **Replace SVG Circles with Images**

   ```typescript
   // Replace this SVG circle:
   <Circle
     cx={planet.size / 2}
     cy={planet.size / 2}
     r={planet.size / 2}
     fill={`url(#${planet.gradientId})`}
   />

   // With Image component:
   <Image
     source={planet.textureImage}
     style={{
       width: planet.size,
       height: planet.size,
       borderRadius: planet.size / 2, // Make circular
     }}
     resizeMode="cover"
   />
   ```

### Phase 2: Performance Optimization

#### Texture Optimization

- Compress large textures for mobile devices
- Consider multiple resolutions for different devices
- Implement lazy loading for performance

#### Asset Management

```typescript
// Create asset mapping system
const PLANET_TEXTURES = {
  mercury: require("../../../assets/images/planets/tex_planet_r.png"),
  venus: require("../../../assets/images/planets/tex_planet_v.png"),
  earth: require("../../../assets/images/planets/tex_planet_a.png"),
  mars: require("../../../assets/images/planets/tex_planet_d.png"),
  jupiter: require("../../../assets/images/planets/tex_planet_k.png"),
};

const MOON_TEXTURES = {
  moon_h: require("../../../assets/images/moons/tex_moon_h.png"),
  moon_f: require("../../../assets/images/moons/tex_moon_f.png"),
  moon_g: require("../../../assets/images/moons/tex_moon_g.png"),
  moon_c: require("../../../assets/images/moons/tex_moon_c.png"),
  moon_d: require("../../../assets/images/moons/tex_moon_d.png"),
};
```

### Phase 3: Advanced 3D Integration (Future)

For true 3D rendering with FBX models:

1. **Install Three.js Dependencies** ✅ (Already done)

   ```bash
   pnpm add three @react-three/fiber @react-three/drei expo-gl expo-gl-cpp
   ```

2. **Create WebGL Context**

   ```typescript
   import { GLView } from "expo-gl";
   import { Renderer } from "expo-three";
   import * as THREE from "three";
   import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
   ```

3. **Load FBX Models**
   ```typescript
   const fbxLoader = new FBXLoader();
   fbxLoader.load("path/to/planet.fbx", (fbx) => {
     // Add to scene
   });
   ```

## Metro Configuration

Ensure Metro can handle PNG imports by updating `metro.config.js`:

```javascript
const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("png", "fbx");

module.exports = config;
```

## TypeScript Configuration

Add image module declarations to handle PNG imports:

```typescript
// types/images.d.ts
declare module "*.png" {
  const value: any;
  export default value;
}
```

## Integration with Existing System

### Current Architecture Preservation

- Keep existing star pooling optimization
- Maintain orbital animation system
- Preserve performance patterns
- Keep SVG system for fallbacks

### Enhanced Planet Rendering

```typescript
const Enhanced3DPlanet: React.FC<{ planet: Planet }> = ({ planet }) => {
  // ... existing animation code

  return (
    <Animated.View style={animatedProps}>
      {/* Use 3D texture instead of SVG */}
      <Image
        source={planet.textureImage}
        style={[
          styles.planetImage,
          { width: planet.size, height: planet.size },
        ]}
      />
      {/* ... moons and rings */}
    </Animated.View>
  );
};
```

## Performance Considerations

### Memory Management

- Large PNG textures (4-10MB each) require careful memory management
- Consider texture compression
- Implement image caching strategies

### Rendering Performance

- Test on lower-end devices
- Monitor frame rates during animation
- Consider LOD (Level of Detail) system

### Loading Optimization

- Preload critical textures
- Lazy load non-visible planets
- Implement progress indicators

## Testing Strategy

1. **Visual Testing**

   - Compare texture quality vs. current gradients
   - Test on different screen densities
   - Verify proper circular masking

2. **Performance Testing**

   - Monitor memory usage with large textures
   - Test animation smoothness
   - Measure startup time impact

3. **Device Testing**
   - Test on iOS and Android
   - Verify on different device specifications
   - Check texture loading reliability

## Implementation Priority

1. **High Priority**: Replace SVG gradients with PNG textures
2. **Medium Priority**: Add moon and ring textures
3. **Low Priority**: Full 3D FBX model integration

## Next Steps

1. Copy texture files to appropriate asset directories
2. Update planet data configuration
3. Modify rendering components to use Image instead of SVG
4. Test performance impact
5. Optimize for production deployment

This approach maintains the existing high-performance architecture while significantly enhancing visual quality with your professional 3D textures.
