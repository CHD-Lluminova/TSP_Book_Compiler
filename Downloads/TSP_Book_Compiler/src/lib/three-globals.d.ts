declare global {
  interface Window {
    THREE: typeof import('three-legacy');
    TWEEN: typeof import('tween-legacy');
  }
  const THREE: typeof import('three-legacy');
  const TWEEN: typeof import('tween-legacy');
}

export {};
