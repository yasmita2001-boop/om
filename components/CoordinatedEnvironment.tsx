import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type CoordinatedPreset = 'ocean' | 'forest' | 'sunset' | 'midnight';

interface CoordinatedEnvironmentProps {
  presetId: CoordinatedPreset;
  lowPower: boolean;
  enabled: boolean;
}

const CoordinatedEnvironment: React.FC<CoordinatedEnvironmentProps> = ({ presetId, lowPower, enabled }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;
    setUnavailable(false);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: !lowPower && window.devicePixelRatio < 2,
        powerPreference: 'low-power'
      });
    } catch (error) {
      console.error(`The ${presetId} 3D wallpaper could not create a WebGL renderer.`, error);
      setUnavailable(true);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 0.8 : 1.25));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 1.4, 12);
    camera.lookAt(0, 0, -3);
    scene.add(new THREE.HemisphereLight(
      presetId === 'sunset' ? 0xffc7a0 : presetId === 'forest' ? 0xcdf0b5 : 0xc9eaff,
      presetId === 'midnight' ? 0x101b36 : 0x142333,
      1.3
    ));
    const keyLight = new THREE.DirectionalLight(
      presetId === 'sunset' ? 0xff9a70 : presetId === 'forest' ? 0xc8f1a0 : 0x8ddfff,
      2.2
    );
    keyLight.position.set(-4, 8, 5);
    scene.add(keyLight);

    const world = new THREE.Group();
    scene.add(world);
    const motion: Array<(time: number) => void> = [];
    const presetIndex = { ocean: 0, forest: 1, sunset: 2, midnight: 3 }[presetId];
    const skyMaterial = new THREE.ShaderMaterial({
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uPreset: { value: presetIndex }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uPreset;
        varying vec2 vUv;
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        void main() {
          vec3 top;
          vec3 horizon;
          vec3 low;
          if (uPreset < 0.5) {
            top = vec3(0.025, 0.34, 0.68);
            horizon = vec3(0.69, 0.78, 0.75);
            low = vec3(0.96, 0.64, 0.39);
          } else if (uPreset < 1.5) {
            top = vec3(0.10, 0.43, 0.70);
            horizon = vec3(0.70, 0.84, 0.78);
            low = vec3(0.88, 0.80, 0.56);
          } else if (uPreset < 2.5) {
            top = vec3(0.31, 0.18, 0.42);
            horizon = vec3(0.96, 0.39, 0.24);
            low = vec3(1.0, 0.66, 0.28);
          } else {
            top = vec3(0.008, 0.035, 0.12);
            horizon = vec3(0.035, 0.19, 0.39);
            low = vec3(0.015, 0.075, 0.20);
          }
          float skyMix = smoothstep(0.0, 1.0, vUv.y);
          vec3 color = mix(low, horizon, smoothstep(0.0, 0.55, skyMix));
          color = mix(color, top, smoothstep(0.48, 1.0, skyMix));
          vec2 sunUv = uPreset < 0.5 ? vec2(0.73, 0.58) : uPreset < 2.5 ? vec2(0.72, 0.43) : vec2(0.74, 0.67);
          float glow = exp(-length((vUv - sunUv) * vec2(1.0, 1.5)) * (uPreset > 2.5 ? 13.0 : 7.0));
          if (uPreset < 0.5 || (uPreset > 1.5 && uPreset < 2.5)) {
            color += vec3(1.0, 0.58, 0.23) * glow * 0.66;
            float disc = 1.0 - smoothstep(0.018, 0.024, length((vUv - sunUv) * vec2(1.0, 1.5)));
            color = mix(color, uPreset < 0.5 ? vec3(1.0, 0.92, 0.69) : vec3(1.0, 0.91, 0.70), disc);
          } else if (uPreset > 2.5) {
            float moon = 1.0 - smoothstep(0.027, 0.034, length((vUv - sunUv) * vec2(1.0, 1.5)));
            color = mix(color, vec3(0.79, 0.88, 1.0), moon);
            color += vec3(0.18, 0.40, 0.83) * glow * 0.36;
            vec2 starCell = floor(vUv * vec2(150.0, 90.0));
            float star = step(0.994, hash(starCell)) * (0.55 + 0.45 * sin(uTime * 1.4 + hash(starCell) * 12.0));
            color += vec3(0.56, 0.76, 1.0) * star * step(0.45, vUv.y);
          } else {
            float rays = noise(vUv * vec2(8.0, 5.0) + vec2(uTime * 0.012, 0.0));
            color += vec3(0.50, 0.62, 0.26) * glow * rays * 0.28;
          }
          float cloudNoise = noise(vUv * vec2(11.0, 6.0) + vec2(uTime * 0.018, 0.0));
          float cloudBand = smoothstep(0.62, 0.82, cloudNoise) * smoothstep(0.39, 0.52, vUv.y) * (1.0 - smoothstep(0.78, 0.95, vUv.y));
          float cloudAmount = uPreset > 2.5 ? 0.22 : 0.38;
          color = mix(color, mix(vec3(0.20, 0.42, 0.66), vec3(1.0, 0.76, 0.57), vUv.y), cloudBand * cloudAmount);
          gl_FragColor = vec4(color, 1.0);
        }
      `
    });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(90, 54), skyMaterial);
    sky.position.set(0, 0, -28);
    scene.add(sky);

    const addWater = (deepColor: number, crestColor: number, opacity: number) => {
      const waterMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uDeep: { value: new THREE.Color(deepColor) },
          uCrest: { value: new THREE.Color(crestColor) },
          uOpacity: { value: opacity }
        },
        vertexShader: `
          uniform float uTime;
          varying vec2 vUv;
          varying float vHeight;
          void main() {
            vUv = uv;
            vec3 p = position;
            float wave = sin(p.x * 0.42 + uTime * 1.1) * 0.16
              + sin(p.y * 0.7 - uTime * 0.8) * 0.08
              + sin((p.x + p.y) * 0.22 + uTime * 0.5) * 0.11;
            p.z += wave;
            vHeight = wave;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uDeep;
          uniform vec3 uCrest;
          uniform float uOpacity;
          varying vec2 vUv;
          varying float vHeight;
          void main() {
            float ripple = sin(vUv.x * 110.0 + vUv.y * 38.0 + uTime * 1.8)
              * sin(vUv.x * 42.0 - vUv.y * 84.0 - uTime);
            float crest = smoothstep(0.35, 0.9, ripple + vHeight * 2.0);
            vec3 color = mix(uDeep, uCrest, clamp(vUv.y * 0.65 + 0.18 + vHeight, 0.0, 1.0));
            color = mix(color, uCrest, crest * 0.72);
            gl_FragColor = vec4(color, uOpacity + crest * 0.18);
          }
        `
      });
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(48, 34, lowPower ? 32 : 96, lowPower ? 24 : 64),
        waterMaterial
      );
      water.rotation.x = -Math.PI / 2;
      water.position.set(0, -1.65, -7);
      world.add(water);
      motion.push(time => { waterMaterial.uniforms.uTime.value = time; });
      return water;
    };

    const addRidge = (points: Array<[number, number]>, z: number, color: number, opacity = 1) => {
      const shape = new THREE.Shape();
      shape.moveTo(points[0][0], -8);
      points.forEach(([x, y]) => shape.lineTo(x, y));
      shape.lineTo(points[points.length - 1][0], -8);
      shape.closePath();
      const mesh = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity })
      );
      mesh.position.z = z;
      world.add(mesh);
      return mesh;
    };

    if (presetId === 'ocean') {
      addWater(0x063d66, 0x24c5d3, 0.78);
      addRidge([[-16, 0.2], [-13, 1.4], [-10, 0.8], [-7, 1.9], [-4, 0.7], [-1, 1.4], [2, 0.7], [5, 1.8], [9, 0.6], [12, 1.4], [16, 0.1]], -12, 0x173f55);
      const sun = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 24, 18),
        new THREE.MeshBasicMaterial({ color: 0xffe6a0 })
      );
      sun.position.set(5.3, 2.35, -14);
      world.add(sun);
      const sunGlow = new THREE.PointLight(0xffa45d, 14, 24, 2);
      sunGlow.position.copy(sun.position);
      world.add(sunGlow);

      const islandMaterial = new THREE.MeshStandardMaterial({ color: 0x1d493a, roughness: 1 });
      const palmMaterial = new THREE.MeshStandardMaterial({ color: 0x315640, roughness: 0.9 });
      [-1, 1].forEach((side, index) => {
        const island = new THREE.Group();
        island.position.set(side * 8.4, -0.35, -10 - index * 1.4);
        const rock = new THREE.Mesh(new THREE.SphereGeometry(2.1, 12, 8), islandMaterial);
        rock.scale.set(1.8, 0.72, 0.72);
        island.add(rock);
        for (let palmIndex = 0; palmIndex < 3; palmIndex += 1) {
          const x = (palmIndex - 1) * 0.9;
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 2.1, 6), palmMaterial);
          trunk.position.set(x, 1.05, 0);
          trunk.rotation.z = side * -0.12;
          island.add(trunk);
          for (let leaf = 0; leaf < 5; leaf += 1) {
            const frond = new THREE.Mesh(
              new THREE.ConeGeometry(0.13, 1.25, 5),
              palmMaterial
            );
            frond.position.set(x + Math.sin(leaf * 1.25) * 0.58, 2.0 + Math.cos(leaf * 1.25) * 0.18, Math.cos(leaf * 1.25) * 0.24);
            frond.rotation.z = Math.PI / 2 - leaf * 1.25;
            frond.rotation.x = Math.cos(leaf * 1.25) * 0.4;
            island.add(frond);
          }
        }
        world.add(island);
      });

      const fishPositions = new Float32Array((lowPower ? 8 : 18) * 3);
      for (let index = 0; index < fishPositions.length / 3; index += 1) {
        fishPositions[index * 3] = Math.sin(index * 9.1) * 7;
        fishPositions[index * 3 + 1] = -2.3 - (index % 5) * 0.33;
        fishPositions[index * 3 + 2] = -1.5 - (index % 4) * 0.8;
      }
      const fish = new THREE.Points(
        new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(fishPositions, 3)),
        new THREE.PointsMaterial({ color: 0xffd26e, size: 0.12, transparent: true, opacity: 0.95 })
      );
      world.add(fish);
      motion.push(time => {
        fish.position.x = Math.sin(time * 0.3) * 0.32;
        sunGlow.intensity = 12 + Math.sin(time * 0.35) * 2;
      });
    } else if (presetId === 'forest') {
      addRidge([[-16, -1], [-13, 2], [-10, 0.1], [-7, 2.4], [-4, 0], [-1, 2.1], [2, -0.2], [6, 2.6], [9, 0.2], [12, 2.2], [16, -0.5]], -10, 0x315c43);
      addRidge([[-16, -1.8], [-12, 0.2], [-9, -1.1], [-6, 0.7], [-3, -1.5], [0, 0.3], [4, -1.2], [7, 0.8], [11, -1.2], [15, 0.1]], -6, 0x214a38);
      const treeCount = lowPower ? 18 : 36;
      const positions = Array.from({ length: treeCount }, (_, index) => {
        const column = index % 12;
        const row = Math.floor(index / 12);
        return {
          x: (column - 5.5) * 1.35 + (row % 2) * 0.5,
          z: -2.7 - row * 2.2 - (column % 3) * 0.35,
          scale: 0.7 + ((index * 7) % 6) * 0.12
        };
      });
      const trunk = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.07, 0.12, 0.8, 5),
        new THREE.MeshStandardMaterial({ color: 0x614a32, roughness: 1 }),
        treeCount
      );
      const foliage = [0x2d704a, 0x3e8752, 0x5b9c5e].map((color, tier) =>
        new THREE.InstancedMesh(
          new THREE.ConeGeometry(0.62 - tier * 0.08, 1.45 - tier * 0.1, 6),
          new THREE.MeshStandardMaterial({ color, roughness: 0.94, flatShading: true }),
          treeCount
        )
      );
      const matrix = new THREE.Object3D();
      positions.forEach((tree, index) => {
        matrix.position.set(tree.x, -1.35 + tree.scale * 0.4, tree.z);
        matrix.scale.setScalar(tree.scale);
        matrix.updateMatrix();
        trunk.setMatrixAt(index, matrix.matrix);
        foliage.forEach((layer, tier) => {
          matrix.position.y = -0.95 + tree.scale * (0.25 + tier * 0.55);
          matrix.scale.setScalar(tree.scale * (1 - tier * 0.13));
          matrix.updateMatrix();
          layer.setMatrixAt(index, matrix.matrix);
        });
      });
      world.add(trunk, ...foliage);
      const waterfallMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            float flow = sin(vUv.x * 42.0 + sin(vUv.y * 12.0) * 3.0 + uTime * 2.4);
            float foam = smoothstep(0.5, 0.95, flow) * smoothstep(0.85, 1.0, vUv.y);
            float edge = smoothstep(0.0, 0.15, vUv.x) * (1.0 - smoothstep(0.85, 1.0, vUv.x));
            vec3 color = mix(vec3(0.12, 0.48, 0.66), vec3(0.67, 0.91, 0.96), foam + 0.2);
            gl_FragColor = vec4(color, edge * 0.78);
          }
        `
      });
      const waterfall = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.8), waterfallMaterial);
      waterfall.position.set(1.2, 0.75, -5.2);
      waterfall.scale.y = 1.3;
      world.add(waterfall);
      const forestStream = addWater(0x07506a, 0x68dbe0, 0.6);
      forestStream.scale.set(0.28, 0.48, 1);
      forestStream.position.set(1.2, -1.85, -5.8);
      const fireflyPositions = new Float32Array((lowPower ? 28 : 64) * 3);
      for (let i = 0; i < fireflyPositions.length / 3; i += 1) {
        fireflyPositions[i * 3] = Math.sin(i * 12.3) * 8;
        fireflyPositions[i * 3 + 1] = -0.5 + (i % 9) * 0.42;
        fireflyPositions[i * 3 + 2] = -1 - (i % 8) * 1.2;
      }
      const fireflies = new THREE.Points(
        new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(fireflyPositions, 3)),
        new THREE.PointsMaterial({ color: 0xd7ff9a, size: 0.09, transparent: true, opacity: 0.85 })
      );
      world.add(fireflies);
      motion.push(time => {
        fireflies.position.y = Math.sin(time * 0.8) * 0.12;
        world.rotation.y = Math.sin(time * 0.12) * 0.018;
        waterfallMaterial.uniforms.uTime.value = time;
      });
    } else if (presetId === 'sunset') {
      addRidge([[-16, -1], [-12, 0.8], [-9, -0.1], [-5, 1.5], [-2, 0.2], [2, 1.2], [6, -0.2], [10, 1.3], [13, 0.4], [16, -0.8]], -9, 0x96536a);
      addRidge([[-16, -1.8], [-12, -0.3], [-9, -1.1], [-6, 0.3], [-2, -1], [2, 0.1], [6, -1.1], [10, 0.3], [13, -0.8], [16, -1.7]], -5, 0x713e58);
      addWater(0x4c263d, 0xf18a46, 0.82);
      const sun = new THREE.Mesh(
        new THREE.SphereGeometry(1.35, 32, 24),
        new THREE.MeshBasicMaterial({ color: 0xffc879 })
      );
      sun.position.set(2.6, 1.55, -12);
      world.add(sun);
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(1.8, 0.025, 8, 80),
        new THREE.MeshBasicMaterial({ color: 0xffb875, transparent: true, opacity: 0.6 })
      );
      halo.position.copy(sun.position);
      world.add(halo);
      const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xffc2a1, transparent: true, opacity: 0.38 });
      const clouds = [0, 1, 2].map(index => {
        const cloud = new THREE.Group();
        cloud.position.set(-5 + index * 5, 2.7 - index * 0.45, -8 - index * 1.4);
        for (let puff = 0; puff < 4; puff += 1) {
          const part = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), cloudMaterial);
          part.position.x = (puff - 1.5) * 0.55;
          part.scale.set(1.5, 0.48, 0.5);
          cloud.add(part);
        }
        world.add(cloud);
        return cloud;
      });
      const palmMaterial = new THREE.MeshStandardMaterial({ color: 0x34263a, roughness: 0.95 });
      const palms: THREE.Group[] = [];
      [-1, 1].forEach((side, index) => {
        const palm = new THREE.Group();
        palm.position.set(side * (6.2 + index * 0.8), -0.35, -1.8 - index * 1.3);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.27, 4.2, 8), palmMaterial);
        trunk.position.y = 2.0;
        trunk.rotation.z = side * -0.12;
        palm.add(trunk);
        const frondShape = new THREE.Shape();
        frondShape.moveTo(0, 0);
        frondShape.quadraticCurveTo(0.82, 0.34, 1.82, 0.12);
        frondShape.quadraticCurveTo(1.53, -0.34, 2.12, -0.92);
        frondShape.quadraticCurveTo(0.92, -0.62, 0, -0.08);
        frondShape.closePath();
        const frondGeometry = new THREE.ShapeGeometry(frondShape, 8);
        const frondMaterial = new THREE.MeshStandardMaterial({
          color: 0x34263a,
          roughness: 0.95,
          side: THREE.DoubleSide
        });
        for (let leaf = 0; leaf < 8; leaf += 1) {
          const angle = (leaf / 8) * Math.PI * 2;
          const frond = new THREE.Mesh(frondGeometry, frondMaterial);
          frond.position.y = 4.1;
          frond.rotation.y = -angle;
          frond.rotation.z = -0.08;
          palm.add(frond);
        }
        world.add(palm);
        palms.push(palm);
      });
      motion.push(time => {
        clouds.forEach((cloud, index) => {
          cloud.position.x = -5 + index * 5 + Math.sin(time * 0.08 + index) * 0.3;
        });
        halo.scale.setScalar(1 + Math.sin(time * 0.45) * 0.035);
        palms.forEach((palm, index) => {
          palm.rotation.z = Math.sin(time * 0.18 + index) * 0.018;
        });
      });
    } else {
      addRidge([[-16, -1.3], [-12, 1], [-9, -0.2], [-6, 2.1], [-3, 0], [0, 1.55], [4, -0.1], [7, 2], [10, 0.2], [13, 1.4], [16, -0.8]], -10, 0x273650);
      addRidge([[-16, -2], [-12, -0.4], [-8, -1.5], [-5, 0.3], [-1, -1.3], [3, 0.1], [7, -1.2], [11, 0.2], [16, -1.8]], -6, 0x18263f);
      addWater(0x031532, 0x2d83dc, 0.86);
      const moon = new THREE.Mesh(
        new THREE.SphereGeometry(0.95, 32, 24),
        new THREE.MeshStandardMaterial({ color: 0xdce9ff, emissive: 0x496b9d, emissiveIntensity: 0.32, roughness: 0.78 })
      );
      moon.position.set(3.2, 3, -12);
      world.add(moon);
      const moonLight = new THREE.PointLight(0x8ebcff, 24, 18, 2);
      moonLight.position.copy(moon.position);
      world.add(moonLight);
      const starPositions = new Float32Array((lowPower ? 90 : 180) * 3);
      for (let i = 0; i < starPositions.length / 3; i += 1) {
        starPositions[i * 3] = Math.sin(i * 31.7) * 15;
        starPositions[i * 3 + 1] = Math.cos(i * 17.3) * 6;
        starPositions[i * 3 + 2] = -8 - (i % 7) * 1.8;
      }
      const stars = new THREE.Points(
        new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(starPositions, 3)),
        new THREE.PointsMaterial({ color: 0xc8ddff, size: 0.055, transparent: true, opacity: 0.8 })
      );
      world.add(stars);
      const cabin = new THREE.Group();
      cabin.position.set(-7.2, -0.2, -4.7);
      const cabinBody = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 1.15, 1.1),
        new THREE.MeshStandardMaterial({ color: 0x312c3a, roughness: 0.9 })
      );
      cabinBody.position.y = 0.55;
      cabin.add(cabinBody);
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(1.25, 0.9, 4),
        new THREE.MeshStandardMaterial({ color: 0x151d31, roughness: 0.9 })
      );
      roof.position.y = 1.52;
      roof.rotation.y = Math.PI / 4;
      cabin.add(roof);
      const windowLight = new THREE.Mesh(
        new THREE.PlaneGeometry(0.24, 0.34),
        new THREE.MeshBasicMaterial({ color: 0xffb35f })
      );
      windowLight.position.set(0, 0.65, 0.56);
      cabin.add(windowLight);
      const cabinGlow = new THREE.PointLight(0xff9b4a, 2.5, 4, 2);
      cabinGlow.position.set(0, 0.8, 0.8);
      cabin.add(cabinGlow);
      world.add(cabin);
      motion.push(time => {
        stars.rotation.z = Math.sin(time * 0.04) * 0.015;
        moonLight.intensity = 21 + Math.sin(time * 0.45) * 2;
        cabinGlow.intensity = 2.1 + Math.sin(time * 1.2) * 0.35;
        world.rotation.y = Math.sin(time * 0.08) * 0.012;
      });
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = { x: 0, y: 0 };
    let width = 0;
    let height = 0;
    let frameId = 0;
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.position.z = camera.aspect < 0.72 ? 15 : camera.aspect < 1 ? 13 : 12;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 0.8 : 1.25));
      if (reducedMotion.matches) renderer.render(scene, camera);
    };
    const onPointerMove = (event: PointerEvent) => {
      pointer.x = (event.clientX / Math.max(width, 1) - 0.5) * 2;
      pointer.y = (event.clientY / Math.max(height, 1) - 0.5) * 2;
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      console.error(`The ${presetId} 3D wallpaper lost its WebGL context.`);
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
      setUnavailable(true);
    };
    const draw = (time = 0) => {
      frameId = 0;
      if (document.hidden) return;
      const seconds = time * 0.001;
      if (!reducedMotion.matches) {
        camera.position.x += (pointer.x * 0.32 - camera.position.x) * 0.014;
        camera.position.y += (1.4 - pointer.y * 0.18 - camera.position.y) * 0.014;
        camera.lookAt(0, 0, -3);
        motion.forEach(update => update(seconds));
      }
      renderer.render(scene, camera);
      if (!reducedMotion.matches) frameId = window.requestAnimationFrame(draw);
    };
    const onMotionPreferenceChange = () => {
      if (reducedMotion.matches) {
        if (frameId) window.cancelAnimationFrame(frameId);
        frameId = 0;
        draw();
      } else if (!frameId && !document.hidden) {
        frameId = window.requestAnimationFrame(draw);
      }
    };
    const onVisibilityChange = () => {
      if (document.hidden && frameId) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      } else if (!document.hidden && !frameId) {
        frameId = window.requestAnimationFrame(draw);
      }
    };

    resize();
    canvas.addEventListener('webglcontextlost', onContextLost);
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    reducedMotion.addEventListener('change', onMotionPreferenceChange);
    if (reducedMotion.matches) draw();
    else frameId = window.requestAnimationFrame(draw);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      reducedMotion.removeEventListener('change', onMotionPreferenceChange);
      scene.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      });
      renderer.dispose();
    };
  }, [enabled, presetId, lowPower]);

  return (
    <div
      className="coordinated-theme-layer"
      data-preset={presetId}
      data-environment={enabled ? 'on' : 'off'}
      data-renderer-unavailable={unavailable}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="coordinated-theme-scene"
        data-preset={presetId}
        style={{ display: !enabled || unavailable ? 'none' : undefined }}
      />
      <div className="coordinated-theme-overlay" />
    </div>
  );
};

export default CoordinatedEnvironment;
