import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// 3D research terrain with honest axes:
//   x = publication year, z = research domain (ordered along the care pathway)
//   height = density of papers, so the year slider literally cuts the land.
//
//    domain ↑      ╱╲
//                ╱    ╲___╱╲      pins mark papers, stems touch the surface
//   ───────────────────────── year →

const SIZE_X = 13;
const SIZE_Z = 8;
const SEG_X = 260;
const SEG_Z = 160;
const YEAR_HALF_SPAN = 5.4;
const LANES = ["prehospital", "stroke", "neurocritical", "clinical-ai", "networks", "other"];
const LANE_GAP = 1.15;
const SIGMA_X = 0.85;
const SIGMA_Z = 0.5;
const CULL_SIGMAS = 4;
const AMPLITUDE = 0.9;
const HEIGHT_CAP = 2.4;
const TINT_STRENGTH = 0.6;
const TINT_SATURATION_AT = 1.1;
const CONTOUR_STEP = 0.25;
const JITTER_X = 0.35;
const JITTER_Z = 0.22;
const PIN_LIFT = 0.35;
const PIN_SIZE = 0.11;
const SELECTED_SCALE = 1.8;
const PICK_RADIUS = 1.0;
const CLICK_SLOP_PX = 5;
const EASE = 0.12;
const SETTLED = 0.0005;
const BASE_FOV = 32;
const MAX_FOV = 70;
const WIDE_ASPECT = 1.6;
const SIDE_SHIFT = 0.04;
const LIFT_SHIFT = 0;
const SIDE_SHIFT_MIN_WIDTH = 900;
const TAG_TITLE_MAX = 64;
const BASE_COLOR = "#f6f5f1";
const SLAB_COLOR = "#e6e4dc";
const EDGE_COLOR = "#b9b6aa";
const GRID_COLOR = "#d4d1c6";
const STEM_COLOR = "#8a857a";
const SLAB_THICKNESS = 0.5;
const SLAB_SINK = 0.02; // keeps slab top below flat terrain, avoids z-fighting

const root = document.getElementById("terrain");
const hasWebGL2 = !!document.createElement("canvas").getContext("webgl2");

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- per-theme wireframe glyphs: unit-sized line drawings in the XY plane ----
const GLYPH_SIZE = 0.5;
const GLYPH_LIFT = 1.6;
const GLYPH_SPREAD = 0.45; // x offset per lane so glyphs over one peak do not overlap
const SUMMIT_RANGE_X = 1.4;
const SUMMIT_RANGE_Z = 0.9;
const SUMMIT_STEP = 0.1;
const SLOPE_OFFSET_Z = 0.55; // how far down the front slope (toward the viewer) the leader line lands
const GLYPH_OPACITY = 0.95;
const STEM_OPACITY = 0.9;
const SUMMIT_RING_RADIUS = 0.16;
const GLYPH_DARKEN = 0.7; // line art on a light page needs more contrast than the fills
const STEM_GAP = 0.85; // fraction of glyph size left empty between stem and glyph centre
const CIRCLE_SEGMENTS = 40;
const NODE_SEGMENTS = 14;
const NODE_RADIUS = 0.09;

const arc = (cx, cy, rx, ry, a0, a1, n = CIRCLE_SEGMENTS) =>
  Array.from({ length: n }, (_, i) => {
    const t0 = a0 + ((a1 - a0) * i) / n;
    const t1 = a0 + ((a1 - a0) * (i + 1)) / n;
    return [cx + rx * Math.cos(t0), cy + ry * Math.sin(t0), cx + rx * Math.cos(t1), cy + ry * Math.sin(t1)];
  });
const circle = (cx, cy, rx, ry = rx, n = CIRCLE_SEGMENTS) => arc(cx, cy, rx, ry, 0, 2 * Math.PI, n);
const node = (x, y, r = NODE_RADIUS) => circle(x, y, r, r, NODE_SEGMENTS);

const polyline = (pts, closed = false) => {
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) segs.push([...pts[i], ...pts[i + 1]]);
  if (closed) segs.push([...pts[pts.length - 1], ...pts[0]]);
  return segs;
};

// Smooth sine-modulated curve between two points (gyri, trace lines).
const wave = (x0, y0, x1, y1, amp, cycles, n = 24) => {
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + amp * Math.sin(t * cycles * 2 * Math.PI)];
  });
  return polyline(pts);
};

// Straight edge between two node centres, shortened so it stops at the node outlines.
const link = ([ax, ay], [bx, by], trim = NODE_RADIUS) => {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  return [[ax + ux * trim, ay + uy * trim, bx - ux * trim, by - uy * trim]];
};

const diamond = (cx, cy, r) => polyline([[cx, cy + r], [cx + r, cy], [cx, cy - r], [cx - r, cy]], true);

// Diagonal hatching clipped to a circle.
const hatch = (cx, cy, r, step) => {
  const segs = [];
  const d = [Math.SQRT1_2, -Math.SQRT1_2];
  const n = [Math.SQRT1_2, Math.SQRT1_2];
  for (let t = -r + step / 2; t < r; t += step) {
    const half = Math.sqrt(r * r - t * t);
    segs.push([cx + n[0] * t - d[0] * half, cy + n[1] * t - d[1] * half, cx + n[0] * t + d[0] * half, cy + n[1] * t + d[1] * half]);
  }
  return segs;
};

// Axial brain slice: outline, interhemispheric fissure, gyri, hatched lesion.
const strokeGlyph = () => [
  ...arc(0, 0, 1, 0.82, -Math.PI * 0.46, Math.PI * 1.46),
  ...polyline([[0, 0.8], [0, 0.35]]),
  ...polyline([[0, -0.8], [0, -0.3]]),
  ...wave(-0.85, 0.3, -0.12, 0.36, 0.07, 2.5),
  ...wave(-0.9, -0.05, -0.12, -0.02, 0.07, 3),
  ...wave(-0.8, -0.4, -0.12, -0.38, 0.07, 2.5),
  ...wave(0.12, 0.5, 0.8, 0.45, 0.07, 2.5),
  ...wave(0.12, -0.45, 0.8, -0.42, 0.07, 2.5),
  ...circle(0.5, 0.04, 0.2),
  ...hatch(0.5, 0.04, 0.2, 0.1),
];

// Network with a hub, ring of nodes and one broken (dashed) link
const NET_HUB = [0, 0];
const NET_RING = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * 2 * Math.PI + Math.PI / 6;
  return [0.85 * Math.cos(a), 0.85 * Math.sin(a)];
});
const networkGlyph = () => {
  const segs = [];
  NET_RING.forEach((p, i) => {
    segs.push(...link(p, NET_RING[(i + 1) % NET_RING.length]));
    if (i === 2) {
      // broken spoke: two short stubs with a gap
      const [x, y] = p;
      segs.push([x * 0.9, y * 0.9, x * 0.62, y * 0.62], [x * 0.38, y * 0.38, x * 0.18, y * 0.18]);
      return;
    }
    segs.push(...link(NET_HUB, p, NODE_RADIUS * 1.6));
  });
  NET_RING.forEach(([x, y]) => segs.push(...node(x, y)));
  segs.push(...node(0, 0, NODE_RADIUS * 1.6));
  return segs;
};

// Eye / pupillometry: iris ring with radial ticks around a pupil
const neuroGlyph = () => {
  const segs = [...circle(0, 0, 0.92), ...circle(0, 0, 0.62), ...circle(0, 0, 0.28)];
  const TICKS = 24;
  for (let i = 0; i < TICKS; i++) {
    const a = (i / TICKS) * 2 * Math.PI;
    segs.push([0.34 * Math.cos(a), 0.34 * Math.sin(a), 0.58 * Math.cos(a), 0.58 * Math.sin(a)]);
  }
  segs.push(...arc(0, 0, 0.17, 0.17, Math.PI * 0.55, Math.PI * 0.95, 8)); // glint
  return segs;
};

// Helicopter, side view: cabin, window, tail boom + fin, rotor, skids
const heliGlyph = () => [
  ...circle(-0.1, 0, 0.55, 0.36),
  ...arc(-0.3, 0.03, 0.22, 0.2, Math.PI * 0.45, Math.PI * 1.1, 10),
  ...polyline([[0.42, 0.1], [0.98, 0.2]]),
  ...polyline([[0.42, -0.06], [0.98, 0.13]]),
  ...polyline([[0.9, 0.18], [1.02, 0.5], [0.78, 0.16]]),
  ...polyline([[-0.1, 0.35], [-0.1, 0.55]]),
  ...wave(-1, 0.56, 0.8, 0.56, -0.025, 0.5, 12),
  ...polyline([[-0.55, -0.55], [0.4, -0.55]]),
  ...polyline([[-0.35, -0.34], [-0.42, -0.55]]),
  ...polyline([[0.15, -0.34], [0.22, -0.55]]),
];

// Three-layer neural net with round nodes
const NET_LAYERS = [[-0.9, [0.55, 0, -0.55]], [0, [0.8, 0.27, -0.27, -0.8]], [0.9, [0.55, 0, -0.55]]];
const netGlyph = () => {
  const segs = [];
  for (let c = 0; c < NET_LAYERS.length - 1; c++) {
    for (const ya of NET_LAYERS[c][1]) {
      for (const yb of NET_LAYERS[c + 1][1]) {
        segs.push(...link([NET_LAYERS[c][0], ya], [NET_LAYERS[c + 1][0], yb]));
      }
    }
  }
  NET_LAYERS.forEach(([x, ys]) => ys.forEach((y) => segs.push(...node(x, y))));
  return segs;
};

const GLYPHS = {
  stroke: strokeGlyph,
  networks: networkGlyph,
  neurocritical: neuroGlyph,
  prehospital: heliGlyph,
  "clinical-ai": netGlyph,
  other: () => [...diamond(0, 0, 0.8), ...diamond(0, 0, 0.45), ...diamond(0, 0, 0.12)],
};

function buildGlyph(id, color) {
  const pts = GLYPHS[id]().flatMap(([x0, y0, x1, y1]) => [x0, y0, 0, x1, y1, 0]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  const lines = new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color: color.clone().multiplyScalar(GLYPH_DARKEN), transparent: true, opacity: GLYPH_OPACITY }),
  );
  lines.frustumCulled = false;
  return lines;
}

const TERRAIN_VERT = /* glsl */ `
  attribute vec3 aTint;
  varying vec3 vTint;
  varying float vH;
  varying vec3 vN;
  varying vec2 vXZ;
  void main() {
    vTint = aTint;
    vXZ = position.xz;
    vH = position.y;
    vN = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Soft lambert shading + antialiased contour lines (every 4th is heavier).
const TERRAIN_FRAG = /* glsl */ `
  uniform float uStep;
  uniform vec3 uLight;
  uniform vec4 uGrid;
  uniform vec3 uGridColor;
  varying vec3 vTint;
  varying float vH;
  varying vec3 vN;
  varying vec2 vXZ;

  float contour(float f, float width) {
    float d = abs(fract(f - 0.5) - 0.5) / max(fwidth(f), 1e-4);
    return 1.0 - smoothstep(0.0, width, d);
  }

  float gridLine(float f) {
    float d = abs(fract(f - 0.5) - 0.5) / max(fwidth(f), 1e-4);
    return 1.0 - smoothstep(0.0, 1.2, d);
  }

  void main() {
    vec3 n = normalize(vN);
    float lit = 0.64 + 0.48 * max(dot(n, uLight), 0.0);
    vec3 col = vTint * lit;

    float f = vH / uStep;
    float fade = smoothstep(0.1, 0.25, vH);
    float line = (contour(f, 1.3) * 0.3 + contour(f / 4.0, 1.6) * 0.5) * fade;
    col = mix(col, col * 0.42, line);

    // Year (x) and domain (z) grid, draped on the surface: no z-fighting.
    float grid = max(gridLine((vXZ.x - uGrid.x) / uGrid.y), gridLine((vXZ.y - uGrid.z) / uGrid.w));
    col = mix(col, uGridColor, grid * 0.7 * (1.0 - smoothstep(0.0, 0.6, vH)));

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

function boot() {
  const { works, themes, isVisible, select, state } = window.researchMap;
  const css = getComputedStyle(document.documentElement);
  const themeColor = Object.fromEntries(
    themes.map((t) => [t.id, new THREE.Color(css.getPropertyValue(`--${t.id}`).trim())]),
  );

  const years = works.map((w) => w.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const xOfYear = (y) => -YEAR_HALF_SPAN + ((y - minYear) / (maxYear - minYear)) * 2 * YEAR_HALF_SPAN;
  const zOfLane = (id) => (LANES.indexOf(id) - (LANES.length - 1) / 2) * LANE_GAP;

  const papers = works.map((w) => {
    const rnd = mulberry32(w.id);
    const z = w.themes.reduce((s, t) => s + zOfLane(t), 0) / w.themes.length;
    return {
      work: w,
      x: xOfYear(w.year) + (rnd() - 0.5) * 2 * JITTER_X,
      z: z + (rnd() - 0.5) * 2 * JITTER_Z,
      y: 0,
      targetY: 0,
    };
  });

  // ---- scene ----
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 2, 80);
  camera.position.set(-5, 8, 18);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.3, 0);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minPolarAngle = 0.5;
  controls.maxPolarAngle = Math.PI / 2.1;
  controls.minDistance = 8;
  controls.maxDistance = 30;

  scene.add(new THREE.AmbientLight(0xffffff, 1.0));
  const sun = new THREE.DirectionalLight(0xffffff, 0.6);
  sun.position.set(-4, 8, 6);
  scene.add(sun);

  // Slab: the block the terrain sits in, with crisp outline.
  const slabGeo = new THREE.BoxGeometry(SIZE_X, SLAB_THICKNESS, SIZE_Z);
  const slab = new THREE.Mesh(slabGeo, new THREE.MeshBasicMaterial({ color: SLAB_COLOR, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  slab.position.y = -SLAB_THICKNESS / 2 - SLAB_SINK;
  scene.add(slab);
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(slabGeo),
    new THREE.LineBasicMaterial({ color: EDGE_COLOR }),
  );
  outline.position.copy(slab.position);
  scene.add(outline);

  // Terrain
  const geo = new THREE.PlaneGeometry(SIZE_X, SIZE_Z, SEG_X, SEG_Z);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  geo.setAttribute("aTint", new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
  const tint = geo.attributes.aTint;
  const terrain = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      vertexShader: TERRAIN_VERT,
      fragmentShader: TERRAIN_FRAG,
      uniforms: {
        uStep: { value: CONTOUR_STEP },
        uGrid: { value: new THREE.Vector4(xOfYear(minYear), xOfYear(minYear + 1) - xOfYear(minYear), zOfLane(LANES[0]), LANE_GAP) },
        uGridColor: { value: new THREE.Color(GRID_COLOR) },
        uLight: { value: new THREE.Vector3(-0.4, 0.8, 0.5).normalize() },
      },
    }),
  );
  scene.add(terrain);

  // Pins: a diamond floating above the surface, joined by a thin stem.
  const pinGeo = new THREE.OctahedronGeometry(PIN_SIZE);
  pinGeo.scale(1, 1.4, 1);
  const pins = papers.map((p) => {
    const m = new THREE.Mesh(pinGeo, new THREE.MeshBasicMaterial({ color: themeColor[p.work.themes[0]] }));
    m.userData.paper = p;
    scene.add(m);
    return m;
  });
  const stemGeo = new THREE.BufferGeometry();
  stemGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(papers.length * 6), 3));
  const stems = new THREE.LineSegments(
    stemGeo,
    new THREE.LineBasicMaterial({ color: STEM_COLOR, transparent: true, opacity: 0.7 }),
  );
  stems.frustumCulled = false;
  scene.add(stems);

  // One glyph per theme, floating above that theme's highest visible paper.
  const glyphs = LANES.map((id) => {
    const lineColor = themeColor[id].clone().multiplyScalar(GLYPH_DARKEN);
    const obj = buildGlyph(id, themeColor[id]);
    obj.scale.setScalar(0);
    obj.visible = false;
    scene.add(obj);

    const stem = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3)),
      new THREE.LineBasicMaterial({ color: lineColor, transparent: true, opacity: STEM_OPACITY }),
    );
    stem.frustumCulled = false;
    scene.add(stem);

    // Small ring on the slope so the target of the leader line is unmistakable.
    const ringPts = circle(0, 0, SUMMIT_RING_RADIUS, SUMMIT_RING_RADIUS, 24).flatMap(([x0, y0, x1, y1]) => [x0, 0, y0, x1, 0, y1]);
    const ring = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(ringPts, 3)),
      new THREE.LineBasicMaterial({ color: lineColor, transparent: true, opacity: STEM_OPACITY }),
    );
    ring.frustumCulled = false;
    scene.add(ring);

    return { id, obj, stem, ring, x: 0, z: 0, y: 0, tx: 0, tz: 0, ty: 0, anchor: new THREE.Vector3(), anchorTarget: new THREE.Vector3(), want: 0, placed: false };
  });

  // ---- HTML tags projected from world space ----
  const tags = [];
  function addTag(text, className, world, anchor, color) {
    const el = document.createElement("div");
    el.className = `tag ${className}`;
    el.textContent = text;
    if (color) el.style.color = color;
    root.appendChild(el);
    const tag = { el, world: new THREE.Vector3(...world), anchor };
    tags.push(tag);
    return tag;
  }

  for (let y = minYear; y <= maxYear; y++) {
    addTag(y, "axis", [xOfYear(y), 0, SIZE_Z / 2 + 0.3], "-50%,0");
  }
  addTag("YEAR →", "axis-title", [0, 0, SIZE_Z / 2 + 1.0], "-50%,0");
  for (const id of LANES) {
    const label = themes.find((t) => t.id === id).label;
    addTag(label, "lane", [-SIZE_X / 2 - 0.2, 0, zOfLane(id)], "-100%,-50%", `var(--${id})`);
  }

  const paperTag = addTag("", "paper-tag", [0, 0, 0], "14px,-50%");
  paperTag.el.hidden = true;
  let hovered = null;

  // ---- terrain math ----
  let visible = [];
  const target = new Float32Array(pos.count);
  let settled = false;

  const capped = (raw) => HEIGHT_CAP * Math.tanh(raw / HEIGHT_CAP);
  const bump = (dx, dz) =>
    AMPLITUDE * Math.exp(-(dx * dx) / (2 * SIGMA_X ** 2) - (dz * dz) / (2 * SIGMA_Z ** 2));

  function heightAt(x, z) {
    let raw = 0;
    for (const p of visible) raw += bump(x - p.x, z - p.z);
    return capped(raw);
  }

  // Highest surface point near (x, z): the summit of the mountain the paper sits on.
  function findSummit(x, z) {
    let best = { x, y: heightAt(x, z), z };
    for (let dx = -SUMMIT_RANGE_X; dx <= SUMMIT_RANGE_X; dx += SUMMIT_STEP) {
      for (let dz = -SUMMIT_RANGE_Z; dz <= SUMMIT_RANGE_Z; dz += SUMMIT_STEP) {
        const y = heightAt(x + dx, z + dz);
        if (y > best.y) best = { x: x + dx, y, z: z + dz };
      }
    }
    return best;
  }

  function recompute() {
    visible = papers.filter((p) => isVisible(p.work));
    const base = new THREE.Color(BASE_COLOR);
    const c = new THREE.Color();
    const cullX = SIGMA_X * CULL_SIGMAS;
    const cullZ = SIGMA_Z * CULL_SIGMAS;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      let raw = 0;
      let wr = 0, wg = 0, wb = 0, wsum = 0;

      for (const p of visible) {
        const dx = x - p.x;
        const dz = z - p.z;
        if (Math.abs(dx) > cullX || Math.abs(dz) > cullZ) continue;

        const b = bump(dx, dz);
        raw += b;
        for (const t of p.work.themes) {
          const tc = themeColor[t];
          wr += tc.r * b; wg += tc.g * b; wb += tc.b * b; wsum += b;
        }
      }

      const h = capped(raw);
      target[i] = h;

      // Pale land that picks up its domain's colour as it rises.
      c.copy(base);
      if (wsum > 0) {
        const mix = Math.min(1, h / TINT_SATURATION_AT) * TINT_STRENGTH;
        c.lerp(new THREE.Color(wr / wsum, wg / wsum, wb / wsum), mix);
      }
      tint.setXYZ(i, c.r, c.g, c.b);
    }

    tint.needsUpdate = true;
    papers.forEach((p) => (p.targetY = heightAt(p.x, p.z)));

    for (const g of glyphs) {
      const mine = visible.filter((p) => p.work.themes.includes(g.id) && state.active.has(g.id));
      g.want = mine.length ? 1 : 0;
      if (!mine.length) continue;

      const top = mine.reduce((a, b) => (b.targetY > a.targetY ? b : a));
      g.tx = top.x + (LANES.indexOf(g.id) - (LANES.length - 1) / 2) * GLYPH_SPREAD;
      g.tz = top.z;
      const summit = findSummit(top.x, top.z);

      // Anchor on the mountain's front slope, straight below the glyph.
      const anchorZ = summit.z + SLOPE_OFFSET_Z;
      const anchorY = heightAt(g.tx, anchorZ);
      g.tz = anchorZ;
      g.ty = anchorY + GLYPH_LIFT;
      g.anchorTarget.set(g.tx, anchorY, anchorZ);
      if (!g.placed) {
        Object.assign(g, { x: g.tx, z: g.tz, y: g.ty, placed: true });
        g.anchor.copy(g.anchorTarget);
      }
    }
    settled = false;
  }

  const selectedPaper = () => papers.find((p) => p.work === state.selected);

  function easeStep() {
    if (settled) return;
    let maxDelta = 0;

    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const d = target[i] - y;
      pos.setY(i, y + d * EASE);
      maxDelta = Math.max(maxDelta, Math.abs(d));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    const sel = selectedPaper();
    const stemPos = stemGeo.attributes.position;
    papers.forEach((p, i) => {
      p.y += (p.targetY - p.y) * EASE;
      maxDelta = Math.max(maxDelta, Math.abs(p.targetY - p.y));

      const want = isVisible(p.work) ? (p === sel ? SELECTED_SCALE : 1) : 0;
      const m = pins[i];
      const s = m.scale.x + (want - m.scale.x) * EASE;
      maxDelta = Math.max(maxDelta, Math.abs(want - s));
      m.scale.setScalar(s);
      m.visible = s > 0.02;
      m.position.set(p.x, p.y + PIN_LIFT * s, p.z);

      stemPos.setXYZ(i * 2, p.x, p.y, p.z);
      stemPos.setXYZ(i * 2 + 1, p.x, p.y + PIN_LIFT * s, p.z);
    });
    stemPos.needsUpdate = true;

    for (const g of glyphs) {
      g.x += (g.tx - g.x) * EASE;
      g.z += (g.tz - g.z) * EASE;
      g.y += (g.ty - g.y) * EASE;
      const sc = g.obj.scale.x + (g.want * GLYPH_SIZE - g.obj.scale.x) * EASE;
      maxDelta = Math.max(maxDelta, Math.abs(g.tx - g.x), Math.abs(g.tz - g.z), Math.abs(g.ty - g.y), Math.abs(g.want * GLYPH_SIZE - sc));
      g.obj.scale.setScalar(sc);
      g.obj.visible = sc > 0.01;
      g.obj.position.set(g.x, g.y, g.z);

      // Leader line from the glyph down to its mountain slope.
      g.anchor.lerp(g.anchorTarget, EASE);
      const sp = g.stem.geometry.attributes.position;
      sp.setXYZ(0, g.anchor.x, g.anchor.y, g.anchor.z);
      sp.setXYZ(1, g.x, g.y - sc * STEM_GAP, g.z);
      sp.needsUpdate = true;
      g.stem.visible = g.obj.visible;
      g.ring.visible = g.obj.visible;
      g.ring.position.copy(g.anchor);
    }

    if (maxDelta < SETTLED) settled = true;
  }

  // ---- picking ----
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt = null;

  function aim(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }

  const pickPin = () => ray.intersectObjects(pins.filter((m) => m.visible))[0]?.object.userData.paper ?? null;

  function pickAny() {
    const pin = pickPin();
    if (pin) return pin;

    const hit = ray.intersectObject(terrain)[0];
    if (!hit) return null;

    let best = null;
    let bestD = PICK_RADIUS;
    for (const p of visible) {
      const d = Math.hypot(p.x - hit.point.x, p.z - hit.point.z);
      if (d < bestD) { best = p; bestD = d; }
    }
    return best;
  }

  const canvas = renderer.domElement;
  canvas.addEventListener("pointerdown", (e) => (downAt = [e.clientX, e.clientY]));
  canvas.addEventListener("pointerup", (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > CLICK_SLOP_PX) return;
    aim(e);
    const p = pickAny();
    if (p) select(p.work);
  });
  canvas.addEventListener("pointermove", (e) => {
    aim(e);
    hovered = pickPin();
    canvas.style.cursor = hovered ? "pointer" : "grab";
  });
  canvas.addEventListener("pointerleave", () => (hovered = null));

  // ---- sizing / loop ----
  function resize() {
    const w = root.clientWidth;
    const h = root.clientHeight;
    if (!w || !h) return;

    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = Math.min(MAX_FOV, BASE_FOV * Math.max(1, WIDE_ASPECT / camera.aspect));

    // Wide screens: nudge the scene right, away from the title overlay.
    if (w >= SIDE_SHIFT_MIN_WIDTH) camera.setViewOffset(w, h, -w * SIDE_SHIFT, h * LIFT_SHIFT, w, h);
    else camera.clearViewOffset();

    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(root);

  const v = new THREE.Vector3();
  function placeTags() {
    const w = root.clientWidth;
    const h = root.clientHeight;

    // Hover tag only: the selected paper is shown by the detail card instead.
    const active = hovered && hovered.work !== state.selected ? hovered : null;
    paperTag.el.hidden = !active;
    if (active) {
      paperTag.world.set(active.x, active.y + PIN_LIFT, active.z);
      const t = active.work.title;
      paperTag.el.textContent = `${active.work.year} · ${t.length > TAG_TITLE_MAX ? t.slice(0, TAG_TITLE_MAX) + "…" : t}`;
    }

    for (const tag of tags) {
      if (tag.el.hidden) continue;
      v.copy(tag.world).project(camera);
      const px = ((v.x + 1) / 2) * w;
      const py = ((1 - v.y) / 2) * h;
      tag.el.style.transform = `translate(${px}px,${py}px) translate(${tag.anchor})`;
    }
  }

  function frame() {
    easeStep();
    controls.update();
    for (const g of glyphs) g.obj.quaternion.copy(camera.quaternion);
    renderer.render(scene, camera);
    placeTags();
    requestAnimationFrame(frame);
  }

  // ---- view toggle ----
  const graph = document.getElementById("graph");
  document.querySelectorAll(".views button").forEach((b) =>
    b.addEventListener("click", () => {
      const is3d = b.dataset.view === "terrain";
      root.hidden = !is3d;
      graph.style.display = is3d ? "none" : "block";
      document.querySelectorAll(".views button").forEach((o) => o.setAttribute("aria-pressed", o === b));
      if (is3d) resize();
    }),
  );

  document.addEventListener("map:refresh", recompute);

  recompute();
  resize();
  frame();
}

if (!root || !hasWebGL2) {
  document.querySelector(".views")?.remove();
} else if (window.researchMap) {
  boot();
} else {
  document.addEventListener("map:ready", boot, { once: true });
}
