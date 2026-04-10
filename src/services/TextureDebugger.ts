/**
 * @fileoverview
 * Utility service for validating that all 3D texture assets used by the
 * solar system background can be resolved and downloaded via Expo's
 * `Asset` system.
 *
 * This code is intended for development and debugging only. It does not
 * render anything; instead it logs detailed diagnostics that help track
 * down asset pipeline issues when running on device or simulator.
 */
import { Asset } from "expo-asset";

// Import all textures to test
import texPlanetR from "../../assets/3d/tex_planet_r.png";
import texPlanetV from "../../assets/3d/tex_planet_v.png";
import texPlanetA from "../../assets/3d/tex_planet_a.png";
import texPlanetD from "../../assets/3d/tex_planet_d.png";
import texPlanetK from "../../assets/3d/tex_planet_k.png";

import texMoonH from "../../assets/3d/tex_moon_h.png";
import texMoonF from "../../assets/3d/tex_moon_f.png";
import texMoonG from "../../assets/3d/tex_moon_g.png";
import texMoonC from "../../assets/3d/tex_moon_c.png";
import texMoonD from "../../assets/3d/tex_moon_d.png";

import texRingA from "../../assets/3d/tex_ring_a.png";
import texRingB from "../../assets/3d/tex_ring_b.png";

import texGradientCircle from "../../assets/3d/tex_gradient_circle.png";
import texGradientCircleSun from "../../assets/3d/tex_gradient_circle_sun.png";
import texGradientCircleI from "../../assets/3d/tex_gradient_circle_i.png";
import texGradientCircleSunI from "../../assets/3d/tex_gradient_circle_sun_i.png";
import { logger } from "../utils/logger";
import { captureException } from "../utils/sentry";

/**
 * Static helper class for batch or single-asset texture verification.
 */
export class TextureDebugger {
  private static readonly textureAssets = [
    { name: "planet_r", asset: texPlanetR },
    { name: "planet_v", asset: texPlanetV },
    { name: "planet_a", asset: texPlanetA },
    { name: "planet_d", asset: texPlanetD },
    { name: "planet_k", asset: texPlanetK },
    { name: "moon_h", asset: texMoonH },
    { name: "moon_f", asset: texMoonF },
    { name: "moon_g", asset: texMoonG },
    { name: "moon_c", asset: texMoonC },
    { name: "moon_d", asset: texMoonD },
    { name: "ring_a", asset: texRingA },
    { name: "ring_b", asset: texRingB },
    { name: "gradient_circle", asset: texGradientCircle },
    { name: "gradient_circle_sun", asset: texGradientCircleSun },
    { name: "gradient_circle_i", asset: texGradientCircleI },
    { name: "gradient_circle_sun_i", asset: texGradientCircleSunI },
  ];

  /**
   * Iterates over all known texture assets, attempting to resolve and
   * download each one and logging a summary of successes and failures.
   */
  static async testAllAssets(): Promise<void> {
    logger.debug("🔍 TextureDebugger: Starting asset loading test...");

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const { name, asset } of this.textureAssets) {
      try {
        logger.debug(`🔍 Testing asset: ${name}`);

        // Test 1: Check if asset import is valid
        if (!asset) {
          throw new Error(`Asset import is null/undefined`);
        }

        // Test 2: Create Expo Asset
        const imageAsset = Asset.fromModule(asset);
        logger.debug(`  ✓ Asset created: ${imageAsset.name || "unnamed"}`);

        // Test 3: Download asset
        await imageAsset.downloadAsync();
        logger.debug(`  ✓ Asset downloaded`);

        // Test 4: Check localUri
        if (!imageAsset.localUri) {
          throw new Error(`localUri is null after download`);
        }
        logger.debug(`  ✓ LocalUri available: ${imageAsset.localUri}`);

        // Test 5: Check if file exists (basic validation)
        if (imageAsset.localUri.length < 10) {
          throw new Error(`localUri seems invalid: ${imageAsset.localUri}`);
        }

        logger.debug(`✅ ${name}: SUCCESS`);
        results.success++;
      } catch (error) {
        const errorMsg = `❌ ${name}: ${error}`;
        logger.error(errorMsg);
        captureException(error);
        results.errors.push(errorMsg);
        results.failed++;
      }
    }

    logger.debug("\n🔍 TextureDebugger: Test Results Summary");
    logger.debug(
      `✅ Successful: ${results.success}/${this.textureAssets.length}`
    );
    logger.debug(`❌ Failed: ${results.failed}/${this.textureAssets.length}`);

    if (results.errors.length > 0) {
      logger.debug("\n❌ Errors:");
      results.errors.forEach((error) => logger.debug(`  ${error}`));
    }

    if (results.success === this.textureAssets.length) {
      logger.debug("🎉 All texture assets loaded successfully!");
    } else {
      logger.debug("⚠️ Some texture assets failed to load");
    }
  }

  /**
   * Tests a single texture asset by resolving it through the Expo `Asset`
   * system and ensuring a non-empty `localUri` is produced.
   *
   * @param assetPath Module reference for the asset (as imported).
   * @param name Human-readable name used in log output.
   * @returns `true` if the asset could be downloaded and validated,
   * otherwise `false`.
   */
  static async testSingleAsset(
    assetPath: string | number,
    name: string
  ): Promise<boolean> {
    try {
      logger.debug(`🔍 Testing single asset: ${name}`);

      const imageAsset = Asset.fromModule(assetPath);
      await imageAsset.downloadAsync();

      if (!imageAsset.localUri) {
        throw new Error(`localUri is null`);
      }

      logger.debug(`✅ ${name}: SUCCESS - ${imageAsset.localUri}`);
      return true;
    } catch (error) {
      logger.error(`❌ ${name}: FAILED - ${error}`);
      captureException(error);
      return false;
    }
  }
}

