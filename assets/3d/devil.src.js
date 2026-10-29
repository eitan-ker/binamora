// BinaMora 3D background characters (devil | robot): self-contained module (three.js + GLTFLoader + MeshoptDecoder), bundled by esbuild.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, ACESFilmicToneMapping, SRGBColorSpace,
  PMREMGenerator, HemisphereLight, DirectionalLight, Box3, Vector3, RepeatWrapping, MathUtils, AnimationMixer
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const SWAY = MathUtils.degToRad(25);   // gentle ±25° yaw (sides/back textures are stretched)
const PERIOD = 14;                      // seconds per full sway cycle

// per-model look: lights + idle motion
const KINDS = {
  devil: { hemi: [0x8899aa, 0x221111, 0.45], key: [0xffe6c8, 2.3], rim: [0xff5522, 2.4], rim2: [0xff6a2a, 1.4], env: 0.35, exposure: 1.0, glow: false },
  robot: { hemi: [0x9fc4e0, 0x10161e, 0.55], key: [0xf2f6ff, 2.1], rim: [0x38c8ff, 2.6], rim2: [0xffc23a, 1.2], env: 0.55, exposure: 1.05, glow: true }
};

export function createDevil(canvas, opts) { return createCharacter(canvas, Object.assign({ kind: 'devil' }, opts)); }

export async function createCharacter(canvas, opts) {
  opts = opts || {};
  const kind = KINDS[opts.kind] ? opts.kind : 'devil';
  const K = KINDS[kind];
  const mobile = !!opts.mobile;
  const maxDpr = mobile ? 1.25 : 1.5;
  const renderer = new WebGLRenderer({
    canvas, alpha: true, antialias: true, powerPreference: mobile ? 'low-power' : 'default',
    preserveDrawingBuffer: !!opts.preserve
  });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = K.exposure;
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = K.env;
  pmrem.dispose();
  scene.add(new HemisphereLight(K.hemi[0], K.hemi[1], K.hemi[2]));
  const key = new DirectionalLight(K.key[0], K.key[1]); key.position.set(2, 3, 4); scene.add(key);
  const rim = new DirectionalLight(K.rim[0], K.rim[1]); rim.position.set(-3, 2, -3); scene.add(rim);
  const rim2 = new DirectionalLight(K.rim2[0], K.rim2[1]); rim2.position.set(3, 1.5, -3); scene.add(rim2);

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

  // Glowing parts (emissive maps, e.g. the robot's eyes/lights): pulse gently, surge on flare.
  const glows = [];
  model.traverse(function (o) {
    if (!K.glow || !o.isMesh || !o.material || !o.material.emissiveMap) return;
    o.material = o.material.clone();
    glows.push({ mat: o.material, base: o.material.emissiveIntensity || 1 });
  });
  // Embedded animation clips, if any
  let mixer = null;
  if (gltf.animations && gltf.animations.length) {
    mixer = new AnimationMixer(model);
    gltf.animations.forEach(function (c) { mixer.clipAction(c).play(); });
  }

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
    rim.intensity = K.rim[1] + flare * 2.2 + 0.15 * Math.sin(t * 3.1);
    for (let i = 0; i < glows.length; i++) glows[i].mat.emissiveIntensity = glows[i].base * (1.15 + 0.35 * Math.sin(t * 2.4 + i) + flare * 1.6);
    renderer.render(scene, camera);
  }
  function tick(dt) {
    flare = Math.max(0, flare - dt * 1.4);
    aim += (aimT - aim) * Math.min(1, dt * 4);
    if (mixer) mixer.update(dt);
  }

  return {
    resize, frame, tick, renderer,
    flare: function () { flare = 1; },
    aim: function (v) { aimT = v * MathUtils.degToRad(10); },
    flames: flames.length, glows: glows.length, clips: mixer ? gltf.animations.length : 0, kind,
    still: function (yaw) { aim = aimT = 0; pivot.rotation.y = yaw || 0; flames.forEach(function (f) { if (f.mat.map) f.mat.map.offset.x = f.base; }); renderer.render(scene, camera); },
    info: { size: size.toArray(), center: cy }
  };
}
