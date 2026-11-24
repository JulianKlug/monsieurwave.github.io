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
const MOBILE_QUERY = "(max-width: 720px)"; // matches the mobile breakpoint in style.css
const TAG_TITLE_MAX = 64;
const TAG_OFFSET_PX = 14;
const TAG_RIGHT = `${TAG_OFFSET_PX}px,-50%`;
const TAG_LEFT = `calc(-100% - ${TAG_OFFSET_PX}px),-50%`;
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

// ---- per-theme glyphs: small 3D ball-and-stick models, unit radius ----
//
//        o            atoms: solid spheres, radius per atom
//       / \           bonds: thin lines between atom centres
//      o---o          the whole model spins slowly above its peak
const GLYPH_SIZE = 0.5;
const GLYPH_LIFT = 1.6;
const GLYPH_SPREAD = 0.45; // x offset per lane so glyphs over one peak do not overlap
const SUMMIT_RANGE_X = 1.4;
const SUMMIT_RANGE_Z = 0.9;
const SUMMIT_STEP = 0.1;
const SLOPE_OFFSET_Z = 0.55; // how far down the front slope (toward the viewer) the leader line lands
const BOND_OPACITY = 0.55;
const STEM_OPACITY = 0.9;
const SUMMIT_RING_RADIUS = 0.16;
const GLYPH_DARKEN = 0.7; // line art on a light page needs more contrast than the fills
const STEM_GAP = 0.85; // fraction of glyph size left empty between stem and glyph centre
const CIRCLE_SEGMENTS = 40;
const ATOM = 0.07;
const ATOM_SEGMENTS = [12, 8];
const GLYPH_SPIN = 0.25; // rad/s
const GLYPH_HOVER_SCALE = 1.2;
const GLYPH_HIT_RADIUS = 1.1; // generous invisible sphere, easier to click than thin lines

const arc = (cx, cy, rx, ry, a0, a1, n = CIRCLE_SEGMENTS) =>
  Array.from({ length: n }, (_, i) => {
    const t0 = a0 + ((a1 - a0) * i) / n;
    const t1 = a0 + ((a1 - a0) * (i + 1)) / n;
    return [cx + rx * Math.cos(t0), cy + ry * Math.sin(t0), cx + rx * Math.cos(t1), cy + ry * Math.sin(t1)];
  });
const circle = (cx, cy, rx, ry = rx, n = CIRCLE_SEGMENTS) => arc(cx, cy, rx, ry, 0, 2 * Math.PI, n);

// Tiny model builder: atom() returns its index, bond() joins two indices.
function model() {
  const atoms = [];
  const bonds = [];
  const atom = (x, y, z, r = ATOM) => atoms.push([x, y, z, r]) - 1;
  const bond = (a, b) => bonds.push([a, b]);
  return { atoms, bonds, atom, bond };
}

const ring = (m, n, radius, y, r, phase = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * 2 * Math.PI;
    return m.atom(radius * Math.cos(a), y, radius * Math.sin(a), r);
  });

// Arterial tree, one branch occluded by a large clot with no flow beyond it.
function strokeGlyph() {
  const m = model();
  const BRANCH_ANGLE = 0.5;
  const SHRINK = 0.68;
  const DEPTH = 3;
  const CLOT_PATH = "10";

  const grow = (parent, p, dir, len, depth, path) => {
    if (depth === DEPTH) return;

    // Each generation splits in a plane turned 90° from the previous one: a 3D tree.
    const side = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), (depth * Math.PI) / 2);
    [-1, 1].forEach((sign, k) => {
      const branchPath = path + k;
      const d = dir.clone().applyAxisAngle(side, sign * BRANCH_ANGLE);
      const q = p.clone().addScaledVector(d, len);
      const isClot = branchPath === CLOT_PATH;
      const child = m.atom(q.x, q.y, q.z, isClot ? ATOM * 2.4 : ATOM * (1 - depth * 0.2));
      m.bond(parent, child);
      if (!isClot) grow(child, q, d, len * SHRINK, depth + 1, branchPath);
    });
  };

  const root = m.atom(0, -1, 0, ATOM * 1.3);
  const fork = m.atom(0, -0.35, 0, ATOM);
  m.bond(root, fork);
  grow(fork, new THREE.Vector3(0, -0.35, 0), new THREE.Vector3(0, 1, 0), 0.62, 0, "");
  return m;
}

// Connectome: icosahedral shell of regions, a central hub, one lost spoke.
function networkGlyph() {
  const m = model();
  const geo = new THREE.IcosahedronGeometry(0.9, 0);
  const pos = geo.attributes.position;
  const key = (i) => [pos.getX(i), pos.getY(i), pos.getZ(i)].map((v) => v.toFixed(3)).join();

  // Icosahedron geometry repeats vertices per face: dedupe, then bond each face edge once.
  const ids = new Map();
  const idOf = (i) => {
    const k = key(i);
    if (!ids.has(k)) ids.set(k, m.atom(pos.getX(i), pos.getY(i), pos.getZ(i)));
    return ids.get(k);
  };
  const seen = new Set();
  for (let f = 0; f < pos.count; f += 3) {
    const tri = [idOf(f), idOf(f + 1), idOf(f + 2)];
    [[0, 1], [1, 2], [2, 0]].forEach(([a, b]) => {
      const e = [tri[a], tri[b]].sort().join();
      if (seen.has(e)) return;
      seen.add(e);
      m.bond(tri[a], tri[b]);
    });
  }

  const hub = m.atom(0, 0, 0, ATOM * 1.8);
  const SPOKE_EVERY = 2;
  const LOST_SPOKE = 4;
  [...ids.values()].forEach((v, i) => {
    if (i % SPOKE_EVERY || i === LOST_SPOKE) return;
    m.bond(hub, v);
  });
  return m;
}

// Pupil: iris fibres run from a ring of small atoms to a large central pupil.
function neuroGlyph() {
  const m = model();
  const pupil = m.atom(0, 0, 0, ATOM * 2.6);
  const inner = ring(m, 8, 0.42, 0, ATOM * 0.8);
  const outer = ring(m, 16, 0.9, 0, ATOM * 0.7);

  // Ring lies in XY so the disk faces the viewer as it spins.
  m.atoms.forEach((a) => ([a[1], a[2]] = [a[2], a[1]]));

  outer.forEach((o, i) => m.bond(o, outer[(i + 1) % outer.length]));
  inner.forEach((n, i) => {
    m.bond(n, inner[(i + 1) % inner.length]);
    m.bond(n, outer[2 * i]);
    m.bond(n, pupil);
  });
  return m;
}

// Helicopter, nose toward -x:
//
//        ─────o─────          main rotor on a short mast
//          .--+--.
//         (  cabin )===o==o┤  truss tail boom, fin, tail rotor
//          '-----'
//        ‿__|___|__           skids on struts
function heliGlyph() {
  const m = model();
  const CABIN = [-0.2, 0, 0];
  const CABIN_R = [0.45, 0.32, 0.3];
  const RING_ATOMS = 10;
  const SMALL = ATOM * 0.55;

  // Closed ellipse of atoms through the cabin centre, spanned by two unit axes.
  const ellipse = (u, v, ru, rv) => {
    const ids = Array.from({ length: RING_ATOMS }, (_, i) => {
      const a = (i / RING_ATOMS) * 2 * Math.PI;
      const p = CABIN.map((c, k) => c + ru * Math.cos(a) * u[k] + rv * Math.sin(a) * v[k]);
      return m.atom(...p, ATOM * 0.4);
    });
    ids.forEach((id, i) => m.bond(id, ids[(i + 1) % ids.length]));
    return ids;
  };

  // Cabin: side profile plus waistline, a light wire cage.
  const [rx, ry, rz] = CABIN_R;
  ellipse([1, 0, 0], [0, 1, 0], rx, ry);
  ellipse([1, 0, 0], [0, 0, 1], rx, rz);

  // Tail boom: tapering two-rail truss with zig-zag struts.
  const BOOM_STEPS = 4;
  const upper = [];
  const lower = [];
  for (let i = 0; i <= BOOM_STEPS; i++) {
    const t = i / BOOM_STEPS;
    const x = 0.25 + 0.75 * t;
    upper.push(m.atom(x, 0.12 + 0.06 * t, 0, SMALL));
    lower.push(m.atom(x, -0.06 + 0.18 * t, 0, SMALL));
    if (i) {
      m.bond(upper[i - 1], upper[i]);
      m.bond(lower[i - 1], lower[i]);
      m.bond(i % 2 ? lower[i - 1] : upper[i - 1], i % 2 ? upper[i] : lower[i]);
    }
  }

  // Fin and tail rotor.
  const tail = upper[BOOM_STEPS];
  const finTop = m.atom(1.1, 0.48, 0, SMALL);
  m.bond(tail, finTop);
  m.bond(lower[BOOM_STEPS], finTop);
  const tailHub = m.atom(1.05, 0.3, 0.06, ATOM * 0.8);
  m.bond(tailHub, m.atom(1.05, 0.52, 0.06, SMALL));
  m.bond(tailHub, m.atom(1.05, 0.08, 0.06, SMALL));

  // Mast and four-blade main rotor.
  const mastBase = m.atom(CABIN[0], ry, 0, SMALL);
  const hub = m.atom(CABIN[0], ry + 0.16, 0, ATOM * 1.3);
  m.bond(mastBase, hub);
  const BLADE = 0.95;
  [[BLADE, 0], [-BLADE, 0], [0, BLADE], [0, -BLADE]].forEach(([x, z]) => m.bond(hub, m.atom(CABIN[0] + x, ry + 0.16, z, SMALL)));

  // Skids: rails with an upturned nose, two struts each.
  const SKID_Y = -0.52;
  [-0.24, 0.24].forEach((z) => {
    const tip = m.atom(-0.8, SKID_Y + 0.1, z, SMALL);
    const front = m.atom(-0.6, SKID_Y, z, SMALL);
    const back = m.atom(0.3, SKID_Y, z, SMALL);
    m.bond(tip, front);
    m.bond(front, back);
    [-0.42, 0.05].forEach((x) => m.bond(m.atom(x, -0.24, z * 0.75, SMALL), m.atom(x - 0.04, SKID_Y, z, SMALL)));
  });

  // Centre the silhouette on the spin axis.
  const X_SHIFT = -0.12;
  m.atoms.forEach((a) => (a[0] += X_SHIFT));
  return m;
}

// Neural net funnel: a 3×3 input plane, 2×2 hidden plane, one output.
function netGlyph() {
  const m = model();
  const plane = (x, n, spacing) => {
    const ids = [];
    const half = ((n - 1) * spacing) / 2;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) ids.push(m.atom(x, i * spacing - half, j * spacing - half, ATOM * 0.9));
    }
    return ids;
  };
  const input = plane(-0.85, 3, 0.55);
  const hidden = plane(0, 2, 0.5);
  const output = [m.atom(0.85, 0, 0, ATOM * 1.6)];
  [[input, hidden], [hidden, output]].forEach(([a, b]) => a.forEach((i) => b.forEach((j) => m.bond(i, j))));
  return m;
}

// Octahedron around a central atom.
function otherGlyph() {
  const m = model();
  const c = m.atom(0, 0, 0, ATOM * 1.5);
  const R = 0.8;
  const v = [[R, 0, 0], [-R, 0, 0], [0, R, 0], [0, -R, 0], [0, 0, R], [0, 0, -R]].map(([x, y, z]) => m.atom(x, y, z));
  v.forEach((a) => m.bond(c, a));
  for (let i = 0; i < v.length; i++) {
    for (let j = i + 1; j < v.length; j++) {
      if (Math.floor(i / 2) !== Math.floor(j / 2)) m.bond(v[i], v[j]); // skip opposite vertices
    }
  }
  return m;
}

const GLYPHS = {
  stroke: strokeGlyph,
  networks: networkGlyph,
  neurocritical: neuroGlyph,
  prehospital: heliGlyph,
  "clinical-ai": netGlyph,
  other: otherGlyph,
};

// Group = bonds (lines) + atoms (instanced spheres) + invisible hit sphere for picking.
function buildGlyph(id, color) {
  const { atoms, bonds } = GLYPHS[id]();
  const ink = color.clone().multiplyScalar(GLYPH_DARKEN);
  const group = new THREE.Group();

  const pts = bonds.flatMap(([a, b]) => [...atoms[a].slice(0, 3), ...atoms[b].slice(0, 3)]);
  const lines = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)),
    new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: BOND_OPACITY }),
  );
  group.add(lines);

  const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(1, ...ATOM_SEGMENTS), new THREE.MeshBasicMaterial({ color: ink }), atoms.length);
  const mtx = new THREE.Matrix4();
  atoms.forEach(([x, y, z, r], i) => balls.setMatrixAt(i, mtx.makeScale(r, r, r).setPosition(x, y, z)));
  group.add(balls);

  const hit = new THREE.Mesh(new THREE.SphereGeometry(GLYPH_HIT_RADIUS, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.userData.theme = id;
  group.add(hit);

  group.userData.hit = hit;
  group.traverse((o) => (o.frustumCulled = false));
  return group;
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
  const { works, themes, isVisible, select, isolateTheme, state } = window.researchMap;
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
    const lane = addTag(label, "lane", [-SIZE_X / 2 - 0.2, 0, zOfLane(id)], "-100%,-50%", `var(--${id})`);

    // Lane label click isolates its theme, like the legend chip.
    lane.el.addEventListener("click", () => isolateTheme(id));
  }

  const paperTag = addTag("", "paper-tag", [0, 0, 0], TAG_RIGHT);
  paperTag.el.hidden = true;
  let hovered = null;
  let hoveredGlyph = null;

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
      const wantScale = g.want * GLYPH_SIZE * (g.id === hoveredGlyph ? GLYPH_HOVER_SCALE : 1);
      const sc = g.obj.scale.x + (wantScale - g.obj.scale.x) * EASE;
      maxDelta = Math.max(maxDelta, Math.abs(g.tx - g.x), Math.abs(g.tz - g.z), Math.abs(g.ty - g.y), Math.abs(wantScale - sc));
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
  const pickGlyph = () =>
    ray.intersectObjects(glyphs.filter((g) => g.obj.visible).map((g) => g.obj.userData.hit), false)[0]?.object.userData.theme ?? null;

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

    // Glyph click isolates its theme, like the legend chip.
    const theme = pickGlyph();
    if (theme) return isolateTheme(theme);

    const p = pickAny();
    if (p) select(p.work);
  });
  canvas.addEventListener("pointermove", (e) => {
    aim(e);
    hovered = pickPin();
    const glyph = hovered ? null : pickGlyph();
    if (glyph !== hoveredGlyph) settled = false; // re-run easing for the hover scale
    hoveredGlyph = glyph;
    canvas.style.cursor = hovered || hoveredGlyph ? "pointer" : "grab";
  });
  canvas.addEventListener("pointerleave", () => {
    hovered = null;
    hoveredGlyph = null;
    settled = false;
  });

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

      // Flip the tag to the pin's left when it would run past the frame's right edge.
      v.copy(paperTag.world).project(camera);
      const fitsRight = ((v.x + 1) / 2) * w + TAG_OFFSET_PX + paperTag.el.offsetWidth <= w;
      paperTag.anchor = fitsRight ? TAG_RIGHT : TAG_LEFT;
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
    // Slow spin, phase-shifted per lane so the models do not turn in lockstep.
    const t = performance.now() / 1000;
    glyphs.forEach((g, i) => (g.obj.rotation.y = t * GLYPH_SPIN + i));
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

  // Phones: the 3D terrain is cramped and drag-to-orbit fights page scroll, so open on the network.
  if (matchMedia(MOBILE_QUERY).matches) document.querySelector('.views button[data-view="network"]').click();

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
