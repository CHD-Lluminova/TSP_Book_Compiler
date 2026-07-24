declare module 'three-legacy' {
  export class Scene {
    fog: any;
    add(...objects: any[]): void;
  }
  export class PerspectiveCamera {
    position: Vector3;
    aspect: number;
    constructor(fov: number, aspect: number, near: number, far: number);
    updateProjectionMatrix(): void;
  }
  export class WebGLRenderer {
    domElement: HTMLCanvasElement;
    shadowMap: { enabled: boolean; type: number };
    toneMapping: number;
    toneMappingExposure: number;
    constructor(params?: any);
    setSize(w: number, h: number): void;
    setPixelRatio(ratio: number): void;
    render(scene: any, camera: any): void;
  }
  export class OrbitControls {
    enableDamping: boolean;
    dampingFactor: number;
    maxDistance: number;
    minDistance: number;
    target: Vector3;
    constructor(camera: any, domElement: HTMLElement);
    addEventListener(event: string, handler: () => void): void;
    update(): void;
  }
  export class Vector3 {
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
  }
  export class Clock {
    constructor();
    getElapsedTime(): number;
  }
  export class Color {
    constructor(hex: number);
  }
  export class FogExp2 {
    constructor(color: number, density: number);
  }
  export class AmbientLight {
    constructor(color: number, intensity: number);
  }
  export class DirectionalLight {
    position: Vector3;
    castShadow: boolean;
    shadow: { mapSize: { width: number; height: number } };
    constructor(color: number, intensity: number);
  }
  export class PointLight {
    position: Vector3;
    constructor(color: number, intensity: number, distance: number);
  }
  export class PlaneGeometry {
    attributes: { position: BufferAttribute };
    computeVertexNormals(): void;
    constructor(width: number, height: number, segX?: number, segY?: number);
  }
  export class BoxGeometry {
    constructor(width: number, height: number, depth: number);
  }
  export class BufferAttribute {
    getX(i: number): number;
    setZ(i: number, z: number): void;
    count: number;
  }
  export class MeshStandardMaterial {
    map: any;
    color: Color;
    roughness: number;
    metalness: number;
    side: number;
    name: string;
    needsUpdate: boolean;
    constructor(params?: any);
  }
  export class ShadowMaterial {
    opacity: number;
    constructor(params?: any);
  }
  export class Mesh {
    position: Vector3;
    rotation: Vector3;
    material: any;
    visible: boolean;
    castShadow: boolean;
    receiveShadow: boolean;
    constructor(geometry: any, material: any);
  }
  export class Group {
    visible: boolean;
    position: Vector3;
    rotation: Vector3;
    add(...objects: any[]): void;
  }
  export class CanvasTexture {
    constructor(canvas: HTMLCanvasElement);
  }
  export const DoubleSide: number;
  export const PCFSoftShadowMap: number;
  export const ACESFilmicToneMapping: number;
}

declare module 'tween-legacy' {
  export class Tween {
    constructor(object: any);
    to(props: any, duration: number): this;
    easing(fn: any): this;
    start(): this;
    yoyo(value: boolean): this;
    repeat(count: number): this;
  }
  export const Easing: {
    Cubic: { Out: any };
    Quadratic: { Out: any };
  };
  export function update(): void;
}
