import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import * as THREE from 'three';

export interface JarSceneHandle {
  startAnimation: () => void;
}

interface JarSceneProps {
  words: string[];
  onAnimationComplete: () => void;
}

export const JarScene = forwardRef<JarSceneHandle, JarSceneProps>(({ words, onAnimationComplete }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animStateRef = useRef<'IDLE' | 'P0' | 'P1' | 'P2' | 'P3' | 'DONE'>('IDLE');
  const animStartRef = useRef(0);
  
  const [wetOpacity, setWetOpacity] = useState(0);
  const [whiteoutOpacity, setWhiteoutOpacity] = useState(0);

  useImperativeHandle(ref, () => ({
    startAnimation: () => {
      if (animStateRef.current !== 'IDLE') return;
      animStateRef.current = 'P0';
      animStartRef.current = performance.now();
    }
  }));

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    
    const updateSize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    const startCamPos = new THREE.Vector3(0, 2.0, 16);
    const startLookAt = new THREE.Vector3(0, 0, 0);
    camera.position.copy(startCamPos);
    camera.lookAt(startLookAt);

    updateSize();
    window.addEventListener('resize', updateSize);

    // ---- Lighting ----
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const topLight = new THREE.PointLight(0xffffff, 1.5, 20);
    topLight.position.set(2, 6, 4); scene.add(topLight);
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
    rimLight.position.set(-3, 2, -3); scene.add(rimLight);
    const internalLight = new THREE.PointLight(0xffffff, 1.0, 5);
    internalLight.position.set(0, -0.5, 0); scene.add(internalLight);

    // ---- Materials ----
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff, transmission: 0.98, roughness: 0.02,
        ior: 1.5, side: THREE.DoubleSide, transparent: true,
        // @ts-ignore
        thickness: 0.1
    });
    const outlineMat = new THREE.MeshBasicMaterial({
        color: 0xf5f5f5, side: THREE.BackSide, transparent: true, opacity: 0.6
    });
    const lidMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff, transmission: 0.95, roughness: 0.02,
        ior: 1.5, side: THREE.DoubleSide, transparent: true,
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
    
    const liqColor = 0xe0cdb0;
    const liqVolMat = new THREE.MeshBasicMaterial({
        color: liqColor, transparent: true, opacity: 0.85,
        side: THREE.FrontSide, depthTest: false, depthWrite: false
    });
    const liqVolMesh = new THREE.Mesh(new THREE.LatheGeometry(liqPoints,64), liqVolMat);
    liqVolMesh.renderOrder = 2;
    scene.add(liqVolMesh);
    
    const liqCapMat = new THREE.MeshBasicMaterial({
        color: liqColor, transparent: true, opacity: 0.85,
        side: THREE.FrontSide, depthTest: false, depthWrite: false
    });
    const liqCapMesh = new THREE.Mesh(new THREE.CircleGeometry(liqPoints[0].x * 0.98, 64), liqCapMat);
    liqCapMesh.rotation.x = Math.PI / 2;
    liqCapMesh.position.y = liqPoints[0].y + 0.01;
    liqCapMesh.renderOrder = 2;
    scene.add(liqCapMesh);
    
    const liqTopCapMat = new THREE.MeshBasicMaterial({
        color: 0xe8d8c0, transparent: true, opacity: 0.9,
        side: THREE.FrontSide, depthTest: false, depthWrite: false
    });
    const jarRadiusBot = 2.132;

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
        const amp = 0.045;
        const freq = 3.2;
        const sp = 1.1;
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

    // ---- Text sprites ----
    const displayWords = words.length > 0 ? words : ['発酵','記憶','静寂','問い','秋','醸す','澱','季節'];
    const allWords = ['発酵','記憶','静寂','問い','秋','醸す','澱','季節','時間','思考','沈殿','麹','息','熱','言葉','微生物','風','心','光','闇','朝','夜','蔵','水','塩','米','土','菌'];
    const sprites: THREE.Sprite[] = [];
    
    function mkSprite(text: string, opts: any = {}) {
        const c=document.createElement('canvas'), fs=opts.fontSize||28;
        c.width=opts.width||192; c.height=opts.height||80;
        const ctx=c.getContext('2d');
        if(!ctx) return new THREE.Sprite();
        ctx.font=`${opts.weight||400} ${fs}px "Noto Serif JP", serif`;
        ctx.fillStyle=opts.color||'#a89f91'; ctx.globalAlpha=1;
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
    });
    
    const kana='あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
    for(let i=0;i<100;i++){
        const isW=Math.random()>0.55;
        const txt=isW?allWords[Math.floor(Math.random()*allWords.length)]:kana[Math.floor(Math.random()*kana.length)];
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
    const partMat=new THREE.PointsMaterial({color:0xffffff,size:0.03,transparent:true,opacity:0.4,blending:THREE.AdditiveBlending});
    scene.add(new THREE.Points(partGeo,partMat));

    // ---- Microbes ----
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

        const ref = sprites[Math.floor(Math.random() * Math.min(displayWords.length, sprites.length))];
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

    // ---- Bubbles ----
    const bubbleMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff, transparent: true, opacity: 0.18,
        roughness: 0.05, ior: 1.33, side: THREE.DoubleSide, depthTest: false, depthWrite: false,
        // @ts-ignore
        thickness: 0.04
    });
    const activeBubbles: any[] = [];
    let nextBubbleTime = 2.5 + Math.random() * 4;

    function spawnBubble(eg: number) {
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
        activeBubbles.push({ mesh, startY, riseSpeed, wobbleX, wobbleZ, wobbleFreq, wobblePhase, born: eg, popped: false });
    }

    function updateBubbles(eg: number) {
        if (eg >= nextBubbleTime) {
            spawnBubble(eg);
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

    // ---- Animation ----
    const P0_DUR = 1200, P1_DUR = 1000, P2_DUR = 1467, P3_DUR = 667;
    let p0CamStart = new THREE.Vector3();
    const p0CamEnd     = new THREE.Vector3(0, 18.0, 0.01);
    const p1CamTarget  = new THREE.Vector3(0, 14.0, 0.01);
    const p2CamTarget  = new THREE.Vector3(0, -2.0, 0.01);
    const p2LookTarget = new THREE.Vector3(0, -6,   0);
    let wetTriggered = false;

    function easeInOutCubic(x: number) { return x < 0.5 ? 4*x*x*x : 1 - Math.pow(-2*x+2,3)/2; }

    const clock = new THREE.Clock();
    let animationFrameId: number;

    function animate(t: number) {
        animationFrameId = requestAnimationFrame(animate);
        const eg = clock.getElapsedTime();
        
        sprites.forEach(s => {
            const u = s.userData;
            s.position.y = u.baseY + Math.sin(eg*u.speed + u.offset)*u.amplitude;
            s.position.x = u.baseX + Math.sin(eg*u.speedX + u.offsetX)*u.amplitudeX;
            s.position.z = u.baseZ + Math.cos(eg*u.speedZ + u.offsetZ)*u.amplitudeZ;
            s.lookAt(camera.position);
        });
        
        partGeo.rotateY(0);
        scene.children.forEach(c => { if ((c as any).isPoints) c.rotation.y = eg * 0.05; });
        updateWave(eg);
        updateBubbles(eg);
        updateMicrobes(eg);

        const state = animStateRef.current;
        const animStart = animStartRef.current;

        if(state === 'IDLE'){
            camera.position.set(startCamPos.x+Math.sin(eg*0.4)*0.15, startCamPos.y+Math.sin(eg*0.27)*0.08, startCamPos.z);
            camera.lookAt(startLookAt);
        } else if(state === 'P0'){
            const tt=Math.min((t-animStart)/P0_DUR,1), ee=easeInOutCubic(tt);
            camera.position.lerpVectors(p0CamStart, p0CamEnd, ee);
            const lookY = THREE.MathUtils.lerp(0, 0, ee);
            camera.lookAt(0, lookY, 0);
            camera.fov = THREE.MathUtils.lerp(60, 52, ee); camera.updateProjectionMatrix();
            if(tt>=1){animStateRef.current='P1';animStartRef.current=performance.now();}
        } else if(state === 'P1'){
            const tt=Math.min((t-animStart)/P1_DUR,1), ee=easeInOutCubic(tt);
            camera.position.lerpVectors(p0CamEnd,p1CamTarget,ee);
            camera.lookAt(0,0,0); camera.fov=52+ee*8; camera.updateProjectionMatrix();
            if(tt>=1){animStateRef.current='P2';animStartRef.current=performance.now();}
        } else if(state === 'P2'){
            const tt=Math.min((t-animStart)/P2_DUR,1), ee=easeInOutCubic(tt);
            camera.position.lerpVectors(p1CamTarget,p2CamTarget,ee);
            camera.lookAt(new THREE.Vector3().lerpVectors(new THREE.Vector3(0,0,0),p2LookTarget,ee));
            if(camera.position.y<liqTopY+1.2&&!wetTriggered) setWetOpacity(0.3);
            if(camera.position.y<liqTopY&&!wetTriggered){
                wetTriggered=true; setWetOpacity(1);
                partMat.size=0.12; partMat.opacity=0.85;
            }
            if(tt>=1){animStateRef.current='P3';animStartRef.current=performance.now();}
        } else if(state === 'P3'){
            const tt=Math.min((t-animStart)/P3_DUR,1);
            setWhiteoutOpacity(tt);
            if(tt>=1){
                animStateRef.current='DONE';
                onAnimationComplete();
            }
        }

        if(state !== 'DONE') renderer.render(scene,camera);
    }

    // Set initial p0CamStart
    p0CamStart.copy(camera.position);
    animate(performance.now());

    return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', updateSize);
        renderer.dispose();
        jarGroup.children.forEach(c => {
            if (c instanceof THREE.Mesh) {
                c.geometry.dispose();
                if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
                else c.material.dispose();
            }
        });
    };
  }, [words, onAnimationComplete]);

  return (
    <div ref={containerRef} className="w-full h-full absolute inset-0 z-0 pointer-events-none overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full outline-none" />
      
      {/* Wet Lens Overlay */}
      <div 
        className="absolute inset-0 z-30 pointer-events-none bg-[#d97706]/20 mix-blend-multiply" 
        style={{ opacity: wetOpacity, transition: 'opacity 0.7s ease' }} 
      />
      
      {/* Wet Blur Overlay */}
      <div 
        className="absolute inset-0 z-30 pointer-events-none" 
        style={{ 
          opacity: wetOpacity, 
          backdropFilter: 'blur(8px) contrast(1.1) brightness(1.2)',
          transition: 'opacity 0.7s ease' 
        }} 
      />
      
      {/* Whiteout Overlay */}
      <div 
        className="absolute inset-0 z-40 pointer-events-none bg-white" 
        style={{ opacity: whiteoutOpacity, transition: 'opacity 0.3s ease' }} 
      />
    </div>
  );
});
