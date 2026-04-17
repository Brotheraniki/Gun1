// 3D Renderer using Three.js
import { getMapGeometry, BOMB_SITES } from './map.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.THREE = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.botMeshes = new Map();
    this.mapMeshes = [];
    this.siteIndicators = {};
    this.skybox = null;
    this.bombIndicatorMesh = null;
    this.geometry = [];
    this.weaponViewModel = null;
    this.weaponBob = { x: 0, y: 0, timer: 0 };
    this.scopeOverlay = null;
    this.ambientLights = [];
  }

  async init() {
    // Dynamically import Three.js
    const module = await import('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js');
    this.THREE = module;
    const THREE = this.THREE;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0e18, 0.022);

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 200);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = false; // disabled for perf
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    // Lighting
    const ambLight = new THREE.AmbientLight(0x1a2030, 1.2);
    this.scene.add(ambLight);

    const sun = new THREE.DirectionalLight(0x4466aa, 0.8);
    sun.position.set(20, 30, -20);
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x2233aa, 0.4);
    fill.position.set(-15, 10, 20);
    this.scene.add(fill);

    // Site accent lights
    const siteA = new THREE.PointLight(0xff5e3a, 2, 18);
    siteA.position.set(-24, 3, 18);
    this.scene.add(siteA);

    const siteB = new THREE.PointLight(0x00b4d8, 2, 18);
    siteB.position.set(24, 3, 18);
    this.scene.add(siteB);

    // Build map
    this._buildMap();
    this._buildSkybox();
    this._buildBombIndicator();
    this._buildWeaponViewModel();
    this._buildSiteIndicators();

    window.addEventListener('resize', () => this._onResize());

    return this.THREE;
  }

  _buildMap() {
    const THREE = this.THREE;
    this.geometry = getMapGeometry();

    for (const g of this.geometry) {
      const geo = new THREE.BoxGeometry(g.w, g.h, g.d);

      let mat;
      if (g.type === 'floor') {
        mat = new THREE.MeshLambertMaterial({ color: g.color });
      } else if (g.type === 'cover') {
        mat = new THREE.MeshLambertMaterial({ color: g.color });
      } else {
        // Wall material with slight variation
        mat = new THREE.MeshLambertMaterial({ color: g.color });
      }

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(g.x, g.y, g.z);
      this.scene.add(mesh);
      this.mapMeshes.push(mesh);
    }

    // Add grid lines on floor for visual interest
    const gridHelper = new THREE.GridHelper(80, 40, 0x1a2030, 0x151a24);
    gridHelper.position.y = 0.15;
    this.scene.add(gridHelper);

    // Site floor decals
    for (const [key, site] of Object.entries(BOMB_SITES)) {
      const decalGeo = new THREE.PlaneGeometry(site.radius * 2, site.radius * 2);
      const decalMat = new THREE.MeshBasicMaterial({
        color: site.color,
        transparent: true, opacity: 0.12,
        depthWrite: false
      });
      const decal = new THREE.Mesh(decalGeo, decalMat);
      decal.rotation.x = -Math.PI / 2;
      decal.position.set(site.center.x, 0.22, site.center.z);
      this.scene.add(decal);
    }
  }

  _buildSkybox() {
    const THREE = this.THREE;
    // Night sky gradient sphere
    const geo = new THREE.SphereGeometry(150, 16, 16);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x02050f) },
        bottomColor: { value: new THREE.Color(0x060c1a) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(h, 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide,
    });
    this.skybox = new THREE.Mesh(geo, mat);
    this.scene.add(this.skybox);

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const starVerts = [];
    for (let i = 0; i < 800; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 140;
      starVerts.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.4, sizeAttenuation: true });
    this.scene.add(new THREE.Points(starGeo, starMat));
  }

  _buildBombIndicator() {
    const THREE = this.THREE;
    const geo = new THREE.BoxGeometry(0.25, 0.12, 0.45);
    const mat = new THREE.MeshLambertMaterial({ color: 0xff3d57, emissive: 0xff1133, emissiveIntensity: 0.5 });
    this.bombIndicatorMesh = new THREE.Mesh(geo, mat);
    this.bombIndicatorMesh.visible = false;
    this.scene.add(this.bombIndicatorMesh);
  }

  _buildSiteIndicators() {
    const THREE = this.THREE;
    for (const [key, site] of Object.entries(BOMB_SITES)) {
      // Floating ring indicator
      const geo = new THREE.TorusGeometry(site.radius - 0.3, 0.08, 6, 32);
      const mat = new THREE.MeshBasicMaterial({ color: site.color, transparent: true, opacity: 0.6 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(site.center.x, 0.25, site.center.z);
      this.scene.add(mesh);
      this.siteIndicators[key] = mesh;

      // Letter
      // (skip canvas text for simplicity, use a colored box)
    }
  }

  _buildWeaponViewModel() {
    const THREE = this.THREE;
    // Simple FPS weapon viewmodel (stylized box)
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.06, 0.08, 0.35);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x222833 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);

    // Barrel
    const barrelGeo = new THREE.BoxGeometry(0.025, 0.025, 0.22);
    const barrelMat = new THREE.MeshLambertMaterial({ color: 0x1a1e28 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.position.set(0, 0.02, -0.24);

    // Stock
    const stockGeo = new THREE.BoxGeometry(0.055, 0.06, 0.12);
    const stock = new THREE.Mesh(stockGeo, bodyMat);
    stock.position.set(0, -0.01, 0.2);

    // Handle
    const handleGeo = new THREE.BoxGeometry(0.04, 0.1, 0.04);
    const handle = new THREE.Mesh(handleGeo, bodyMat);
    handle.position.set(0, -0.07, 0.03);

    // Mag
    const magGeo = new THREE.BoxGeometry(0.03, 0.09, 0.07);
    const magMat = new THREE.MeshLambertMaterial({ color: 0x181c24 });
    const mag = new THREE.Mesh(magGeo, magMat);
    mag.position.set(0, -0.07, -0.05);

    group.add(body, barrel, stock, handle, mag);

    // Position in view (bottom right)
    group.position.set(0.22, -0.18, -0.35);
    group.rotation.y = 0.1;

    this.weaponViewModel = group;
    this.camera.add(group);
    this.scene.add(this.camera);
  }

  updateWeaponViewModel(weaponDef, isReloading, isCrouching) {
    if (!this.weaponViewModel) return;
    const THREE = this.THREE;

    // Resize based on weapon type
    let scaleZ = 1.0;
    if (weaponDef) {
      if (weaponDef.id === 'sniper') scaleZ = 1.4;
      else if (weaponDef.id === 'shotgun') scaleZ = 1.1;
      else if (weaponDef.id === 'pistol_std' || weaponDef.id === 'pistol_heavy') scaleZ = 0.7;
      else if (weaponDef.id === 'knife') scaleZ = 0.5;
      else if (weaponDef.id === 'smg') scaleZ = 0.85;
    }
    this.weaponViewModel.scale.z = scaleZ;

    if (isReloading) {
      this.weaponViewModel.rotation.x = Math.sin(performance.now() * 0.008) * 0.3;
    } else {
      this.weaponViewModel.rotation.x *= 0.85;
    }
  }

  createBotMesh(bot) {
    const THREE = this.THREE;
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.28, 0.28, 1.0, 8);
    const bodyMat = new THREE.MeshLambertMaterial({
      color: bot.team === 'attacker' ? 0x7a2010 : 0x104060
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.6;
    group.add(bodyMesh);

    // Head
    const headGeo = new THREE.BoxGeometry(0.38, 0.38, 0.38);
    const headMat = new THREE.MeshLambertMaterial({
      color: bot.team === 'attacker' ? 0xaa3318 : 0x1a5878
    });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.position.y = 1.45;
    group.add(headMesh);

    // Helmet detail
    const helmGeo = new THREE.BoxGeometry(0.40, 0.12, 0.40);
    const helmMat = new THREE.MeshLambertMaterial({ color: 0x111418 });
    const helm = new THREE.Mesh(helmGeo, helmMat);
    helm.position.y = 1.62;
    group.add(helm);

    // Team indicator on chest
    const idGeo = new THREE.BoxGeometry(0.2, 0.12, 0.01);
    const idMat = new THREE.MeshBasicMaterial({
      color: bot.team === 'attacker' ? 0xff5e3a : 0x00b4d8
    });
    const id = new THREE.Mesh(idGeo, idMat);
    id.position.set(0, 0.8, 0.295);
    group.add(id);

    // Gun
    const gunGeo = new THREE.BoxGeometry(0.04, 0.04, 0.4);
    const gunMat = new THREE.MeshLambertMaterial({ color: 0x1a1e28 });
    const gun = new THREE.Mesh(gunGeo, gunMat);
    gun.position.set(0.18, 0.85, -0.1);
    gun.rotation.y = -0.2;
    group.add(gun);

    // Dead indicator (initial hidden)
    group.userData.headMesh = headMesh;
    group.userData.bodyMesh = bodyMesh;

    this.scene.add(group);
    this.botMeshes.set(bot.id, group);
    return group;
  }

  updateBotMesh(bot) {
    const mesh = this.botMeshes.get(bot.id);
    if (!mesh) return;

    mesh.position.set(bot.pos.x, 0, bot.pos.z);
    mesh.rotation.y = bot.yaw;

    // Death animation (fall over)
    if (!bot.alive) {
      mesh.rotation.z = Math.PI / 2;
      mesh.position.y = -0.3;
      const mat = mesh.userData.bodyMesh?.material;
      if (mat) mat.opacity = 0.5;
    } else {
      mesh.rotation.z = 0;
      mesh.position.y = 0;
      // Crouch
      mesh.scale.y = bot.isCrouching ? 0.7 : 1.0;
    }
  }

  removeBotMesh(botId) {
    const mesh = this.botMeshes.get(botId);
    if (mesh) {
      this.scene.remove(mesh);
      this.botMeshes.delete(botId);
    }
  }

  updateCamera(player) {
    const cam = player.getCameraPosition();
    const angles = player.getViewAngles();

    this.camera.position.set(cam.x, cam.y, cam.z);

    // Apply yaw/pitch
    const q1 = new this.THREE.Quaternion();
    q1.setFromAxisAngle(new this.THREE.Vector3(0, 1, 0), -angles.yaw);
    const q2 = new this.THREE.Quaternion();
    q2.setFromAxisAngle(new this.THREE.Vector3(1, 0, 0), -angles.pitch);
    q1.multiply(q2);
    this.camera.quaternion.copy(q1);

    // FOV for scope
    const targetFOV = 75 * player.scopeFOV;
    this.camera.fov += (targetFOV - this.camera.fov) * 0.15;
    this.camera.updateProjectionMatrix();
  }

  updateBombMesh(bombState) {
    if (!this.bombIndicatorMesh) return;
    if (bombState.planted && !bombState.defused && !bombState.detonated) {
      this.bombIndicatorMesh.visible = true;
      if (bombState.plantedPos) {
        this.bombIndicatorMesh.position.set(
          bombState.plantedPos.x,
          0.25,
          bombState.plantedPos.z
        );
      }
      // Pulse scale
      const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.15;
      this.bombIndicatorMesh.scale.setScalar(pulse);
    } else {
      this.bombIndicatorMesh.visible = false;
    }
  }

  updateSiteIndicators(bombState) {
    const time = performance.now() * 0.001;
    for (const [key, mesh] of Object.entries(this.siteIndicators)) {
      // Rotate ring
      mesh.rotation.z = time * 0.8;
      if (bombState.planted && bombState.plantedSiteId === key) {
        mesh.material.opacity = 0.9 + Math.sin(time * 6) * 0.1;
        mesh.material.color.setHex(0xff3d57);
      } else {
        mesh.material.opacity = 0.4;
        mesh.material.color.setHex(BOMB_SITES[key].color);
      }
    }
  }

  render() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  _onResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  getScene() { return this.scene; }
  getTHREE() { return this.THREE; }
  getGeometry() { return this.geometry; }
}
