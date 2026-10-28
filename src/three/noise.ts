import * as THREE from 'three';

export const WORLD_RADIUS = 1800;
export const WATER_LEVEL = -1.5;

// Fast deterministic 2D hash & value noise
function hash2D(ix: number, iz: number): number {
  let n = ix * 374761393 + iz * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) & 0x7fffffff) / 0x7fffffff;
}

function smoothNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;

  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);

  const a = hash2D(ix, iz);
  const b = hash2D(ix + 1, iz);
  const c = hash2D(ix, iz + 1);
  const d = hash2D(ix + 1, iz + 1);

  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/**
 * Deterministic low-poly terrain height function.
 * Combines ridged alpine mountains, a central flight canyon, and natural outer mountain barriers.
 */
export function getTerrainHeightAt(x: number, z: number): number {
  const scale1 = 0.0028;
  const scale2 = 0.0075;
  const scale3 = 0.021;

  const n1 = smoothNoise(x * scale1 + 11.3, z * scale1 + 47.1);
  const n2 = smoothNoise(x * scale2 - 23.7, z * scale2 + 19.4);
  const n3 = smoothNoise(x * scale3 + 5.2, z * scale3 - 31.8);

  // Ridged mountain factor
  const ridge = 1.0 - Math.abs(n1 * 2.0 - 1.0);
  const ridgeSharp = ridge * ridge;

  let height = ridgeSharp * 98 + (n2 - 0.45) * 38 + (n3 - 0.5) * 12 - 14;

  // Carve a dramatic winding flight canyon along the X=sin(Z) corridor
  const canyonCenterX = Math.sin(z * 0.0022) * 210 + Math.cos(z * 0.0009) * 140;
  const distToCanyon = Math.abs(x - canyonCenterX);
  const canyonFactor = Math.min(1, distToCanyon / 165);
  const smoothCanyon = canyonFactor * canyonFactor * (3 - 2 * canyonFactor);

  height = height * smoothCanyon - (1 - smoothCanyon) * 6.5;

  // Natural outer mountain perimeter barrier (no indoor walls)
  const distFromOrigin = Math.hypot(x, z);
  if (distFromOrigin > WORLD_RADIUS * 0.72) {
    const rimT = Math.min(1, (distFromOrigin - WORLD_RADIUS * 0.72) / (WORLD_RADIUS * 0.28));
    height += rimT * rimT * 155;
  }

  return height;
}

/**
 * Assigns expressive height-based and slope-based vertex colors for low-poly aesthetic.
 */
export function writeElevationColor(
  height: number,
  slope: number,
  jitter: number,
  target: THREE.Color
): void {
  const h = height + jitter * 2.5;

  if (h < -2.2) {
    // Deep river/lake bed
    target.setRGB(0.08, 0.24, 0.36);
  } else if (h < 2.8) {
    // Warm golden shoreline sand & gravel
    const t = (h + 2.2) / 5.0;
    target.setRGB(
      0.76 - t * 0.38,
      0.68 - t * 0.16,
      0.44 - t * 0.2
    );
  } else if (h < 28) {
    // Emerald & pine lowland meadows
    const t = (h - 2.8) / 25.2;
    if (slope > 0.58) {
      target.setRGB(0.28, 0.33, 0.38);
    } else {
      target.setRGB(
        0.16 + t * 0.12 + jitter * 0.03,
        0.48 - t * 0.08 + jitter * 0.04,
        0.24 - t * 0.04
      );
    }
  } else if (h < 56) {
    // Highland olive / amber ridge & rocky outcrops
    const t = (h - 28) / 28;
    if (slope > 0.52) {
      target.setRGB(0.32, 0.35, 0.41);
    } else {
      target.setRGB(
        0.34 + t * 0.12,
        0.42 - t * 0.06,
        0.28 + t * 0.14
      );
    }
  } else if (h < 82) {
    // Steep alpine slate & basalt cliffs
    const t = (h - 56) / 26;
    target.setRGB(
      0.42 + t * 0.28,
      0.45 + t * 0.28,
      0.51 + t * 0.27
    );
  } else {
    // High glacier snow-capped peaks
    const boost = Math.min(0.12, (h - 82) * 0.004);
    target.setRGB(
      0.88 + boost,
      0.91 + boost,
      0.96 + boost * 0.5
    );
  }
}

export function getBiomeNameAt(x: number, z: number, height: number): string {
  const dist = Math.hypot(x, z);
  if (dist > WORLD_RADIUS * 0.72) return 'Хребет Крайнего Рубежа';
  if (height > 78) return 'Ледниковые Пики Авроры';
  if (height > 44) return 'Базальтовое Нагорье';
  if (height < 3) return 'Каньон Лазурной Реки';
  return 'Изумрудная Долина Ветров';
}
