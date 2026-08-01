/* SPORELANDS v3 — a lush, living psychedelic mushroom world
   bloom + shadows + nebula sky + dense flora + jellyfish + butterflies + ponds */
(function () {
  'use strict';

  // ---------- renderer / scene ----------
  const canvas = document.getElementById('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x140828, 0.0102);

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);

  let seed = 1337;
  function rng() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  function hsl(h, s, l) { return new THREE.Color().setHSL(((h % 1) + 1) % 1, s, l); }

  const WORLD_RADIUS = 230;
  const uTimeShared = { value: 0 };   // one clock for every shader patch

  // ---------- procedural canvas textures ----------
  function makeTex(size, draw, repX, repY) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    draw(cv.getContext('2d'), size);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repX || repY) t.repeat.set(repX || 1, repY || 1);
    t.anisotropy = 8;
    return t;
  }

  const capTex = makeTex(256, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#d8d4d0'); g.addColorStop(1, '#8d8489');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * s;
      ctx.strokeStyle = 'rgba(70,45,90,' + (0.03 + Math.random() * 0.09) + ')';
      ctx.lineWidth = 1 + Math.random() * 2.5;
      ctx.beginPath(); ctx.moveTo(x, s * 0.12); ctx.lineTo(x + (Math.random() - 0.5) * 14, s); ctx.stroke();
    }
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + Math.random() * 0.12 + ')';
      ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
  });

  const stemTex = makeTex(128, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#f2ead9'); g.addColorStop(1, '#c9bba4');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * s;
      ctx.strokeStyle = 'rgba(120,95,70,' + (0.05 + Math.random() * 0.14) + ')';
      ctx.lineWidth = 0.5 + Math.random() * 1.8;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (Math.random() - 0.5) * 6, s); ctx.stroke();
    }
  }, 3, 1);

  const gillTex = makeTex(256, (ctx, s) => {
    ctx.fillStyle = '#2a1438'; ctx.fillRect(0, 0, s, s);
    ctx.save(); ctx.translate(s / 2, s / 2);
    for (let i = 0; i < 150; i++) {
      ctx.rotate((Math.PI * 2) / 150);
      ctx.strokeStyle = 'rgba(150,105,180,' + (0.25 + Math.random() * 0.35) + ')';
      ctx.lineWidth = 1 + Math.random();
      ctx.beginPath(); ctx.moveTo(s * 0.03, 0); ctx.lineTo(s * 0.5, 0); ctx.stroke();
    }
    ctx.restore();
  });

  const softTex = makeTex(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  });

  // mottled detail texture so the ground isn't a flat sheet of color
  const groundDetailTex = makeTex(256, (ctx, s) => {
    ctx.fillStyle = '#c8c8c8'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 420; i++) {
      const x = Math.random() * s, y = Math.random() * s, r = 3 + Math.random() * 26;
      const dark = Math.random() > 0.5;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const a = 0.04 + Math.random() * 0.10;
      g.addColorStop(0, dark ? 'rgba(40,30,60,' + a + ')' : 'rgba(255,250,240,' + a + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }, 26, 26);

  const fernTex = makeTex(256, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.translate(s / 2, s);
    for (let f = 0; f < 9; f++) {
      const ang = (f / 8 - 0.5) * 2.0;
      const len = s * (0.55 + Math.random() * 0.4);
      const grad = ctx.createLinearGradient(0, 0, 0, -len);
      grad.addColorStop(0, '#1f7a4d'); grad.addColorStop(1, '#8ef7b8');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(ang * 40, -len * 0.5, ang * 90, -len);
      ctx.stroke();
      ctx.lineWidth = 1.5;
      for (let k = 1; k < 14; k++) { // leaflets
        const tt = k / 14;
        const bx = ang * 40 * 2 * tt * (1 - tt) + ang * 90 * tt * tt;
        const by = -len * tt;
        const leaf = 14 * (1 - tt) + 3;
        ctx.beginPath(); ctx.moveTo(bx - leaf, by - leaf * 0.4); ctx.lineTo(bx, by); ctx.lineTo(bx + leaf, by - leaf * 0.4);
        ctx.stroke();
      }
    }
  });

  const wingTex = makeTex(128, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, '#ff4fd8'); g.addColorStop(0.5, '#8f6bff'); g.addColorStop(1, '#4fe8ff');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(6, s * 0.55);
    ctx.bezierCurveTo(s * 0.15, 4, s * 0.95, 4, s * 0.92, s * 0.38);
    ctx.bezierCurveTo(s * 0.9, s * 0.62, s * 0.5, s * 0.6, s * 0.45, s * 0.72);
    ctx.bezierCurveTo(s * 0.42, s * 0.92, s * 0.1, s * 0.95, 6, s * 0.55);
    ctx.fill();
    for (const [ex, ey, er, c] of [[s * 0.62, s * 0.28, 13, '#2a0a3a'], [s * 0.35, s * 0.42, 9, '#ffd166']]) {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex - er * 0.3, ey - er * 0.3, er * 0.3, 0, Math.PI * 2); ctx.fill();
    }
  });

  const runeTex = makeTex(128, (ctx, s) => {
    ctx.fillStyle = '#241a2e'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + Math.random() * 0.05 + ')';
      ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
    ctx.strokeStyle = '#c99bff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let row = 0; row < 5; row++) {
      for (let colc = 0; colc < 3; colc++) {
        const bx = 16 + colc * 38, by = 12 + row * 24;
        ctx.beginPath();
        let px = bx, py = by;
        ctx.moveTo(px, py);
        for (let k = 0; k < 3; k++) {
          px = bx + Math.random() * 22; py = by + Math.random() * 14;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
  });

  // ---------- shader patch helpers ----------
  // wind sway for instanced foliage (bends with height above the instance base)
  function windMaterial(mat, strength) {
    const s = strength.toFixed(4);
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTimeShared;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', [
          '#include <begin_vertex>',
          '#ifdef USE_INSTANCING',
          '  vec3 iwp = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);',
          '  float wph = iwp.x * 0.35 + iwp.z * 0.5;',
          '  float wamt = max(transformed.y, 0.0);',
          '  transformed.x += sin(uTime * 1.4 + wph) * ' + s + ' * wamt;',
          '  transformed.z += cos(uTime * 1.1 + wph) * ' + (strength * 0.6).toFixed(4) + ' * wamt;',
          '#endif'
        ].join('\n'));
    };
    return mat;
  }

  // ---------- terrain ----------
  function terrainHeight(x, z) {
    return (
      Math.sin(x * 0.045) * Math.cos(z * 0.045) * 3.2 +
      Math.sin(x * 0.13 + 1.7) * Math.cos(z * 0.11 + 2.3) * 1.1 +
      Math.sin((x + z) * 0.021 + 0.5) * 2.6 +
      Math.cos(x * 0.008) * Math.sin(z * 0.009) * 4.0 +
      Math.sin(x * 0.016 + 2.0) * Math.cos(z * 0.014 + 1.0) * 5.5
    );
  }

  const groundPulse = { value: new THREE.Vector3(0, 0, -100) }; // x, z, startTime
  {
    const size = 520, segs = 200;
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const col = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);
      const hue = (0.62 + h * 0.045 + Math.sin(x * 0.02) * 0.06 + Math.cos(z * 0.017) * 0.06 + 1) % 1;
      col.setHSL(hue, 0.55, 0.15 + Math.max(0, h) * 0.018);
      colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, map: groundDetailTex, roughness: 0.95, metalness: 0
    });
    // glowing mycelium veins, ripple rings, and a rainbow shockwave on spore pickup
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTimeShared;
      shader.uniforms.uPulse = groundPulse;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform float uTime;\nuniform vec3 uPulse;')
        .replace('#include <emissivemap_fragment>', [
          '#include <emissivemap_fragment>',
          'float vx = sin(vWPos.x * 0.30 + sin(vWPos.z * 0.22 + uTime * 0.6) * 2.4);',
          'float vz = cos(vWPos.z * 0.27 + sin(vWPos.x * 0.19 - uTime * 0.5) * 2.4);',
          'float vein = smoothstep(0.70, 0.98, vx * vz);',
          'float d1 = length(vWPos.xz - vec2(30.0, -20.0));',
          'float d2 = length(vWPos.xz - vec2(-60.0, 45.0));',
          'float rings = smoothstep(0.86, 1.0, sin(d1 * 0.5 - uTime * 1.2) * 0.5 + 0.5) * exp(-d1 * 0.012)',
          '            + smoothstep(0.86, 1.0, sin(d2 * 0.4 - uTime * 0.9) * 0.5 + 0.5) * exp(-d2 * 0.012);',
          'vec3 psyCol = 0.5 + 0.5 * cos(uTime * 0.25 + (vWPos.x + vWPos.z) * 0.04 + vec3(0.0, 2.1, 4.2));',
          'totalEmissiveRadiance += psyCol * (vein * 0.40 + rings * 0.55);',
          // shockwave from the last collected spore
          'float pt = uTime - uPulse.z;',
          'if (pt > 0.0 && pt < 6.0) {',
          '  float pd = length(vWPos.xz - uPulse.xy);',
          '  float band = exp(-pow(pd - pt * 16.0, 2.0) * 0.10) * exp(-pt * 0.7);',
          '  totalEmissiveRadiance += (0.5 + 0.5 * cos(pd * 0.45 - uTime * 2.0 + vec3(0.0, 2.1, 4.2))) * band * 1.4;',
          '}'
        ].join('\n'));
    };
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    scene.add(ground);
  }

  // ---------- flowing nebula + aurora sky ----------
  {
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTime: uTimeShared },
      vertexShader: 'varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'varying vec3 vPos;',
        'uniform float uTime;',
        'float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }',
        'float noise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);',
        '  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),',
        '             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }',
        'float fbm(vec3 p){ float v = 0.0; float a = 0.5; for (int k = 0; k < 4; k++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }',
        'void main(){',
        '  vec3 d = normalize(vPos);',
        '  float t = uTime;',
        '  float n1 = fbm(d * 2.3 + vec3(0.0, t * 0.02, t * 0.035));',
        '  float n2 = fbm(d * 4.1 + vec3(t * 0.025, 0.0, -t * 0.02) + n1 * 1.8);',
        '  vec3 neb = 0.5 + 0.5 * cos(6.2831 * (n1 * 0.9 + n2 * 0.5) + t * 0.05 + vec3(0.0, 2.1, 4.2));',
        '  float dens = smoothstep(0.30, 0.85, n1 * 0.55 + n2 * 0.45);',
        '  vec3 col = neb * (0.05 + 0.42 * dens);',
        '  col *= 0.30 + 0.70 * smoothstep(-0.35, 0.75, d.y);',
        '  float a = atan(d.z, d.x);',
        '  float curtain = sin(a * 4.0 + fbm(d * 3.0 + vec3(0.0, t * 0.08, 0.0)) * 5.0 + t * 0.25);',
        '  float aur = exp(-pow(d.y - 0.30 - 0.10 * sin(a * 2.0 + t * 0.15), 2.0) * 30.0) * (0.55 + 0.45 * curtain);',
        '  col += vec3(0.15, 0.95, 0.55) * aur * 0.30 + vec3(0.55, 0.20, 0.95) * aur * aur * 0.45;',
        '  float sp = hash(floor(d * 230.0));',
        '  if (sp > 0.996) { float tw = 0.5 + 0.5 * sin(t * (1.5 + sp * 6.0) + sp * 90.0); col += vec3(0.9, 0.95, 1.0) * tw * 0.9; }',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(800, 48, 24), skyMat));
  }

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0x8a5cff, 0xff5ca8, 0.5);
  scene.add(hemi);
  scene.add(new THREE.AmbientLight(0x2a1840, 0.5));
  const moon = new THREE.DirectionalLight(0xa8c0ff, 0.85);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -75; moon.shadow.camera.right = 75;
  moon.shadow.camera.top = 75; moon.shadow.camera.bottom = -75;
  moon.shadow.camera.near = 20; moon.shadow.camera.far = 400;
  moon.shadow.bias = -0.0004;
  scene.add(moon);
  scene.add(moon.target);
  const rim = new THREE.DirectionalLight(0xff7ad9, 0.25);
  rim.position.set(-80, 40, 60);
  scene.add(rim);

  // ---------- mushrooms ----------
  const colliders = [];
  const caps = [];
  const CAP_HUES = [0.90, 0.78, 0.55, 0.48, 0.33, 0.13, 0.98];

  function capProfilePoint(tt, capR, capH) {
    return {
      r: capR * Math.pow(Math.sin(tt * Math.PI * 0.5), 0.72),
      y: capH * Math.cos(tt * Math.PI * 0.56)
    };
  }

  function makeMushroom(x, z, stemH) {
    const g = new THREE.Group();
    const stemR = stemH * 0.09 * (0.8 + rng() * 0.5);
    const capR = stemH * (0.40 + rng() * 0.22);
    const capH = capR * (0.55 + rng() * 0.40);
    const bend = (rng() - 0.5) * 0.24;
    const wavyN = 5 + Math.floor(rng() * 5);
    const wavyPhase = rng() * Math.PI * 2;

    const stemGeo = new THREE.CylinderGeometry(stemR * 0.78, stemR * 1.5, stemH, 20, 12, true);
    {
      const p = stemGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const yy = (p.getY(i) + stemH / 2) / stemH;
        const bulge = 1 + 0.07 * Math.sin(yy * 9.0 + wavyPhase);
        p.setX(i, p.getX(i) * bulge + bend * stemH * yy * yy);
        p.setZ(i, p.getZ(i) * bulge);
      }
      stemGeo.computeVertexNormals();
    }
    const stemMat = new THREE.MeshStandardMaterial({
      map: stemTex, color: hsl(0.10 + rng() * 0.06, 0.30, 0.78), roughness: 0.85
    });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = stemH / 2;
    stem.castShadow = true; stem.receiveShadow = true;
    g.add(stem);

    const volva = new THREE.Mesh(new THREE.SphereGeometry(stemR * 1.9, 20, 14), stemMat);
    volva.scale.set(1, 0.45, 1);
    volva.position.y = stemR * 0.45;
    g.add(volva);

    const skirt = new THREE.Mesh(new THREE.TorusGeometry(stemR * 1.02, stemR * 0.30, 12, 32), stemMat);
    skirt.rotation.x = Math.PI / 2;
    skirt.position.set(bend * stemH * 0.46, stemH * 0.68, 0);
    g.add(skirt);

    const capGrp = new THREE.Group();
    capGrp.position.set(bend * stemH, stemH * 0.96, 0);
    capGrp.rotation.z = -bend * 0.7;

    const hue = CAP_HUES[Math.floor(rng() * CAP_HUES.length)] + (rng() - 0.5) * 0.05;
    const capMat = new THREE.MeshStandardMaterial({
      map: capTex, color: hsl(hue, 0.85, 0.52),
      emissive: hsl(hue, 0.95, 0.40), emissiveMap: capTex, emissiveIntensity: 0.55,
      roughness: 0.45, side: THREE.DoubleSide
    });
    const pts = [];
    const PSEG = 24;
    for (let i = 0; i <= PSEG; i++) {
      const pp = capProfilePoint(i / PSEG, capR, capH);
      pts.push(new THREE.Vector2(pp.r, pp.y));
    }
    const capGeo = new THREE.LatheGeometry(pts, 48);
    {
      const p = capGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
        const ang = Math.atan2(vz, vx);
        const tEdge = 1 - Math.max(0, Math.min(1, vy / capH));
        const wob = 1 + Math.sin(ang * wavyN + wavyPhase) * 0.055 * tEdge * tEdge;
        p.setX(i, vx * wob); p.setZ(i, vz * wob);
      }
      capGeo.computeVertexNormals();
    }
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.castShadow = true;
    capGrp.add(cap);

    const gillGeo = new THREE.CircleGeometry(capR * 0.94, 48);
    {
      const p = gillGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const ang = Math.atan2(p.getY(i), p.getX(i));
        p.setZ(i, Math.sin(ang * 40.0) * capR * 0.012);
      }
      gillGeo.computeVertexNormals();
    }
    const gills = new THREE.Mesh(gillGeo, new THREE.MeshStandardMaterial({
      map: gillTex, color: 0xbfa8d8, roughness: 0.9,
      emissive: hsl(hue, 0.9, 0.10), side: THREE.DoubleSide
    }));
    gills.rotation.x = Math.PI / 2;
    gills.position.y = 0.02;
    capGrp.add(gills);

    const spotMat = new THREE.MeshStandardMaterial({ color: 0xfff6e8, roughness: 0.65, emissive: 0x443322, emissiveIntensity: 0.3 });
    const spotGeo = new THREE.SphereGeometry(capR * 0.085, 12, 9);
    const nSpots = 5 + Math.floor(rng() * 6);
    for (let s = 0; s < nSpots; s++) {
      const theta = rng() * Math.PI * 2;
      const pp = capProfilePoint(0.12 + rng() * 0.62, capR, capH);
      const spot = new THREE.Mesh(spotGeo, spotMat);
      spot.position.set(Math.cos(theta) * pp.r, pp.y, Math.sin(theta) * pp.r);
      spot.lookAt(spot.position.x * 2, spot.position.y * 2 + capH, spot.position.z * 2);
      spot.scale.set(0.7 + rng() * 0.8, 0.7 + rng() * 0.8, 0.42);
      capGrp.add(spot);
    }

    // glowing bulb-strands hanging beneath the big canopies
    if (stemH > 14) {
      const strandMat = new THREE.MeshStandardMaterial({ color: 0x9adfc8, roughness: 0.7, emissive: 0x2f8f6f, emissiveIntensity: 0.5 });
      const nStr = 7 + Math.floor(rng() * 4);
      for (let k = 0; k < nStr; k++) {
        const a2 = rng() * Math.PI * 2;
        const rr = capR * (0.5 + rng() * 0.38);
        const len = stemH * (0.22 + rng() * 0.3);
        const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, len, 5), strandMat);
        strand.position.set(Math.cos(a2) * rr, -len / 2 - 0.1, Math.sin(a2) * rr);
        capGrp.add(strand);
        const bulbHue = rng();
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.13 + rng() * 0.17, 10, 8),
          new THREE.MeshStandardMaterial({ color: hsl(bulbHue, 1, 0.65), emissive: hsl(bulbHue, 1, 0.55), emissiveIntensity: 2.0 })
        );
        bulb.position.set(strand.position.x, -len - 0.15, strand.position.z);
        capGrp.add(bulb);
      }
    }

    g.add(capGrp);
    caps.push({ mat: capMat, grp: capGrp, phase: rng() * Math.PI * 2 });

    g.position.set(x, terrainHeight(x, z) - 0.25, z);
    g.rotation.y = rng() * Math.PI * 2;
    scene.add(g);
    colliders.push({ x, z, r: stemR * 1.5 + 0.35 });
  }

  for (let i = 0; i < 110; i++) {
    const ang = rng() * Math.PI * 2;
    const dist = 12 + Math.sqrt(rng()) * (WORLD_RADIUS - 20);
    makeMushroom(Math.cos(ang) * dist, Math.sin(ang) * dist, 2.2 + rng() * 7);
  }
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2 + rng();
    const dist = 35 + rng() * 155;
    makeMushroom(Math.cos(ang) * dist, Math.sin(ang) * dist, 16 + rng() * 16);
  }
  // the Mother Shroom — a colossal landmark visible from everywhere
  makeMushroom(-30, -80, 42);
  {
    const baseY = terrainHeight(-30, -80);
    for (let v = 0; v < 3; v++) {
      const pts = [];
      const off = (v / 3) * Math.PI * 2;
      for (let k = 0; k <= 60; k++) {
        const a = off + (k / 60) * Math.PI * 5.5;
        const r = 5.6 - (k / 60) * 3.2;
        pts.push(new THREE.Vector3(-30 + Math.cos(a) * r, baseY + (k / 60) * 38, -80 + Math.sin(a) * r));
      }
      const vine = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x7dffd8, roughness: 0.5, emissive: 0x2fbf8f, emissiveIntensity: 1.1 })
      );
      scene.add(vine);
    }
  }

  // ---------- lush instanced flora ----------
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(),
        _v = new THREE.Vector3(), _s = new THREE.Vector3();

  function scatterInstanced(meshes, count, place) {
    // meshes: array of InstancedMesh sharing the same transforms
    for (let i = 0; i < count; i++) {
      const p = place(i);
      _v.set(p.x, p.y, p.z);
      _e.set(p.rx || 0, p.ry || 0, p.rz || 0);
      _q.setFromEuler(_e);
      _s.set(p.s, p.s * (p.sy || 1), p.s);
      _m.compose(_v, _q, _s);
      for (const mesh of meshes) {
        mesh.setMatrixAt(i, _m);
        if (p.color && mesh.userData.colored) mesh.setColorAt(i, p.color);
      }
    }
  }
  function randomGroundSpot(minDist, maxDist) {
    const ang = rng() * Math.PI * 2;
    const dist = minDist + Math.sqrt(rng()) * (maxDist - minDist);
    const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
    return { x, z, y: terrainHeight(x, z) };
  }

  // 1) swaying grass — 7000 blades
  {
    const geo = new THREE.ConeGeometry(0.045, 1.1, 4, 3, true);
    geo.translate(0, 0.55, 0);
    const mat = windMaterial(new THREE.MeshStandardMaterial({
      roughness: 0.8, emissive: 0x0a3326, emissiveIntensity: 0.35
    }), 0.13);
    const count = 7000;
    const inst = new THREE.InstancedMesh(geo, mat, count);
    inst.userData.colored = true;
    scatterInstanced([inst], count, () => {
      const p = randomGroundSpot(6, WORLD_RADIUS);
      const trippy = rng() < 0.2;
      return {
        x: p.x, y: p.y - 0.05, z: p.z,
        ry: rng() * Math.PI, rx: (rng() - 0.5) * 0.25, rz: (rng() - 0.5) * 0.25,
        s: 0.6 + rng() * 1.3, sy: 0.7 + rng() * 1.3,
        color: trippy ? hsl(0.7 + rng() * 0.25, 0.8, 0.5) : hsl(0.33 + rng() * 0.2, 0.75, 0.30 + rng() * 0.2)
      };
    });
    scene.add(inst);
  }

  // 2) ferns — crossed textured planes, 550 clumps
  {
    const geoA = new THREE.PlaneGeometry(1.7, 1.25);
    geoA.translate(0, 0.62, 0);
    const geoB = geoA.clone().rotateY(Math.PI / 2);
    const mat = windMaterial(new THREE.MeshStandardMaterial({
      map: fernTex, transparent: true, alphaTest: 0.15, side: THREE.DoubleSide,
      roughness: 0.9, emissive: 0x0c4d2e, emissiveIntensity: 0.35
    }), 0.06);
    const count = 550;
    const a = new THREE.InstancedMesh(geoA, mat, count);
    const b = new THREE.InstancedMesh(geoB, mat, count);
    scatterInstanced([a, b], count, () => {
      const p = randomGroundSpot(7, WORLD_RADIUS);
      return { x: p.x, y: p.y - 0.05, z: p.z, ry: rng() * Math.PI, s: 0.5 + rng() * 1.6 };
    });
    scene.add(a); scene.add(b);
  }

  // 3) glowing lantern flowers — stems + hanging bells, 420
  {
    const count = 420;
    const stemGeo = new THREE.CylinderGeometry(0.014, 0.025, 0.75, 6);
    stemGeo.translate(0, 0.37, 0);
    const stemMat = windMaterial(new THREE.MeshStandardMaterial({ color: 0x2e8a5a, roughness: 0.8 }), 0.08);
    const bellGeo = new THREE.SphereGeometry(0.14, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62);
    bellGeo.rotateX(Math.PI);
    bellGeo.translate(0, 0.78, 0);
    const bellMat = windMaterial(new THREE.MeshStandardMaterial({
      roughness: 0.4, emissive: 0xb689ff, emissiveIntensity: 1.15, side: THREE.DoubleSide
    }), 0.08);
    const stems = new THREE.InstancedMesh(stemGeo, stemMat, count);
    const bells = new THREE.InstancedMesh(bellGeo, bellMat, count);
    bells.userData.colored = true;
    scatterInstanced([stems, bells], count, () => {
      const p = randomGroundSpot(7, WORLD_RADIUS);
      return {
        x: p.x, y: p.y - 0.03, z: p.z,
        ry: rng() * Math.PI, rx: (rng() - 0.5) * 0.3, rz: (rng() - 0.5) * 0.3,
        s: 0.7 + rng() * 1.5, color: hsl(rng(), 0.95, 0.62)
      };
    });
    scene.add(stems); scene.add(bells);
  }

  // 4) tiny toadstool clusters — 720 in clumps
  {
    const count = 720;
    const stemGeo = new THREE.CylinderGeometry(0.028, 0.05, 0.26, 8);
    stemGeo.translate(0, 0.13, 0);
    const capGeo = new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    capGeo.scale(1, 0.62, 1);
    capGeo.translate(0, 0.25, 0);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.85 });
    const capMat = new THREE.MeshStandardMaterial({ roughness: 0.5, emissive: 0x7733aa, emissiveIntensity: 0.5 });
    const stems = new THREE.InstancedMesh(stemGeo, stemMat, count);
    const capsI = new THREE.InstancedMesh(capGeo, capMat, count);
    capsI.userData.colored = true;
    const centers = [];
    for (let c = 0; c < 130; c++) centers.push(randomGroundSpot(8, WORLD_RADIUS));
    scatterInstanced([stems, capsI], count, (i) => {
      const c = centers[i % centers.length];
      const x = c.x + (rng() - 0.5) * 2.2, z = c.z + (rng() - 0.5) * 2.2;
      return {
        x, y: terrainHeight(x, z) - 0.02, z,
        ry: rng() * Math.PI, rx: (rng() - 0.5) * 0.35, rz: (rng() - 0.5) * 0.35,
        s: 0.5 + rng() * 1.4, color: hsl(rng(), 0.9, 0.55)
      };
    });
    scene.add(stems); scene.add(capsI);
  }

  // 5) glowing crystal clusters — 160
  const crystalMats = [];
  {
    const geo = new THREE.OctahedronGeometry(0.5, 0);
    geo.translate(0, 0.5, 0);
    const count = 160;
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.8,
      emissive: 0x66ddff, emissiveIntensity: 0.8
    });
    crystalMats.push(mat);
    const inst = new THREE.InstancedMesh(geo, mat, count);
    inst.userData.colored = true;
    const centers = [];
    for (let c = 0; c < 45; c++) centers.push(randomGroundSpot(10, WORLD_RADIUS));
    scatterInstanced([inst], count, (i) => {
      const c = centers[i % centers.length];
      const x = c.x + (rng() - 0.5) * 3, z = c.z + (rng() - 0.5) * 3;
      return {
        x, y: terrainHeight(x, z) - 0.1, z,
        ry: rng() * Math.PI, rx: (rng() - 0.5) * 0.5, rz: (rng() - 0.5) * 0.5,
        s: 0.4 + rng() * 1.6, sy: 1.4 + rng() * 1.8,
        color: [hsl(0.52, 1, 0.6), hsl(0.85, 1, 0.6), hsl(0.12, 1, 0.6)][Math.floor(rng() * 3)]
      };
    });
    scene.add(inst);
  }

  // 6) mossy rocks — 180
  {
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const count = 180;
    const mat = new THREE.MeshStandardMaterial({ color: 0x6b5a80, roughness: 1, flatShading: true, emissive: 0x0d2818, emissiveIntensity: 0.4 });
    const inst = new THREE.InstancedMesh(geo, mat, count);
    inst.castShadow = true;
    scatterInstanced([inst], count, () => {
      const p = randomGroundSpot(9, WORLD_RADIUS);
      const s = 0.3 + rng() * 1.9;
      if (s > 1.2) colliders.push({ x: p.x, z: p.z, r: s * 0.9 });
      return {
        x: p.x, y: p.y - s * 0.35, z: p.z,
        rx: rng() * Math.PI, ry: rng() * Math.PI, rz: rng() * Math.PI,
        s, sy: 0.6 + rng() * 0.5
      };
    });
    scene.add(inst);
  }

  // 7) rune monoliths — 8 ancient glowing stones
  {
    const mat = new THREE.MeshStandardMaterial({
      map: runeTex, color: 0x9a8fb0, roughness: 0.9,
      emissive: 0x8a4dff, emissiveMap: runeTex, emissiveIntensity: 0.9
    });
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + rng() * 0.5;
      const dist = 60 + rng() * 150;
      const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
      const h = 5.5 + rng() * 3.5;
      const mono = new THREE.Mesh(new THREE.BoxGeometry(1.5, h, 0.9), mat);
      mono.position.set(x, terrainHeight(x, z) + h / 2 - 0.5, z);
      mono.rotation.set((rng() - 0.5) * 0.12, rng() * Math.PI, (rng() - 0.5) * 0.12);
      mono.castShadow = true;
      scene.add(mono);
      colliders.push({ x, z, r: 1.6 });
    }
  }

  // 8) psychedelic ponds — 3 glowing pools in terrain dips
  const pondMats = [];
  {
    const candidates = [];
    for (let i = 0; i < 60; i++) {
      const p = randomGroundSpot(30, WORLD_RADIUS - 30);
      candidates.push(p);
    }
    candidates.sort((a, b) => a.y - b.y);
    const chosen = [];
    for (const c of candidates) {
      if (chosen.length >= 3) break;
      if (chosen.every(o => Math.hypot(o.x - c.x, o.z - c.z) > 70)) chosen.push(c);
    }
    chosen.forEach((c, i) => {
      const radius = 9 + rng() * 5;
      let minH = c.y;
      for (let k = 0; k < 16; k++) {
        const a = rng() * Math.PI * 2, r = rng() * radius * 0.7;
        minH = Math.min(minH, terrainHeight(c.x + Math.cos(a) * r, c.z + Math.sin(a) * r));
      }
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uTime: uTimeShared, uShift: { value: i * 2.1 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: [
          'varying vec2 vUv; uniform float uTime; uniform float uShift;',
          'void main(){',
          '  vec2 p = (vUv - 0.5) * 2.0;',
          '  float r = length(p);',
          '  float t = uTime * 0.7 + uShift;',
          '  float n = sin(p.x * 7.0 + t) + sin(p.y * 6.0 - t * 1.3) + sin((p.x + p.y) * 5.0 + t * 0.7) + sin(r * 9.0 - t * 1.8);',
          '  float caustic = pow(abs(sin(n * 1.7)), 3.0);',
          '  vec3 deep = vec3(0.06, 0.02, 0.16);',
          '  vec3 glow = 0.5 + 0.5 * cos(n * 0.9 + t * 0.4 + vec3(0.0, 2.1, 4.2));',
          '  vec3 col = deep + glow * caustic * 0.85 + glow * 0.10;',
          '  float rip = smoothstep(0.4, 1.0, sin(r * 24.0 - uTime * 2.2) * 0.5 + 0.5) * (1.0 - r) * 0.25;',
          '  col += vec3(rip);',
          '  float alpha = smoothstep(1.0, 0.82, r) * 0.88;',
          '  gl_FragColor = vec4(col, alpha);',
          '}'
        ].join('\n')
      });
      pondMats.push(mat);
      const pond = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), mat);
      pond.rotation.x = -Math.PI / 2;
      pond.position.set(c.x, minH + 0.5, c.z);
      scene.add(pond);
    });
  }

  // ---------- big landmarks: alien trees, floating islands, arches, vines, spires ----------
  const islands = [];
  {
    // twisted glow-canopy trees
    const barkMat = new THREE.MeshStandardMaterial({ map: stemTex, color: 0x7a5a78, roughness: 0.95 });
    const blobCols = [0x1d5c66, 0x3a1f5c, 0x5c1f4e, 0x24506b];
    const fruitSpots = [];
    for (let i = 0; i < 28; i++) {
      const spot = randomGroundSpot(24, WORLD_RADIUS - 4);
      const x = spot.x, z = spot.z;
      const H = 13 + rng() * 13;
      const R = 0.45 + rng() * 0.5;
      const bendA = (rng() - 0.5) * 1.0, bendB = (rng() - 0.5) * 1.0;
      const g = new THREE.Group();
      const trunkGeo = new THREE.CylinderGeometry(R * 0.45, R * 1.5, H, 12, 16);
      {
        const p = trunkGeo.attributes.position;
        for (let k = 0; k < p.count; k++) {
          const yy = (p.getY(k) + H / 2) / H;
          p.setX(k, p.getX(k) + bendA * H * 0.14 * yy * yy);
          p.setZ(k, p.getZ(k) + bendB * H * 0.10 * Math.sin(yy * Math.PI));
        }
        trunkGeo.computeVertexNormals();
      }
      const trunk = new THREE.Mesh(trunkGeo, barkMat);
      trunk.position.y = H / 2;
      trunk.castShadow = true;
      g.add(trunk);
      for (let br = 0; br < 2; br++) {
        const bl = H * (0.3 + rng() * 0.15);
        const branch = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.22, R * 0.45, bl, 8), barkMat);
        const ba = rng() * Math.PI * 2;
        const by = H * (0.55 + rng() * 0.25);
        branch.position.set(Math.cos(ba) * bl * 0.32, by, Math.sin(ba) * bl * 0.32);
        branch.rotation.z = Math.cos(ba) * 1.0;
        branch.rotation.x = -Math.sin(ba) * 1.0;
        branch.castShadow = true;
        g.add(branch);
      }
      const topX = bendA * H * 0.14;
      const nBlobs = 4 + Math.floor(rng() * 3);
      for (let b = 0; b < nBlobs; b++) {
        const col = blobCols[Math.floor(rng() * blobCols.length)];
        const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1),
          new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, flatShading: true, emissive: col, emissiveIntensity: 0.25 }));
        blob.position.set(topX + (rng() - 0.5) * 4.4, H * 0.95 + (rng() - 0.3) * 2.2, (rng() - 0.5) * 4.4);
        blob.scale.set(1.6 + rng() * 2.0, (1.6 + rng() * 2.0) * 0.65, 1.6 + rng() * 2.0);
        blob.castShadow = true;
        g.add(blob);
        for (let f = 0; f < 2; f++) {
          fruitSpots.push({
            x: x + blob.position.x + (rng() - 0.5) * 3.4,
            y: spot.y - 0.25 + blob.position.y - 1.2 - rng() * 1.6,
            z: z + blob.position.z + (rng() - 0.5) * 3.4,
            hue: rng()
          });
        }
      }
      g.position.set(x, spot.y - 0.25, z);
      scene.add(g);
      colliders.push({ x, z, r: R * 1.5 + 0.45 });
    }
    // glowing fruit hanging in the canopies — one instanced draw call
    if (fruitSpots.length) {
      const inst = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.14, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
        fruitSpots.length
      );
      inst.userData.colored = true;
      scatterInstanced([inst], fruitSpots.length, (i) => {
        const f = fruitSpots[i];
        return { x: f.x, y: f.y, z: f.z, s: 0.8 + rng() * 1.2, color: hsl(f.hue, 1, 0.62) };
      });
      scene.add(inst);
    }

    // floating islands with turf, roots, crystals, and light beams
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x5c4a72, roughness: 1, flatShading: true });
    const turfMat = new THREE.MeshStandardMaterial({ color: 0x2f8f5f, roughness: 0.9, emissive: 0x0f4d2a, emissiveIntensity: 0.5 });
    for (let i = 0; i < 10; i++) {
      const grp = new THREE.Group();
      const s = 4.5 + rng() * 6;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), rockMat);
      rock.scale.set(s, s * 0.6, s * (0.8 + rng() * 0.4));
      rock.rotation.set(rng() * 0.6, rng() * Math.PI, rng() * 0.6);
      rock.castShadow = true;
      grp.add(rock);
      const turf = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), turfMat);
      turf.scale.set(s * 0.95, s * 0.22, s * 0.9);
      turf.position.y = s * 0.42;
      grp.add(turf);
      for (let r2 = 0; r2 < 4; r2++) {
        const root = new THREE.Mesh(new THREE.ConeGeometry(s * 0.10, s * (0.7 + rng() * 0.7), 6), rockMat);
        root.rotation.x = Math.PI;
        root.position.set((rng() - 0.5) * s * 0.9, -s * (0.5 + rng() * 0.3), (rng() - 0.5) * s * 0.9);
        grp.add(root);
      }
      for (let cN = 0; cN < 3; cN++) {
        const chh = 0.5 + rng() * 0.4;
        const crys = new THREE.Mesh(new THREE.OctahedronGeometry(chh, 0),
          new THREE.MeshStandardMaterial({
            color: hsl(0.5 + rng() * 0.4, 1, 0.6), emissive: hsl(0.5 + rng() * 0.4, 1, 0.5),
            emissiveIntensity: 1.4, transparent: true, opacity: 0.85
          }));
        crys.position.set((rng() - 0.5) * s * 0.8, s * 0.5 + chh, (rng() - 0.5) * s * 0.7);
        crys.scale.y = 1.8;
        grp.add(crys);
      }
      if (i % 3 === 0) {
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(s * 0.5, s * 0.8, 34, 16, 1, true),
          new THREE.MeshBasicMaterial({ color: 0x55ffd0, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
        );
        beam.position.y = -17 - s * 0.4;
        grp.add(beam);
      }
      const ang = rng() * Math.PI * 2, dist = 45 + rng() * 150;
      const h = 24 + rng() * 22;
      grp.position.set(Math.cos(ang) * dist, h, Math.sin(ang) * dist);
      scene.add(grp);
      islands.push({ grp, baseY: h, phase: rng() * Math.PI * 2, rotSpeed: (rng() - 0.5) * 0.05 });
    }

    // rune-carved stone arches
    const archMat = new THREE.MeshStandardMaterial({
      map: runeTex, color: 0x8b7fa8, roughness: 0.9,
      emissive: 0x6a3bd6, emissiveMap: runeTex, emissiveIntensity: 0.7
    });
    for (let i = 0; i < 6; i++) {
      const Rr = 7 + rng() * 7;
      const tube = 0.7 + rng() * 0.7;
      const arch = new THREE.Mesh(new THREE.TorusGeometry(Rr, tube, 12, 40, Math.PI), archMat);
      const ang = rng() * Math.PI * 2, dist = 40 + rng() * 160;
      const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
      const ry = rng() * Math.PI;
      arch.position.set(x, terrainHeight(x, z) + 0.2, z);
      arch.rotation.y = ry;
      arch.castShadow = true;
      scene.add(arch);
      const ax = Math.cos(ry), az = -Math.sin(ry);
      colliders.push({ x: x + ax * Rr, z: z + az * Rr, r: tube * 2.0 });
      colliders.push({ x: x - ax * Rr, z: z - az * Rr, r: tube * 2.0 });
    }

    // giant glowing vine arcs leaping out of the ground
    const arcGeo = new THREE.TorusGeometry(1, 0.055, 8, 30, Math.PI * 0.95);
    for (const [colA, emisA] of [[0x7dffd8, 0x2fbf8f], [0xff8ae0, 0xc23fa0]]) {
      const matA = new THREE.MeshStandardMaterial({ color: colA, roughness: 0.5, emissive: emisA, emissiveIntensity: 0.9 });
      const count = 24;
      const instA = new THREE.InstancedMesh(arcGeo, matA, count);
      scatterInstanced([instA], count, () => {
        const p = randomGroundSpot(12, WORLD_RADIUS - 5);
        return { x: p.x, y: p.y - 0.1, z: p.z, ry: rng() * Math.PI, rz: (rng() - 0.5) * 0.2, s: 2.5 + rng() * 6, sy: 0.7 + rng() * 0.9 };
      });
      scene.add(instA);
    }

    // towering crystal spires
    {
      const geo = new THREE.OctahedronGeometry(1, 0);
      geo.translate(0, 0.85, 0);
      const mat = new THREE.MeshStandardMaterial({
        roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.85,
        emissive: 0x9a66ff, emissiveIntensity: 0.7
      });
      crystalMats.push(mat);
      const count = 40;
      const inst = new THREE.InstancedMesh(geo, mat, count);
      inst.userData.colored = true;
      inst.castShadow = true;
      scatterInstanced([inst], count, () => {
        const p = randomGroundSpot(16, WORLD_RADIUS - 6);
        const s = 1.2 + rng() * 1.4;
        if (s > 1.8) colliders.push({ x: p.x, z: p.z, r: s * 0.8 });
        return {
          x: p.x, y: p.y - 0.4, z: p.z,
          ry: rng() * Math.PI, rx: (rng() - 0.5) * 0.18, rz: (rng() - 0.5) * 0.18,
          s, sy: 1.8 + rng() * 2.4,
          color: [hsl(0.52, 1, 0.62), hsl(0.85, 1, 0.62), hsl(0.68, 1, 0.62)][Math.floor(rng() * 3)]
        };
      });
      scene.add(inst);
    }

    // tall reeds filling the low wetlands
    {
      const positions = [];
      let attempts = 0;
      while (positions.length < 900 && attempts < 8000) {
        attempts++;
        const p = randomGroundSpot(10, WORLD_RADIUS);
        if (p.y < -2.2) positions.push(p);
      }
      if (positions.length) {
        const geo = new THREE.ConeGeometry(0.05, 2.4, 4, 4, true);
        geo.translate(0, 1.2, 0);
        const mat = windMaterial(new THREE.MeshStandardMaterial({ roughness: 0.8, emissive: 0x123a4d, emissiveIntensity: 0.5 }), 0.2);
        const inst = new THREE.InstancedMesh(geo, mat, positions.length);
        inst.userData.colored = true;
        scatterInstanced([inst], positions.length, (i) => {
          const p = positions[i];
          return {
            x: p.x + (rng() - 0.5), y: p.y - 0.1, z: p.z + (rng() - 0.5),
            ry: rng() * Math.PI, rx: (rng() - 0.5) * 0.2, rz: (rng() - 0.5) * 0.2,
            s: 0.7 + rng() * 1.1, color: hsl(0.45 + rng() * 0.35, 0.8, 0.45)
          };
        });
        scene.add(inst);
      }
    }
  }

  // ---------- drifting spore particles ----------
  function makeParticles(n, area, yMin, yMax, size, hueFn, driftMin, driftMax) {
    const pos = new Float32Array(n * 3);
    const cols = new Float32Array(n * 3);
    const drift = new Float32Array(n);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rng() - 0.5) * area;
      pos[i * 3 + 1] = yMin + rng() * (yMax - yMin);
      pos[i * 3 + 2] = (rng() - 0.5) * area;
      c.copy(hueFn());
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
      drift[i] = driftMin + rng() * (driftMax - driftMin);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const mat = new THREE.PointsMaterial({
      map: softTex, size, sizeAttenuation: true, vertexColors: true,
      transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    return { points, geo, drift, n, yMin, yMax };
  }
  const spores = makeParticles(2200, 460, 1, 55, 0.9, () => hsl(0.72 + rng() * 0.2, 0.8, 0.75), 0.25, 0.9);
  const motes = makeParticles(1000, 320, 0.2, 7, 0.38, () => hsl(0.12 + rng() * 0.25, 0.9, 0.7), 0.06, 0.25);

  // ---------- wandering wisps ----------
  const wisps = [];
  for (let i = 0; i < 6; i++) {
    const color = hsl(i / 6, 1, 0.6);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshBasicMaterial({ color }));
    const light = new THREE.PointLight(color, 1.8, 40, 2);
    mesh.add(light);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softTex, color, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    sprite.scale.setScalar(5);
    mesh.add(sprite);
    scene.add(mesh);
    wisps.push({ mesh, phase: i * 1.7, radius: 22 + i * 24, speed: 0.10 + rng() * 0.1, height: 3 + rng() * 6 });
  }

  // ---------- sky jellyfish ----------
  const jellies = [];
  for (let i = 0; i < 12; i++) {
    const hue = rng();
    const grp = new THREE.Group();
    const bellMat = new THREE.MeshStandardMaterial({
      color: hsl(hue, 0.9, 0.6), emissive: hsl(hue, 0.95, 0.5), emissiveIntensity: 0.9,
      transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false
    });
    const bell = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.58), bellMat);
    grp.add(bell);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softTex, color: hsl(hue, 1, 0.65), transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    glow.scale.setScalar(3.2);
    grp.add(glow);
    const tentacles = [];
    const tentMat = new THREE.MeshStandardMaterial({
      color: hsl(hue, 0.8, 0.55), emissive: hsl(hue, 0.9, 0.4), emissiveIntensity: 0.7,
      transparent: true, opacity: 0.6
    });
    const nT = 7;
    for (let k = 0; k < nT; k++) {
      const a = (k / nT) * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(a) * 0.6, -0.05, Math.sin(a) * 0.6);
      const len = 2.2 + rng() * 1.4;
      const tent = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.005, len, 5, 6), tentMat);
      tent.position.y = -len / 2;
      pivot.add(tent);
      grp.add(pivot);
      tentacles.push(pivot);
    }
    const s = 1.4 + rng() * 1.8;
    grp.scale.setScalar(s);
    scene.add(grp);
    jellies.push({
      grp, bell, tentacles, phase: rng() * Math.PI * 2,
      radius: 45 + rng() * 130, height: 17 + rng() * 26, speed: 0.018 + rng() * 0.03
    });
  }

  // ---------- butterflies ----------
  const butterflies = [];
  {
    const wingGeo = new THREE.PlaneGeometry(0.42, 0.34);
    wingGeo.translate(0.21, 0, 0);
    wingGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 36; i++) {
      const grp = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({
        map: wingTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide,
        color: hsl(rng(), 0.9, 0.75)
      });
      const wingR = new THREE.Mesh(wingGeo, mat);
      const wingL = new THREE.Mesh(wingGeo, mat);
      wingL.scale.x = -1;
      grp.add(wingR); grp.add(wingL);
      const p = randomGroundSpot(10, WORLD_RADIUS - 10);
      scene.add(grp);
      butterflies.push({
        grp, wingR, wingL, ax: p.x, az: p.z,
        phase: rng() * Math.PI * 2, flap: 10 + rng() * 6,
        px: p.x, pz: p.z
      });
    }
  }

  // ---------- collectible spores ----------
  const orbs = [];
  const ORB_TOTAL = 30;
  {
    const coreGeo = new THREE.IcosahedronGeometry(0.32, 2);
    const shellGeo = new THREE.SphereGeometry(0.55, 24, 16);
    for (let i = 0; i < ORB_TOTAL; i++) {
      const p = randomGroundSpot(10, WORLD_RADIUS - 15);
      const hue = rng();
      const grp = new THREE.Group();
      const core = new THREE.Mesh(coreGeo, new THREE.MeshStandardMaterial({
        color: hsl(hue, 1, 0.7), emissive: hsl(hue, 1, 0.55), emissiveIntensity: 2.2, roughness: 0.3
      }));
      grp.add(core);
      const shell = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({
        color: hsl(hue, 1, 0.6), transparent: true, opacity: 0.28,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      grp.add(shell);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: softTex, color: hsl(hue, 1, 0.65), transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      glow.scale.setScalar(3);
      grp.add(glow);
      grp.position.set(p.x, p.y + 1.4, p.z);
      scene.add(grp);
      orbs.push({ grp, core, baseY: grp.position.y, phase: rng() * Math.PI * 2, taken: false });
    }
  }
  document.getElementById('sporeTotal').textContent = ORB_TOTAL;
  let collected = 0;

  function collectOrb(i, fromNet) {
    const o = orbs[i];
    if (!o || o.taken) return;
    o.taken = true;
    o.grp.visible = false;
    collected++;
    document.getElementById('sporeCount').textContent = collected;
    groundPulse.value.set(o.grp.position.x, o.grp.position.z, clock.elapsedTime);
    chime();
    if (collected === ORB_TOTAL) {
      const msg = document.getElementById('message');
      msg.textContent = '✨ YOU ARE ONE WITH THE MYCELIUM ✨';
      msg.style.opacity = '1';
      setTimeout(() => { msg.style.opacity = '0'; }, 7000);
    }
    if (!fromNet && net) net.sendOrb(i);
  }

  // ---------- the explorer ----------
  const player = new THREE.Group();
  scene.add(player);
  player.position.set(0, terrainHeight(0, 0), 4);

  const figure = new THREE.Group();
  const joints = {};
  {
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a679, roughness: 0.75 });
    const suit = new THREE.MeshStandardMaterial({ color: 0xff4f9a, roughness: 0.55, emissive: 0x2a0014, emissiveIntensity: 0.4 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x3a2c8f, roughness: 0.7 });

    function capsule(mat, r, len) {
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 20), mat);
      mesh.castShadow = true;
      return mesh;
    }
    function twoBoneLimb(name, mat, x, y, upperLen, lowerLen, r, endMat, endIsFoot) {
      const upper = new THREE.Group(); upper.position.set(x, y, 0);
      const um = capsule(mat, r, upperLen); um.position.y = -(upperLen / 2 + r); upper.add(um);
      const lower = new THREE.Group(); lower.position.y = -(upperLen + r * 1.6);
      const lm = capsule(mat, r * 0.82, lowerLen); lm.position.y = -(lowerLen / 2 + r * 0.82); lower.add(lm);
      if (endIsFoot) {
        const foot = new THREE.Mesh(new THREE.BoxGeometry(r * 2.1, r * 1.1, r * 3.4), endMat);
        foot.position.set(0, -(lowerLen + r * 1.6), r * 0.8);
        foot.castShadow = true;
        lower.add(foot);
      } else {
        const hand = new THREE.Mesh(new THREE.SphereGeometry(r * 1.05, 12, 9), endMat);
        hand.position.y = -(lowerLen + r * 1.4);
        hand.castShadow = true;
        lower.add(hand);
      }
      upper.add(lower);
      figure.add(upper);
      joints[name] = { upper, lower };
    }

    const pelvis = capsule(pants, 0.21, 0.16); pelvis.position.y = 0.98; figure.add(pelvis);
    const torso = capsule(suit, 0.26, 0.42); torso.position.y = 1.32; figure.add(torso);
    const neck = capsule(skin, 0.07, 0.06); neck.position.y = 1.62; figure.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 18), skin);
    head.position.y = 1.78; head.castShadow = true; figure.add(head);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a2e });
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), eyeMat);
      eye.position.set(sx * 0.06, 1.80, 0.14);
      figure.add(eye);
    }
    twoBoneLimb('armL', suit, -0.34, 1.50, 0.26, 0.26, 0.065, skin, false);
    twoBoneLimb('armR', suit, 0.34, 1.50, 0.26, 0.26, 0.065, skin, false);
    twoBoneLimb('legL', pants, -0.13, 0.90, 0.36, 0.36, 0.085, pants, true);
    twoBoneLimb('legR', pants, 0.13, 0.90, 0.36, 0.36, 0.085, pants, true);
  }
  player.add(figure);

  let mixer = null, usingModel = false, currentAnim = 'Idle';
  let soldierProto = null, soldierClips = null;
  const anims = {};
  if (THREE.GLTFLoader) {
    new THREE.GLTFLoader().load(
      'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r147/examples/models/gltf/Soldier.glb',
      (gltf) => {
        const model = gltf.scene;
        model.rotation.y = Math.PI;
        model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
        mixer = new THREE.AnimationMixer(model);
        for (const name of ['Idle', 'Walk', 'Run']) {
          const clip = THREE.AnimationClip.findByName(gltf.animations, name);
          if (clip) anims[name] = mixer.clipAction(clip);
        }
        if (anims.Idle && anims.Walk && anims.Run) {
          player.remove(figure);
          player.add(model);
          anims.Idle.play();
          usingModel = true;
          soldierProto = model;
          soldierClips = gltf.animations;
        }
      },
      undefined,
      () => { /* offline — procedural figure stays */ }
    );
  }

  // ---------- input ----------
  const keys = {};
  addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'Space') e.preventDefault(); });
  addEventListener('keyup', e => { keys[e.code] = false; });

  let yaw = Math.PI, pitch = 0.32;
  canvas.addEventListener('click', () => {
    if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
  });
  addEventListener('mousemove', e => {
    if (document.pointerLockElement === canvas) {
      yaw -= e.movementX * 0.0026;
      pitch = Math.max(-0.15, Math.min(1.25, pitch + e.movementY * 0.0022));
    }
  });

  // ---------- tiny synth for pickup chimes ----------
  let audioCtx = null;
  const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
  function chime() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const t = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = SCALE[Math.floor(Math.random() * SCALE.length)];
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t); osc.stop(t + 0.65);
    } catch (err) { /* audio blocked — stay silent */ }
  }

  // ---------- post-processing: bloom + trip pass ----------
  let composer = null, tripUniforms = null;
  if (THREE.EffectComposer && THREE.RenderPass && THREE.ShaderPass && THREE.UnrealBloomPass) {
    composer = new THREE.EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    composer.addPass(new THREE.RenderPass(scene, camera));
    composer.addPass(new THREE.UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight), 0.95, 0.6, 0.55
    ));
    const TripShader = {
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;',
        'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
        'void main(){',
        '  vec2 uv = vUv;',
        '  uv += vec2(sin(uv.y * 14.0 + uTime * 0.8), cos(uv.x * 12.0 - uTime * 0.7)) * 0.0012;',
        '  vec2 c = uv - 0.5;',
        '  float r2 = dot(c, c);',
        '  vec2 off = c * (0.002 + 0.010 * r2);',
        '  float rr = texture2D(tDiffuse, uv + off).r;',
        '  vec4 base = texture2D(tDiffuse, uv);',
        '  float bb = texture2D(tDiffuse, uv - off).b;',
        '  vec3 col = vec3(rr, base.g, bb);',
        '  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));',
        '  col = mix(vec3(l), col, 1.18);',
        '  col *= smoothstep(0.92, 0.35, length(c)) * 0.25 + 0.78;',
        '  col += (hash(uv * vec2(1920.0, 1080.0) + fract(uTime) * 13.7) - 0.5) * 0.03;',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    };
    const tripPass = new THREE.ShaderPass(TripShader);
    tripUniforms = tripPass.uniforms;
    composer.addPass(tripPass);
  }

  // ---------- multiplayer (WebRTC via PeerJS — host relays to everyone) ----------
  let net = null;
  let netAnim = 'Idle';
  const remotes = new Map();

  function makeLabel(text, hue) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = 'rgba(12, 4, 28, 0.7)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(6, 8, 244, 48, 14); else ctx.rect(6, 8, 244, 48);
    ctx.fill();
    ctx.strokeStyle = 'hsl(' + Math.round(hue * 360) + ', 90%, 65%)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.font = 'bold 28px "Avenir Next", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text.slice(0, 16), 128, 42);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    sp.scale.set(2.6, 0.65, 1);
    sp.position.y = 2.35;
    return sp;
  }

  function createRemoteAvatar(name, hue) {
    const grp = new THREE.Group();
    let avMixer = null;
    const acts = {};
    if (soldierProto && THREE.SkeletonUtils) {
      const model = THREE.SkeletonUtils.clone(soldierProto);
      model.rotation.y = Math.PI;
      model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
      avMixer = new THREE.AnimationMixer(model);
      for (const nm of ['Idle', 'Walk', 'Run']) {
        const clip = THREE.AnimationClip.findByName(soldierClips, nm);
        if (clip) acts[nm] = avMixer.clipAction(clip);
      }
      if (acts.Idle) acts.Idle.play();
      grp.add(model);
    } else {
      const mat = new THREE.MeshStandardMaterial({
        color: hsl(hue, 0.8, 0.55), emissive: hsl(hue, 0.9, 0.3), emissiveIntensity: 0.6, roughness: 0.6
      });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.9, 8, 16), mat);
      body.position.y = 1.0; body.castShadow = true; grp.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), mat);
      head.position.y = 1.75; head.castShadow = true; grp.add(head);
    }
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.05, 8, 32),
      new THREE.MeshBasicMaterial({ color: hsl(hue, 1, 0.6) })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    grp.add(ring);
    grp.add(makeLabel(name, hue));
    grp.position.set(0, terrainHeight(0, 0), 4);
    scene.add(grp);
    return {
      grp, mixer: avMixer, acts, cur: 'Idle',
      target: grp.position.clone(), targetH: 0,
      setAnim(a) {
        if (this.mixer && this.acts[a] && a !== this.cur) {
          this.acts[a].reset().fadeIn(0.2).play();
          if (this.acts[this.cur]) this.acts[this.cur].fadeOut(0.2);
          this.cur = a;
        }
      }
    };
  }

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => el.remove(), 5200);
  }

  (function initNet() {
    if (typeof Peer === 'undefined') return; // peerjs missing — single player still works
    const params = new URLSearchParams(location.search);
    const joined = (params.get('room') || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    const isHost = !joined;
    const code = isHost ? Math.random().toString(36).slice(2, 8) : joined;
    const NAMES_A = ['Trippy', 'Glowy', 'Cosmic', 'Mellow', 'Fuzzy', 'Neon', 'Dreamy', 'Sporey'];
    const NAMES_B = ['Toad', 'Shroom', 'Wisp', 'Jelly', 'Moth', 'Fern', 'Spore', 'Crystal'];
    const myName = (params.get('name') ||
      (NAMES_A[Math.floor(Math.random() * NAMES_A.length)] + ' ' + NAMES_B[Math.floor(Math.random() * NAMES_B.length)])).slice(0, 16);
    const myHue = Math.random();
    const meta = new Map();   // id -> {name, hue}
    const conns = new Map();  // id -> DataConnection
    let hostConn = null;

    function updateRoster() {
      const el = document.getElementById('players');
      el.textContent = '';
      const mkRow = (txt) => {
        const d = document.createElement('div');
        d.textContent = txt;
        el.appendChild(d);
      };
      mkRow('🍄 ' + myName + ' (you)');
      for (const m of meta.values()) mkRow('🍄 ' + m.name);
    }
    updateRoster();

    const inviteEl = document.getElementById('invite');
    inviteEl.addEventListener('click', () => {
      const url = location.origin + location.pathname + '?room=' + code;
      const done = () => {
        inviteEl.textContent = '✅ link copied — send it!';
        setTimeout(() => { inviteEl.textContent = '🔗 invite a friend'; }, 2500);
      };
      if (navigator.clipboard && location.protocol !== 'file:') {
        navigator.clipboard.writeText(url).then(done).catch(() => window.prompt('copy this link:', url));
      } else {
        window.prompt('copy this link:', url);
      }
    });

    function addPlayer(id, name, hue) {
      if (remotes.has(id)) return;
      name = String(name || 'Explorer').slice(0, 16);
      hue = +hue || 0;
      meta.set(id, { name, hue });
      remotes.set(id, createRemoteAvatar(name, hue));
      toast(name + ' joined 🌈');
      updateRoster();
    }
    function removePlayer(id) {
      const av = remotes.get(id);
      if (av) { scene.remove(av.grp); remotes.delete(id); }
      const m = meta.get(id);
      meta.delete(id);
      if (m) toast(m.name + ' left');
      updateRoster();
    }
    function broadcast(except, msg) {
      for (const [id, c] of conns) if (id !== except && c.open) c.send(msg);
    }
    function handleMsg(fromId, msg, viaConn) {
      if (!msg || typeof msg !== 'object') return;
      switch (msg.t) {
        case 'hello':
          addPlayer(fromId, msg.name, msg.hue);
          viaConn.send({
            t: 'welcome',
            players: [{ id: 'H', name: myName, hue: myHue }].concat(
              [...meta].filter(([id]) => id !== fromId).map(([id, m]) => ({ id, name: m.name, hue: m.hue }))
            ),
            orbs: orbs.map(o => o.taken)
          });
          broadcast(fromId, { t: 'join', id: fromId, name: msg.name, hue: msg.hue });
          break;
        case 'welcome':
          for (const p of msg.players || []) addPlayer(p.id, p.name, p.hue);
          (msg.orbs || []).forEach((tk, i) => { if (tk) collectOrb(i, true); });
          toast('connected — explore together ✨');
          break;
        case 'join': addPlayer(msg.id, msg.name, msg.hue); break;
        case 'leave': removePlayer(msg.id); break;
        case 'p': {
          if (isHost) broadcast(fromId, { t: 'p', id: fromId, x: msg.x, y: msg.y, z: msg.z, h: msg.h, a: msg.a });
          const id = isHost ? fromId : (msg.id || 'H');
          const av = remotes.get(id);
          if (av) {
            av.target.set(+msg.x || 0, +msg.y || 0, +msg.z || 0);
            av.targetH = +msg.h || 0;
            av.setAnim(msg.a === 'Run' ? 'Run' : msg.a === 'Walk' ? 'Walk' : 'Idle');
          }
          break;
        }
        case 'orb': {
          const i = msg.i | 0;
          if (isHost) broadcast(fromId, { t: 'orb', i });
          collectOrb(i, true);
          break;
        }
      }
    }

    const peer = new Peer(isHost ? 'sporelands-' + code : undefined, { debug: 0 });
    peer.on('open', () => {
      if (isHost) {
        toast('world open — click invite to bring a friend');
      } else {
        const conn = peer.connect('sporelands-' + code);
        hostConn = conn;
        conn.on('open', () => conn.send({ t: 'hello', name: myName, hue: myHue }));
        conn.on('data', m => handleMsg('H', m, conn));
        conn.on('close', () => {
          toast('host disconnected 😢');
          for (const id of [...remotes.keys()]) removePlayer(id);
        });
      }
    });
    if (isHost) {
      peer.on('connection', (conn) => {
        conn.on('open', () => conns.set(conn.peer, conn));
        conn.on('data', m => handleMsg(conn.peer, m, conn));
        conn.on('close', () => {
          if (conns.has(conn.peer)) {
            conns.delete(conn.peer);
            removePlayer(conn.peer);
            broadcast(null, { t: 'leave', id: conn.peer });
          }
        });
      });
    }
    peer.on('error', (err) => {
      if (err.type === 'peer-unavailable') toast("couldn't find that world — is your friend online?");
      else if (err.type === 'unavailable-id') toast('room clash — reload for a fresh room');
      else if (err.type !== 'disconnected') toast('network hiccup: ' + err.type);
    });

    setInterval(() => {
      const msg = {
        t: 'p',
        x: +player.position.x.toFixed(2),
        y: +player.position.y.toFixed(2),
        z: +player.position.z.toFixed(2),
        h: +heading.toFixed(3),
        a: netAnim
      };
      if (isHost) broadcast(null, Object.assign({ id: 'H' }, msg));
      else if (hostConn && hostConn.open) hostConn.send(msg);
    }, 80);

    net = {
      sendOrb(i) {
        if (isHost) broadcast(null, { t: 'orb', i });
        else if (hostConn && hostConn.open) hostConn.send({ t: 'orb', i });
      }
    };
  })();

  // ---------- game state ----------
  const vel = new THREE.Vector3();
  let onGround = true;
  let walkCycle = 0;
  let heading = 0;
  let fovBase = 70;
  const GRAVITY = -32, JUMP = 12.5, WALK = 8, SPRINT = 14;
  const MOON_OFFSET = new THREE.Vector3(55, 110, -35);
  const camTarget = new THREE.Vector3();

  const hintEl = document.getElementById('hint');
  setTimeout(() => { hintEl.style.opacity = '0'; }, 14000);

  const clock = new THREE.Clock();
  const fogColor = new THREE.Color();
  const hemiSky = new THREE.Color(), hemiGround = new THREE.Color();

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    uTimeShared.value = t;
    if (tripUniforms) tripUniforms.uTime.value = t;

    // --- movement (camera-relative) ---
    let ix = 0, iz = 0;
    if (keys.KeyW || keys.ArrowUp) iz -= 1;
    if (keys.KeyS || keys.ArrowDown) iz += 1;
    if (keys.KeyA || keys.ArrowLeft) ix -= 1;
    if (keys.KeyD || keys.ArrowRight) ix += 1;
    const moving = ix !== 0 || iz !== 0;
    const sprinting = !!(keys.ShiftLeft || keys.ShiftRight);
    const speed = sprinting ? SPRINT : WALK;

    if (moving) {
      const len = Math.hypot(ix, iz);
      const sin = Math.sin(yaw), cos = Math.cos(yaw);
      const dx = (ix * cos - iz * sin) / len;
      const dz = (-ix * sin - iz * cos) / len;
      player.position.x += dx * speed * dt;
      player.position.z += dz * speed * dt;
      const target = Math.atan2(dx, dz);
      let diff = target - heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      heading += diff * Math.min(1, dt * 12);
      player.rotation.y = heading;
    }

    const rad = Math.hypot(player.position.x, player.position.z);
    if (rad > WORLD_RADIUS) {
      player.position.x *= WORLD_RADIUS / rad;
      player.position.z *= WORLD_RADIUS / rad;
    }

    for (const c of colliders) {
      const dx = player.position.x - c.x, dz = player.position.z - c.z;
      const d = Math.hypot(dx, dz);
      if (d < c.r && d > 0.0001) {
        player.position.x = c.x + (dx / d) * c.r;
        player.position.z = c.z + (dz / d) * c.r;
      }
    }

    const groundY = terrainHeight(player.position.x, player.position.z);
    if (onGround && keys.Space) { vel.y = JUMP; onGround = false; }
    vel.y += GRAVITY * dt;
    player.position.y += vel.y * dt;
    if (player.position.y <= groundY) { player.position.y = groundY; vel.y = 0; onGround = true; }

    // --- character animation ---
    if (usingModel) {
      const want = moving ? (sprinting ? 'Run' : 'Walk') : 'Idle';
      if (want !== currentAnim) {
        anims[want].reset().fadeIn(0.22).play();
        anims[currentAnim].fadeOut(0.22);
        currentAnim = want;
      }
      mixer.update(dt);
    } else {
      const animSpeed = moving ? (sprinting ? 13 : 9) : 0;
      walkCycle += animSpeed * dt;
      const amp = moving ? (sprinting ? 0.95 : 0.65) : 0;
      const swing = Math.sin(walkCycle) * amp;
      joints.armL.upper.rotation.x = swing;
      joints.armR.upper.rotation.x = -swing;
      joints.armL.lower.rotation.x = -0.35 - Math.max(0, -swing) * 1.1;
      joints.armR.lower.rotation.x = -0.35 - Math.max(0, swing) * 1.1;
      joints.legL.upper.rotation.x = -swing;
      joints.legR.upper.rotation.x = swing;
      joints.legL.lower.rotation.x = 0.25 + Math.max(0, swing) * 1.2;
      joints.legR.lower.rotation.x = 0.25 + Math.max(0, -swing) * 1.2;
      figure.rotation.x = moving ? 0.12 : 0;
      figure.position.y = moving ? Math.abs(Math.sin(walkCycle)) * 0.06 : 0;
      if (!onGround) {
        joints.armL.upper.rotation.x = -2.3;
        joints.armR.upper.rotation.x = -2.3;
      }
    }

    // --- camera ---
    const camDist = 7;
    const cx = player.position.x + Math.sin(yaw) * Math.cos(pitch) * camDist;
    const cz = player.position.z + Math.cos(yaw) * Math.cos(pitch) * camDist;
    let cy = player.position.y + 1.6 + Math.sin(pitch) * camDist;
    const camGround = terrainHeight(cx, cz) + 0.4;
    if (cy < camGround) cy = camGround;
    camera.position.lerp(camTarget.set(cx, cy, cz), Math.min(1, dt * 10));
    camera.lookAt(player.position.x, player.position.y + 1.5, player.position.z);
    const fovWant = (moving && sprinting) ? 76 : 70;
    fovBase += (fovWant - fovBase) * Math.min(1, dt * 4);
    camera.fov = fovBase + Math.sin(t * 0.5) * 1.2;
    camera.updateProjectionMatrix();

    moon.position.copy(player.position).add(MOON_OFFSET);
    moon.target.position.copy(player.position);
    moon.target.updateMatrixWorld();

    // --- living world ---
    for (const c of caps) {
      c.mat.emissiveIntensity = 0.5 + 0.4 * Math.sin(t * 1.4 + c.phase);
      const s = 1 + 0.04 * Math.sin(t * 0.9 + c.phase);
      c.grp.scale.set(s, s * (1 + 0.03 * Math.sin(t * 1.1 + c.phase)), s);
    }
    for (const m of crystalMats) m.emissiveIntensity = 0.6 + 0.5 * Math.sin(t * 1.1);

    for (const layer of [spores, motes]) {
      const p = layer.geo.attributes.position;
      for (let i = 0; i < layer.n; i++) {
        let y = p.getY(i) + layer.drift[i] * dt;
        if (y > layer.yMax) y = layer.yMin;
        p.setY(i, y);
      }
      p.needsUpdate = true;
    }
    spores.points.rotation.y = t * 0.008;
    spores.points.material.opacity = 0.6 + 0.2 * Math.sin(t * 1.3);
    motes.points.rotation.y = -t * 0.005;

    for (const w of wisps) {
      const a = t * w.speed + w.phase;
      const x = Math.cos(a) * w.radius, z = Math.sin(a * 0.7) * w.radius;
      w.mesh.position.set(x, terrainHeight(x, z) + w.height + Math.sin(t * 0.8 + w.phase) * 2, z);
    }

    for (const j of jellies) {
      const a = t * j.speed + j.phase;
      j.grp.position.set(
        Math.cos(a) * j.radius,
        j.height + Math.sin(t * 0.4 + j.phase) * 3 + Math.sin(t * 1.8 + j.phase) * 0.4,
        Math.sin(a * 0.8) * j.radius
      );
      const pulse = Math.sin(t * 1.9 + j.phase);
      j.bell.scale.set(1 + pulse * 0.10, 1 - pulse * 0.14, 1 + pulse * 0.10);
      j.grp.rotation.y = a * 0.5;
      for (let k = 0; k < j.tentacles.length; k++) {
        j.tentacles[k].rotation.x = Math.sin(t * 1.5 + j.phase + k) * 0.16;
        j.tentacles[k].rotation.z = Math.cos(t * 1.3 + j.phase + k * 1.3) * 0.16;
      }
    }

    for (const isl of islands) {
      isl.grp.position.y = isl.baseY + Math.sin(t * 0.25 + isl.phase) * 1.6;
      isl.grp.rotation.y += isl.rotSpeed * dt;
    }

    for (const b of butterflies) {
      const nx = b.ax + Math.sin(t * 0.5 + b.phase) * 3.5;
      const nz = b.az + Math.cos(t * 0.37 + b.phase) * 3.5;
      const ny = terrainHeight(nx, nz) + 1.1 + Math.sin(t * 2.2 + b.phase) * 0.5;
      b.grp.rotation.y = Math.atan2(nx - b.px, nz - b.pz);
      b.grp.position.set(nx, ny, nz);
      b.px = nx; b.pz = nz;
      const flap = 0.15 + Math.abs(Math.sin(t * b.flap + b.phase)) * 1.05;
      b.wingR.rotation.z = flap - 0.6;
      b.wingL.rotation.z = -(flap - 0.6);
    }

    fogColor.setHSL((0.72 + Math.sin(t * 0.03) * 0.10 + 1) % 1, 0.55, 0.09);
    scene.fog.color.copy(fogColor);
    hemiSky.setHSL((0.70 + Math.sin(t * 0.05) * 0.12 + 1) % 1, 0.8, 0.6);
    hemiGround.setHSL((0.95 + Math.cos(t * 0.04) * 0.10 + 1) % 1, 0.8, 0.45);
    hemi.color.copy(hemiSky);
    hemi.groundColor.copy(hemiGround);

    // --- collectibles ---
    for (let oi = 0; oi < orbs.length; oi++) {
      const o = orbs[oi];
      if (o.taken) continue;
      o.grp.position.y = o.baseY + Math.sin(t * 2 + o.phase) * 0.35;
      o.core.rotation.y = t * 1.5 + o.phase;
      o.core.rotation.x = t * 0.9;
      if (o.grp.position.distanceTo(player.position) < 1.9) collectOrb(oi, false);
    }

    // --- remote players ---
    netAnim = moving ? (sprinting ? 'Run' : 'Walk') : 'Idle';
    if (!onGround) netAnim = 'Run';
    for (const av of remotes.values()) {
      av.grp.position.lerp(av.target, Math.min(1, dt * 10));
      let dh = av.targetH - av.grp.rotation.y;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      av.grp.rotation.y += dh * Math.min(1, dt * 10);
      if (av.mixer) av.mixer.update(dt);
    }

    if (composer) composer.render();
    else renderer.render(scene, camera);
  }

  addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
  });

  animate();
})();
