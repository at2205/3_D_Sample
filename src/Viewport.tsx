import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

interface Props {
  geometry: THREE.BufferGeometry;
  color: string;
  wireframe: boolean;
  autoRotate: boolean;
}

export interface ViewportHandle { reset: () => void; image: () => Blob | Promise<Blob> }

export const Viewport = forwardRef<ViewportHandle, Props>(function Viewport(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>; controls: OrbitControls; renderer: THREE.WebGLRenderer; frame: (reset?: boolean) => void; render: () => void } | null>(null);
  const [error, setError] = useState('');
  useImperativeHandle(ref, () => ({
    reset() {
      const state = sceneRef.current;
      state?.frame(true);
    },
    async image() {
      const state = sceneRef.current;
      if (!state) throw new Error('The 3D viewport is not available.');
      state.render();
      return new Promise<Blob>((resolve, reject) => {
        state.renderer.domElement.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not capture preview.')), 'image/png');
      });
    },
  }), []);
  useEffect(() => {
    const element = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); }
    catch (cause) {
      console.error('WebGL initialization failed', cause);
      setError('WebGL is unavailable. Enable hardware acceleration or try another browser. Geometry and exports still work.');
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#eeeee7');
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 2000);
    camera.position.set(235, 190, 275);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 68, 0);
    controls.enableDamping = true;
    controls.minDistance = 150;
    controls.maxDistance = 650;
    controls.maxPolarAngle = Math.PI * 0.53;
    controls.autoRotateSpeed = 1;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    room.dispose();
    pmrem.dispose();
    const material = new THREE.MeshStandardMaterial({ color: props.color, roughness: 0.55, metalness: 0.02, envMapIntensity: 0.65 });
    const mesh = new THREE.Mesh(props.geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    scene.add(new THREE.HemisphereLight('#fff9ec', '#8e917a', 0.9));
    const key = new THREE.DirectionalLight('#fff8eb', 2.4);
    key.position.set(-100, 240, 160);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -180; key.shadow.camera.right = 180;
    key.shadow.camera.top = 220; key.shadow.camera.bottom = -180;
    key.shadow.normalBias = 0.4;
    scene.add(key);
    const groundMaterial = new THREE.ShadowMaterial({ color: '#555b43', opacity: 0.18 });
    const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(600, 30, '#c6c8ba', '#dcded3');
    grid.position.y = -0.3;
    const gridMaterial = grid.material as THREE.Material;
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.28;
    scene.add(grid);
    const frame = (reset = false) => {
      mesh.geometry.computeBoundingSphere();
      const sphere = mesh.geometry.boundingSphere!;
      const verticalHalfFov = THREE.MathUtils.degToRad(camera.fov / 2);
      const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * camera.aspect);
      const distance = Math.max(320, sphere.radius / Math.sin(Math.min(verticalHalfFov, horizontalHalfFov)) * 1.18);
      const direction = reset ? new THREE.Vector3(1, 0.6, 1.3).normalize() : camera.position.clone().sub(controls.target).normalize();
      controls.target.copy(sphere.center);
      camera.position.copy(sphere.center).addScaledVector(direction, distance);
      controls.minDistance = distance * 0.45;
      controls.maxDistance = distance * 2.7;
      controls.update();
      renderer.render(scene, camera);
    };
    sceneRef.current = { mesh, controls, renderer, frame, render: () => renderer.render(scene, camera) };
    const resize = new ResizeObserver(() => {
      const { width, height } = element.getBoundingClientRect();
      if (height === 0 || width === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      frame();
    });
    resize.observe(element);
    renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
    return () => {
      resize.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      material.dispose(); groundGeometry.dispose(); groundMaterial.dispose();
      grid.geometry.dispose(); gridMaterial.dispose(); environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
    // The scene is created once; changing mesh and material values happens below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const state = sceneRef.current;
    if (state) { state.mesh.geometry = props.geometry; state.frame(); }
  }, [props.geometry]);
  useEffect(() => {
    const state = sceneRef.current;
    if (state) {
      state.mesh.material.color.set(props.color);
      state.mesh.material.wireframe = props.wireframe;
      state.controls.autoRotate = props.autoRotate;
      state.render();
    }
  }, [props.color, props.wireframe, props.autoRotate]);
  return <div ref={host} className="viewport" role="img" aria-label="Interactive 3D planter. Drag to orbit, scroll to zoom.">{error && <div className="viewport-error" role="alert">{error}</div>}</div>;
});
