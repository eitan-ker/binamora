// BinaMora 3D devil: self-contained module (three.js + GLTFLoader + MeshoptDecoder), bundled by esbuild.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, ACESFilmicToneMapping, SRGBColorSpace,
  PMREMGenerator, HemisphereLight, DirectionalLight, Box3, Vector3, RepeatWrapping, MathUtils
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const SWAY = MathUtils.degToRad(25);   // gentle ±25° yaw (sides/back textures are stretched)
const PERIOD = 14;                      // seconds per full sway cycle

export async function createDevil(canvas, opts) {
  opts = opts || {};
  const mobile = !!opts.mobile;
  const maxDpr = mobile ? 1.25 : 1.5;
  const renderer = new WebGLRenderer({
    canvas, alpha: true, antialias: true, powerPreference: mobile ? 'low-power' : 'default',
    preserveDrawingBuffer: !!opts.preserve
  });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.35;
  pmrem.dispose();
  scene.add(new HemisphereLight(0x8899aa, 0x221111, 0.45));
  const key = new DirectionalLight(0xffe6c8, 2.3); key.position.set(2, 3, 4); scene.add(key);
  const rim = new DirectionalLight(0xff5522, 2.4); rim.position.set(-3, 2, -3); scene.add(rim);
  const rim2 = new DirectionalLight(0xff6a2a, 1.4); rim2.position.set(3, 1.5, -3); scene.add(rim2);

  const camera = new PerspectiveCamera(30, 0.8, 0.1, 50);

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(opts.src);
  const model = gltf.scene;
  const pivot = new Scene(); // yaw pivot (a bare Object3D would do; Scene is fine and tiny)
  pivot.add(model);
  scene.add(pivot);

  // Flames: per-node material + texture clones so each flame runs its own flipbook phase.
  const flames = [];
  model.traverse(function (o) {
    if (!o.isMesh) return;
    let n = o, isFlame = false;
    while (n) { if (/^flame_\d+$/.test(n.name)) { isFlame = true; break; } n = n.parent; }
    if (!isFlame) return;
    const m = o.material.clone();
    m.depthWrite = false;
    m.transparent = true;
    if (m.map) {
      m.map = m.map.clone();
      m.map.wrapS = RepeatWrapping;
      m.map.needsUpdate = true;
    }
    o.material = m;
    o.renderOrder = 2;
    flames.push({ mesh: o, node: n, mat: m, base: m.map ? m.map.offset.x : 0, sy: n.scale.y, sx: n.scale.x, phase: flames.length * 1.7 });
  });

  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());
  const cy = (box.min.y + box.max.y) / 2;

  let w = 0, h = 0, aspect = 0.8;
  function resize(cw, ch) {
    w = Math.max(1, Math.round(cw)); h = Math.max(1, Math.round(ch));
    aspect = w / h;
    renderer.setPixelRatio(Math.min(opts.dpr || window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(w, h, false);
    camera.aspect = aspect;
    // keep the whole figure in frame on narrow boxes (30° vertical FOV, nominal distance 5)
    const vfov = MathUtils.degToRad(camera.fov);
    const needH = size.y * 1.18, needW = Math.max(size.x, size.z * 0.5) * 1.12;
    const dist = Math.max(5, (needH / 2) / Math.tan(vfov / 2), (needW / 2) / (Math.tan(vfov / 2) * aspect));
    camera.position.set(0, cy + 0.3 * (dist / 5), dist);
    camera.lookAt(0, cy, 0);
    camera.updateProjectionMatrix();
  }

  let flare = 0;      // 0..1 flame flare (tap)
  let aim = 0;        // pointer-driven extra yaw (eased)
  let aimT = 0;
  function frame(t) {
    const yaw = Math.sin(t * Math.PI * 2 / PERIOD) * SWAY + aim;
    pivot.rotation.y = yaw;
    const step = Math.floor(t * (10 + flare * 8));
    for (let i = 0; i < flames.length; i++) {
      const f = flames[i];
      if (f.mat.map) f.mat.map.offset.x = f.base + ((step + i * 3) % 4) * 0.25;
      const flick = 1 + 0.05 * Math.sin(t * 7 + f.phase) + flare * 0.35;
      f.node.scale.set(f.sx * (1 + flare * 0.12), f.sy * flick, f.node.scale.z);
    }
    rim.intensity = 2.4 + flare * 2.2 + 0.15 * Math.sin(t * 3.1);
    renderer.render(scene, camera);
  }
  function tick(dt) {
    flare = Math.max(0, flare - dt * 1.4);
    aim += (aimT - aim) * Math.min(1, dt * 4);
  }

  return {
    resize, frame, tick, renderer,
    flare: function () { flare = 1; },
    aim: function (v) { aimT = v * MathUtils.degToRad(10); },
    flames: flames.length,
    still: function (yaw) { aim = aimT = 0; pivot.rotation.y = yaw || 0; flames.forEach(function (f) { if (f.mat.map) f.mat.map.offset.x = f.base; }); renderer.render(scene, camera); },
    info: { size: size.toArray(), center: cy }
  };
}
