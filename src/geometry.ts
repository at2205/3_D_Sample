import * as THREE from 'three';

export interface Design {
  height: number;
  diameter: number;
  taper: number;
  twist: number;
  ribs: number;
  depth: number;
  wall: number;
  drainage: boolean;
}

export const limits = {
  height: [60, 200], diameter: [70, 180], taper: [55, 100],
  twist: [-120, 120], ribs: [8, 64], depth: [0, 5], wall: [1.2, 4],
} as const;

export const presets: { name: string; subtitle: string; design: Design }[] = [
  { name: 'Helix', subtitle: 'A little movement.', design: { height: 128, diameter: 112, taper: 72, twist: 65, ribs: 40, depth: 2.4, wall: 2, drainage: true } },
  { name: 'Dune', subtitle: 'Soft, sculptural rhythm.', design: { height: 102, diameter: 142, taper: 78, twist: 12, ribs: 20, depth: 3.8, wall: 2.4, drainage: true } },
  { name: 'Column', subtitle: 'Quiet architecture.', design: { height: 160, diameter: 96, taper: 94, twist: 0, ribs: 32, depth: 1.8, wall: 2, drainage: true } },
];

export function validDesign(value: unknown): value is Design {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return Object.entries(limits).every(([key, range]) => {
    const n = record[key];
    return typeof n === 'number' && Number.isFinite(n) && n >= range[0] && n <= range[1]
      && (key !== 'ribs' || Number.isInteger(n));
  }) && typeof record.drainage === 'boolean';
}

export function radiusAt(design: Design, t: number, angle: number) {
  const envelope = design.diameter / 2 * (design.taper / 100 + (1 - design.taper / 100) * t);
  const phase = angle - THREE.MathUtils.degToRad(design.twist) * t;
  return envelope + design.depth * (0.5 + 0.5 * Math.cos(design.ribs * phase));
}

/** One indexed shell: outer wall, rim, inner wall, floor, drain bore and underside. */
export function generatePlanter(design: Design, segments = 256, levels = 96): THREE.BufferGeometry {
  if (!validDesign(design)) throw new Error('Design parameters are outside the supported range.');
  if (!Number.isInteger(segments) || segments < 16 || !Number.isInteger(levels) || levels < 2) {
    throw new Error('Mesh resolution must use at least 16 segments and 2 levels.');
  }
  const positions: number[] = [];
  const indices: number[] = [];
  const floor = Math.max(2.4, design.wall);
  const rings: number[] = [];
  const addRing = (y: number, radial: (angle: number) => number) => {
    const start = positions.length / 3;
    for (let i = 0; i < segments; i++) {
      const a = i / segments * Math.PI * 2;
      const r = radial(a);
      positions.push(r * Math.cos(a), y, r * Math.sin(a));
    }
    rings.push(start);
  };
  for (let j = 0; j <= levels; j++) {
    const t = j / levels;
    addRing(t * design.height, a => radiusAt(design, t, a));
  }
  for (let j = levels; j >= 0; j--) {
    const y = floor + (design.height - floor) * j / levels;
    addRing(y, a => radiusAt(design, y / design.height, a) - design.wall);
  }
  if (design.drainage) {
    addRing(floor, () => 3);
    addRing(0, () => 3);
  }
  const connect = (a: number, b: number) => {
    for (let i = 0; i < segments; i++) {
      const n = (i + 1) % segments;
      indices.push(a + i, b + i, a + n, a + n, b + i, b + n);
    }
  };
  for (let i = 0; i < rings.length - 1; i++) connect(rings[i], rings[i + 1]);
  if (design.drainage) {
    connect(rings[rings.length - 1], rings[0]);
  } else {
    const topCenter = positions.length / 3;
    positions.push(0, floor, 0, 0, 0, 0);
    const last = rings[rings.length - 1];
    for (let i = 0; i < segments; i++) {
      const n = (i + 1) % segments;
      indices.push(last + i, topCenter, last + n, rings[0] + n, topCenter + 1, rings[0] + i);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

export function meshStats(geometry: THREE.BufferGeometry) {
  const p = geometry.getAttribute('position');
  const index = geometry.getIndex();
  if (!index) throw new Error('Expected indexed geometry.');
  let volume = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(p, index.getX(i));
    b.fromBufferAttribute(p, index.getX(i + 1));
    c.fromBufferAttribute(p, index.getX(i + 2));
    volume += a.dot(b.cross(c)) / 6;
  }
  const volumeCm3 = Math.abs(volume) / 1000;
  return { triangles: index.count / 3, volumeCm3, grams: volumeCm3 * 1.24 };
}

// Exports are rotated from display Y-up to slicer Z-up, with millimeter coordinates.
export function exportGeometry(geometry: THREE.BufferGeometry) {
  return geometry.clone().rotateX(Math.PI / 2);
}
