import type { BookPage, Covers } from '@/types';
import { getWrappedLines } from './textWrap';

interface BookEngineCallbacks {
  onSpreadChange?: (index: number) => void;
}

interface LoadedImages {
  pages: Record<number, HTMLImageElement | null>;
  fullWrap: HTMLImageElement | null;
  front: HTMLImageElement | null;
  back: HTMLImageElement | null;
  spine: HTMLImageElement | null;
}

export class Book3DEngine {
  private container: HTMLElement;
  private scene: any = null;
  private camera: any = null;
  private renderer: any = null;
  private controls: any = null;
  private closedBookMesh: any = null;
  private openedBookGroup: any = null;
  private leftPageMesh: any = null;
  private rightPageMesh: any = null;
  private leftCoverMesh: any = null;
  private rightCoverMesh: any = null;
  private closedMaterials: any[] = [];
  private clock = new THREE.Clock();
  private animFrame = 0;

  private frontCanvas: HTMLCanvasElement;
  private backCanvas: HTMLCanvasElement;
  private spineCanvas: HTMLCanvasElement;
  private leftPageCanvas: HTMLCanvasElement;
  private rightPageCanvas: HTMLCanvasElement;

  private pages: BookPage[] = [];
  private covers: Covers = { front: null, back: null, spine: null, fullWrap: null };
  private loadedImages: LoadedImages = {
    pages: {},
    fullWrap: null,
    front: null,
    back: null,
    spine: null,
  };

  private activeSpreadIndex = 0;
  private isBookOpen = false;
  private autoSpin = true;
  private autoFloat = true;

  private callbacks: BookEngineCallbacks;
  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement, callbacks: BookEngineCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    this.frontCanvas = document.createElement('canvas');
    this.backCanvas = document.createElement('canvas');
    this.spineCanvas = document.createElement('canvas');
    this.leftPageCanvas = document.createElement('canvas');
    this.rightPageCanvas = document.createElement('canvas');

    this.frontCanvas.width = 1024;
    this.frontCanvas.height = 1424;
    this.backCanvas.width = 1024;
    this.backCanvas.height = 1424;
    this.spineCanvas.width = 256;
    this.spineCanvas.height = 1424;
    this.leftPageCanvas.width = 1024;
    this.leftPageCanvas.height = 1424;
    this.rightPageCanvas.width = 1024;
    this.rightPageCanvas.height = 1424;
  }

  async setBook(pages: BookPage[], covers: Covers) {
    this.pages = pages.map((p) => ({ ...p }));
    this.covers = { ...covers };
    await this.preloadImages();
    this.recreateBookMesh();
    this.updateAllTextures();
  }

  updatePages(pages: BookPage[]) {
    this.pages = pages.map((p) => ({ ...p }));
    this.updateAllTextures();
  }

  updateCovers(covers: Covers) {
    this.covers = { ...covers };
    this.updateAllTextures();
  }

  private async preloadImages() {
    const promises: Promise<void>[] = [];

    const loadCover = (src: string | null, slot: keyof LoadedImages) => {
      if (!src) {
        (this.loadedImages as any)[slot] = null;
        return;
      }
      promises.push(
        this.loadImg(src).then((img) => {
          (this.loadedImages as any)[slot] = img;
        })
      );
    };

    loadCover(this.covers.fullWrap, 'fullWrap');
    loadCover(this.covers.front, 'front');
    loadCover(this.covers.back, 'back');
    loadCover(this.covers.spine, 'spine');

    this.loadedImages.pages = {};
    this.pages.forEach((p) => {
      if (p.imageDataUrl) {
        promises.push(
          this.loadImg(p.imageDataUrl).then((img) => {
            this.loadedImages.pages[p.num] = img;
          })
        );
      }
    });

    await Promise.all(promises);
  }

  private loadImg(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image load failed'));
      img.src = src;
    });
  }

  private getBookThickness() {
    return Math.min(2.5, 0.25 + this.pages.length * 0.08);
  }

  private createPageCurveGeometry(width: number, height: number, segX: number, segY: number, isLeft: boolean) {
    const geo = new THREE.PlaneGeometry(width, height, segX, segY);
    const pos = geo.attributes.position;
    const curveIntensity = 0.15;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const normX = isLeft ? (x + width / 2) / width : (width / 2 - x) / width;
      const z = Math.sin(normX * Math.PI * 0.5) * curveIntensity;
      pos.setZ(i, z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  init() {
    const THREE_ANY = THREE as any;

    this.scene = new THREE_ANY.Scene();
    this.scene.fog = new THREE_ANY.FogExp2(0x0a0c10, 0.04);

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;

    this.camera = new THREE_ANY.PerspectiveCamera(40, w / h, 0.1, 100);
    this.camera.position.set(0, 1.2, 10);

    this.renderer = new THREE_ANY.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE_ANY.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE_ANY.NoToneMapping; // Changed to NoToneMapping
    this.renderer.toneMappingExposure = 1.0; // Reset exposure
    this.renderer.outputEncoding = THREE_ANY.sRGBEncoding; // Corrected for r128
    this.renderer.setClearColor(0x000000, 0); // Set clear color to transparent black
    this.container.appendChild(this.renderer.domElement);

    this.controls = new THREE_ANY.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 15;
    this.controls.minDistance = 3;
    this.controls.target.set(0, 0, 0);
    this.controls.addEventListener('start', () => {
      if (this.autoSpin) this.toggleAutoSpin();
    });

    const ambientLight = new THREE_ANY.AmbientLight(0xffffff, 0.05); // Significantly reduced intensity
    this.scene.add(ambientLight);

    const dirLight = new THREE_ANY.DirectionalLight(0xffffff, 1.8); // Increased intensity
    dirLight.position.set(5, 10, 6);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    this.scene.add(dirLight);

    const pointLight = new THREE_ANY.PointLight(0xffffff, 3.0, 15); // Neutral white, increased intensity
    pointLight.position.set(-3, 2, 4);
    this.scene.add(pointLight);

    const shadowPlaneGeo = new THREE_ANY.PlaneGeometry(30, 30);
    const shadowPlaneMat = new THREE_ANY.ShadowMaterial({ opacity: 0.35 });
    const shadowPlane = new THREE_ANY.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -3.0;
    shadowPlane.receiveShadow = true;
    this.scene.add(shadowPlane);

    this.recreateBookMesh();

    this.openedBookGroup = new THREE_ANY.Group();
    this.openedBookGroup.visible = false;
    this.scene.add(this.openedBookGroup);

    const coverWidth = 3.75;
    const coverHeight = 5.25;
    const coverThickness = 0.08;
    const coverGeo = new THREE_ANY.BoxGeometry(coverWidth, coverHeight, coverThickness);

    const coverLMaterials = Array(6)
      .fill(null)
      .map(
        (_, idx) =>
          new THREE_ANY.MeshBasicMaterial({
            color: idx === 4 || idx === 5 ? 0xffffff : 0x134e4a,
          })
      );
    const coverRMaterials = Array(6)
      .fill(null)
      .map(
        (_, idx) =>
          new THREE_ANY.MeshBasicMaterial({
            color: idx === 4 || idx === 5 ? 0xffffff : 0x134e4a,
          })
      );

    this.leftCoverMesh = new THREE_ANY.Mesh(coverGeo, coverLMaterials);
    this.leftCoverMesh.position.set(-1.875, 0, -0.06);
    this.leftCoverMesh.castShadow = true;
    this.openedBookGroup.add(this.leftCoverMesh);

    this.rightCoverMesh = new THREE_ANY.Mesh(coverGeo, coverRMaterials);
    this.rightCoverMesh.position.set(1.875, 0, -0.06);
    this.rightCoverMesh.castShadow = true;
    this.openedBookGroup.add(this.rightCoverMesh);

    const leftCurvedGeo = this.createPageCurveGeometry(3.6, 5.1, 15, 15, true);
    const rightCurvedGeo = this.createPageCurveGeometry(3.6, 5.1, 15, 15, false);

    const pageMatConfig = { side: THREE_ANY.DoubleSide };
    this.leftPageMesh = new THREE_ANY.Mesh(leftCurvedGeo, new THREE_ANY.MeshBasicMaterial(pageMatConfig));
    this.leftPageMesh.position.set(-1.82, 0, 0);
    this.leftPageMesh.castShadow = true;
    this.openedBookGroup.add(this.leftPageMesh);

    this.rightPageMesh = new THREE_ANY.Mesh(rightCurvedGeo, new THREE_ANY.MeshBasicMaterial(pageMatConfig));
    this.rightPageMesh.position.set(1.82, 0, 0);
    this.rightPageMesh.castShadow = true;
    this.openedBookGroup.add(this.rightPageMesh);

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.container);

    this.animate();
  }

  private recreateBookMesh() {
    const THREE_ANY = THREE as any;
    if (this.closedBookMesh) this.scene.remove(this.closedBookMesh);

    const currentThickness = this.getBookThickness();
    const geometry = new THREE_ANY.BoxGeometry(3.6, 5.1, currentThickness);

    this.closedMaterials = [
      new THREE_ANY.MeshBasicMaterial({ name: 'pages_right' }),
      new THREE_ANY.MeshBasicMaterial({ name: 'spine' }),
      new THREE_ANY.MeshBasicMaterial({ name: 'pages_top' }),
      new THREE_ANY.MeshBasicMaterial({ name: 'pages_bottom' }),
      new THREE_ANY.MeshBasicMaterial({ name: 'front' }),
      new THREE_ANY.MeshBasicMaterial({ name: 'back' }),
    ];

    this.closedBookMesh = new THREE_ANY.Mesh(geometry, this.closedMaterials);
    this.closedBookMesh.castShadow = true;
    this.closedBookMesh.receiveShadow = true;
    this.scene.add(this.closedBookMesh);
    this.closedBookMesh.visible = !this.isBookOpen;
  }

  private drawCovers() {
    const fCtx = this.frontCanvas.getContext('2d')!;
    const bCtx = this.backCanvas.getContext('2d')!;
    const sCtx = this.spineCanvas.getContext('2d')!;

    fCtx.clearRect(0, 0, this.frontCanvas.width, this.frontCanvas.height);
    bCtx.clearRect(0, 0, this.backCanvas.width, this.backCanvas.height);
    sCtx.clearRect(0, 0, this.spineCanvas.width, this.spineCanvas.height);

    const currentThickness = this.getBookThickness();

    if (this.loadedImages.fullWrap) {
      const bWidth = 3.6;
      const sWidth = currentThickness;
      const fWidth = 3.6;
      const totalUnits = bWidth + sWidth + fWidth;
      const fBack = bWidth / totalUnits;
      const fSpine = sWidth / totalUnits;
      const fFront = fWidth / totalUnits;
      const w = this.loadedImages.fullWrap.width;
      const h = this.loadedImages.fullWrap.height;

      bCtx.drawImage(this.loadedImages.fullWrap, 0, 0, w * fBack, h, 0, 0, this.backCanvas.width, this.backCanvas.height);
      sCtx.drawImage(this.loadedImages.fullWrap, w * fBack, 0, w * fSpine, h, 0, 0, this.spineCanvas.width, this.spineCanvas.height);
      fCtx.drawImage(this.loadedImages.fullWrap, w * (fBack + fSpine), 0, w * fFront, h, 0, 0, this.frontCanvas.width, this.frontCanvas.height);
    } else {
      bCtx.fillStyle = '#0d9488';
      bCtx.fillRect(0, 0, this.backCanvas.width, this.backCanvas.height);
      sCtx.fillStyle = '#0d9488';
      sCtx.fillRect(0, 0, this.spineCanvas.width, this.spineCanvas.height);
      fCtx.fillStyle = '#0d9488';
      fCtx.fillRect(0, 0, this.frontCanvas.width, this.frontCanvas.height);

      if (this.loadedImages.front) {
        fCtx.drawImage(this.loadedImages.front, 0, 0, this.frontCanvas.width, this.frontCanvas.height);
      } else {
        fCtx.fillStyle = '#ffffff';
        fCtx.font = "bold 60px 'Fredoka'";
        fCtx.textAlign = 'center';
        fCtx.fillText('PICTURE BOOK', this.frontCanvas.width / 2, 500);
        fCtx.font = "40px 'Fredoka'";
        fCtx.fillStyle = '#10b981';
        fCtx.fillText('3D EDITION', this.frontCanvas.width / 2, 600);
      }

      if (this.loadedImages.back) {
        bCtx.drawImage(this.loadedImages.back, 0, 0, this.backCanvas.width, this.backCanvas.height);
      }
      if (this.loadedImages.spine) {
        sCtx.drawImage(this.loadedImages.spine, 0, 0, this.spineCanvas.width, this.spineCanvas.height);
      }
    }
  }

  private drawPageOnCanvas(canvas: HTMLCanvasElement, page: BookPage, isLeft: boolean) {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#faf4ec';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Removed shading for true image representation
    // const shading = ctx.createLinearGradient(0, 0, canvas.width, 0);
    // if (isLeft) {
    //   shading.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
    //   shading.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
    // } else {
    //   shading.addColorStop(0, 'rgba(0, 0, 0, 0.15)');
    //   shading.addColorStop(0.3, 'rgba(0, 0, 0, 0)');
    // }
    // ctx.fillStyle = shading;
    // ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = this.loadedImages.pages[page.num];

    if (img) {
      if (page.fullPage) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.06)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 8;
        const cardWidth = 840;
        const cardHeight = 780;
        const cardX = (canvas.width - cardWidth) / 2;
        const cardY = 100;
        ctx.fillRect(cardX, cardY, cardWidth, cardHeight);
        ctx.restore();

        const imgMargin = 40;
        const imgW = cardWidth - imgMargin * 2;
        const imgH = cardHeight - imgMargin * 2 - 40;
        ctx.drawImage(img, cardX + imgMargin, cardY + imgMargin, imgW, imgH);
      }
    } else if (!page.fullPage) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 4;
      ctx.strokeRect(100, 100, canvas.width - 200, 750);
      ctx.font = "50px 'Fredoka'";
      ctx.fillStyle = 'rgba(13,148,136,0.25)';
      ctx.textAlign = 'center';
      ctx.fillText('Illustration Slot', canvas.width / 2, 450);
      ctx.restore();
    }

    if (!page.fullPage) {
      ctx.fillStyle = '#1e293b';
      ctx.font = "bold 44px 'Fredoka'";
      ctx.textAlign = 'center';

      const startY = img ? 980 : 200;
      const maxH = img ? 300 : 1080;

      const wrapRes = getWrappedLines(ctx, page.text || '', 840, maxH, 60);
      const linesToDraw = wrapRes.lines;

      let currentY = startY;
      for (let l = 0; l < linesToDraw.length; l++) {
        ctx.fillText(linesToDraw[l], canvas.width / 2, currentY);
        currentY += 60;
      }

      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.font = "bold 30px 'Plus Jakarta Sans'";
      ctx.fillText(String(page.num), canvas.width / 2, 1340);
    }
  }

  private generatePagesEdge() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 128;
    tempCanvas.height = 128;
    const ctx = tempCanvas.getContext('2d')!;
    ctx.fillStyle = '#faf4ec';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(100, 80, 50, 0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 128; i += 3) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(128, i);
      ctx.stroke();
    }
    return tempCanvas;
  }

  private updateAllTextures() {
    if (!this.closedMaterials.length) return;
    const THREE_ANY = THREE as any;

    this.drawCovers();

    const frontTex = new THREE_ANY.CanvasTexture(this.frontCanvas);
    frontTex.encoding = THREE_ANY.sRGBEncoding;
    const backTex = new THREE_ANY.CanvasTexture(this.backCanvas);
    backTex.encoding = THREE_ANY.sRGBEncoding;
    const spineTex = new THREE_ANY.CanvasTexture(this.spineCanvas);
    spineTex.encoding = THREE_ANY.sRGBEncoding;
    const pagesEdgeTex = new THREE_ANY.CanvasTexture(this.generatePagesEdge());
    pagesEdgeTex.encoding = THREE_ANY.sRGBEncoding;

    this.closedMaterials[4].map = frontTex;
    this.closedMaterials[4].color.set(0xffffff);
    this.closedMaterials[5].map = backTex;
    this.closedMaterials[5].color.set(0xffffff);
    this.closedMaterials[1].map = spineTex;
    this.closedMaterials[0].map = pagesEdgeTex;
    this.closedMaterials[2].map = pagesEdgeTex;
    this.closedMaterials[3].map = pagesEdgeTex;
    this.closedMaterials.forEach((m) => (m.needsUpdate = true));

    if (this.leftCoverMesh) {
      this.leftCoverMesh.material[5].map = backTex;
      this.leftCoverMesh.material[5].needsUpdate = true;
    }
    if (this.rightCoverMesh) {
      this.rightCoverMesh.material[5].map = frontTex;
      this.rightCoverMesh.material[5].needsUpdate = true;
    }

    const leftPage = this.pages[this.activeSpreadIndex * 2];
    const rightPage = this.pages[this.activeSpreadIndex * 2 + 1];

    if (leftPage) this.drawPageOnCanvas(this.leftPageCanvas, leftPage, true);
    if (rightPage) this.drawPageOnCanvas(this.rightPageCanvas, rightPage, false);

    if (this.leftPageMesh) {
      const leftPageTexture = new THREE_ANY.CanvasTexture(this.leftPageCanvas);
      leftPageTexture.encoding = THREE_ANY.sRGBEncoding;
      this.leftPageMesh.material.map = leftPageTexture;
      this.leftPageMesh.material.needsUpdate = true;
    }
    if (this.rightPageMesh) {
      const rightPageTexture = new THREE_ANY.CanvasTexture(this.rightPageCanvas);
      rightPageTexture.encoding = THREE_ANY.sRGBEncoding;
      this.rightPageMesh.material.map = rightPageTexture;
      this.rightPageMesh.material.needsUpdate = true;
    }

    this.callbacks.onSpreadChange?.(this.activeSpreadIndex);
  }

  toggleBookState() {
    if (!this.closedBookMesh) return;
    const TWEEN_ANY = TWEEN as any;
    this.isBookOpen = !this.isBookOpen;

    if (this.isBookOpen) {
      this.autoSpin = false;
      this.closedBookMesh.visible = false;
      this.openedBookGroup.visible = true;

      new TWEEN_ANY.Tween(this.openedBookGroup.rotation)
        .to({ x: -0.2, y: 0, z: 0 }, 1000)
        .easing(TWEEN_ANY.Easing.Cubic.Out)
        .start();

      new TWEEN_ANY.Tween(this.camera.position)
        .to({ x: 0, y: 0, z: 8.5 }, 1000)
        .easing(TWEEN_ANY.Easing.Cubic.Out)
        .start();
    } else {
      this.closedBookMesh.visible = true;
      this.openedBookGroup.visible = false;

      new TWEEN_ANY.Tween(this.closedBookMesh.rotation)
        .to({ x: 0, y: 0, z: 0 }, 800)
        .easing(TWEEN_ANY.Easing.Cubic.Out)
        .start();

      this.resetCamera();
    }
  }

  nextSpread() {
    const maxSpreads = Math.ceil(this.pages.length / 2);
    if (this.activeSpreadIndex < maxSpreads - 1) {
      this.activeSpreadIndex++;
      if (this.isBookOpen) this.triggerPageTurn();
      this.updateAllTextures();
    }
  }

  prevSpread() {
    if (this.activeSpreadIndex > 0) {
      this.activeSpreadIndex--;
      if (this.isBookOpen) this.triggerPageTurn();
      this.updateAllTextures();
    }
  }

  selectSpread(index: number) {
    this.activeSpreadIndex = index;
    this.updateAllTextures();
  }

  private triggerPageTurn() {
    const TWEEN_ANY = TWEEN as any;
    new TWEEN_ANY.Tween(this.openedBookGroup.rotation)
      .to({ x: -0.2, y: 0.1, z: 0 }, 150)
      .yoyo(true)
      .repeat(1)
      .easing(TWEEN_ANY.Easing.Quadratic.Out)
      .start();
  }

  toggleAutoSpin() {
    this.autoSpin = !this.autoSpin;
  }

  toggleAutoFloat() {
    this.autoFloat = !this.autoFloat;
    if (!this.autoFloat) {
      if (this.closedBookMesh) this.closedBookMesh.position.y = 0;
      if (this.openedBookGroup) this.openedBookGroup.position.y = 0;
    }
  }

  isSpinning() {
    return this.autoSpin;
  }
  isFloating() {
    return this.autoFloat;
  }
  isOpen() {
    return this.isBookOpen;
  }
  getSpreadIndex() {
    return this.activeSpreadIndex;
  }

  resetCamera() {
    const TWEEN_ANY = TWEEN as any;
    new TWEEN_ANY.Tween(this.camera.position)
      .to({ x: 0, y: 1.2, z: 10 }, 1000)
      .easing(TWEEN_ANY.Easing.Cubic.Out)
      .start();
    this.controls.target.set(0, 0, 0);
  }

  private onResize() {
    if (!this.camera || !this.renderer) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private animate = () => {
    this.animFrame = requestAnimationFrame(this.animate);
    const TWEEN_ANY = TWEEN as any;
    TWEEN_ANY.update();
    const elapsed = this.clock.getElapsedTime();

    if (this.closedBookMesh && this.closedBookMesh.visible) {
      if (this.autoFloat) this.closedBookMesh.position.y = Math.sin(elapsed * 1.5) * 0.12;
      if (this.autoSpin) this.closedBookMesh.rotation.y += 0.35 * 0.016;
    }

    if (this.openedBookGroup && this.openedBookGroup.visible) {
      if (this.autoFloat) this.openedBookGroup.position.y = Math.sin(elapsed * 1.5) * 0.08;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.animFrame);
    this.resizeObserver?.disconnect();
    if (this.renderer) {
      this.renderer.dispose?.();
      this.renderer.domElement?.remove();
    }
  }
}
