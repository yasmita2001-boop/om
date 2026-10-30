import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const SanctuaryEnvironment: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: window.devicePixelRatio < 2,
        powerPreference: 'low-power',
      });
    } catch (error) {
      console.error('The sanctuary scene could not create a WebGL renderer; using the static scene instead.', error);
      setUnavailable(true);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 90);
    camera.position.set(0, 1.2, 11);

    scene.add(new THREE.HemisphereLight(0xffe6bf, 0x182338, 1.55));
    const sun = new THREE.DirectionalLight(0xffd69a, 2.2);
    sun.position.set(-4, 7, 7);
    scene.add(sun);
    const portalLight = new THREE.PointLight(0xffc46e, 22, 12, 2);
    portalLight.position.set(0, 1.3, 0.5);
    scene.add(portalLight);

    const world = new THREE.Group();
    scene.add(world);

    const stone = new THREE.MeshStandardMaterial({
      color: 0x78604c,
      metalness: 0.52,
      roughness: 0.58,
    });
    const gold = new THREE.MeshStandardMaterial({
      color: 0xcda464,
      emissive: 0x754214,
      emissiveIntensity: 0.46,
      metalness: 0.82,
      roughness: 0.3,
    });
    const glowGold = new THREE.MeshBasicMaterial({
      color: 0xf3c77f,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });

    const portal = new THREE.Group();
    portal.position.set(0, 0.15, -0.5);
    world.add(portal);

    const archShape = (width: number, springHeight: number, crownHeight: number) => {
      const shape = new THREE.Shape();
      shape.moveTo(-width, -1.95);
      shape.lineTo(-width, springHeight);
      shape.quadraticCurveTo(-width, crownHeight, 0, crownHeight);
      shape.quadraticCurveTo(width, crownHeight, width, springHeight);
      shape.lineTo(width, -1.95);
      shape.lineTo(-width, -1.95);
      return shape;
    };
    const archFrameShape = archShape(2.08, 0.15, 2.22);
    const archOpening = new THREE.Path();
    archOpening.moveTo(-1.67, -1.95);
    archOpening.lineTo(1.67, -1.95);
    archOpening.lineTo(1.67, 0.12);
    archOpening.quadraticCurveTo(1.67, 1.78, 0, 1.78);
    archOpening.quadraticCurveTo(-1.67, 1.78, -1.67, 0.12);
    archOpening.lineTo(-1.67, -1.95);
    archFrameShape.holes.push(archOpening);
    const frameGeometry = new THREE.ExtrudeGeometry(archFrameShape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.045,
      bevelThickness: 0.055,
    });
    const frame = new THREE.Mesh(frameGeometry, stone);
    frame.position.z = -0.05;
    portal.add(frame);

    const archTrimMaterial = new THREE.LineBasicMaterial({
      color: 0xf0cd91,
      transparent: true,
      opacity: 0.78,
    });
    for (const side of [-1, 1]) {
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(side * 1.82, -1.82, 0.21),
        new THREE.Vector3(side * 1.82, 0.15, 0.21),
      ]);
      const trim = new THREE.Line(lineGeometry, archTrimMaterial);
      portal.add(trim);
    }

    const archTopTrim = new THREE.Mesh(
      new THREE.TorusGeometry(1.82, 0.018, 8, 72, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0xffe1a4, transparent: true, opacity: 0.82 }),
    );
    archTopTrim.position.set(0, 0.15, 0.19);
    portal.add(archTopTrim);

    const halo = new THREE.Mesh(new THREE.TorusGeometry(2.16, 0.075, 10, 88, Math.PI), glowGold);
    halo.position.set(0, 0.15, -0.02);
    portal.add(halo);

    const portalLightMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.55, 3.9),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          void main() {
            vec2 p = (vUv - 0.5) * vec2(1.0, 0.92);
            float body = (1.0 - smoothstep(0.36, 0.40, abs(p.x))) * smoothstep(-0.49, -0.43, p.y) * (1.0 - smoothstep(-0.02, 0.04, p.y));
            float crown = (1.0 - smoothstep(0.36, 0.40, length(vec2(p.x, p.y - 0.02)))) * smoothstep(-0.02, 0.04, p.y);
            float arch = max(body, crown);
            float glow = arch * 0.14;
            gl_FragColor = vec4(1.0, 0.66, 0.32, glow);
          }
        `,
      }),
    );
    portalLightMesh.position.z = -0.16;
    portal.add(portalLightMesh);

    const addBox = (
      x: number,
      y: number,
      z: number,
      width: number,
      height: number,
      depth: number,
      material: THREE.Material,
      parent = world,
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };

    for (const side of [-1, 1]) {
      addBox(side * 2.14, 0.1, 0.16, 0.3, 4.2, 0.38, stone);
      addBox(side * 2.14, 2.24, 0.16, 0.52, 0.18, 0.5, gold);
      addBox(side * 2.14, -2.05, 0.16, 0.52, 0.18, 0.5, gold);
      addBox(side * 2.14, -0.28, 0.365, 0.07, 3.2, 0.035, gold);
    }

    const towerGeometry = new THREE.CylinderGeometry(0.3, 0.42, 2.3, 8);
    const roofGeometry = new THREE.ConeGeometry(0.52, 0.8, 8);
    const towerLights: THREE.PointLight[] = [];
    for (const side of [-1, 1]) {
      const towerX = side * 3.18;
      const tower = new THREE.Mesh(towerGeometry, stone);
      tower.position.set(towerX, 0.68, -0.45);
      world.add(tower);
      const roof = new THREE.Mesh(roofGeometry, gold);
      roof.position.set(towerX, 2.18, -0.45);
      world.add(roof);
      for (const height of [-0.35, 0.72]) {
        addBox(towerX, height, -0.22, 0.56, 0.11, 0.55, gold);
      }
      const lantern = new THREE.PointLight(0xffbf70, 2.8, 3.4, 2);
      lantern.position.set(towerX, 0.75, 0.12);
      world.add(lantern);
      towerLights.push(lantern);
    }

    const sunOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.46, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0xffd49a, transparent: true, opacity: 0.88 }),
    );
    sunOrb.position.set(3.9, 2.65, -5.3);
    world.add(sunOrb);
    const sunGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.68, 20, 14),
      new THREE.MeshBasicMaterial({
        color: 0xffb76b,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    sunGlow.position.copy(sunOrb.position);
    world.add(sunGlow);

    const platform = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 5, 0.42, 12), stone);
    platform.position.set(0, -2.27, 0.08);
    world.add(platform);
    const platformEdge = new THREE.Mesh(
      new THREE.TorusGeometry(4.1, 0.035, 8, 64),
      gold,
    );
    platformEdge.rotation.x = Math.PI / 2;
    platformEdge.position.set(0, -2.05, 0.08);
    world.add(platformEdge);

    const ridgeMaterial = new THREE.MeshStandardMaterial({
      color: 0x596075,
      roughness: 1,
      metalness: 0.04,
      flatShading: true,
    });
    const makeRidge = (peaks: Array<[number, number]>, z: number, color: number) => {
      const shape = new THREE.Shape();
      shape.moveTo(peaks[0][0], -2.8);
      peaks.forEach(([x, y]) => shape.lineTo(x, y));
      shape.lineTo(peaks[peaks.length - 1][0], -2.8);
      shape.closePath();
      const geometry = new THREE.ShapeGeometry(shape);
      const material = ridgeMaterial.clone();
      material.color.setHex(color);
      const mountain = new THREE.Mesh(geometry, material);
      mountain.position.set(0, 0, z);
      world.add(mountain);
      return mountain;
    };
    makeRidge(
      [[-12, 0.2], [-10.2, 1.1], [-8.7, 0.55], [-6.4, 1.7], [-4.3, 0.72], [-2.4, 1.45], [0, 0.6], [2.4, 1.55], [4.1, 0.72], [6.8, 1.8], [8.8, 0.6], [10.8, 1.2], [13, 0.1]],
      -4.7,
      0x54637b,
    );
    makeRidge(
      [[-13, -0.6], [-10.7, 0.3], [-8.5, -0.1], [-6.1, 1], [-3.6, -0.25], [-1.4, 0.52], [1.2, -0.3], [3.8, 0.8], [6.3, -0.25], [8.7, 0.32], [11.4, -0.48], [14, 0.2]],
      -3.35,
      0x39465f,
    );

    const cloudMaterial = new THREE.MeshStandardMaterial({
      color: 0xffe9cf,
      transparent: true,
      opacity: 0.2,
      roughness: 1,
      depthWrite: false,
    });
    const clouds: THREE.Group[] = [];
    const cloudOrigins: Array<{ x: number; y: number; phase: number }> = [];
    for (const side of [-1, 1]) {
      const cloud = new THREE.Group();
      cloud.position.set(side * 5.1, -1.52, 0.9);
      for (let puff = 0; puff < 5; puff += 1) {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.72, 10, 7), cloudMaterial);
        mesh.position.set((puff - 2) * 0.68, Math.sin(puff * 1.4) * 0.13, 0);
        mesh.scale.set(1.85, 0.48 + (puff % 2) * 0.13, 0.62);
        cloud.add(mesh);
      }
      world.add(cloud);
      clouds.push(cloud);
      cloudOrigins.push({ x: cloud.position.x, y: cloud.position.y, phase: side === -1 ? 0 : 2 });
    }

    const starsGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(150 * 3);
    for (let index = 0; index < 150; index += 1) {
      starPositions[index * 3] = (Math.random() - 0.5) * 24;
      starPositions[index * 3 + 1] = Math.random() * 10 - 0.1;
      starPositions[index * 3 + 2] = -7 - Math.random() * 6;
    }
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starsGeometry,
      new THREE.PointsMaterial({ color: 0xffe8c1, size: 0.025, transparent: true, opacity: 0.7 }),
    );
    world.add(stars);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = { x: 0, y: 0 };
    let width = 0;
    let height = 0;
    let frameId = 0;
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.position.z = camera.aspect < 0.72 ? 13 : camera.aspect < 1 ? 11.8 : 10.8;
      camera.position.y = camera.aspect < 0.72 ? 1.1 : 1.3;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 720 ? 1 : 1.35));
      if (reducedMotion.matches) renderer.render(scene, camera);
    };
    const onPointerMove = (event: PointerEvent) => {
      pointer.x = (event.clientX / Math.max(width, 1) - 0.5) * 2;
      pointer.y = (event.clientY / Math.max(height, 1) - 0.5) * 2;
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      console.error('The sanctuary WebGL context was lost; reverting to the static scene.');
      setUnavailable(true);
    };
    const draw = (time = 0) => {
      frameId = 0;
      if (document.hidden) return;
      if (!reducedMotion.matches) {
        const seconds = time * 0.00015;
        camera.position.x += (pointer.x * 0.28 - camera.position.x) * 0.018;
        camera.position.y += (1.3 - pointer.y * 0.12 - camera.position.y) * 0.018;
        camera.lookAt(0, 0, -0.25);
        portal.rotation.y = Math.sin(seconds) * 0.012 + pointer.x * 0.006;
        clouds.forEach((cloud, index) => {
          const origin = cloudOrigins[index];
          cloud.position.x = origin.x + Math.sin(seconds + origin.phase) * 0.16;
          cloud.position.y = origin.y + Math.sin(seconds * 1.7 + origin.phase) * 0.045;
        });
        portalLight.intensity = 20 + Math.sin(seconds * 2.5) * 2;
        towerLights.forEach((light, index) => {
          light.intensity = 2.4 + (Math.sin(seconds * 2 + index) + 1) * 0.55;
        });
      }
      renderer.render(scene, camera);
      if (!reducedMotion.matches) frameId = window.requestAnimationFrame(draw);
    };
    const start = () => {
      if (!frameId && !document.hidden) frameId = window.requestAnimationFrame(draw);
    };
    const onMotionPreferenceChange = () => {
      if (reducedMotion.matches) {
        if (frameId) window.cancelAnimationFrame(frameId);
        frameId = 0;
        draw();
      } else {
        start();
      }
    };
    const onVisibilityChange = () => {
      if (document.hidden && frameId) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      } else {
        start();
      }
    };

    resize();
    canvas.addEventListener('webglcontextlost', onContextLost);
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    reducedMotion.addEventListener('change', onMotionPreferenceChange);
    start();

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      reducedMotion.removeEventListener('change', onMotionPreferenceChange);
      scene.traverse((object: THREE.Object3D) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      });
      renderer.dispose();
    };
  }, []);

  if (unavailable) return null;
  return <canvas ref={canvasRef} className="sanctuary-scene" aria-hidden="true" />;
};

export default SanctuaryEnvironment;
