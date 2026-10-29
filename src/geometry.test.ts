import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { exportGeometry, generatePlanter, limits, meshStats, presets, validDesign, type Design } from './geometry';
import { serializeMesh } from './exports';

function assertClosedManifold(geometry: THREE.BufferGeometry) {
  const index = geometry.getIndex()!;
  const points = geometry.getAttribute('position');
  const edges = new Map<string, { count: number; direction: number }>();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let signedVolume = 0;
  for (let i = 0; i < index.count; i += 3) {
    const tri = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    a.fromBufferAttribute(points, tri[0]); b.fromBufferAttribute(points, tri[1]); c.fromBufferAttribute(points, tri[2]);
    const cross = b.clone().sub(a).cross(c.clone().sub(a));
    expect(cross.lengthSq()).toBeGreaterThan(1e-10);
    signedVolume += a.dot(b.clone().cross(c)) / 6;
    for (let j = 0; j < 3; j++) {
      const from = tri[j], to = tri[(j + 1) % 3];
      const key = `${Math.min(from, to)}:${Math.max(from, to)}`;
      const current = edges.get(key) ?? { count: 0, direction: 0 };
      current.count++; current.direction += from < to ? 1 : -1;
      edges.set(key, current);
    }
  }
  expect(signedVolume).toBeGreaterThan(0);
  expect([...edges.values()].every(edge => edge.count === 2 && edge.direction === 0)).toBe(true);
  expect([...points.array].every(Number.isFinite)).toBe(true);
  const adjacency = Array.from({ length: points.count }, () => [] as number[]);
  for (const key of edges.keys()) {
    const [from, to] = key.split(':').map(Number);
    adjacency[from].push(to); adjacency[to].push(from);
  }
  const seen = new Set<number>([0]), pending = [0];
  while (pending.length) {
    for (const neighbor of adjacency[pending.pop()!]) {
      if (!seen.has(neighbor)) { seen.add(neighbor); pending.push(neighbor); }
    }
  }
  expect(seen.size).toBe(points.count);
}

describe('printable parametric geometry', () => {
  for (const preset of presets) for (const drainage of [true, false]) {
    it(`${preset.name}: connected, consistently oriented, closed nondegenerate mesh, drainage ${drainage}`, () => {
      const geometry = generatePlanter({ ...preset.design, drainage }, 128, 24);
      assertClosedManifold(geometry);
      expect(geometry.boundingBox!.min.y).toBe(0);
      expect(geometry.boundingBox!.max.y).toBeCloseTo(preset.design.height, 4);
      expect(meshStats(geometry).volumeCm3).toBeGreaterThan(10);
      geometry.dispose();
    });
  }
  it('survives supported parameter extremes', () => {
    for (const maximum of [true, false]) {
      const design = { ...presets[0].design };
      for (const [key, values] of Object.entries(limits)) {
        design[key as Exclude<keyof Design, 'drainage'>] = values[maximum ? 1 : 0];
      }
      const geometry = generatePlanter(design);
      assertClosedManifold(geometry);
      geometry.dispose();
    }
  });
  it('each geometry control actually changes the mesh', () => {
    const baseline = generatePlanter(presets[0].design, 128, 24);
    for (const key of Object.keys(limits) as (keyof typeof limits)[]) {
      const changed = generatePlanter({ ...presets[0].design, [key]: limits[key][1] }, 128, 24);
      expect(Array.from(changed.getAttribute('position').array)).not.toEqual(Array.from(baseline.getAttribute('position').array));
      changed.dispose();
    }
    const sealed = generatePlanter({ ...presets[0].design, drainage: false }, 128, 24);
    expect(meshStats(sealed).volumeCm3).toBeGreaterThan(meshStats(baseline).volumeCm3);
    sealed.dispose(); baseline.dispose();
  });
  it('rotates exports Z-up at original millimeter size', () => {
    const geometry = generatePlanter(presets[0].design, 128, 24);
    const oriented = exportGeometry(geometry);
    oriented.computeBoundingBox();
    expect(oriented.boundingBox!.min.z).toBeCloseTo(0, 4);
    expect(oriented.boundingBox!.max.z).toBeCloseTo(128, 4);
    oriented.dispose(); geometry.dispose();
  });
  it('creates a real open drain, and seals it when disabled', () => {
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 200, 0), new THREE.Vector3(0, -1, 0));
    for (const drainage of [true, false]) {
      const geometry = generatePlanter({ ...presets[0].design, drainage }, 128, 24);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.updateMatrixWorld();
      const hits = ray.intersectObject(mesh);
      expect(hits.length > 0).toBe(!drainage);
      geometry.dispose();
    }
    material.dispose();
  });
  it('matches analytic hollow-cylinder volume in cubic centimeters', () => {
    const segments = 256;
    const design: Design = { ...presets[0].design, diameter: 100, height: 100, taper: 100, depth: 0, wall: 2, twist: 0, drainage: true };
    const geometry = generatePlanter(design, segments, 12);
    const polygonFactor = segments * Math.sin(2 * Math.PI / segments) / 2;
    const expected = polygonFactor * (50 ** 2 * 100 - 48 ** 2 * 97.6 - 3 ** 2 * 2.4) / 1000;
    expect(meshStats(geometry).volumeCm3).toBeCloseTo(expected, 3);
    geometry.dispose();
  });
  it('serializes every triangle to binary STL and OBJ', async () => {
    const geometry = generatePlanter(presets[0].design, 64, 12);
    const triangles = meshStats(geometry).triangles;
    const stl = await serializeMesh(geometry, 'stl').arrayBuffer();
    expect(stl.byteLength).toBe(84 + triangles * 50);
    expect(new DataView(stl).getUint32(80, true)).toBe(triangles);
    const imported = new STLLoader().parse(stl);
    imported.computeBoundingBox();
    expect(imported.getAttribute('position').count).toBe(triangles * 3);
    expect(imported.boundingBox!.min.z).toBeCloseTo(0, 4);
    expect(imported.boundingBox!.max.z).toBeCloseTo(presets[0].design.height, 4);
    const obj = await serializeMesh(geometry, 'obj').text();
    expect(obj.split('\n').filter(line => line.startsWith('f '))).toHaveLength(triangles);
    expect(obj).toContain('units: millimeters');
    imported.dispose(); geometry.dispose();
  });
  it('rejects malformed or out-of-range shared designs', () => {
    expect(validDesign({ ...presets[0].design })).toBe(true);
    for (const invalid of [null, {}, { ...presets[0].design, wall: 0 }, { ...presets[0].design, height: Infinity }, { ...presets[0].design, ribs: 8.5 }, { ...presets[0].design, drainage: 'true' }]) {
      expect(validDesign(invalid)).toBe(false);
      expect(() => generatePlanter(invalid as Design)).toThrow();
    }
  });
});
