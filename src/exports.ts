import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { exportGeometry } from './geometry';

export function serializeMesh(geometry: THREE.BufferGeometry, format: 'stl' | 'obj'): Blob {
  const oriented = exportGeometry(geometry);
  const material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.Mesh(oriented, material);
  mesh.name = 'FORM_Planter_mm';
  try {
    if (format === 'stl') {
      const result = new STLExporter().parse(mesh, { binary: true });
      const bytes = new Uint8Array(result.byteLength);
      bytes.set(new Uint8Array(result.buffer, result.byteOffset, result.byteLength));
      return new Blob([bytes], { type: 'application/octet-stream' });
    }
    return new Blob(['# FORM Studio | units: millimeters | Z up\n', new OBJExporter().parse(mesh)], { type: 'text/plain' });
  } finally {
    oriented.dispose();
    material.dispose();
  }
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
