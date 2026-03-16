import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';

interface StandaloneJarSceneProps {
  words?: string[];
  reviewWords?: any[];
  showControls?: boolean;
  onAnimationComplete?: () => void;
  onWordClick?: (word: any) => void;
  onExitReview?: () => void;
}

export const StandaloneJarScene = forwardRef<any, StandaloneJarSceneProps>(({ 
  words: propWords = [], 
  reviewWords = [],
  showControls = false, 
  onAnimationComplete,
  onWordClick,
  onExitReview
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const startAnimRef = useRef<() => void>(() => {});
  const onWordClickRef = useRef(onWordClick);
  const onExitReviewRef = useRef(onExitReview);

  useEffect(() => {
    onWordClickRef.current = onWordClick;
    onExitReviewRef.current = onExitReview;
  }, [onWordClick, onExitReview]);

  useImperativeHandle(ref, () => ({
    startAnimation: () => startAnimRef.current(),
  }));

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // ---- Slider state ----
    let speedMult = 1.0, ampMult = 1.0, waveSpeedMult = 1.0, waveAmpMult = 1.0;
    function updateSliderBg(el: HTMLInputElement) {
        const pct = ((Number(el.value) - Number(el.min)) / (Number(el.max) - Number(el.min))) * 100;
        el.style.background = `linear-gradient(to right, #d97706 ${pct}%, rgba(139,115,85,0.25) ${pct}%)`;
    }
    function sliderToMult(v: number) { return v<=50 ? 0.1+(v/50)*0.9 : 1.0+(v-50)/50*2.0; }

    const speedSlider = container.querySelector('#speed-slider') as HTMLInputElement;
    const ampSlider = container.querySelector('#amp-slider') as HTMLInputElement;
    const waveSpeedSlider = container.querySelector('#wave-speed-slider') as HTMLInputElement;
    const waveAmpSlider = container.querySelector('#wave-amp-slider') as HTMLInputElement;
    const liqSlider = container.querySelector('#liq-slider') as HTMLInputElement;
    const capSlider = container.querySelector('#cap-slider') as HTMLInputElement;

    speedSlider?.addEventListener('input', function() {
        speedMult = sliderToMult(+this.value);
        const valEl = container.querySelector('#speed-val');
        if (valEl) valEl.textContent = speedMult.toFixed(1)+'×';
        updateSliderBg(this);
    });
    ampSlider?.addEventListener('input', function() {
        ampMult = sliderToMult(+this.value);
        const valEl = container.querySelector('#amp-val');
        if (valEl) valEl.textContent = ampMult.toFixed(1)+'×';
        updateSliderBg(this);
    });
    waveSpeedSlider?.addEventListener('input', function() {
        waveSpeedMult = sliderToMult(+this.value);
        const valEl = container.querySelector('#wave-speed-val');
        if (valEl) valEl.textContent = waveSpeedMult.toFixed(1)+'×';
        updateSliderBg(this);
    });
    waveAmpSlider?.addEventListener('input', function() {
        waveAmpMult = sliderToMult(+this.value);
        const valEl = container.querySelector('#wave-amp-val');
        if (valEl) valEl.textContent = waveAmpMult.toFixed(1)+'×';
        updateSliderBg(this);
    });

    // ---- Transition state ----
    const P0_DUR = 1200, P1_DUR = 1000, P2_DUR = 1467, P3_DUR = 667;
    const R0_DUR = 400, R1_DUR = 1467, R2_DUR = 1000, R3_DUR = 1200;
    let animState: string = 'IDLE', animStart = 0, wetTriggered = false;
    let r1CamStart = new THREE.Vector3(), r1LookStart = new THREE.Vector3();
    let p0CamStart = new THREE.Vector3();
    const p0CamEnd     = new THREE.Vector3(0, 18.0, 0.01);
    const p1CamTarget  = new THREE.Vector3(0, 14.0, 0.01);
    const p2CamTarget  = new THREE.Vector3(0, -2.0, 0.01);
    const p2LookTarget = new THREE.Vector3(0, -6,   0);
    function easeInOutCubic(x: number) { return x < 0.5 ? 4*x*x*x : 1 - Math.pow(-2*x+2,3)/2; }
    
    startAnimRef.current = () => {
        if(animState!=='IDLE') return;
        p0CamStart.copy(camera.position);
        animState='P0'; animStart=performance.now();
        const jarUI = container.querySelector('#jar-ui') as HTMLElement;
        const slidersUI = container.querySelector('#sliders-ui') as HTMLElement;
        if (jarUI) jarUI.style.opacity = '0';
        if (slidersUI) slidersUI.style.opacity = '0';
    };

    const startBtn = container.querySelector('#start-btn');
    // Removed redundant addEventListener, using onClick in JSX instead

    // ---- Renderer ----
    const canvas = container.querySelector('#webgl-canvas') as HTMLCanvasElement;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    
    const updateSize = () => {
        if (!container) return;
        renderer.setSize(container.clientWidth, container.clientHeight);
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
    };

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
    const startCamPos = new THREE.Vector3(0, 2.0, 16);
    const startLookAt = new THREE.Vector3(0, 0, 0);
    camera.position.copy(startCamPos);
    camera.lookAt(startLookAt);

    // ---- Lighting ----
    scene.add(new THREE.AmbientLight(0xfff5e6, 1.0));
    const topLight = new THREE.PointLight(0xffedd5, 2.5, 20);
    topLight.position.set(2, 6, 4); scene.add(topLight);
    const rimLight = new THREE.DirectionalLight(0xffffff, 1.2);
    rimLight.position.set(-3, 2, -3); scene.add(rimLight);
    const internalLight = new THREE.PointLight(0xd97706, 2.5, 5);
    internalLight.position.set(0, -0.5, 0); scene.add(internalLight);

    // ---- Materials ----
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xfafffe, transmission: 0.92, roughness: 0.04,
        ior: 1.52, side: THREE.DoubleSide, transparent: true,
        // @ts-ignore
        thickness: 0.12
    });
    const outlineMat = new THREE.MeshBasicMaterial({
        color: 0xaaccbb, side: THREE.BackSide, transparent: true, opacity: 0.22
    });
    const lidMat = new THREE.MeshPhysicalMaterial({
        color: 0xeef6ff, transmission: 0.82, roughness: 0.06,
        ior: 1.52, side: THREE.DoubleSide, transparent: true,
        // @ts-ignore
        thickness: 0.10
    });

    // ---- Jar geometry ----
    const jarGroup  = new THREE.Group(); scene.add(jarGroup);
    const jarBottomY = -3.64, jarTopY = 3.64;
    const profile = [
        [0.00, jarBottomY],       [2.288, jarBottomY],
        [2.340, jarBottomY+0.312],[2.444, jarBottomY+1.300],
        [2.652, jarBottomY+2.600],[2.704, jarBottomY+3.900],
        [2.548, jarBottomY+4.820],[2.132, jarBottomY+5.668],
        [1.612, jarBottomY+6.448],[1.508, jarBottomY+6.812],
        [1.560, jarBottomY+7.072],[1.768, jarTopY],
    ];
    const profilePoints = profile.map(([r,y]) => new THREE.Vector2(r,y));
    jarGroup.add(new THREE.Mesh(new THREE.LatheGeometry(profilePoints, 72), glassMat));
    const outlinePts = profile.map(([r,y]) => new THREE.Vector2(r*1.025, y));
    jarGroup.add(new THREE.Mesh(new THREE.LatheGeometry(outlinePts, 72), outlineMat));
    const baseDisc = new THREE.Mesh(new THREE.CircleGeometry(2.288, 64), glassMat);
    baseDisc.rotation.x = Math.PI/2; baseDisc.position.y = jarBottomY+0.01; jarGroup.add(baseDisc);
    const lidDisc = new THREE.Mesh(new THREE.CylinderGeometry(2.04,2.04,0.21,64), lidMat);
    lidDisc.position.y = jarTopY+0.106; jarGroup.add(lidDisc);
    const lidOutline = new THREE.Mesh(new THREE.CylinderGeometry(2.11,2.11,0.25,64), outlineMat);
    lidOutline.position.y = jarTopY+0.106; jarGroup.add(lidOutline);

    // ---- Liquid ----
    const liqHeight = 4.42, liqBottomY = jarBottomY+0.34, liqTopY = liqBottomY+liqHeight;
    const liqPoints = [
        [0.00,liqBottomY],[2.132,liqBottomY],[2.236,liqBottomY+1.04],
        [2.444,liqBottomY+2.34],[2.470,liqBottomY+3.64],[2.288,liqTopY]
    ].map(([r,y]) => new THREE.Vector2(r,y));
    
    const liqVolMat = new THREE.MeshBasicMaterial({
        color:0xbf783a, transparent:true, opacity:0.65,
        side:THREE.FrontSide, depthTest:false, depthWrite:false
    });
    const liqVolMesh = new THREE.Mesh(new THREE.LatheGeometry(liqPoints,64), liqVolMat);
    liqVolMesh.renderOrder = 2;
    scene.add(liqVolMesh);
    
    const liqCapMat = new THREE.MeshBasicMaterial({
        color:0xbf783a, transparent:true, opacity:0.65,
        side:THREE.FrontSide, depthTest:false, depthWrite:false
    });
    const liqCapMesh = new THREE.Mesh(new THREE.CircleGeometry(liqPoints[0].x * 0.98, 64), liqCapMat);
    liqCapMesh.rotation.x = Math.PI / 2;
    liqCapMesh.position.y = liqPoints[0].y + 0.01;
    liqCapMesh.renderOrder = 2;
    scene.add(liqCapMesh);
    
    const liqTopCapMat = new THREE.MeshBasicMaterial({
        color:0xbf783a, transparent:true, opacity:0.65,
        side:THREE.FrontSide, depthTest:false, depthWrite:false
    });
    const jarRadiusBot = 2.132;

    liqSlider?.addEventListener('input', function() {
        const v = +this.value / 100;
        const valEl = container.querySelector('#liq-val');
        if (valEl) valEl.textContent = v.toFixed(2);
        updateSliderBg(this);
        liqVolMat.opacity = v;
        liqVolMat.transparent = (v < 0.99);
        liqVolMat.needsUpdate = true;
        liqCapMat.opacity = v;
        liqCapMat.transparent = (v < 0.99);
        liqCapMat.needsUpdate = true;
        liqTopCapMat.opacity = v;
        liqTopCapMat.transparent = (v < 0.99);
        liqTopCapMat.needsUpdate = true;
    });
    capSlider?.addEventListener('input', function() {
        const v = +this.value / 100;
        const valEl = container.querySelector('#cap-val');
        if (valEl) valEl.textContent = v.toFixed(2);
        updateSliderBg(this);
        liqCapMat.opacity = v;
    });

    // ---- Text sprites ----
    const reviewWordStrings = reviewWords.map(w => w.word);
    const displayWords = reviewWordStrings.length > 0 ? reviewWordStrings : (propWords.length > 0 ? propWords : ['Memory', 'Focus', 'Learn', 'Review', 'Growth', 'Mind', 'Knowledge', 'Time']);
    const allWords = reviewWordStrings.length > 0 ? reviewWordStrings : (propWords.length > 0 ? propWords : ['Memory', 'Focus', 'Learn', 'Review', 'Growth', 'Mind', 'Knowledge', 'Time', 'Study', 'Brain', 'Think', 'Seed', 'Breath', 'Heat', 'Word', 'Microbe', 'Wind', 'Heart', 'Light', 'Dark', 'Morning', 'Night', 'Cellar', 'Water', 'Salt', 'Rice', 'Soil', 'Culture']);
    const sprites: THREE.Sprite[]  = [];
    function mkSprite(text: string, opts: any={}) {
        const c=document.createElement('canvas'), fs=opts.fontSize||28;
        c.width=opts.width||192; c.height=opts.height||80;
        const ctx=c.getContext('2d');
        if (!ctx) return new THREE.Sprite();
        ctx.font=`${opts.weight||400} ${fs}px "Inter", sans-serif`;
        ctx.fillStyle=opts.color||'#4a3f35'; ctx.globalAlpha=1;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(text,c.width/2,c.height/2);
        const tex=new THREE.CanvasTexture(c); tex.needsUpdate=true;
        return new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,opacity:opts.opacity??0.75,depthTest:false}));
    }
    displayWords.forEach(w => {
        const s=mkSprite(w,{fontSize:28,opacity:0.72,weight:500});
        s.scale.set(0.7,0.35,1);
        s.renderOrder = 3;
        const r=Math.random()*(jarRadiusBot-0.2), th=Math.random()*Math.PI*2;
        const y=liqBottomY+0.2+Math.random()*(liqHeight-0.4);
        s.position.set(r*Math.cos(th),y,r*Math.sin(th));
        s.userData={baseY:y, baseX:s.position.x, baseZ:s.position.z,
        speed:0.35+Math.random()*0.4, offset:Math.random()*Math.PI*2, amplitude:0.04+Math.random()*0.04,
        speedX:0.22+Math.random()*0.3, offsetX:Math.random()*Math.PI*2, amplitudeX:0.03+Math.random()*0.03,
        speedZ:0.18+Math.random()*0.28, offsetZ:Math.random()*Math.PI*2, amplitudeZ:0.03+Math.random()*0.03};
        scene.add(s); sprites.push(s);
    })
    const alphabet='abcdefghijklmnopqrstuvwxyz';
    for(let i=0;i<100;i++){
        const isW=Math.random()>0.55;
        const txt=isW?allWords[Math.floor(Math.random()*allWords.length)]:alphabet[Math.floor(Math.random()*alphabet.length)];
        const fs=isW?(10+Math.random()*8):(7+Math.random()*5), al=0.18+Math.random()*0.38;
        const s=mkSprite(txt,{fontSize:Math.round(fs*3.5),width:128,height:56,opacity:al,weight:300});
        const sw=isW?0.38+Math.random()*0.28:0.16+Math.random()*0.14;
        s.scale.set(sw,sw*0.5,1);
        const an=Math.random()*Math.PI*2, rd=Math.random()*(jarRadiusBot-0.08);
        const y=liqBottomY+0.08+Math.pow(Math.random(),1.6)*(liqHeight-0.12);
        s.position.set(Math.cos(an)*rd,y,Math.sin(an)*rd);
        s.userData={baseY:y, baseX:s.position.x, baseZ:s.position.z,
            speed:0.15+Math.random()*0.3, offset:Math.random()*Math.PI*2, amplitude:0.02+Math.random()*0.03,
            speedX:0.10+Math.random()*0.2, offsetX:Math.random()*Math.PI*2, amplitudeX:0.015+Math.random()*0.02,
            speedZ:0.08+Math.random()*0.18, offsetZ:Math.random()*Math.PI*2, amplitudeZ:0.015+Math.random()*0.02};
        scene.add(s); sprites.push(s);
    }

    // ---- Particles ----
    const partGeo=new THREE.BufferGeometry(), partPos=new Float32Array(200*3);
    for(let i=0;i<200*3;i+=3){
        const r=Math.random()*(jarRadiusBot-0.1), th=Math.random()*Math.PI*2;
        partPos[i]=r*Math.cos(th); partPos[i+1]=liqBottomY+Math.random()*liqHeight; partPos[i+2]=r*Math.sin(th);
    }
    partGeo.setAttribute('position',new THREE.BufferAttribute(partPos,3));
    const partMat=new THREE.PointsMaterial({color:0xfbbf24,size:0.03,transparent:true,opacity:0.4,blending:THREE.AdditiveBlending});
    scene.add(new THREE.Points(partGeo,partMat));

    updateSize();
    window.addEventListener('resize', updateSize);

    // ---- Wave surface ----
    const WAVE_SEGS = 48;
    const waveTopR = 2.288 * 0.98;
    const waveGeo = new THREE.CircleGeometry(waveTopR, WAVE_SEGS, 0, Math.PI * 2);
    waveGeo.rotateX(-Math.PI / 2);
    const wavePosAttr = waveGeo.attributes.position;
    const waveOrigY = new Float32Array(wavePosAttr.count);
    for (let i = 0; i < wavePosAttr.count; i++) waveOrigY[i] = wavePosAttr.getY(i);
    const waveMesh = new THREE.Mesh(waveGeo, liqTopCapMat);
    waveMesh.position.set(0, liqTopY, 0);
    waveMesh.renderOrder = 2;
    scene.add(waveMesh);

    function updateWave(t: number) {
        const pos = waveGeo.attributes.position;
        const amp = 0.045 * waveAmpMult;
        const freq = 3.2;
        const sp = 1.1 * waveSpeedMult;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            const w = amp * (
                Math.sin(freq * x + sp * t) * 0.55 +
                Math.sin(freq * 0.75 * z + sp * 1.4 * t + 1.2) * 0.30 +
                Math.sin(freq * 1.3 * (x + z) + sp * 0.8 * t + 2.5) * 0.15
            );
            pos.setY(i, waveOrigY[i] + w);
        }
        pos.needsUpdate = true;
        waveGeo.computeVertexNormals();
    }

    // ---- Microbe objects ----
    function mkMicrobeMat(color: number, opacity: number) {
        return new THREE.MeshPhysicalMaterial({
            color, transparent: true, opacity,
            roughness: 0.25, metalness: 0.0,
            side: THREE.DoubleSide, depthTest: false, depthWrite: false
        });
    }

    const microbeGroup = new THREE.Group();
    scene.add(microbeGroup);
    const microbes: THREE.Group[] = [];

    function makeLacto(scale = 1) {
        const g = new THREE.Group();
        const mat = mkMicrobeMat(0xd4e8c2, 0.72);
        const bodyGeo = new THREE.CylinderGeometry(0.045 * scale, 0.045 * scale, 0.24 * scale, 16);
        const capGeo  = new THREE.SphereGeometry(0.045 * scale, 16, 8);
        const body = new THREE.Mesh(bodyGeo, mat); body.renderOrder = 3;
        const capTop = new THREE.Mesh(capGeo, mat); capTop.position.y = 0.12 * scale; capTop.renderOrder = 3;
        const capBot = new THREE.Mesh(capGeo, mat); capBot.position.y = -0.12 * scale; capBot.renderOrder = 3;
        g.add(body, capTop, capBot);
        g.rotation.z = (Math.random() - 0.5) * 0.6;
        g.rotation.x = (Math.random() - 0.5) * 0.3;
        return g;
    }

    function makeYeast(scale = 1) {
        const g = new THREE.Group();
        const mat = mkMicrobeMat(0xf5d9a0, 0.68);
        const bodyGeo = new THREE.SphereGeometry(0.11 * scale, 20, 16);
        const body = new THREE.Mesh(bodyGeo, mat); body.renderOrder = 3;
        body.scale.set(1, 1.22, 1);
        const budGeo = new THREE.SphereGeometry(0.055 * scale, 14, 10);
        const bud = new THREE.Mesh(budGeo, mat); bud.renderOrder = 3;
        bud.position.set(0.10 * scale, 0.10 * scale, 0);
        g.add(body, bud);
        return g;
    }

    function makeKoji(scale = 1) {
        const g = new THREE.Group();
        const stalkMat = mkMicrobeMat(0xc8b4e0, 0.65);
        const headMat  = mkMicrobeMat(0xe8d4f8, 0.70);
        const stalkGeo = new THREE.CylinderGeometry(0.018 * scale, 0.022 * scale, 0.28 * scale, 10);
        const stalk = new THREE.Mesh(stalkGeo, stalkMat); stalk.renderOrder = 3;
        stalk.position.y = 0.0;
        const headGeo = new THREE.SphereGeometry(0.075 * scale, 18, 12);
        const head = new THREE.Mesh(headGeo, headMat); head.renderOrder = 3;
        head.position.y = 0.17 * scale;
        const sporeCount = 10;
        for (let i = 0; i < sporeCount; i++) {
            const phi = (i / sporeCount) * Math.PI * 2;
            const sGeo = new THREE.SphereGeometry(0.018 * scale, 8, 6);
            const s = new THREE.Mesh(sGeo, headMat); s.renderOrder = 3;
            s.position.set(
                Math.cos(phi) * 0.105 * scale,
                0.17 * scale + Math.sin(phi) * 0.012 * scale,
                Math.sin(phi) * 0.105 * scale
            );
            g.add(s);
        }
        g.add(stalk, head);
        g.rotation.z = (Math.random() - 0.5) * 0.4;
        return g;
    }

    const microbeTypes = ['lacto', 'lacto', 'yeast', 'yeast', 'koji', 'koji'];
    microbeTypes.forEach((type) => {
        let mesh;
        if (type === 'lacto') mesh = makeLacto(1.0 + Math.random() * 0.4);
        else if (type === 'yeast') mesh = makeYeast(1.0 + Math.random() * 0.3);
        else mesh = makeKoji(1.0 + Math.random() * 0.3);

        const ref = sprites[Math.floor(Math.random() * Math.min(propWords.length, sprites.length))];
        const offR = 0.12 + Math.random() * 0.25;
        const offTh = Math.random() * Math.PI * 2;
        mesh.position.set(
            ref.position.x + Math.cos(offTh) * offR,
            ref.position.y + (Math.random() - 0.5) * 0.15,
            ref.position.z + Math.sin(offTh) * offR
        );

        mesh.userData = {
            basePos: mesh.position.clone(),
            driftSpeed: 0.18 + Math.random() * 0.22,
            driftOffset: Math.random() * Math.PI * 2,
            driftAmpY: 0.04 + Math.random() * 0.04,
            driftAmpX: 0.025 + Math.random() * 0.025,
            rotSpeed: (Math.random() - 0.5) * 0.4,
            wobbleFreq: 0.8 + Math.random() * 0.6,
            wobbleAmp: 0.008 + Math.random() * 0.01,
            targetSprite: ref,
            crawlPhase: Math.random() * Math.PI * 2,
            type
        };
        microbeGroup.add(mesh);
        microbes.push(mesh);
    });

    function updateMicrobes(eg: number) {
        microbes.forEach(m => {
            const u = m.userData;
            m.position.y = u.basePos.y + Math.sin(eg * u.driftSpeed + u.driftOffset) * u.driftAmpY;
            m.position.x = u.basePos.x + Math.sin(eg * u.driftSpeed * 0.7 + u.driftOffset + 1.3) * u.driftAmpX;
            m.rotation.y += 0.003 * u.rotSpeed;
            const wobble = Math.sin(eg * u.wobbleFreq + u.wobbleAmp);
            if (u.type === 'lacto') m.rotation.z += wobble * 0.001;
            if (m.position.y > liqTopY - 0.1) m.position.y = liqTopY - 0.1;
            if (m.position.y < liqBottomY + 0.1) m.position.y = liqBottomY + 0.1;
        });
    }

    // ---- Bubble system ----
    const bubbleMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff, transparent: true, opacity: 0.18,
        roughness: 0.05, ior: 1.33, side: THREE.DoubleSide, depthTest: false, depthWrite: false,
        // @ts-ignore
        thickness: 0.04
    });
    const activeBubbles: any[] = [];
    let nextBubbleTime = 2.5 + Math.random() * 4;

    function spawnBubble() {
        const radius = (0.04 + Math.random() * 0.07) * 1.5;
        const geo = new THREE.SphereGeometry(radius, 12, 8);
        const mesh = new THREE.Mesh(geo, bubbleMat.clone());
        mesh.renderOrder = 4;
        const r = Math.random() * (jarRadiusBot - 0.3);
        const th = Math.random() * Math.PI * 2;
        const startY = liqBottomY + 0.2 + Math.random() * (liqHeight * 0.4);
        mesh.position.set(r * Math.cos(th), startY, r * Math.sin(th));
        const wobbleX = (Math.random() - 0.5) * 0.006;
        const wobbleZ = (Math.random() - 0.5) * 0.006;
        const riseSpeed = 0.6 + Math.random() * 0.8;
        const wobbleFreq = 2.0 + Math.random() * 2.0;
        const wobblePhase = Math.random() * Math.PI * 2;
        scene.add(mesh);
        activeBubbles.push({ mesh, startY, riseSpeed, wobbleX, wobbleZ, wobbleFreq, wobblePhase, born: clock.getElapsedTime(), popped: false });
    }

    function updateBubbles(eg: number) {
        if (eg >= nextBubbleTime) {
            spawnBubble();
            nextBubbleTime = eg + 1.5 + Math.random() * 5.0;
        }
        for (let i = activeBubbles.length - 1; i >= 0; i--) {
            const b = activeBubbles[i];
            if (b.popped) { scene.remove(b.mesh); activeBubbles.splice(i, 1); continue; }
            const age = eg - b.born;
            const y = b.startY + age * b.riseSpeed;
            const wobble = Math.sin(age * b.wobbleFreq + b.wobblePhase);
            b.mesh.position.y = y;
            b.mesh.position.x += b.wobbleX * wobble;
            b.mesh.position.z += b.wobbleZ * wobble;
            b.mesh.material.opacity = 0.18 * Math.min(age / 0.3, 1.0);
            if (y >= liqTopY - 0.05) {
                b.popped = true;
                scene.remove(b.mesh);
                activeBubbles.splice(i, 1);
            }
        }
    }

    // ---- UI wiring ----
    const jarUi   = container.querySelector('#jar-ui') as HTMLElement;
    const wetLens = container.querySelector('#wet-lens') as HTMLElement;
    const wetBlur = container.querySelector('#wet-blur') as HTMLElement;
    const whiteout= container.querySelector('#whiteout') as HTMLElement;
    const mapView = container.querySelector('#map-view') as HTMLElement;
    const sliders = container.querySelector('#sliders-ui') as HTMLElement;

    container.querySelector('#start-btn')?.addEventListener('click',()=>{
        if(animState!=='IDLE') return;
        const eg = clock.getElapsedTime();
        p0CamStart.set(startCamPos.x+Math.sin(eg*0.4)*0.15, startCamPos.y+Math.sin(eg*0.27)*0.08, startCamPos.z);
        animState='P0'; animStart=performance.now();
        if (jarUi) jarUi.style.opacity='0';
        if (sliders) sliders.style.opacity='0';
    });

    container.querySelector('#back-btn')?.addEventListener('click',()=>{
        if(animState!=='DONE') return;
        if (onExitReviewRef.current) onExitReviewRef.current();
        if (whiteout) whiteout.style.transition='opacity 0.4s ease';
        animState='R0'; animStart=performance.now();
    });

    // ---- Color picker ----
    function applyLiqColor(hex: string) {
        const c = parseInt(hex.replace('#',''), 16);
        liqVolMat.color.setHex(c); liqVolMat.needsUpdate = true;
        liqCapMat.color.setHex(c); liqCapMat.needsUpdate = true;
        liqTopCapMat.color.setHex(c); liqTopCapMat.needsUpdate = true;
        internalLight.color.setHex(c);
    }
    container.querySelectorAll('.swatch[data-hex]').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
            btn.classList.add('active');
            applyLiqColor('#' + (btn as HTMLElement).dataset.hex);
            const customInput = container.querySelector('#custom-color') as HTMLInputElement;
            if (customInput) customInput.value = '#' + (btn as HTMLElement).dataset.hex;
        });
    });
    const customInput = container.querySelector('#custom-color') as HTMLInputElement;
    const customSwatch = container.querySelector('#custom-swatch');
    if (customInput && customSwatch) {
        customSwatch.parentElement?.addEventListener('click', () => customInput.click());
        customInput.addEventListener('input', function() {
            container.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
            applyLiqColor(this.value);
        });
    }

    // ---- Animate ----
    const clock=new THREE.Clock();
    let animationFrameId: number;
    function animate(t: number){
        animationFrameId = requestAnimationFrame(animate);
        const eg=clock.getElapsedTime();
        sprites.forEach(s=>{
            const u=s.userData;
            s.position.y = u.baseY + Math.sin(eg*u.speed*speedMult + u.offset)*u.amplitude*ampMult;
            s.position.x = u.baseX + Math.sin(eg*u.speedX*speedMult + u.offsetX)*u.amplitudeX*ampMult;
            s.position.z = u.baseZ + Math.cos(eg*u.speedZ*speedMult + u.offsetZ)*u.amplitudeZ*ampMult;
            s.lookAt(camera.position);
        });
        partGeo.rotateY(0); 
        scene.children.forEach(c=>{ if((c as any).isPoints) c.rotation.y=eg*0.05; });
        updateWave(eg);
        updateBubbles(eg);
        updateMicrobes(eg);

        if(animState==='IDLE'){
            camera.position.set(startCamPos.x+Math.sin(eg*0.4)*0.15, startCamPos.y+Math.sin(eg*0.27)*0.08, startCamPos.z);
            camera.lookAt(startLookAt);
        } else if(animState==='P0'){
            const tt=Math.min((t-animStart)/P0_DUR,1), ee=easeInOutCubic(tt);
            camera.position.lerpVectors(p0CamStart, p0CamEnd, ee);
            const lookY = THREE.MathUtils.lerp(0, 0, ee);
            camera.lookAt(0, lookY, 0);
            camera.fov = THREE.MathUtils.lerp(60, 52, ee); camera.updateProjectionMatrix();
            if(tt>=1){animState='P1';animStart=performance.now();}
        } else if(animState==='P1'){
            const tt=Math.min((t-animStart)/P1_DUR,1), ee=easeInOutCubic(tt);
            camera.position.lerpVectors(p0CamEnd,p1CamTarget,ee);
            camera.lookAt(0,0,0); camera.fov=52+ee*8; camera.updateProjectionMatrix();
            if(tt>=1){animState='P2';animStart=performance.now();}
        } else if(animState==='P2'){
            const tt=Math.min((t-animStart)/P2_DUR,1), ee=easeInOutCubic(tt);
            camera.position.lerpVectors(p1CamTarget,p2CamTarget,ee);
            camera.lookAt(new THREE.Vector3().lerpVectors(new THREE.Vector3(0,0,0),p2LookTarget,ee));
            if(camera.position.y<liqTopY+1.2&&!wetTriggered && wetLens) wetLens.style.opacity='0.3';
            if(camera.position.y<liqTopY&&!wetTriggered){
                wetTriggered=true; 
                if (wetLens) wetLens.style.opacity='1'; 
                if (wetBlur) wetBlur.style.opacity='1';
                partMat.size=0.12; partMat.opacity=0.85;
            }
            if(tt>=1){animState='P3';animStart=performance.now();}
        } else if(animState==='P3'){
            const tt=Math.min((t-animStart)/P3_DUR,1);
            if (whiteout) whiteout.style.opacity=String(tt);
            if(tt>=1){
                animState='DONE';
                if (onAnimationComplete) onAnimationComplete();
                if (mapView) {
                    mapView.classList.remove('pointer-events-none'); 
                    mapView.style.visibility='visible'; 
                    mapView.style.opacity='1';
                }
                if (canvas) canvas.style.display='none'; 
                if (wetLens) wetLens.style.display='none'; 
                if (wetBlur) wetBlur.style.display='none';
                if (sliders) {
                    sliders.style.opacity='0'; 
                    sliders.style.pointerEvents='none';
                }
                setTimeout(()=>{if (whiteout) { whiteout.style.transition='opacity 0.8s ease'; whiteout.style.opacity='0'; }},80);
            }
        } else if(animState==='R0'){
            const tt=Math.min((t-animStart)/R0_DUR,1);
            if (whiteout) whiteout.style.opacity=String(tt);
            if(tt>=1){
                if (canvas) canvas.style.display='block';
                if (wetLens) { wetLens.style.display='block'; wetLens.style.opacity='1'; }
                if (wetBlur) { wetBlur.style.display='block'; wetBlur.style.opacity='1'; }
                partMat.size=0.12; partMat.opacity=0.85;
                camera.position.copy(p2CamTarget);
                camera.lookAt(p2LookTarget);
                camera.fov=60; camera.updateProjectionMatrix();
                if (mapView) {
                    mapView.style.opacity='0'; 
                    mapView.style.visibility='hidden'; 
                    mapView.classList.add('pointer-events-none');
                }
                r1CamStart.copy(p2CamTarget);
                animState='R1'; animStart=performance.now();
                setTimeout(()=>{if (whiteout) { whiteout.style.transition='opacity 0.4s ease'; whiteout.style.opacity='0'; }},60);
            }
        } else if(animState==='R1'){
            const tt=Math.min((t-animStart)/R1_DUR,1), ee=easeInOutCubic(tt);
            camera.position.lerpVectors(p2CamTarget, p1CamTarget, ee);
            camera.lookAt(new THREE.Vector3().lerpVectors(p2LookTarget, new THREE.Vector3(0,0,0), ee));
            if(camera.position.y>liqTopY){
                if (wetLens) wetLens.style.opacity='0'; 
                if (wetBlur) wetBlur.style.opacity='0';
                partMat.size=0.03; partMat.opacity=0.4; wetTriggered=false;
            }
            renderer.render(scene,camera);
            if(tt>=1){animState='R2';animStart=performance.now();}
        } else if(animState==='R2'){
            const tt=Math.min((t-animStart)/R2_DUR,1), ee=easeInOutCubic(tt);
            camera.position.lerpVectors(p1CamTarget, p0CamEnd, ee);
            camera.lookAt(0,0,0);
            camera.fov=60; camera.updateProjectionMatrix();
            renderer.render(scene,camera);
            if(tt>=1){animState='R3';animStart=performance.now();}
        } else if(animState==='R3'){
            const tt=Math.min((t-animStart)/R3_DUR,1), ee=easeInOutCubic(tt);
            camera.position.lerpVectors(p0CamEnd, startCamPos, ee);
            camera.lookAt(0,0,0);
            renderer.render(scene,camera);
            if(tt>=1){
                animState='IDLE';
                if (jarUi) jarUi.style.opacity='1';
                if (sliders) {
                    sliders.style.opacity = '';
                    sliders.style.pointerEvents = '';
                }
            }
        }
        if(animState!=='DONE') renderer.render(scene,camera);
    }

    animate(performance.now());

    return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', updateSize);
        renderer.dispose();
    };
  }, []);

  // Update map nodes when reviewWords changes
  useEffect(() => {
    if (!containerRef.current) return;
    
    const nc = containerRef.current.querySelector('#nodes-container');
    const sv = containerRef.current.querySelector('#network-lines');
    if (!nc || !sv) return;

    nc.innerHTML = '';
    sv.innerHTML = '';

    if (reviewWords.length === 0) return;

    // Generate positions for nodes using Golden Angle (Phyllotaxis) for organic distribution
    const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
    const nodes = reviewWords.map((word, i) => {
        const angle = i * GOLDEN_ANGLE;
        // Adjust spread based on word count
        const spread = Math.min(35, 15 + Math.sqrt(reviewWords.length) * 4);
        let radius = Math.sqrt(i + 1) * (spread / Math.sqrt(reviewWords.length || 1));
        
        let x = 50 + Math.cos(angle) * radius;
        let y = 45 + Math.sin(angle) * radius; // Shifted center up from 50 to 45

        // Safety check to avoid blocking bottom-center button (Show Jar) and top header
        // Ensure y doesn't go too low (e.g., below 82%) or too high (e.g., above 12%)
        if (y > 82) {
            y = 82;
        }
        if (y < 12) {
            y = 12;
        }
        
        return {
            ...word,
            x,
            y,
            size: 45 + Math.random() * 15 // Smaller, more consistent size
        };
    });

    nodes.forEach(nd => {
        const el = document.createElement('div');
        el.className = `map-node absolute cursor-pointer group ${nd.isReviewed ? 'is-reviewed' : ''}`;
        el.style.cssText = `left:${nd.x}%;top:${nd.y}%;transform:translate(-50%,-50%);`;
        el.innerHTML = `
            ${nd.isReviewed ? '' : `<div class="node-glow" style="width:${nd.size * 2.5}px;height:${nd.size * 2.5}px;"></div>`}
            <div class="node-core relative flex items-center justify-center rounded-full border ${nd.isReviewed ? 'border-stone-200 bg-white/60' : 'border-amber-600/30 bg-white/80'} backdrop-blur-md transition-all duration-500 z-10 shadow-sm" style="width:${nd.size}px;height:${nd.size}px;">
                <span class="text-[#4a3f35] font-serif italic text-[10px] md:text-xs tracking-wider pointer-events-none text-center px-2 leading-tight">${nd.word}</span>
            </div>
        `;
        el.addEventListener('click', e => {
            e.stopPropagation();
            if (onWordClickRef.current) onWordClickRef.current(nd);
        });
        nc.appendChild(el);
    });

    const rect = nc.getBoundingClientRect();
    const drawLines = () => {
        sv.innerHTML = '';
        const currentRect = nc.getBoundingClientRect();
        const connections = new Set();

        for (let i = 0; i < nodes.length; i++) {
            // Find 2 nearest neighbors for each node to create a clean, non-cluttered web
            const neighbors = nodes
                .map((n, idx) => ({ idx, dist: Math.sqrt(Math.pow(nodes[i].x - n.x, 2) + Math.pow(nodes[i].y - n.y, 2)) }))
                .filter(n => n.idx !== i)
                .sort((a, b) => a.dist - b.dist)
                .slice(0, 2);

            neighbors.forEach(nb => {
                const pair = [i, nb.idx].sort().join('-');
                if (!connections.has(pair) && nb.dist < 30) {
                    connections.add(pair);
                    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    ln.setAttribute('x1', String((nodes[i].x / 100) * currentRect.width));
                    ln.setAttribute('y1', String((nodes[i].y / 100) * currentRect.height));
                    ln.setAttribute('x2', String((nodes[nb.idx].x / 100) * currentRect.width));
                    ln.setAttribute('y2', String((nodes[nb.idx].y / 100) * currentRect.height));
                    
                    // Beautify: solid yellow lines as requested
                    ln.setAttribute('stroke', '#d97706');
                    ln.setAttribute('stroke-width', '1');
                    ln.setAttribute('stroke-opacity', '0.25');
                    sv.appendChild(ln);
                }
            });
        }
    };

    drawLines();
    window.addEventListener('resize', drawLines);
    return () => window.removeEventListener('resize', drawLines);
  }, [reviewWords, onWordClick]);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden rounded-2xl shadow-2xl bg-[#faf8f5]" style={{
        backgroundImage: `
            linear-gradient(to right, rgba(230, 222, 195, 0.4) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(230, 222, 195, 0.4) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        backgroundPosition: 'center center'
    }}>
        <style>{`
            @keyframes rotateSlow {
                from { transform: translate(-50%,-50%) rotate(0deg); }
                to   { transform: translate(-50%,-50%) rotate(360deg); }
            }
            @keyframes float {
                0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
                50% { transform: translate(-50%, -50%) translateY(-5px); }
            }
            .map-node {
                animation: float 4s ease-in-out infinite;
            }
            .map-node:nth-child(odd) {
                animation-delay: -2s;
            }
            .swatch {
                width:22px; height:22px;
                border-radius:50%;
                border:2px solid transparent;
                cursor:pointer;
                transition:transform 0.15s, border-color 0.15s;
                flex-shrink:0;
            }
            .swatch:hover { transform:scale(1.18); }
            .swatch.active { border-color:#fbbf24; box-shadow:0 0 0 1px rgba(251,191,36,0.5); }
            .map-node:hover .node-glow {
                transform: translate(-50%,-50%) scale(1.2);
                background: radial-gradient(circle, rgba(217,119,6,0.2) 0%, rgba(217,119,6,0) 70%);
            }
            .map-node:hover .node-core {
                border-color: #fbbf24;
                transform: scale(1.1);
                box-shadow: 0 10px 25px rgba(217,119,6,0.15);
            }
            .map-node.is-reviewed:hover .node-core {
                border-color: #e5e7eb;
                transform: scale(1.05);
                box-shadow: 0 5px 15px rgba(0,0,0,0.05);
            }
            .node-glow {
                position: absolute;
                top: 50%; left: 50%;
                transform: translate(-50%,-50%);
                border-radius: 50%;
                background: radial-gradient(circle, rgba(217,119,6,0.2) 0%, rgba(217,119,6,0) 70%);
                pointer-events: none;
                transition: all 0.5s ease;
            }
        `}</style>
        
        {/* overlays */}
        <div id="wet-lens" className="absolute inset-0 z-30 pointer-events-none opacity-0 bg-[#d97706]/20 mix-blend-multiply" style={{transition:'opacity 0.7s ease'}}></div>
        <div id="wet-blur" className="absolute inset-0 z-30 pointer-events-none opacity-0" style={{backdropFilter:'blur(8px) contrast(1.1) brightness(1.2)',transition:'opacity 0.7s ease'}}></div>
        <div id="whiteout" className="absolute inset-0 z-40 pointer-events-none opacity-0 bg-white" style={{transition:'opacity 0.3s ease'}}></div>

        {/* sliders */}
        <div id="sliders-ui" className={`absolute top-24 left-8 z-20 flex flex-col space-y-4 transition-all duration-500 ${showControls ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10 pointer-events-none'}`}>
            <div className="flex flex-col space-y-1">
                <div className="flex justify-between items-center">
                    <span className="text-[#8b7355] text-xs tracking-[0.2em] font-light">Fluctuation Speed</span>
                    <span id="speed-val" className="text-[#d97706] text-xs tracking-wider font-light">1.0×</span>
                </div>
                <input id="speed-slider" type="range" min="0" max="100" defaultValue="50" className="w-44 h-px appearance-none cursor-pointer" style={{background: 'linear-gradient(to right, #d97706 50%, rgba(139,115,85,0.25) 50%)', outline:'none'}} />
            </div>
            <div className="flex flex-col space-y-1">
                <div className="flex justify-between items-center">
                    <span className="text-[#8b7355] text-xs tracking-[0.2em] font-light">Fluctuation Amplitude</span>
                    <span id="amp-val" className="text-[#d97706] text-xs tracking-wider font-light">1.0×</span>
                </div>
                <input id="amp-slider" type="range" min="0" max="100" defaultValue="50" className="w-44 h-px appearance-none cursor-pointer" style={{background: 'linear-gradient(to right, #d97706 50%, rgba(139,115,85,0.25) 50%)', outline:'none'}} />
            </div>
            <div className="flex flex-col space-y-1">
                <div className="flex justify-between items-center">
                    <span className="text-[#8b7355] text-xs tracking-[0.2em] font-light">Liquid Density</span>
                    <span id="liq-val" className="text-[#d97706] text-xs tracking-wider font-light">0.65</span>
                </div>
                <input id="liq-slider" type="range" min="0" max="100" defaultValue="65" className="w-44 h-px appearance-none cursor-pointer" style={{background: 'linear-gradient(to right, #d97706 65%, rgba(139,115,85,0.25) 65%)', outline:'none'}} />
            </div>
            <div className="flex flex-col space-y-2" id="color-ui">
                <span className="text-[#8b7355] text-xs tracking-[0.2em] font-light">Liquid Color</span>
                <div className="flex items-center space-x-2">
                    <button className="swatch active" data-hex="bf783a" style={{background:'#bf783a'}}></button>
                    <button className="swatch" data-hex="8b3a2a" style={{background:'#8b3a2a'}}></button>
                    <button className="swatch" data-hex="4a7c59" style={{background:'#4a7c59'}}></button>
                    <button className="swatch" data-hex="2c5f8a" style={{background:'#2c5f8a'}}></button>
                    <button className="swatch" data-hex="6b4fa0" style={{background:'#6b4fa0'}}></button>
                    <label style={{position:'relative',cursor:'pointer',flexShrink:0}} title="Custom">
                        <span style={{display:'flex',alignItems:'center',justifyContent:'center',width:'22px',height:'22px',borderRadius:'50%',border:'2px solid rgba(139,115,85,0.35)',background:'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)'}} id="custom-swatch"></span>
                        <input type="color" id="custom-color" defaultValue="#bf783a" style={{position:'absolute',opacity:0,width:0,height:0,pointerEvents:'none'}} />
                    </label>
                </div>
            </div>
            <div className="flex flex-col space-y-1">
                <div className="flex justify-between items-center">
                    <span className="text-[#8b7355] text-xs tracking-[0.2em] font-light">Cap Opacity</span>
                    <span id="cap-val" className="text-[#d97706] text-xs tracking-wider font-light">0.25</span>
                </div>
                <input id="cap-slider" type="range" min="0" max="100" defaultValue="25" className="w-44 h-px appearance-none cursor-pointer" style={{background: 'linear-gradient(to right, #d97706 25%, rgba(139,115,85,0.25) 25%)', outline:'none'}} />
            </div>
            <div className="flex flex-col space-y-1">
                <div className="flex justify-between items-center">
                    <span className="text-[#8b7355] text-xs tracking-[0.2em] font-light">Wave Speed</span>
                    <span id="wave-speed-val" className="text-[#d97706] text-xs tracking-wider font-light">1.0×</span>
                </div>
                <input id="wave-speed-slider" type="range" min="0" max="100" defaultValue="50" className="w-44 h-px appearance-none cursor-pointer" style={{background: 'linear-gradient(to right, #d97706 50%, rgba(139,115,85,0.25) 50%)', outline:'none'}} />
            </div>
            <div className="flex flex-col space-y-1">
                <div className="flex justify-between items-center">
                    <span className="text-[#8b7355] text-xs tracking-[0.2em] font-light">Wave Amplitude</span>
                    <span id="wave-amp-val" className="text-[#d97706] text-xs tracking-wider font-light">1.0×</span>
                </div>
                <input id="wave-amp-slider" type="range" min="0" max="100" defaultValue="50" className="w-44 h-px appearance-none cursor-pointer" style={{background: 'linear-gradient(to right, #d97706 50%, rgba(139,115,85,0.25) 50%)', outline:'none'}} />
            </div>
        </div>

        {/* jar ui */}
        <div id="jar-ui" className="absolute inset-0 z-20 pointer-events-none flex flex-col items-center justify-end pb-24" style={{transition:'opacity 0.5s ease'}}>
            <button id="start-btn" className="pointer-events-auto group flex flex-col items-center space-y-3 cursor-pointer" onClick={() => {
                console.log('Start button clicked');
                startAnimRef.current();
            }}>
                <div className="w-8 h-8 rounded-full border border-[#8b7355]/30 flex items-center justify-center group-hover:border-[#d97706] transition-colors duration-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#8b7355] group-hover:bg-[#d97706] transition-colors duration-300"></div>
                </div>
                <span className="text-[#8b7355] text-sm tracking-[0.3em] font-light group-hover:text-[#d97706] transition-colors duration-300 uppercase">Review</span>
            </button>
        </div>

        {/* map view */}
        <div id="map-view" className="absolute inset-0 z-30 opacity-0 pointer-events-none" style={{transition:'opacity 0.4s ease',visibility:'hidden'}}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(250,248,245,0.8)_100%)] pointer-events-none"></div>
            <div className="absolute top-1/2 left-1/2 w-[800px] h-[800px] pointer-events-none opacity-20" style={{transform:'translate(-50%,-50%)',animation:'rotateSlow 60s linear infinite'}}>
                <svg viewBox="0 0 100 100" className="w-full h-full stroke-[#8b7355] fill-none" strokeWidth="0.1">
                    <circle cx="50" cy="50" r="20" strokeDasharray="1 2"></circle>
                    <circle cx="50" cy="50" r="35" strokeDasharray="0.5 4"></circle>
                    <circle cx="50" cy="50" r="48" strokeDasharray="2 6"></circle>
                    <line x1="50" y1="0" x2="50" y2="100" strokeDasharray="0.5 2"></line>
                    <line x1="0" y1="50" x2="100" y2="50" strokeDasharray="0.5 2"></line>
                </svg>
            </div>
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" id="network-lines"></svg>
            <div id="nodes-container" className="absolute inset-0 z-10"></div>

            {/* back to jar button */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
                <button id="back-btn" className="pointer-events-auto group flex flex-col items-center space-y-3 cursor-pointer">
                    <span className="text-[#8b7355] text-xs tracking-[0.3em] font-light group-hover:text-[#d97706] transition-colors duration-300 uppercase">Show Jar</span>
                    <div className="w-10 h-10 rounded-full border border-[#8b7355]/30 flex items-center justify-center group-hover:border-[#d97706] transition-colors duration-300">
                        <svg className="w-4 h-4 text-[#8b7355] group-hover:text-[#d97706] transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 15l7-7 7 7"></path></svg>
                    </div>
                </button>
            </div>
        </div>

        {/* detail panel */}
        <div id="detail-panel" className="absolute top-0 right-0 w-[400px] h-full bg-[#faf8f5]/95 backdrop-blur-md border-l border-[#8b7355]/20 z-50 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.05)]" style={{transform:'translateX(100%)',transition:'transform 0.7s cubic-bezier(0.19,1,0.22,1)'}}>
            <div className="p-8 pb-4 flex justify-between items-center border-b border-[#8b7355]/10">
                <h2 id="panel-title" className="text-2xl font-medium text-[#4a3f35] tracking-widest">記憶</h2>
                <button id="close-panel" className="w-8 h-8 rounded-full hover:bg-[#8b7355]/10 flex items-center justify-center transition-colors text-[#8b7355]">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="space-y-3 cursor-pointer group">
                    <div className="flex items-center space-x-3"><div className="w-1.5 h-1.5 rounded-full bg-[#d97706]"></div><span className="text-xs text-[#8b7355] tracking-widest">2023.10.14</span></div>
                    <p className="text-sm text-[#4a3f35] leading-loose text-justify group-hover:text-[#d97706] transition-colors">古い蔵の中で見つけた手帳には、祖父の字で「静寂が味を育てる」と記されていた。温度管理だけではない、空間の記憶が菌に影響を与えるという仮説。</p>
                </div>
                <div className="w-full h-px bg-[#8b7355]/10"></div>
                <div className="space-y-3 cursor-pointer group">
                    <div className="flex items-center space-x-3"><div className="w-1.5 h-1.5 rounded-full bg-[#d97706] opacity-50"></div><span className="text-xs text-[#8b7355] tracking-widest">2023.09.28</span></div>
                    <p className="text-sm text-[#4a3f35] leading-loose text-justify group-hover:text-[#d97706] transition-colors">秋の気配が濃くなるにつれ、発酵の進みが穏やかになった。まるで季節の移ろいを感知しているかのようだ。データには現れない微細な揺らぎ。</p>
                </div>
                <div className="w-full h-px bg-[#8b7355]/10"></div>
                <div className="space-y-3 cursor-pointer group">
                    <div className="flex items-center space-x-3"><div className="w-1.5 h-1.5 rounded-full bg-[#d97706] opacity-50"></div><span className="text-xs text-[#8b7355] tracking-widest">2023.08.12</span></div>
                    <p className="text-sm text-[#4a3f35] leading-loose text-justify group-hover:text-[#d97706] transition-colors">澱の沈殿パターンに規則性を見出した。フラクタル状に広がるその形は、過去の発酵過程の全記憶を内包しているように見える。</p>
                </div>
            </div>
            <div className="p-6 border-t border-[#8b7355]/10 bg-[#f0ece1]/50">
                <button className="w-full py-3 border border-[#d97706] text-[#d97706] text-sm tracking-widest hover:bg-[#d97706] hover:text-white transition-colors duration-300 uppercase">Write New Entry</button>
            </div>
        </div>
        
        <div className="absolute top-0 left-0 w-full h-12 flex items-center px-4 z-50 pointer-events-none">
            {/* Dots and label removed for cleaner mobile look */}
        </div>

        <canvas id="webgl-canvas" className="absolute top-0 left-0 w-full h-full z-10 outline-none"></canvas>
    </div>
  );
});
