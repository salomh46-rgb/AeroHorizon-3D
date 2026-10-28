import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CameraMode,
  DifficultyMode,
  FlightTelemetry,
  GameScreenState,
  LiveryId,
  RemotePilot,
  WeatherMode,
} from '../types/game';
import {
  getBiomeNameAt,
  getTerrainHeightAt,
  WATER_LEVEL,
  WORLD_RADIUS,
} from '../three/noise';
import {
  AircraftRig,
  createAircraftGroup,
  createCheckpointGate,
  createInstancedScenery,
  createLowPolyTerrain,
  createStormHazardDrone,
} from '../three/models';
import { soundEngine } from '../audio/soundEngine';

// Reusable module-scope math objects (Zero GC in render loop)
const _forward = new THREE.Vector3();
const _camOffset = new THREE.Vector3();
const _camTargetPos = new THREE.Vector3();
const _lookAtTarget = new THREE.Vector3();
const _currentLookAt = new THREE.Vector3(0, 50, -30);
const _ringDir = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

export interface TutorialProgressFlags {
  adjustedThrottle: boolean;
  steeredAircraft: boolean;
  toggledModeOrCamera: boolean;
  passedFirstRing: boolean;
}

interface FlightCanvasProps {
  screenState: GameScreenState;
  cameraMode: CameraMode;
  weather: WeatherMode;
  wireframe: boolean;
  isNight: boolean;
  difficulty: DifficultyMode;
  livery: LiveryId;
  remotePilots: RemotePilot[];
  resetSignal: number;
  onTelemetryUpdate: (telemetry: FlightTelemetry) => void;
  onRingCollected: (newCombo: number, altitudeAboveGround: number, isNight: boolean, isWireframe: boolean) => void;
  onCrashGameOver: () => void;
  onToggleCamera: () => void;
  onToggleWeather: () => void;
  onToggleWireframe: () => void;
  onToggleNight: () => void;
  onTogglePause: () => void;
  onTutorialStep: (flags: Partial<TutorialProgressFlags>) => void;
  onBroadcastLocalState: (state: {
    x: number;
    y: number;
    z: number;
    pitch: number;
    yaw: number;
    roll: number;
    speed: number;
    platform: 'PC' | 'Gamepad' | 'Web';
  }) => void;
}

interface PooledParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

export const FlightCanvas: React.FC<FlightCanvasProps> = ({
  screenState,
  cameraMode,
  weather,
  wireframe,
  isNight,
  difficulty,
  livery,
  remotePilots,
  resetSignal,
  onTelemetryUpdate,
  onRingCollected,
  onCrashGameOver,
  onToggleCamera,
  onToggleWeather,
  onToggleWireframe,
  onToggleNight,
  onTogglePause,
  onTutorialStep,
  onBroadcastLocalState,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  // Store latest props in refs so the WebGL loop never restarts on React state updates
  const propsRef = useRef({
    screenState,
    cameraMode,
    weather,
    wireframe,
    isNight,
    difficulty,
    livery,
    remotePilots,
    onTelemetryUpdate,
    onRingCollected,
    onCrashGameOver,
    onToggleCamera,
    onToggleWeather,
    onToggleWireframe,
    onToggleNight,
    onTogglePause,
    onTutorialStep,
    onBroadcastLocalState,
  });

  useEffect(() => {
    propsRef.current = {
      screenState,
      cameraMode,
      weather,
      wireframe,
      isNight,
      difficulty,
      livery,
      remotePilots,
      onTelemetryUpdate,
      onRingCollected,
      onCrashGameOver,
      onToggleCamera,
      onToggleWeather,
      onToggleWireframe,
      onToggleNight,
      onTogglePause,
      onTutorialStep,
      onBroadcastLocalState,
    };
  });

  const sceneApiRef = useRef<{
    setWireframe: (v: boolean) => void;
    setLivery: (l: LiveryId) => void;
    resetFlight: () => void;
  } | null>(null);

  useEffect(() => {
    sceneApiRef.current?.setWireframe(wireframe);
  }, [wireframe]);

  useEffect(() => {
    sceneApiRef.current?.setLivery(livery);
  }, [livery]);

  useEffect(() => {
    if (resetSignal > 0) {
      sceneApiRef.current?.resetFlight();
    }
  }, [resetSignal]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Detect Software WebGL (SwiftShader / llvmpipe) per Three.js skill directive
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // 2. Mandatory Studio Environment Reflection (RoomEnvironment + PMREMGenerator)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const daySkyColor = new THREE.Color(0x7dd3fc);
    const nightSkyColor = new THREE.Color(0x060b19);
    const rainDaySkyColor = new THREE.Color(0x475569);
    const rainNightSkyColor = new THREE.Color(0x090f1d);
    const snowDaySkyColor = new THREE.Color(0xcbd5e1);
    const snowNightSkyColor = new THREE.Color(0x0f172a);
    const fogDaySkyColor = new THREE.Color(0x94a3b8);
    const fogNightSkyColor = new THREE.Color(0x0b1324);

    const currentSkyColor = new THREE.Color().copy(
      propsRef.current.isNight ? nightSkyColor : daySkyColor
    );

    scene.background = currentSkyColor;
    const fog = new THREE.FogExp2(currentSkyColor.getHex(), 0.00085);
    scene.fog = fog;

    const camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.5,
      2600
    );

    // 3. Balanced 3-Point Studio & Outdoor Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x334155, 0.85);
    hemiLight.position.set(0, 300, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.85);
    sunLight.position.set(260, 420, 180);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    const d = 160;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 900;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);
    scene.add(sunLight.target);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
    rimLight.position.set(-200, 140, -250);
    scene.add(rimLight);

    // Night Starfield Dome
    const starCount = 900;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.85 + 0.15);
      const r = 1950;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xf8fafc,
      size: 3.5,
      sizeAttenuation: false,
      transparent: true,
      opacity: propsRef.current.isNight ? 0.9 : 0,
    });
    const starPoints = new THREE.Points(starGeo, starMat);
    scene.add(starPoints);

    // 3B. Procedural Weather Precipitation Systems (Light Snow & Rain Streaks)
    const WEATHER_BOX_XZ = 140;
    const WEATHER_BOX_Y = 80;

    // Light Snow Particle Cloud (THREE.Points)
    const SNOW_COUNT = 650;
    const snowGeo = new THREE.BufferGeometry();
    const snowPositions = new Float32Array(SNOW_COUNT * 3);
    const snowPhases = new Float32Array(SNOW_COUNT);
    for (let i = 0; i < SNOW_COUNT; i++) {
      snowPositions[i * 3] = (Math.random() - 0.5) * WEATHER_BOX_XZ;
      snowPositions[i * 3 + 1] = (Math.random() - 0.5) * WEATHER_BOX_Y;
      snowPositions[i * 3 + 2] = (Math.random() - 0.5) * WEATHER_BOX_XZ;
      snowPhases[i] = Math.random() * Math.PI * 2;
    }
    const snowPosAttr = new THREE.BufferAttribute(snowPositions, 3);
    snowGeo.setAttribute('position', snowPosAttr);
    const snowMat = new THREE.PointsMaterial({
      color: 0xf8fafc,
      size: 0.75,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const snowSystem = new THREE.Points(snowGeo, snowMat);
    snowSystem.frustumCulled = false;
    snowSystem.visible = false;
    scene.add(snowSystem);

    // Rain Streak System (THREE.LineSegments)
    const RAIN_COUNT = 520;
    const rainGeo = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(RAIN_COUNT * 6); // 2 vertices per rain streak
    const rainOffsets = new Float32Array(RAIN_COUNT * 3);
    for (let i = 0; i < RAIN_COUNT; i++) {
      const rx = (Math.random() - 0.5) * WEATHER_BOX_XZ;
      const ry = (Math.random() - 0.5) * WEATHER_BOX_Y;
      const rz = (Math.random() - 0.5) * WEATHER_BOX_XZ;
      rainOffsets[i * 3] = rx;
      rainOffsets[i * 3 + 1] = ry;
      rainOffsets[i * 3 + 2] = rz;

      const idx6 = i * 6;
      rainPositions[idx6] = rx;
      rainPositions[idx6 + 1] = ry;
      rainPositions[idx6 + 2] = rz;
      rainPositions[idx6 + 3] = rx - 0.45;
      rainPositions[idx6 + 4] = ry - 3.2;
      rainPositions[idx6 + 5] = rz - 0.35;
    }
    const rainPosAttr = new THREE.BufferAttribute(rainPositions, 3);
    rainGeo.setAttribute('position', rainPosAttr);
    const rainMat = new THREE.LineBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    const rainSystem = new THREE.LineSegments(rainGeo, rainMat);
    rainSystem.frustumCulled = false;
    rainSystem.visible = false;
    scene.add(rainSystem);

    // 4. Low-Poly Terrain, Water, and Instanced Forest/Rocks
    const terrainRig = createLowPolyTerrain(3600, 140);
    terrainRig.setWireframeMode(propsRef.current.wireframe);
    scene.add(terrainRig.terrainMesh);
    scene.add(terrainRig.wireframeOverlay);
    scene.add(terrainRig.waterMesh);

    createInstancedScenery(scene);

    // 5. Player Composite Aircraft Rig
    const playerRig: AircraftRig = createAircraftGroup(
      propsRef.current.livery,
      isSoftwareGl
    );
    scene.add(playerRig.group);

    // Cockpit Spotlight for night flying
    const noseSpotLight = new THREE.SpotLight(0x38bdf8, 0, 260, Math.PI / 5, 0.5, 1.4);
    noseSpotLight.position.set(0, 0, -4.5);
    noseSpotLight.target.position.set(0, -2, -45);
    playerRig.group.add(noseSpotLight);
    playerRig.group.add(noseSpotLight.target);

    // 6. Aerial Checkpoint Rings (Chain of 12 gates along the canyon & mountain valleys)
    const RING_COUNT = 12;
    const rings: {
      group: THREE.Group;
      outerRing: THREE.Mesh;
      innerRing: THREE.Mesh;
      active: boolean;
    }[] = [];

    function placeRingAtIndex(idx: number, zBase: number) {
      const z = zBase - idx * 240;
      const x = Math.sin(z * 0.0022) * 195 + Math.cos(idx * 1.4) * 65;
      const groundH = Math.max(WATER_LEVEL, getTerrainHeightAt(x, z));
      const y = groundH + 34 + (idx % 3) * 16;
      rings[idx].group.position.set(x, y, z);
      rings[idx].group.rotation.y = Math.cos(z * 0.0022) * 0.35;
      rings[idx].active = true;
    }

    for (let i = 0; i < RING_COUNT; i++) {
      const gate = createCheckpointGate();
      scene.add(gate.group);
      rings.push({ ...gate, active: true });
      placeRingAtIndex(i, -180);
    }
    let activeRingIndex = 0;

    // 7. Aerial Storm Drone Hazards with visible telegraph windup rings
    const HAZARD_COUNT = 8;
    const hazards: {
      group: THREE.Group;
      telegraphRing: THREE.Mesh;
      coreMesh: THREE.Mesh;
      baseX: number;
      baseY: number;
      baseZ: number;
      phase: number;
    }[] = [];

    for (let i = 0; i < HAZARD_COUNT; i++) {
      const hz = createStormHazardDrone();
      const z = -310 - i * 310;
      const x = Math.sin(z * 0.0022) * 170 + (i % 2 === 0 ? 38 : -38);
      const y = Math.max(WATER_LEVEL, getTerrainHeightAt(x, z)) + 44;
      hz.group.position.set(x, y, z);
      scene.add(hz.group);
      hazards.push({
        ...hz,
        baseX: x,
        baseY: y,
        baseZ: z,
        phase: i * 1.1,
      });
    }

    // 8. Pooled 3D Burst Particles (Ring collect & collision sparks)
    const PARTICLE_POOL_SIZE = 36;
    const particleGeo = new THREE.OctahedronGeometry(0.45, 0);
    const particlePool: PooledParticle[] = [];
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const pMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0,
      });
      const pMesh = new THREE.Mesh(particleGeo, pMat);
      pMesh.visible = false;
      scene.add(pMesh);
      particlePool.push({
        mesh: pMesh,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.6,
      });
    }

    function spawnParticleBurst(pos: THREE.Vector3, hexColor: number, count: number = 14) {
      let spawned = 0;
      for (let i = 0; i < particlePool.length && spawned < count; i++) {
        const p = particlePool[i];
        if (p.life <= 0) {
          p.mesh.position.copy(pos);
          (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(hexColor);
          (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
          p.mesh.visible = true;
          const speed = 12 + Math.random() * 26;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.random() * Math.PI;
          p.vx = Math.sin(phi) * Math.cos(theta) * speed;
          p.vy = Math.cos(phi) * speed + 6;
          p.vz = Math.sin(phi) * Math.sin(theta) * speed;
          p.maxLife = 0.45 + Math.random() * 0.35;
          p.life = p.maxLife;
          spawned++;
        }
      }
    }

    // 9. Remote Multiplayer Aircraft Pool
    const remoteMeshes = new Map<
      string,
      {
        rig: AircraftRig;
        livery: LiveryId;
      }
    >();

    // Pre-compile shaders on hardware WebGL
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 10. Flight Simulation State
    const flight = {
      x: 0,
      y: 68,
      z: 60,
      pitch: 0,
      yaw: 0,
      roll: 0,
      speedKmh: 210,
      throttlePct: 58,
      boostPct: 100,
      hullPct: 100,
      score: 0,
      combo: 0,
      ringsCollected: 0,
      shakeIntensity: 0,
      hitstopRemaining: 0,
      collisionCooldown: 0,
      mouseNormX: 0,
      mouseNormY: 0,
      mouseSteeringActive: false,
      lastNetworkSend: 0,
      lastTelemetryEmit: 0,
      prevGamepadButtons: [] as boolean[],
    };

    function resetFlightState() {
      flight.x = 0;
      flight.y = 68;
      flight.z = 60;
      flight.pitch = 0;
      flight.yaw = 0;
      flight.roll = 0;
      flight.speedKmh = 210;
      flight.throttlePct = 58;
      flight.boostPct = 100;
      flight.hullPct = 100;
      flight.score = 0;
      flight.combo = 0;
      flight.ringsCollected = 0;
      flight.shakeIntensity = 0;
      flight.hitstopRemaining = 0;
      flight.collisionCooldown = 0;
      flight.mouseNormX = 0;
      flight.mouseNormY = 0;

      activeRingIndex = 0;
      for (let i = 0; i < RING_COUNT; i++) {
        placeRingAtIndex(i, -180);
      }

      playerRig.group.position.set(flight.x, flight.y, flight.z);
      playerRig.group.rotation.set(0, 0, 0);
    }

    resetFlightState();

    sceneApiRef.current = {
      setWireframe: (enabled: boolean) => {
        terrainRig.setWireframeMode(enabled);
      },
      setLivery: (newLivery: LiveryId) => {
        playerRig.setLivery(newLivery);
      },
      resetFlight: resetFlightState,
    };

    // 11. Keyboard & Mouse Input Listeners
    const heldKeys = new Set<string>();

    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore keyboard shortcuts if typing in an input or chat box
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const code = e.code;
      heldKeys.add(code);

      if (code === 'KeyC') {
        propsRef.current.onToggleCamera();
        propsRef.current.onTutorialStep({ toggledModeOrCamera: true });
      } else if (code === 'KeyG') {
        propsRef.current.onToggleWeather();
        propsRef.current.onTutorialStep({ toggledModeOrCamera: true });
      } else if (code === 'KeyV' || code === 'KeyK') {
        propsRef.current.onToggleWireframe();
        propsRef.current.onTutorialStep({ toggledModeOrCamera: true });
      } else if (code === 'KeyN' || code === 'KeyL') {
        propsRef.current.onToggleNight();
        propsRef.current.onTutorialStep({ toggledModeOrCamera: true });
      } else if (code === 'Escape') {
        propsRef.current.onTogglePause();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldKeys.delete(e.code);
    };

    const onWindowBlur = () => {
      heldKeys.clear();
    };

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('resize', onResize);

    // 12. Paced Render Loop (GPU rAF vs Software WebGL fenceSync afterDraw)
    let frameId = 0;
    let isDisposed = false;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (isDisposed) return;

      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05); // Clamped frame delta per game guidelines
      const elapsed = clock.getElapsedTime();
      const currentProps = propsRef.current;
      const activeWeather = currentProps.weather;

      // 12A. Procedural Weather Visual Aesthetics (Sky, Fog, Lighting, Surface Wetness/Frost & Precipitation)
      let targetSky = currentProps.isNight ? nightSkyColor : daySkyColor;
      let targetFogDensity = 0.00085;
      let targetSunIntensity = currentProps.isNight ? 0.32 : 1.85;
      let targetHemiIntensity = currentProps.isNight ? 0.28 : 0.85;
      let targetTerrainRoughness = currentProps.wireframe ? 0.92 : 0.82;
      let targetTerrainMetalness = 0.06;

      if (activeWeather === 'rain') {
        targetSky = currentProps.isNight ? rainNightSkyColor : rainDaySkyColor;
        targetFogDensity = 0.00185;
        targetSunIntensity = currentProps.isNight ? 0.22 : 0.95;
        // Occasional storm lightning flash in rain mode
        const flashSpike = Math.sin(elapsed * 7.3) * Math.sin(elapsed * 19.1) > 0.92 ? 0.85 : 0;
        targetHemiIntensity = (currentProps.isNight ? 0.25 : 0.65) + flashSpike;
        targetTerrainRoughness = 0.38; // Wet glossy surface
        targetTerrainMetalness = 0.24;
      } else if (activeWeather === 'snow') {
        targetSky = currentProps.isNight ? snowNightSkyColor : snowDaySkyColor;
        targetFogDensity = 0.00145;
        targetSunIntensity = currentProps.isNight ? 0.3 : 1.35;
        targetHemiIntensity = currentProps.isNight ? 0.35 : 0.95;
        targetTerrainRoughness = 0.68; // Frosted sheen
        targetTerrainMetalness = 0.12;
      } else if (activeWeather === 'fog') {
        targetSky = currentProps.isNight ? fogNightSkyColor : fogDaySkyColor;
        targetFogDensity = 0.0036;
        targetSunIntensity = currentProps.isNight ? 0.18 : 0.72;
        targetHemiIntensity = currentProps.isNight ? 0.24 : 0.68;
      }

      currentSkyColor.lerp(targetSky, 1 - Math.exp(-3.5 * dt));
      fog.color.copy(currentSkyColor);
      fog.density = THREE.MathUtils.damp(fog.density, targetFogDensity, 3.0, dt);

      const terrainMat = terrainRig.terrainMesh.material as THREE.MeshStandardMaterial;
      terrainMat.roughness = THREE.MathUtils.damp(
        terrainMat.roughness,
        targetTerrainRoughness,
        3.0,
        dt
      );
      terrainMat.metalness = THREE.MathUtils.damp(
        terrainMat.metalness,
        targetTerrainMetalness,
        3.0,
        dt
      );

      sunLight.intensity = THREE.MathUtils.damp(
        sunLight.intensity,
        targetSunIntensity,
        4,
        dt
      );
      sunLight.color.setHex(currentProps.isNight ? 0x818cf8 : 0xfffbeb);
      hemiLight.intensity = THREE.MathUtils.damp(
        hemiLight.intensity,
        targetHemiIntensity,
        6,
        dt
      );
      starMat.opacity = THREE.MathUtils.damp(
        starMat.opacity,
        currentProps.isNight && activeWeather === 'clear' ? 0.92 : currentProps.isNight ? 0.25 : 0,
        4,
        dt
      );
      // Turn on nose spotlight at night or in heavy fog/rain
      noseSpotLight.intensity =
        currentProps.isNight || activeWeather === 'fog' || activeWeather === 'rain'
          ? 5.0
          : 0;

      // Animate 3D Snow or Rain around the player aircraft/camera
      snowSystem.visible = activeWeather === 'snow';
      rainSystem.visible = activeWeather === 'rain';

      if (activeWeather === 'snow') {
        snowSystem.position.copy(playerRig.group.position);
        const sArr = snowPosAttr.array as Float32Array;
        const halfXZ = WEATHER_BOX_XZ * 0.5;
        const halfY = WEATHER_BOX_Y * 0.5;
        for (let i = 0; i < SNOW_COUNT; i++) {
          const idx = i * 3;
          sArr[idx] += Math.sin(elapsed * 1.6 + snowPhases[i]) * 4.5 * dt;
          sArr[idx + 1] -= 11.5 * dt;
          sArr[idx + 2] += 18.0 * dt; // Relative motion as jet flies forward

          if (sArr[idx + 1] < -halfY) sArr[idx + 1] = halfY;
          if (sArr[idx + 2] > halfXZ) sArr[idx + 2] = -halfXZ;
          if (sArr[idx] > halfXZ) sArr[idx] = -halfXZ;
          if (sArr[idx] < -halfXZ) sArr[idx] = halfXZ;
        }
        snowPosAttr.needsUpdate = true;
      } else if (activeWeather === 'rain') {
        rainSystem.position.copy(playerRig.group.position);
        const rArr = rainPosAttr.array as Float32Array;
        const halfXZ = WEATHER_BOX_XZ * 0.5;
        const halfY = WEATHER_BOX_Y * 0.5;
        for (let i = 0; i < RAIN_COUNT; i++) {
          const oIdx = i * 3;
          let rx = rainOffsets[oIdx] - 8.5 * dt;
          let ry = rainOffsets[oIdx + 1] - 58.0 * dt;
          let rz = rainOffsets[oIdx + 2] + 32.0 * dt;

          if (ry < -halfY) ry = halfY;
          if (rz > halfXZ) rz = -halfXZ;
          if (rx < -halfXZ) rx = halfXZ;

          rainOffsets[oIdx] = rx;
          rainOffsets[oIdx + 1] = ry;
          rainOffsets[oIdx + 2] = rz;

          const idx6 = i * 6;
          rArr[idx6] = rx;
          rArr[idx6 + 1] = ry;
          rArr[idx6 + 2] = rz;
          rArr[idx6 + 3] = rx - 0.55;
          rArr[idx6 + 4] = ry - 3.6;
          rArr[idx6 + 5] = rz + 1.1;
        }
        rainPosAttr.needsUpdate = true;
      }

      // Poll Gamepad API
      let gpPitch = 0;
      let gpRoll = 0;
      let gpYaw = 0;
      let gpThrottleDelta = 0;
      let gpBoost = false;
      let gpBrake = false;
      let gamepadConnected = false;
      let gamepadName = '';

      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const activeGp = gamepads[0] || gamepads[1] || gamepads[2] || gamepads[3];
      if (activeGp && activeGp.connected) {
        gamepadConnected = true;
        gamepadName = activeGp.id.split('(')[0].trim() || 'Gamepad';

        const applyDeadzone = (v: number) => (Math.abs(v) < 0.14 ? 0 : v);
        gpRoll = applyDeadzone(activeGp.axes[0] || 0);
        gpPitch = applyDeadzone(activeGp.axes[1] || 0);
        gpYaw = applyDeadzone(activeGp.axes[2] || 0);

        const rt = activeGp.buttons[7]?.value || 0;
        const lt = activeGp.buttons[6]?.value || 0;
        gpThrottleDelta = rt - lt;
        gpBoost = Boolean(activeGp.buttons[0]?.pressed || activeGp.buttons[5]?.pressed);
        gpBrake = Boolean(activeGp.buttons[1]?.pressed || activeGp.buttons[4]?.pressed);

        // Edge-triggered gamepad buttons: Y (3) = Camera, X (2) = Wireframe, Select/Back (8) = Night
        const b2 = Boolean(activeGp.buttons[2]?.pressed);
        const b3 = Boolean(activeGp.buttons[3]?.pressed);
        const b8 = Boolean(activeGp.buttons[8]?.pressed);
        const b9 = Boolean(activeGp.buttons[9]?.pressed);

        if (b3 && !flight.prevGamepadButtons[3]) {
          currentProps.onToggleCamera();
          currentProps.onTutorialStep({ toggledModeOrCamera: true });
        }
        if (b2 && !flight.prevGamepadButtons[2]) {
          currentProps.onToggleWireframe();
          currentProps.onTutorialStep({ toggledModeOrCamera: true });
        }
        if (b8 && !flight.prevGamepadButtons[8]) {
          currentProps.onToggleNight();
        }
        if (b9 && !flight.prevGamepadButtons[9]) {
          currentProps.onTogglePause();
        }

        flight.prevGamepadButtons[2] = b2;
        flight.prevGamepadButtons[3] = b3;
        flight.prevGamepadButtons[8] = b8;
        flight.prevGamepadButtons[9] = b9;
      }

      // Check Title Screen vs Active Playing vs Paused
      if (currentProps.screenState === 'title') {
        // Atmospheric autopilot flyover on Title Screen
        const autoZ = -elapsed * 55;
        const autoX = Math.sin(autoZ * 0.0022) * 185;
        const groundY = Math.max(WATER_LEVEL, getTerrainHeightAt(autoX, autoZ));
        const autoY = groundY + 48 + Math.sin(elapsed * 0.8) * 8;

        playerRig.group.position.set(autoX, autoY, autoZ);
        const nextAutoX = Math.sin((autoZ - 20) * 0.0022) * 185;
        const yawAngle = Math.atan2(autoX - nextAutoX, 20);
        playerRig.group.rotation.set(
          Math.cos(elapsed * 0.8) * 0.06,
          yawAngle,
          -yawAngle * 0.65,
          'YXZ'
        );

        // Orbiting cinematic camera around aircraft on Title Screen
        camera.position.set(
          autoX + Math.sin(elapsed * 0.35) * 22,
          autoY + 6.5 + Math.cos(elapsed * 0.4) * 3,
          autoZ + Math.cos(elapsed * 0.35) * 22
        );
        camera.lookAt(autoX, autoY + 1.0, autoZ - 8);
        soundEngine.updateFlightAudio(false, 0, 0, 60, false);
      } else if (currentProps.screenState === 'playing') {
        // Handle brief impact hitstop (30-80ms)
        if (flight.hitstopRemaining > 0) {
          flight.hitstopRemaining -= dt;
        } else {
          if (flight.collisionCooldown > 0) {
            flight.collisionCooldown -= dt;
          }

          // Difficulty & Weather Aerodynamic Multipliers
          const speedScale =
            currentProps.difficulty === 'simulation'
              ? 1.15
              : currentProps.difficulty === 'arcade'
                ? 0.92
                : 1.0;

          const weatherDragFactor =
            activeWeather === 'rain'
              ? 0.94
              : activeWeather === 'snow'
                ? 0.96
                : activeWeather === 'fog'
                  ? 0.97
                  : 1.0;

          const rollDampingLambda =
            activeWeather === 'snow'
              ? 3.1
              : activeWeather === 'rain'
                ? 3.8
                : activeWeather === 'fog'
                  ? 4.6
                  : 5.5;

          const pitchDampingLambda =
            activeWeather === 'snow'
              ? 2.9
              : activeWeather === 'rain'
                ? 3.4
                : activeWeather === 'fog'
                  ? 4.2
                  : 4.8;

          // Throttle input (E / Shift to increase throttle & boost, Q / Ctrl to decrease, or Gamepad triggers)
          let throttleInput = gpThrottleDelta;
          if (heldKeys.has('KeyE') || heldKeys.has('ShiftLeft') || heldKeys.has('ShiftRight')) {
            throttleInput += 1;
          }
          if (heldKeys.has('KeyQ') || heldKeys.has('ControlLeft') || heldKeys.has('ControlRight')) {
            throttleInput -= 1;
          }

          if (Math.abs(throttleInput) > 0.1) {
            flight.throttlePct = THREE.MathUtils.clamp(
              flight.throttlePct + throttleInput * 48 * dt,
              15,
              100
            );
            currentProps.onTutorialStep({ adjustedThrottle: true });
          }

          const isBoosting =
            (heldKeys.has('ShiftLeft') || heldKeys.has('ShiftRight') || gpBoost) &&
            flight.boostPct > 2;
          const isBraking = heldKeys.has('Space') || gpBrake;

          if (isBoosting) {
            flight.boostPct = Math.max(0, flight.boostPct - 28 * dt);
            currentProps.onTutorialStep({ adjustedThrottle: true });
          } else {
            flight.boostPct = Math.min(100, flight.boostPct + 14 * dt);
          }

          const targetSpeed =
            (110 + (flight.throttlePct / 100) * 235 + (isBoosting ? 115 : 0) - (isBraking ? 65 : 0)) *
            speedScale *
            weatherDragFactor;

          flight.speedKmh = THREE.MathUtils.damp(flight.speedKmh, targetSpeed, 3.2, dt);

          // Steering: WASD / Arrow Keys + Gamepad sticks (Mouse decoupled from steering)
          let steerRoll = gpRoll;
          let steerPitch = -gpPitch;
          const steerYaw = gpYaw;

          // W / Up = Climb (Pitch Up), S / Down = Dive (Pitch Down)
          if (heldKeys.has('KeyW') || heldKeys.has('ArrowUp')) steerPitch += 1;
          if (heldKeys.has('KeyS') || heldKeys.has('ArrowDown')) steerPitch -= 1;

          // A / Left = Bank & Turn Left, D / Right = Bank & Turn Right
          if (heldKeys.has('KeyA') || heldKeys.has('ArrowLeft')) steerRoll -= 1;
          if (heldKeys.has('KeyD') || heldKeys.has('ArrowRight')) steerRoll += 1;

          if (Math.abs(steerRoll) > 0.1 || Math.abs(steerPitch) > 0.1) {
            currentProps.onTutorialStep({ steeredAircraft: true });
          }

          const combinedRollInput = THREE.MathUtils.clamp(steerRoll, -1.2, 1.2);
          const combinedPitchInput = THREE.MathUtils.clamp(steerPitch, -1.1, 1.1);

          // Environmental turbulence & thermal buffeting based on active weather
          const weatherRollGust =
            activeWeather === 'rain'
              ? Math.sin(elapsed * 4.3) * 0.08 + Math.cos(elapsed * 9.1) * 0.04
              : activeWeather === 'snow'
                ? Math.sin(elapsed * 2.2) * 0.05
                : 0;
          const weatherPitchGust =
            activeWeather === 'rain'
              ? Math.cos(elapsed * 3.7) * 0.045
              : activeWeather === 'snow'
                ? Math.sin(elapsed * 1.7) * 0.035
                : activeWeather === 'fog'
                  ? -0.025
                  : 0;

          // Level wings when pressing Space (airbrake/stabilizer)
          const targetRoll = isBraking ? 0 : -combinedRollInput * 0.95 + weatherRollGust;
          const targetPitch = isBraking ? 0 : combinedPitchInput * 0.68 + weatherPitchGust;

          flight.roll = THREE.MathUtils.damp(flight.roll, targetRoll, rollDampingLambda, dt);
          flight.pitch = THREE.MathUtils.damp(flight.pitch, targetPitch, pitchDampingLambda, dt);

          // Banking turns the aircraft naturally (coordinated turn yaw)
          const bankYawRate = flight.roll * 1.18 - steerYaw * 0.9;
          flight.yaw += bankYawRate * dt;

          // Apply orientation to player aircraft
          _euler.set(flight.pitch, flight.yaw, flight.roll, 'YXZ');
          playerRig.group.quaternion.setFromEuler(_euler);

          // Advance position along forward vector + environmental crosswind drift
          _forward.set(0, 0, -1).applyQuaternion(playerRig.group.quaternion);
          const metersPerSec = flight.speedKmh / 3.6;

          const crosswindX =
            activeWeather === 'rain'
              ? 5.0 * Math.cos(elapsed * 0.4)
              : activeWeather === 'snow'
                ? 3.3 * Math.sin(elapsed * 0.35)
                : activeWeather === 'fog'
                  ? 1.6
                  : 0;
          const thermalVerticalY =
            activeWeather === 'fog'
              ? -1.4
              : activeWeather === 'snow'
                ? Math.sin(elapsed * 1.1) * 1.2
                : activeWeather === 'rain'
                  ? Math.cos(elapsed * 2.4) * 1.8 - 0.8
                  : 0;

          flight.x += (_forward.x * metersPerSec + crosswindX) * dt;
          flight.y += (_forward.y * metersPerSec + thermalVerticalY) * dt;
          flight.z += _forward.z * metersPerSec * dt;

          // Keep within natural mountain perimeter by gently banking back if near outer boundary
          const distFromCenter = Math.hypot(flight.x, flight.z);
          if (distFromCenter > WORLD_RADIUS * 0.85) {
            const toCenterYaw = Math.atan2(-flight.x, -flight.z);
            flight.yaw = THREE.MathUtils.lerp(flight.yaw, toCenterYaw, dt * 1.5);
          }

          // Ceiling clamp
          if (flight.y > 320) {
            flight.y = 320;
            flight.pitch = Math.min(flight.pitch, 0);
          }

          // Ground & Water Collision Detection
          const terrainY = getTerrainHeightAt(flight.x, flight.z);
          const surfaceY = Math.max(terrainY, WATER_LEVEL);
          const minSafeY = surfaceY + 2.4;

          if (flight.y <= minSafeY) {
            flight.y = minSafeY + 1.2;
            flight.pitch = Math.max(0.28, Math.abs(flight.pitch) * 0.6); // Bounce nose up

            if (flight.collisionCooldown <= 0) {
              flight.collisionCooldown = 0.75;
              flight.hitstopRemaining = 0.05; // 50ms impact hitstop
              flight.shakeIntensity = 1.6;

              const damageBase =
                currentProps.difficulty === 'simulation'
                  ? 38
                  : currentProps.difficulty === 'normal'
                    ? 22
                    : 12;

              flight.hullPct = Math.max(0, flight.hullPct - damageBase);
              flight.combo = 0;
              flight.speedKmh = Math.max(120, flight.speedKmh * 0.72);

              spawnParticleBurst(playerRig.group.position, 0xef4444, 18);
              soundEngine.playCollision(damageBase >= 30);

              if (flight.hullPct <= 0) {
                soundEngine.updateFlightAudio(false, 0, 0, 0, false);
                currentProps.onCrashGameOver();
              }
            }
          }

          playerRig.group.position.set(flight.x, flight.y, flight.z);

          // Update shadow camera to follow player
          sunLight.position.set(flight.x + 180, flight.y + 280, flight.z + 140);
          sunLight.target.position.set(flight.x, flight.y, flight.z);

          // Animate Afterburner Exhaust Cones
          const flameScale =
            0.6 + (flight.throttlePct / 100) * 0.9 + (isBoosting ? 0.95 : 0) + Math.sin(elapsed * 45) * 0.08;
          for (const cone of playerRig.exhaustCones) {
            cone.scale.set(1, 1, flameScale);
            (cone.material as THREE.MeshBasicMaterial).color.setHex(
              isBoosting ? 0xf59e0b : 0x38bdf8
            );
          }

          // Check Checkpoint Rings & recycle passed rings ahead of the player
          for (let i = 0; i < rings.length; i++) {
            const r = rings[i];
            r.outerRing.rotation.z = elapsed * 0.8 + i;
            const isTarget = i === activeRingIndex;
            const innerMat = r.innerRing.material as THREE.MeshBasicMaterial;
            innerMat.color.setHex(isTarget ? 0xf59e0b : 0x38bdf8);
            const pulse = isTarget ? 1 + Math.sin(elapsed * 6) * 0.07 : 1;
            r.innerRing.scale.setScalar(pulse);

            const distToRing = playerRig.group.position.distanceTo(r.group.position);
            if (r.active && distToRing < 16.5) {
              r.active = false;
              flight.ringsCollected += 1;
              flight.combo += 1;
              const ringPoints = 150 * Math.min(flight.combo, 8);
              flight.score += ringPoints;
              flight.boostPct = Math.min(100, flight.boostPct + 25);

              spawnParticleBurst(r.group.position, 0xf59e0b, 16);
              soundEngine.playRingCollect(flight.combo);

              const clearance = Math.max(0, flight.y - surfaceY);
              currentProps.onRingCollected(
                flight.combo,
                clearance,
                currentProps.isNight,
                currentProps.wireframe
              );
              currentProps.onTutorialStep({ passedFirstRing: true });

              // Move this ring further ahead along the flight path
              const furthestZ = Math.min(...rings.map((rg) => rg.group.position.z));
              placeRingAtIndex(i, furthestZ - 240 + i * 240);
              activeRingIndex = (i + 1) % rings.length;
            } else if (r.group.position.z > flight.z + 90) {
              // Recycle ring if player flew far past it
              const furthestZ = Math.min(...rings.map((rg) => rg.group.position.z));
              placeRingAtIndex(i, furthestZ - 240 + i * 240);
              if (i === activeRingIndex) {
                activeRingIndex = (i + 1) % rings.length;
              }
            }
          }

          // Update Storm Drone Hazards & check collision
          for (let i = 0; i < hazards.length; i++) {
            const hz = hazards[i];
            const patrolX = hz.baseX + Math.sin(elapsed * 1.4 + hz.phase) * 32;
            const patrolY = hz.baseY + Math.cos(elapsed * 1.8 + hz.phase) * 10;
            hz.group.position.set(patrolX, patrolY, hz.baseZ);
            hz.coreMesh.rotation.y = elapsed * 2.5;
            hz.coreMesh.rotation.x = elapsed * 1.5;

            // Pulsing windup telegraph ring
            const teleScale = 0.85 + ((elapsed * 1.2 + hz.phase) % 1) * 0.45;
            hz.telegraphRing.scale.setScalar(teleScale);
            hz.telegraphRing.lookAt(camera.position);

            const distToHazard = playerRig.group.position.distanceTo(hz.group.position);
            if (distToHazard < 10.0 && flight.collisionCooldown <= 0) {
              flight.collisionCooldown = 0.9;
              flight.hitstopRemaining = 0.055;
              flight.shakeIntensity = 1.4;
              flight.hullPct = Math.max(0, flight.hullPct - 18);
              flight.combo = 0;
              spawnParticleBurst(hz.group.position, 0xf43f5e, 16);
              soundEngine.playCollision(false);

              if (flight.hullPct <= 0) {
                currentProps.onCrashGameOver();
              }
            }

            // Recycle hazard ahead if behind player
            if (hz.baseZ > flight.z + 120) {
              hz.baseZ = flight.z - 2200 - Math.random() * 300;
              hz.baseX = Math.sin(hz.baseZ * 0.0022) * 170 + (Math.random() - 0.5) * 90;
              hz.baseY = Math.max(WATER_LEVEL, getTerrainHeightAt(hz.baseX, hz.baseZ)) + 42;
            }
          }

          // Camera Choreography (Chase, Cockpit, Tactical, Cinematic) with smooth damping & FOV speed cues
          if (currentProps.cameraMode === 'cinematic') {
            // Automatically cycle between 4 dynamic filming angles every 5.5 seconds
            // or trigger a fly-by shot when passing near a ring
            const shotDuration = 5.5;
            const shotIndex = Math.floor(elapsed / shotDuration) % 4;
            const shotPhase = (elapsed % shotDuration) / shotDuration;

            let targetCineFov = 54;

            if (shotIndex === 0) {
              // Shot 0: Sweeping Low Orbital Crane Shot
              const orbitAngle = elapsed * 0.55;
              const radius = 21 + Math.sin(elapsed * 0.9) * 4;
              _camTargetPos.set(
                playerRig.group.position.x + Math.cos(orbitAngle) * radius,
                playerRig.group.position.y + 5.5 + Math.sin(elapsed * 0.7) * 3.5,
                playerRig.group.position.z + Math.sin(orbitAngle) * radius
              );
              _lookAtTarget
                .copy(playerRig.group.position)
                .addScaledVector(_forward, 8);
              targetCineFov = 58 + (flight.speedKmh / 450) * 10;
            } else if (shotIndex === 1) {
              // Shot 1: Dramatic Wingtip & Afterburner Action Cam
              _camOffset
                .set(6.8, 1.4, 5.2)
                .applyQuaternion(playerRig.group.quaternion);
              _camTargetPos.copy(playerRig.group.position).add(_camOffset);
              _lookAtTarget
                .copy(playerRig.group.position)
                .addScaledVector(_forward, 32);
              targetCineFov = 68 + (isBoosting ? 8 : 0);
            } else if (shotIndex === 2) {
              // Shot 2: High-Speed Fly-By Tracking Shot (camera ahead of jet looking back as it roars past)
              const leadDist = 28 - shotPhase * 48; // Sweeps from +28m ahead to -20m behind
              _camOffset
                .set(-9.5, 3.2, -leadDist)
                .applyQuaternion(playerRig.group.quaternion);
              _camTargetPos.copy(playerRig.group.position).add(_camOffset);
              _lookAtTarget.copy(playerRig.group.position);
              targetCineFov = 48 + Math.abs(leadDist) * 0.35;
            } else {
              // Shot 3: Hero Nose-On Canyon Skim Angle (looking back at the cockpit & mountain ridges)
              _camOffset
                .set(4.2, -1.2, -15.5)
                .applyQuaternion(playerRig.group.quaternion);
              _camTargetPos.copy(playerRig.group.position).add(_camOffset);
              _lookAtTarget
                .copy(playerRig.group.position)
                .addScaledVector(_forward, -6);
              targetCineFov = 55;
            }

            // Ensure cinematic camera never clips beneath terrain or water surface
            const camGroundY = Math.max(
              WATER_LEVEL,
              getTerrainHeightAt(_camTargetPos.x, _camTargetPos.z)
            );
            if (_camTargetPos.y < camGroundY + 3.5) {
              _camTargetPos.y = camGroundY + 3.5;
            }

            camera.fov = THREE.MathUtils.damp(camera.fov, targetCineFov, 4.5, dt);
            camera.updateProjectionMatrix();

            camera.position.lerp(_camTargetPos, 1 - Math.exp(-5.5 * dt));
            _currentLookAt.lerp(_lookAtTarget, 1 - Math.exp(-10 * dt));
            camera.lookAt(_currentLookAt);
            camera.rotation.z += Math.sin(elapsed * 0.8) * 0.08 + flight.roll * 0.18;
          } else {
            const targetFov =
              currentProps.cameraMode === 'cockpit'
                ? 74 + (flight.speedKmh / 450) * 10
                : 62 + (flight.speedKmh / 450) * 14 + (isBoosting ? 6 : 0);
            if (Math.abs(camera.fov - targetFov) > 0.05) {
              camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 5, dt);
              camera.updateProjectionMatrix();
            }

            if (currentProps.cameraMode === 'cockpit') {
              _camOffset.set(0, 0.72, -1.65).applyQuaternion(playerRig.group.quaternion);
              camera.position.copy(playerRig.group.position).add(_camOffset);

              _lookAtTarget
                .set(0, 0.55, -40)
                .applyQuaternion(playerRig.group.quaternion)
                .add(playerRig.group.position);
              camera.lookAt(_lookAtTarget);
              camera.rotation.z = flight.roll * 0.85;
            } else if (currentProps.cameraMode === 'tactical') {
              _camOffset.set(0, 14.5, 29).applyQuaternion(playerRig.group.quaternion);
              _camTargetPos.copy(playerRig.group.position).add(_camOffset);
              camera.position.lerp(_camTargetPos, 1 - Math.exp(-6.5 * dt));

              _lookAtTarget.copy(playerRig.group.position).addScaledVector(_forward, 26);
              _currentLookAt.lerp(_lookAtTarget, 1 - Math.exp(-9 * dt));
              camera.lookAt(_currentLookAt);
            } else {
              // Default Chase Cam
              _camOffset.set(0, 4.3, 14.2).applyQuaternion(playerRig.group.quaternion);
              _camTargetPos.copy(playerRig.group.position).add(_camOffset);
              camera.position.lerp(_camTargetPos, 1 - Math.exp(-8.5 * dt));

              _lookAtTarget.copy(playerRig.group.position).addScaledVector(_forward, 24);
              _currentLookAt.lerp(_lookAtTarget, 1 - Math.exp(-11 * dt));
              camera.lookAt(_currentLookAt);
              camera.rotation.z += flight.roll * 0.25;
            }
          }

          // Apply decaying camera shake on impact
          if (flight.shakeIntensity > 0.01) {
            camera.position.x += (Math.random() - 0.5) * flight.shakeIntensity;
            camera.position.y += (Math.random() - 0.5) * flight.shakeIntensity;
            flight.shakeIntensity = THREE.MathUtils.damp(flight.shakeIntensity, 0, 7, dt);
          }

          // Update Procedural Web Audio Engine
          soundEngine.updateFlightAudio(
            true,
            flight.speedKmh,
            flight.throttlePct,
            Math.max(0, flight.y - surfaceY),
            isBoosting
          );

          // Broadcast local state to WebSocket multiplayer server (~12 Hz)
          if (elapsed - flight.lastNetworkSend > 0.085) {
            flight.lastNetworkSend = elapsed;
            currentProps.onBroadcastLocalState({
              x: Math.round(flight.x * 10) / 10,
              y: Math.round(flight.y * 10) / 10,
              z: Math.round(flight.z * 10) / 10,
              pitch: Number(flight.pitch.toFixed(3)),
              yaw: Number(flight.yaw.toFixed(3)),
              roll: Number(flight.roll.toFixed(3)),
              speed: Math.round(flight.speedKmh),
              platform: gamepadConnected ? 'Gamepad' : 'PC',
            });
          }

          // Emit HUD Telemetry (~15 Hz so React HUD stays crisp without over-rendering)
          if (elapsed - flight.lastTelemetryEmit > 0.065) {
            flight.lastTelemetryEmit = elapsed;
            const targetGate = rings[activeRingIndex]?.group;
            let nextDist = 0;
            let nextBearing = 0;
            if (targetGate) {
              nextDist = Math.round(playerRig.group.position.distanceTo(targetGate.position));
              _ringDir.subVectors(targetGate.position, playerRig.group.position);
              const worldAngle = Math.atan2(-_ringDir.x, -_ringDir.z);
              nextBearing = Math.round(
                ((THREE.MathUtils.radToDeg(worldAngle) % 360) + 360) % 360
              );
            }

            const headingDeg = Math.round(
              ((THREE.MathUtils.radToDeg(-flight.yaw) % 360) + 360) % 360
            );

            currentProps.onTelemetryUpdate({
              speedKmh: Math.round(flight.speedKmh),
              altitudeM: Math.round(flight.y),
              groundClearanceM: Math.max(0, Math.round(flight.y - surfaceY)),
              headingDeg,
              pitchDeg: Math.round(THREE.MathUtils.radToDeg(flight.pitch)),
              rollDeg: Math.round(THREE.MathUtils.radToDeg(flight.roll)),
              throttlePct: Math.round(flight.throttlePct),
              hullPct: Math.round(flight.hullPct),
              boostPct: Math.round(flight.boostPct),
              score: Math.round(flight.score),
              combo: flight.combo,
              ringsCollected: flight.ringsCollected,
              nextRingDistanceM: nextDist,
              nextRingBearingDeg: nextBearing,
              gamepadConnected,
              gamepadName,
              biomeName: getBiomeNameAt(flight.x, flight.z, terrainY),
              weather: activeWeather,
              windDriftKmh:
                activeWeather === 'rain'
                  ? 18
                  : activeWeather === 'snow'
                    ? 12
                    : activeWeather === 'fog'
                      ? 6
                      : 0,
            });
          }
        }
      } else {
        // Paused or Game Over
        soundEngine.updateFlightAudio(false, 0, 0, 0, false);
      }

      // Update Pooled Burst Particles
      for (let i = 0; i < particlePool.length; i++) {
        const p = particlePool[i];
        if (p.life > 0) {
          p.life -= dt;
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.position.z += p.vz * dt;
          p.vy -= 18 * dt;
          p.mesh.rotation.x += 5 * dt;
          p.mesh.rotation.y += 4 * dt;
          const alpha = Math.max(0, p.life / p.maxLife);
          (p.mesh.material as THREE.MeshBasicMaterial).opacity = alpha;
          if (p.life <= 0) {
            p.mesh.visible = false;
          }
        }
      }

      // Sync & Interpolate Remote Multiplayer Pilots in 3D Sky
      const activeRemoteIds = new Set<string>();
      for (const rp of currentProps.remotePilots) {
        activeRemoteIds.add(rp.id);
        let entry = remoteMeshes.get(rp.id);
        if (!entry) {
          const rig = createAircraftGroup(rp.livery || 'cobalt', isSoftwareGl);
          rig.group.position.set(rp.x, rp.y, rp.z);
          scene.add(rig.group);
          entry = { rig, livery: rp.livery || 'cobalt' };
          remoteMeshes.set(rp.id, entry);
        }
        if (entry.livery !== rp.livery && rp.livery) {
          entry.rig.setLivery(rp.livery);
          entry.livery = rp.livery;
        }
        entry.rig.group.position.x = THREE.MathUtils.damp(entry.rig.group.position.x, rp.x, 6, dt);
        entry.rig.group.position.y = THREE.MathUtils.damp(entry.rig.group.position.y, rp.y, 6, dt);
        entry.rig.group.position.z = THREE.MathUtils.damp(entry.rig.group.position.z, rp.z, 6, dt);
        _euler.set(rp.pitch, rp.yaw, rp.roll, 'YXZ');
        entry.rig.group.quaternion.setFromEuler(_euler);
      }

      for (const [id, entry] of remoteMeshes.entries()) {
        if (!activeRemoteIds.has(id)) {
          scene.remove(entry.rig.group);
          remoteMeshes.delete(id);
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('resize', onResize);
      soundEngine.updateFlightAudio(false, 0, 0, 0, false);
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={canvasMountRef}
      className="fixed inset-0 w-full h-full overflow-hidden z-0 cursor-default"
      aria-label="3D Flight Viewport"
    />
  );
};
