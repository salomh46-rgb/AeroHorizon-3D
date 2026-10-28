import * as THREE from 'three';
import { LIVERIES, LiveryId } from '../types/game';
import { getTerrainHeightAt, WATER_LEVEL, writeElevationColor } from './noise';

export interface AircraftRig {
  group: THREE.Group;
  exhaustCones: THREE.Mesh[];
  primaryMats: THREE.MeshStandardMaterial[];
  accentMats: THREE.MeshStandardMaterial[];
  setLivery: (liveryId: LiveryId) => void;
}

/**
 * Builds an 11-part composite low-poly supersonic jet aircraft (THREE.Group)
 * with varied roughness/metalness across primary, secondary, and accent parts.
 */
export function createAircraftGroup(
  liveryId: LiveryId = 'amber',
  isSoftwareGl: boolean = false
): AircraftRig {
  const spec = LIVERIES[liveryId] || LIVERIES.amber;
  const group = new THREE.Group();

  // Primary hull material (satin metallic)
  const hullMat = new THREE.MeshStandardMaterial({
    color: spec.primaryHex,
    roughness: 0.32,
    metalness: 0.65,
    flatShading: true,
  });

  // Secondary structural material (matte dark slate carbon)
  const secondaryMat = new THREE.MeshStandardMaterial({
    color: spec.secondaryHex,
    roughness: 0.65,
    metalness: 0.35,
    flatShading: true,
  });

  // Accent trim material (glossy anodized)
  const accentMat = new THREE.MeshStandardMaterial({
    color: spec.accentHex,
    roughness: 0.18,
    metalness: 0.82,
    emissive: spec.accentHex,
    emissiveIntensity: 0.2,
    flatShading: true,
  });

  // 1. Primary Sculpted Fuselage (ExtrudeGeometry)
  const hullShape = new THREE.Shape();
  hullShape.moveTo(0, 0.48);
  hullShape.lineTo(0.68, 0.12);
  hullShape.lineTo(0.52, -0.32);
  hullShape.lineTo(-0.52, -0.32);
  hullShape.lineTo(-0.68, 0.12);
  hullShape.closePath();

  const fuselageGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 4.4,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.16,
    bevelThickness: 0.4,
  });
  fuselageGeo.center();
  const fuselage = new THREE.Mesh(fuselageGeo, hullMat);
  fuselage.castShadow = true;
  fuselage.receiveShadow = true;
  group.add(fuselage);

  // 2. Nose Cone (6-sided low-poly cone pointing forward -Z)
  const noseGeo = new THREE.ConeGeometry(0.56, 2.3, 6);
  noseGeo.rotateX(-Math.PI / 2);
  noseGeo.translate(0, -0.02, -3.35);
  const noseMesh = new THREE.Mesh(noseGeo, secondaryMat);
  noseMesh.castShadow = true;
  group.add(noseMesh);

  // 3. Pitot Nose Needle (accent detail)
  const needleGeo = new THREE.CylinderGeometry(0.02, 0.05, 0.85, 6);
  needleGeo.rotateX(-Math.PI / 2);
  needleGeo.translate(0, -0.02, -4.75);
  const needleMesh = new THREE.Mesh(needleGeo, accentMat);
  group.add(needleMesh);

  // 4. Swept Main Delta Wings (ExtrudeGeometry)
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0.45, -1.2);
  wingShape.lineTo(4.6, 0.9);
  wingShape.lineTo(4.6, 1.75);
  wingShape.lineTo(0.45, 1.5);
  wingShape.closePath();

  const wingExtrudeSettings = {
    depth: 0.1,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.04,
    bevelThickness: 0.04,
  };

  const rightWingGeo = new THREE.ExtrudeGeometry(wingShape, wingExtrudeSettings);
  rightWingGeo.rotateX(Math.PI / 2);
  rightWingGeo.translate(0, 0.02, 0.2);
  const rightWing = new THREE.Mesh(rightWingGeo, hullMat);
  rightWing.castShadow = true;
  rightWing.receiveShadow = true;
  group.add(rightWing);

  const leftWing = rightWing.clone();
  leftWing.scale.x = -1;
  group.add(leftWing);

  // 5. Wingtip Vertical Winglets
  const wingletShape = new THREE.Shape();
  wingletShape.moveTo(0, 0);
  wingletShape.lineTo(0.95, 0);
  wingletShape.lineTo(0.55, 0.75);
  wingletShape.lineTo(0.15, 0.75);
  wingletShape.closePath();

  const wingletGeo = new THREE.ExtrudeGeometry(wingletShape, {
    depth: 0.06,
    bevelEnabled: false,
  });
  wingletGeo.rotateY(Math.PI / 2);

  const rightWinglet = new THREE.Mesh(wingletGeo, accentMat);
  rightWinglet.position.set(4.58, 0.0, 1.0);
  rightWinglet.rotation.z = -0.18;
  group.add(rightWinglet);

  const leftWinglet = new THREE.Mesh(wingletGeo, accentMat);
  leftWinglet.position.set(-4.52, 0.0, 1.0);
  leftWinglet.rotation.z = 0.18;
  group.add(leftWinglet);

  // 6. Twin Canted Tail Fins
  const tailShape = new THREE.Shape();
  tailShape.moveTo(0, 0);
  tailShape.lineTo(1.35, 0);
  tailShape.lineTo(0.75, 1.35);
  tailShape.lineTo(0.2, 1.35);
  tailShape.closePath();

  const tailGeo = new THREE.ExtrudeGeometry(tailShape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.02,
    bevelThickness: 0.02,
  });
  tailGeo.rotateY(Math.PI / 2);

  const rightTail = new THREE.Mesh(tailGeo, secondaryMat);
  rightTail.position.set(0.52, 0.25, 1.15);
  rightTail.rotation.z = -0.32;
  rightTail.castShadow = true;
  group.add(rightTail);

  const leftTail = new THREE.Mesh(tailGeo, secondaryMat);
  leftTail.position.set(-0.44, 0.25, 1.15);
  leftTail.rotation.z = 0.32;
  leftTail.castShadow = true;
  group.add(leftTail);

  // 7. Cockpit Canopy (MeshPhysicalMaterial optical glass)
  const canopyGeo = new THREE.CapsuleGeometry(0.38, 1.35, 4, 8);
  canopyGeo.rotateX(Math.PI / 2);
  canopyGeo.scale(1, 0.72, 1);
  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    roughness: 0.12,
    metalness: 0.1,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    transmission: isSoftwareGl ? 0 : 0.78,
    transparent: true,
    opacity: isSoftwareGl ? 0.65 : 0.92,
    depthWrite: false,
  });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.set(0, 0.42, -0.85);
  canopy.renderOrder = 2;
  group.add(canopy);

  // 8. Pilot Helmet inside cockpit
  const helmetGeo = new THREE.DodecahedronGeometry(0.22, 0);
  const helmetMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.25,
    metalness: 0.5,
  });
  const helmet = new THREE.Mesh(helmetGeo, helmetMat);
  helmet.position.set(0, 0.44, -0.7);
  group.add(helmet);

  // 9. Twin Engine Nacelles
  const nacelleGeo = new THREE.CylinderGeometry(0.28, 0.32, 2.2, 6);
  nacelleGeo.rotateX(Math.PI / 2);

  const leftNacelle = new THREE.Mesh(nacelleGeo, secondaryMat);
  leftNacelle.position.set(-0.42, -0.06, 1.35);
  group.add(leftNacelle);

  const rightNacelle = new THREE.Mesh(nacelleGeo, secondaryMat);
  rightNacelle.position.set(0.42, -0.06, 1.35);
  group.add(rightNacelle);

  // 10. Twin Afterburner Exhaust Cones (Dynamic scale & glow)
  const exhaustGeo = new THREE.ConeGeometry(0.24, 1.45, 6);
  exhaustGeo.rotateX(Math.PI / 2);
  exhaustGeo.translate(0, 0, 0.7);

  const exhaustMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.88,
  });

  const leftExhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
  leftExhaust.position.set(-0.42, -0.06, 2.42);
  group.add(leftExhaust);

  const rightExhaust = new THREE.Mesh(exhaustGeo, exhaustMat.clone());
  rightExhaust.position.set(0.42, -0.06, 2.42);
  group.add(rightExhaust);

  // 11. Port (Red) and Starboard (Green) Navigation Lights
  const navGeo = new THREE.OctahedronGeometry(0.11, 0);
  const portLight = new THREE.Mesh(
    navGeo,
    new THREE.MeshBasicMaterial({ color: 0xef4444 })
  );
  portLight.position.set(-4.62, 0.05, 1.65);
  group.add(portLight);

  const starboardLight = new THREE.Mesh(
    navGeo,
    new THREE.MeshBasicMaterial({ color: 0x10b981 })
  );
  starboardLight.position.set(4.62, 0.05, 1.65);
  group.add(starboardLight);

  const primaryMats = [hullMat];
  const accentMats = [accentMat];

  return {
    group,
    exhaustCones: [leftExhaust, rightExhaust],
    primaryMats,
    accentMats,
    setLivery(newLiveryId: LiveryId) {
      const s = LIVERIES[newLiveryId] || LIVERIES.amber;
      hullMat.color.setHex(s.primaryHex);
      secondaryMat.color.setHex(s.secondaryHex);
      accentMat.color.setHex(s.accentHex);
      accentMat.emissive.setHex(s.accentHex);
    },
  };
}

export interface TerrainRig {
  terrainMesh: THREE.Mesh;
  wireframeOverlay: THREE.LineSegments;
  waterMesh: THREE.Mesh;
  setWireframeMode: (enabled: boolean) => void;
}

/**
 * Generates the low-poly faceted 3D terrain with height-based vertex colors
 * and a dedicated topological wireframe overlay.
 */
export function createLowPolyTerrain(size: number = 3600, segments: number = 140): TerrainRig {
  const basePlane = new THREE.PlaneGeometry(size, size, segments, segments);
  basePlane.rotateX(-Math.PI / 2);

  // Displace vertices on indexed geometry first so adjacent triangles share vertices
  const posAttr = basePlane.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = getTerrainHeightAt(vx, vz);
    posAttr.setY(i, vy);
  }

  // Convert to non-indexed geometry for crisp low-poly faceted triangles and per-face coloring
  const facetedGeo = basePlane.toNonIndexed();
  facetedGeo.computeVertexNormals();

  const fPos = facetedGeo.attributes.position;
  const fNorm = facetedGeo.attributes.normal;
  const colors = new Float32Array(fPos.count * 3);
  const tmpColor = new THREE.Color();

  // Color each triangle uniformly based on its centroid height & normal slope
  for (let i = 0; i < fPos.count; i += 3) {
    const avgY = (fPos.getY(i) + fPos.getY(i + 1) + fPos.getY(i + 2)) / 3;
    const avgX = (fPos.getX(i) + fPos.getX(i + 1) + fPos.getX(i + 2)) / 3;
    const avgZ = (fPos.getZ(i) + fPos.getZ(i + 1) + fPos.getZ(i + 2)) / 3;
    const ny = Math.abs(fNorm.getY(i));
    const slope = 1.0 - ny;

    // Deterministic per-triangle organic tint jitter
    const jitter = Math.sin(avgX * 0.13 + avgZ * 0.17) * 0.5;
    writeElevationColor(avgY, slope, jitter, tmpColor);

    for (let k = 0; k < 3; k++) {
      const idx = (i + k) * 3;
      colors[idx] = tmpColor.r;
      colors[idx + 1] = tmpColor.g;
      colors[idx + 2] = tmpColor.b;
    }
  }

  facetedGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
    metalness: 0.06,
    flatShading: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });

  const terrainMesh = new THREE.Mesh(facetedGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = false;

  // Dedicated wireframe overlay on the indexed geometry for crisp topological lines
  const wireGeo = new THREE.WireframeGeometry(basePlane);
  const wireMat = new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.55,
  });
  const wireframeOverlay = new THREE.LineSegments(wireGeo, wireMat);
  wireframeOverlay.visible = false;

  // Low-poly canyon water plane
  const waterGeo = new THREE.PlaneGeometry(size, size, 24, 24);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.18,
    metalness: 0.72,
    transparent: true,
    opacity: 0.84,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = WATER_LEVEL;
  waterMesh.receiveShadow = true;

  return {
    terrainMesh,
    wireframeOverlay,
    waterMesh,
    setWireframeMode(enabled: boolean) {
      wireframeOverlay.visible = enabled;
      terrainMat.roughness = enabled ? 0.92 : 0.82;
    },
  };
}

/**
 * Populates the terrain with InstancedMesh pine trees and alpine boulders
 * grounded strictly at getTerrainHeightAt(x, z) with bottom-center pivots.
 */
export function createInstancedScenery(scene: THREE.Scene) {
  const treeCount = 420;
  const rockCount = 200;

  // Tree Trunk Geometry (bottom-center pivot at y=0)
  const trunkGeo = new THREE.CylinderGeometry(0.45, 0.7, 3.2, 5);
  trunkGeo.translate(0, 1.6, 0);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x5c4033,
    roughness: 0.9,
    metalness: 0.05,
    flatShading: true,
  });

  // Tree Foliage Geometry (Cone with bottom-center pivot sitting above trunk)
  const foliageGeo = new THREE.ConeGeometry(3.2, 8.8, 6);
  foliageGeo.translate(0, 6.8, 0);
  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, // Tinted via setColorAt
    roughness: 0.78,
    metalness: 0.05,
    flatShading: true,
  });

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const foliageInst = new THREE.InstancedMesh(foliageGeo, foliageMat, treeCount);
  trunkInst.castShadow = true;
  foliageInst.castShadow = true;
  foliageInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  let placedTrees = 0;
  let seed = 1337;
  const nextRand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let attempt = 0; attempt < 1600 && placedTrees < treeCount; attempt++) {
    const x = (nextRand() - 0.5) * 2500;
    const z = (nextRand() - 0.5) * 2500;
    const y = getTerrainHeightAt(x, z);

    // Place trees only on lowland/midland meadows above water and below alpine snowline
    if (y > 4.0 && y < 44.0) {
      const scale = 0.85 + nextRand() * 0.45;
      dummy.position.set(x, y - 0.15, z);
      dummy.rotation.set(0, nextRand() * Math.PI * 2, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();

      trunkInst.setMatrixAt(placedTrees, dummy.matrix);
      foliageInst.setMatrixAt(placedTrees, dummy.matrix);

      // Subtle emerald / pine color variation
      color.setHSL(0.36 + (nextRand() - 0.5) * 0.06, 0.52, 0.24 + nextRand() * 0.12);
      foliageInst.setColorAt(placedTrees, color);
      placedTrees++;
    }
  }

  trunkInst.count = placedTrees;
  foliageInst.count = placedTrees;
  trunkInst.instanceMatrix.needsUpdate = true;
  foliageInst.instanceMatrix.needsUpdate = true;
  if (foliageInst.instanceColor) foliageInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  foliageInst.computeBoundingSphere();

  scene.add(trunkInst);
  scene.add(foliageInst);

  // Alpine Boulders (Dodecahedron grounded at y=0)
  const rockGeo = new THREE.DodecahedronGeometry(2.6, 0);
  rockGeo.translate(0, 1.4, 0);
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.12,
    flatShading: true,
  });
  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rockInst.castShadow = true;
  rockInst.receiveShadow = true;

  let placedRocks = 0;
  for (let attempt = 0; attempt < 800 && placedRocks < rockCount; attempt++) {
    const x = (nextRand() - 0.5) * 2600;
    const z = (nextRand() - 0.5) * 2600;
    const y = getTerrainHeightAt(x, z);

    if (y > 1.5 && y < 78) {
      const s = 0.7 + nextRand() * 1.4;
      dummy.position.set(x, y - 0.3, z);
      dummy.rotation.set(nextRand() * 0.4, nextRand() * Math.PI * 2, nextRand() * 0.4);
      dummy.scale.set(s, s * (0.65 + nextRand() * 0.5), s);
      dummy.updateMatrix();
      rockInst.setMatrixAt(placedRocks, dummy.matrix);

      const shade = 0.35 + nextRand() * 0.22;
      color.setRGB(shade, shade * 1.03, shade * 1.08);
      rockInst.setColorAt(placedRocks, color);
      placedRocks++;
    }
  }

  rockInst.count = placedRocks;
  rockInst.instanceMatrix.needsUpdate = true;
  if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
  rockInst.computeBoundingSphere();
  scene.add(rockInst);
}

/**
 * Builds a composite 5-part glowing aerial checkpoint ring gate.
 */
export function createCheckpointGate(): {
  group: THREE.Group;
  outerRing: THREE.Mesh;
  innerRing: THREE.Mesh;
} {
  const group = new THREE.Group();

  // 1. Outer Structural Octagonal Frame
  const outerGeo = new THREE.TorusGeometry(13.5, 0.85, 6, 8);
  const outerMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.3,
    metalness: 0.8,
    flatShading: true,
  });
  const outerRing = new THREE.Mesh(outerGeo, outerMat);
  group.add(outerRing);

  // 2. Inner Glowing Energy Core
  const innerGeo = new THREE.TorusGeometry(11.8, 0.42, 6, 16);
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
  });
  const innerRing = new THREE.Mesh(innerGeo, innerMat);
  group.add(innerRing);

  // 3. 4 Cardinal Chevron Fin Markers around the perimeter
  const finGeo = new THREE.ConeGeometry(1.3, 3.4, 4);
  const finMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.6,
    roughness: 0.2,
    metalness: 0.7,
  });

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const fin = new THREE.Mesh(finGeo, finMat);
    fin.position.set(Math.cos(angle) * 14.8, Math.sin(angle) * 14.8, 0);
    fin.rotation.z = angle + Math.PI / 2;
    group.add(fin);
  }

  return { group, outerRing, innerRing };
}

/**
 * Builds an aerial storm drone hazard with a visible pulsing telegraph ring.
 */
export function createStormHazardDrone(): {
  group: THREE.Group;
  telegraphRing: THREE.Mesh;
  coreMesh: THREE.Mesh;
} {
  const group = new THREE.Group();

  const coreGeo = new THREE.OctahedronGeometry(3.2, 0);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0x991b1b,
    emissiveIntensity: 0.8,
    roughness: 0.25,
    metalness: 0.75,
    flatShading: true,
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  group.add(coreMesh);

  const shieldGeo = new THREE.TorusGeometry(5.2, 0.35, 5, 12);
  const shieldMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.3,
    metalness: 0.85,
  });
  const shield = new THREE.Mesh(shieldGeo, shieldMat);
  group.add(shield);

  // Telegraph windup ring so the player sees the hazard range clearly
  const teleGeo = new THREE.RingGeometry(8.5, 9.6, 20);
  const teleMat = new THREE.MeshBasicMaterial({
    color: 0xf43f5e,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.55,
  });
  const telegraphRing = new THREE.Mesh(teleGeo, teleMat);
  group.add(telegraphRing);

  return { group, telegraphRing, coreMesh };
}
