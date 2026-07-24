import type { BookPage, Covers } from '@/types';

function escapeForTemplate(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

const wrapFnSource = String.raw`
        function getWrappedLines(context, text, maxWidth, maxHeight, lineHeight) {
            let lines = [];
            if (!text) return { lines: [], overflowText: "" };

            let paragraphs = text.split('\n');
            let maxLines = Math.floor(maxHeight / lineHeight);

            for (let p = 0; p < paragraphs.length; p++) {
                let para = paragraphs[p];
                let words = para.split(' ');
                let currentLine = '';

                for (let w = 0; w < words.length; w++) {
                    let word = words[w];
                    let testLine = currentLine ? (currentLine + ' ' + word) : word;
                    let metrics = context.measureText(testLine);

                    if (metrics.width <= maxWidth) {
                        currentLine = testLine;
                    } else {
                        if (currentLine) {
                            lines.push(currentLine);
                            if (lines.length >= maxLines) {
                                let remainingInPara = words.slice(w).join(' ');
                                let overflow = [remainingInPara, ...paragraphs.slice(p + 1)].join('\n');
                                return { lines, overflowText: overflow };
                            }
                            currentLine = '';
                        }

                        if (context.measureText(word).width > maxWidth) {
                            for (let c = 0; c < word.length; c++) {
                                let char = word[c];
                                let testCharLine = currentLine + char;
                                if (context.measureText(testCharLine).width <= maxWidth) {
                                    currentLine = testCharLine;
                                } else {
                                    lines.push(currentLine);
                                    if (lines.length >= maxLines) {
                                        let remainingWord = word.slice(c);
                                        let remainingInPara = (w + 1 < words.length) ? (' ' + words.slice(w + 1).join(' ')) : '';
                                        let overflow = [remainingWord + remainingInPara, ...paragraphs.slice(p + 1)].join('\n');
                                        return { lines, overflowText: overflow };
                                    }
                                    currentLine = char;
                                }
                            }
                        } else {
                            currentLine = word;
                        }
                    }
                }

                if (currentLine) {
                    lines.push(currentLine);
                    if (lines.length >= maxLines && (p < paragraphs.length - 1)) {
                        let overflow = paragraphs.slice(p + 1).join('\n');
                        return { lines, overflowText: overflow };
                    }
                    currentLine = '';
                }
            }

            return { lines, overflowText: "" };
        }
`;

export function buildStandalone3DHTML(
  pages: BookPage[],
  covers: Covers,
  bookTitle: string,
  authorName: string
): string {
  const serializedPages = pages.map((p) => ({
    num: p.num,
    text: p.text || '',
    fullPage: !!p.fullPage,
    previewDataUrl: p.imageDataUrl || null,
  }));

  const customCovers: Covers = {
    fullWrap: covers.fullWrap || null,
    front: covers.front || null,
    back: covers.back || null,
    spine: covers.spine || null,
  };

  const pagesJson = JSON.stringify(serializedPages);
  const coversJson = JSON.stringify(customCovers);
  const safeTitle = escapeForTemplate(bookTitle);
  const safeAuthor = escapeForTemplate(authorName);

  return `<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-950 text-slate-100">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeTitle} — 3D Interactive Picture Book</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&family=Plus+Jakarta+Sans:wght@300;400;600;800&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Plus Jakarta Sans', sans-serif; overflow: hidden; margin: 0; }
        .canvas-container { cursor: grab; }
        .canvas-container:active { cursor: grabbing; }
    </style>
</head>
<body class="h-full flex flex-col select-none relative bg-slate-950">

    <header class="absolute top-0 left-0 right-0 z-20 px-6 py-4 flex items-center justify-between bg-slate-950/75 backdrop-blur-md border-b border-slate-800/80">
        <div class="flex items-center gap-3">
            <div class="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
                <i class="fa-solid fa-cube text-white text-lg"></i>
            </div>
            <div>
                <h1 class="font-bold text-base leading-tight text-white">${safeTitle}</h1>
                <p class="text-xs text-teal-400 font-semibold">by ${safeAuthor} · Interactive 3D WebGL Edition</p>
            </div>
        </div>
        <div class="flex items-center gap-3">
            <button id="btnOpenBook" onclick="toggleBookState()" class="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-lg shadow-teal-600/30 active:scale-95">
                <i class="fa-solid fa-book-open"></i> <span id="openBtnText">Open 3D Book</span>
            </button>
            <button onclick="resetCamera()" class="p-2.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 transition-all" title="Reset Camera View">
                <i class="fa-solid fa-arrows-to-eye"></i>
            </button>
            <button onclick="toggleFullscreen()" class="p-2.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 transition-all" title="Toggle Fullscreen">
                <i class="fa-solid fa-expand"></i>
            </button>
        </div>
    </header>

    <div id="canvas-container" class="w-full h-full absolute inset-0 canvas-container"></div>

    <div class="absolute top-20 left-6 z-10 pointer-events-none">
        <div class="bg-slate-950/80 backdrop-blur-md px-4 py-3 rounded-xl border border-slate-800/80 shadow-2xl max-w-xs">
            <span class="text-[10px] font-bold uppercase tracking-wider text-teal-400 block mb-0.5">3D Viewport</span>
            <h3 class="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <i class="fa-solid fa-rotate-3d text-teal-400 animate-spin"></i> Click & Drag to Rotate in 3D
            </h3>
        </div>
    </div>

    <footer class="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3 w-full max-w-2xl px-4 pointer-events-auto">
        <div class="bg-slate-950/85 backdrop-blur-md border border-slate-800 p-3 rounded-2xl shadow-2xl flex items-center justify-between w-full gap-4">
            <button onclick="prevSpread()" class="px-4 py-2 bg-slate-900 hover:bg-teal-600 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-800">
                <i class="fa-solid fa-chevron-left"></i> Prev
            </button>
            <div class="flex-1 text-center">
                <span id="currentSpreadText" class="text-xs font-extrabold text-white block">Pages 1 & 2</span>
                <div class="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden mt-1 border border-slate-800">
                    <div id="progressBar" class="h-full bg-teal-500 transition-all duration-300" style="width: 50%;"></div>
                </div>
            </div>
            <button onclick="nextSpread()" class="px-4 py-2 bg-slate-900 hover:bg-teal-600 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-800">
                Next <i class="fa-solid fa-chevron-right"></i>
            </button>
        </div>
        <div class="flex items-center gap-2">
            <button id="btnAutoSpin" onclick="toggleAutoSpin()" class="px-3 py-1.5 bg-slate-950/85 hover:bg-slate-900 backdrop-blur-md border border-slate-800 rounded-lg text-xs font-semibold flex items-center gap-2 text-teal-400 transition-all shadow-lg">
                <i class="fa-solid fa-arrows-spin"></i> Spin: <span id="statusSpin">ON</span>
            </button>
            <button id="btnAutoFloat" onclick="toggleAutoFloat()" class="px-3 py-1.5 bg-slate-950/85 hover:bg-slate-900 backdrop-blur-md border border-slate-800 rounded-lg text-xs font-semibold flex items-center gap-2 text-teal-400 transition-all shadow-lg">
                <i class="fa-solid fa-up-down"></i> Float: <span id="statusFloat">ON</span>
            </button>
        </div>
    </footer>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"><\/script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/tween.js/18.6.4/tween.umd.js"><\/script>

    <script>
        const pages = ${pagesJson};
        const customCovers = ${coversJson};

        let activeSpreadIndex = 0;
        let isBookOpen = false;
        let autoSpin = true;
        let autoFloat = true;

        let scene, camera, renderer, controls;
        let closedBookMesh, openedBookGroup;
        let leftPageMesh, rightPageMesh;
        let leftCoverMesh, rightCoverMesh;
        let closedMaterials = [];
        let clock = new THREE.Clock();

        let loadedImages = { pages: {}, fullWrap: null, front: null, back: null, spine: null };

        const frontCanvas = document.createElement('canvas');
        const backCanvas = document.createElement('canvas');
        const spineCanvas = document.createElement('canvas');
        const leftPageCanvas = document.createElement('canvas');
        const rightPageCanvas = document.createElement('canvas');
        frontCanvas.width = 1024; frontCanvas.height = 1424;
        backCanvas.width = 1024; backCanvas.height = 1424;
        spineCanvas.width = 256; spineCanvas.height = 1424;
        leftPageCanvas.width = 1024; leftPageCanvas.height = 1424;
        rightPageCanvas.width = 1024; rightPageCanvas.height = 1424;

        const container = document.getElementById('canvas-container');
${wrapFnSource}

        function getBookThickness() { return Math.min(2.5, 0.25 + (pages.length * 0.08)); }

        function createPageCurveGeometry(width, height, segX, segY, isLeft) {
            const geo = new THREE.PlaneGeometry(width, height, segX, segY);
            const pos = geo.attributes.position;
            const curveIntensity = 0.15;
            for (let i = 0; i < pos.count; i++) {
                let x = pos.getX(i);
                let normX = isLeft ? (x + width / 2) / width : (width / 2 - x) / width;
                let z = Math.sin(normX * Math.PI * 0.5) * curveIntensity;
                pos.setZ(i, z);
            }
            geo.computeVertexNormals();
            return geo;
        }

        function initThree() {
            scene = new THREE.Scene();
            scene.fog = new THREE.FogExp2(0x0a0c10, 0.04);
            camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
            camera.position.set(0, 1.2, 10);
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            container.appendChild(renderer.domElement);

            controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true; controls.dampingFactor = 0.05;
            controls.maxDistance = 15; controls.minDistance = 3; controls.target.set(0,0,0);
            controls.addEventListener('start', () => { if (autoSpin) toggleAutoSpin(); });

            scene.add(new THREE.AmbientLight(0xffffff, 0.65));
            const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
            dirLight.position.set(5, 10, 6); dirLight.castShadow = true;
            dirLight.shadow.mapSize.width = 2048; dirLight.shadow.mapSize.height = 2048;
            scene.add(dirLight);
            const pl = new THREE.PointLight(0x0d9488, 2.5, 15); pl.position.set(-3,2,4); scene.add(pl);

            const sp = new THREE.Mesh(new THREE.PlaneGeometry(30,30), new THREE.ShadowMaterial({ opacity: 0.35 }));
            sp.rotation.x = -Math.PI/2; sp.position.y = -3.0; sp.receiveShadow = true; scene.add(sp);

            recreateBookMesh();

            openedBookGroup = new THREE.Group(); openedBookGroup.visible = false; scene.add(openedBookGroup);
            const cg = new THREE.BoxGeometry(3.75, 5.25, 0.08);
            const lm = Array(6).fill(0).map((_,i)=> new THREE.MeshStandardMaterial({ color: i===4||i===5?0xffffff:0x134e4a, roughness:0.3 }));
            const rm = Array(6).fill(0).map((_,i)=> new THREE.MeshStandardMaterial({ color: i===4||i===5?0xffffff:0x134e4a, roughness:0.3 }));
            leftCoverMesh = new THREE.Mesh(cg, lm); leftCoverMesh.position.set(-1.875,0,-0.06); leftCoverMesh.castShadow=true; openedBookGroup.add(leftCoverMesh);
            rightCoverMesh = new THREE.Mesh(cg, rm); rightCoverMesh.position.set(1.875,0,-0.06); rightCoverMesh.castShadow=true; openedBookGroup.add(rightCoverMesh);
            leftPageMesh = new THREE.Mesh(createPageCurveGeometry(3.6,5.1,15,15,true), new THREE.MeshStandardMaterial({ roughness:0.9, metalness:0, side:THREE.DoubleSide }));
            leftPageMesh.position.set(-1.82,0,0); leftPageMesh.castShadow=true; openedBookGroup.add(leftPageMesh);
            rightPageMesh = new THREE.Mesh(createPageCurveGeometry(3.6,5.1,15,15,false), new THREE.MeshStandardMaterial({ roughness:0.9, metalness:0, side:THREE.DoubleSide }));
            rightPageMesh.position.set(1.82,0,0); rightPageMesh.castShadow=true; openedBookGroup.add(rightPageMesh);
            window.addEventListener('resize', onWindowResize);
        }

        function recreateBookMesh() {
            if (closedBookMesh) scene.remove(closedBookMesh);
            const t = getBookThickness();
            closedMaterials = [0,1,2,3,4,5].map(i => new THREE.MeshStandardMaterial({ name: ['pages_right','spine','pages_top','pages_bottom','front','back'][i] }));
            closedBookMesh = new THREE.Mesh(new THREE.BoxGeometry(3.6,5.1,t), closedMaterials);
            closedBookMesh.castShadow=true; closedBookMesh.receiveShadow=true;
            closedBookMesh.visible = !isBookOpen; scene.add(closedBookMesh);
        }

        function drawCovers() {
            const f = frontCanvas.getContext('2d'), b = backCanvas.getContext('2d'), s = spineCanvas.getContext('2d');
            f.clearRect(0,0,frontCanvas.width,frontCanvas.height);
            b.clearRect(0,0,backCanvas.width,backCanvas.height);
            s.clearRect(0,0,spineCanvas.width,spineCanvas.height);
            const t = getBookThickness();
            if (loadedImages.fullWrap) {
                const tot = 3.6 + t + 3.6, fB=3.6/tot, fS=t/tot, fF=3.6/tot, w=loadedImages.fullWrap.width, h=loadedImages.fullWrap.height;
                b.drawImage(loadedImages.fullWrap,0,0,w*fB,h,0,0,backCanvas.width,backCanvas.height);
                s.drawImage(loadedImages.fullWrap,w*fB,0,w*fS,h,0,0,spineCanvas.width,spineCanvas.height);
                f.drawImage(loadedImages.fullWrap,w*(fB+fS),0,w*fF,h,0,0,frontCanvas.width,frontCanvas.height);
            } else {
                f.fillStyle="#0d9488"; f.fillRect(0,0,frontCanvas.width,frontCanvas.height);
                b.fillStyle="#0d9488"; b.fillRect(0,0,backCanvas.width,backCanvas.height);
                s.fillStyle="#0d9488"; s.fillRect(0,0,spineCanvas.width,spineCanvas.height);
                if (loadedImages.front) f.drawImage(loadedImages.front,0,0,frontCanvas.width,frontCanvas.height);
                else { f.fillStyle="#fff"; f.font="bold 60px 'Fredoka'"; f.textAlign="center"; f.fillText("PICTURE BOOK",frontCanvas.width/2,500); f.font="40px 'Fredoka'"; f.fillStyle="#10b981"; f.fillText("3D EDITION",frontCanvas.width/2,600); }
                if (loadedImages.back) b.drawImage(loadedImages.back,0,0,backCanvas.width,backCanvas.height);
                if (loadedImages.spine) s.drawImage(loadedImages.spine,0,0,spineCanvas.width,spineCanvas.height);
            }
        }

        function drawPageOnCanvas(canvas, pageData, isLeft) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0,0,canvas.width,canvas.height);
            ctx.fillStyle="#faf4ec"; ctx.fillRect(0,0,canvas.width,canvas.height);
            let sh = ctx.createLinearGradient(0,0,canvas.width,0);
            if (isLeft) { sh.addColorStop(0.7,'rgba(0,0,0,0)'); sh.addColorStop(1,'rgba(0,0,0,0.15)'); }
            else { sh.addColorStop(0,'rgba(0,0,0,0.15)'); sh.addColorStop(0.3,'rgba(0,0,0,0)'); }
            ctx.fillStyle=sh; ctx.fillRect(0,0,canvas.width,canvas.height);
            const img = loadedImages.pages[pageData.num];
            if (img) {
                if (pageData.fullPage) ctx.drawImage(img,0,0,canvas.width,canvas.height);
                else { ctx.save(); ctx.fillStyle="#fff"; ctx.shadowColor="rgba(0,0,0,0.06)"; ctx.shadowBlur=15; ctx.shadowOffsetY=8; const cw=840,ch=780,cx=(canvas.width-cw)/2,cy=100; ctx.fillRect(cx,cy,cw,ch); ctx.restore(); const m=40; ctx.drawImage(img,cx+m,cy+m,cw-m*2,ch-m*2-40); }
            } else if (!pageData.fullPage) { ctx.save(); ctx.strokeStyle="rgba(0,0,0,0.08)"; ctx.lineWidth=4; ctx.strokeRect(100,100,canvas.width-200,750); ctx.font="50px 'Fredoka'"; ctx.fillStyle="rgba(13,148,136,0.25)"; ctx.textAlign="center"; ctx.fillText("Illustration Slot",canvas.width/2,450); ctx.restore(); }
            if (!pageData.fullPage) {
                ctx.fillStyle="#1e293b"; ctx.font="bold 44px 'Fredoka'"; ctx.textAlign="center";
                let sY = img?980:200, mH = img?300:1080;
                let r = getWrappedLines(ctx, pageData.text||"", 840, mH, 60);
                let y=sY; for(let l=0;l<r.lines.length;l++){ ctx.fillText(r.lines[l],canvas.width/2,y); y+=60; }
                ctx.fillStyle="rgba(0,0,0,0.3)"; ctx.font="bold 30px 'Plus Jakarta Sans'"; ctx.fillText(pageData.num,canvas.width/2,1340);
            }
        }

        function updateAllTextures() {
            drawCovers();
            const fT=new THREE.CanvasTexture(frontCanvas), bT=new THREE.CanvasTexture(backCanvas), sT=new THREE.CanvasTexture(spineCanvas);
            const eC=document.createElement('canvas'); eC.width=128;eC.height=128; const ec=eC.getContext('2d'); ec.fillStyle="#faf4ec";ec.fillRect(0,0,128,128); ec.strokeStyle="rgba(100,80,50,0.12)";ec.lineWidth=1; for(let i=0;i<128;i+=3){ec.beginPath();ec.moveTo(0,i);ec.lineTo(128,i);ec.stroke();} const eT=new THREE.CanvasTexture(eC);
            closedMaterials[4].map=fT; closedMaterials[5].map=bT; closedMaterials[1].map=sT; closedMaterials[0].map=eT; closedMaterials[2].map=eT; closedMaterials[3].map=eT;
            closedMaterials.forEach(m=>m.needsUpdate=true);
            if(leftCoverMesh){leftCoverMesh.material[5].map=bT;leftCoverMesh.material[5].needsUpdate=true;}
            if(rightCoverMesh){rightCoverMesh.material[5].map=fT;rightCoverMesh.material[5].needsUpdate=true;}
            drawPageOnCanvas(leftPageCanvas, pages[activeSpreadIndex*2], true);
            drawPageOnCanvas(rightPageCanvas, pages[activeSpreadIndex*2+1], false);
            leftPageMesh.material.map=new THREE.CanvasTexture(leftPageCanvas); leftPageMesh.material.needsUpdate=true;
            rightPageMesh.material.map=new THREE.CanvasTexture(rightPageCanvas); rightPageMesh.material.needsUpdate=true;
            updateHUDText();
        }

        function updateHUDText() {
            const l=pages[activeSpreadIndex*2], r=pages[activeSpreadIndex*2+1], tot=Math.ceil(pages.length/2);
            document.getElementById('currentSpreadText').innerText = \`Pages \${l.num} & \${r.num}\`;
            document.getElementById('progressBar').style.width = \`\${((activeSpreadIndex+1)/tot)*100}%\`;
        }

        function toggleBookState() {
            isBookOpen=!isBookOpen;
            if(isBookOpen){ autoSpin=false; document.getElementById('statusSpin').innerText="OFF"; document.getElementById('btnAutoSpin').classList.replace('text-teal-400','text-slate-400'); closedBookMesh.visible=false; openedBookGroup.visible=true; new TWEEN.Tween(openedBookGroup.rotation).to({x:-0.2,y:0,z:0},1000).easing(TWEEN.Easing.Cubic.Out).start(); new TWEEN.Tween(camera.position).to({x:0,y:0,z:8.5},1000).easing(TWEEN.Easing.Cubic.Out).start(); document.getElementById('openBtnText').innerText="Close 3D Cover"; document.getElementById('btnOpenBook').className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-lg shadow-rose-600/30 active:scale-95"; }
            else { closedBookMesh.visible=true; openedBookGroup.visible=false; new TWEEN.Tween(closedBookMesh.rotation).to({x:0,y:0,z:0},800).easing(TWEEN.Easing.Cubic.Out).start(); resetCamera(); document.getElementById('openBtnText').innerText="Open 3D Book"; document.getElementById('btnOpenBook').className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-lg shadow-teal-600/30 active:scale-95"; }
        }

        function nextSpread(){ const m=Math.ceil(pages.length/2); if(activeSpreadIndex<m-1){activeSpreadIndex++; if(isBookOpen) triggerTurn(); updateAllTextures();} }
        function prevSpread(){ if(activeSpreadIndex>0){activeSpreadIndex--; if(isBookOpen) triggerTurn(); updateAllTextures();} }
        function triggerTurn(){ new TWEEN.Tween(openedBookGroup.rotation).to({x:-0.2,y:0.1,z:0},150).yoyo(true).repeat(1).easing(TWEEN.Easing.Quadratic.Out).start(); }
        function toggleAutoSpin(){ autoSpin=!autoSpin; document.getElementById('statusSpin').innerText=autoSpin?"ON":"OFF"; document.getElementById('btnAutoSpin').classList.toggle('text-teal-400'); document.getElementById('btnAutoSpin').classList.toggle('text-slate-400'); }
        function toggleAutoFloat(){ autoFloat=!autoFloat; document.getElementById('statusFloat').innerText=autoFloat?"ON":"OFF"; document.getElementById('btnAutoFloat').classList.toggle('text-teal-400'); document.getElementById('btnAutoFloat').classList.toggle('text-slate-400'); if(!autoFloat){if(closedBookMesh)closedBookMesh.position.y=0; if(openedBookGroup)openedBookGroup.position.y=0;} }
        function resetCamera(){ new TWEEN.Tween(camera.position).to({x:0,y:1.2,z:10},1000).easing(TWEEN.Easing.Cubic.Out).start(); controls.target.set(0,0,0); }
        function toggleFullscreen(){ if(!document.fullscreenElement){document.documentElement.requestFullscreen().catch(()=>{});}else{document.exitFullscreen().catch(()=>{});} }
        function onWindowResize(){ camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth,window.innerHeight); }
        function animate(){ requestAnimationFrame(animate); TWEEN.update(); const e=clock.getElapsedTime(); if(closedBookMesh&&closedBookMesh.visible){if(autoFloat)closedBookMesh.position.y=Math.sin(e*1.5)*0.12; if(autoSpin)closedBookMesh.rotation.y+=0.35*0.016;} if(openedBookGroup&&openedBookGroup.visible){if(autoFloat)openedBookGroup.position.y=Math.sin(e*1.5)*0.08;} controls.update(); renderer.render(scene,camera); }

        function preloadAssetsAndStart() {
            let pending=0;
            function done(){ if(pending===0){ initThree(); updateAllTextures(); animate(); } }
            function load(src,slot){ pending++; const i=new Image(); i.onload=()=>{loadedImages[slot]=i;pending--;done();}; i.onerror=()=>{pending--;done();}; i.src=src; }
            if(customCovers.fullWrap) load(customCovers.fullWrap,'fullWrap');
            if(customCovers.front) load(customCovers.front,'front');
            if(customCovers.back) load(customCovers.back,'back');
            if(customCovers.spine) load(customCovers.spine,'spine');
            pages.forEach(p=>{ if(p.previewDataUrl){ pending++; const i=new Image(); i.onload=()=>{loadedImages.pages[p.num]=i;pending--;done();}; i.onerror=()=>{pending--;done();}; i.src=p.previewDataUrl; } });
            done();
        }
        window.onload = preloadAssetsAndStart;
    <\/script>
</body>
</html>`;
}

export function downloadHTML(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const link = document.createElement('a');
  link.download = filename;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}
