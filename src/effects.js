// Effects system - manages muzzle flashes, impacts, particles
export class EffectsSystem {
  constructor(scene, THREE) {
    this.scene = scene;
    this.THREE = THREE;
    this.particles = [];
    this.maxParticles = 80;
  }

  addMuzzleFlash(pos) {
    // Create a bright point light flash at muzzle
    const light = new this.THREE.PointLight(0xffaa44, 8, 3);
    light.position.set(pos.x, pos.y, pos.z);
    this.scene.add(light);
    this.particles.push({ type: 'light', obj: light, life: 0.05, maxLife: 0.05 });
  }

  addImpact(x, y, z) {
    // Spark particles
    for (let i = 0; i < 5; i++) {
      const geo = new this.THREE.SphereGeometry(0.015, 4, 4);
      const mat = new this.THREE.MeshBasicMaterial({ color: 0xffdd88 });
      const mesh = new this.THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      const v = {
        x: (Math.random() - 0.5) * 4,
        y: Math.random() * 3 + 1,
        z: (Math.random() - 0.5) * 4
      };
      this.scene.add(mesh);
      if (this.particles.length < this.maxParticles) {
        this.particles.push({ type: 'spark', obj: mesh, life: 0.3, maxLife: 0.3, vel: v });
      } else {
        this.scene.remove(mesh);
        geo.dispose(); mat.dispose();
      }
    }
  }

  addBloodParticle(x, y, z) {
    // Red flash hit indicator
    const geo = new this.THREE.SphereGeometry(0.05, 4, 4);
    const mat = new this.THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.8 });
    const mesh = new this.THREE.Mesh(geo, mat);
    mesh.position.set(x, y + 1.0, z);
    this.scene.add(mesh);
    if (this.particles.length < this.maxParticles) {
      this.particles.push({ type: 'blood', obj: mesh, life: 0.25, maxLife: 0.25, vel: { x: (Math.random()-0.5)*2, y: 1.5, z: (Math.random()-0.5)*2 } });
    } else {
      this.scene.remove(mesh);
      geo.dispose(); mat.dispose();
    }
  }

  addExplosion(x, y, z) {
    // Explosion flash and particles
    const light = new this.THREE.PointLight(0xff6622, 40, 20);
    light.position.set(x, y, z);
    this.scene.add(light);
    this.particles.push({ type: 'light', obj: light, life: 0.4, maxLife: 0.4 });

    for (let i = 0; i < 20; i++) {
      const geo = new this.THREE.SphereGeometry(0.06, 4, 4);
      const mat = new this.THREE.MeshBasicMaterial({
        color: Math.random() > 0.5 ? 0xff4400 : 0xffaa00,
        transparent: true
      });
      const mesh = new this.THREE.Mesh(geo, mat);
      mesh.position.set(x, y + 0.5, z);
      const spd = 5 + Math.random() * 8;
      const angle = Math.random() * Math.PI * 2;
      const vy = (Math.random() - 0.3) * spd;
      this.scene.add(mesh);
      if (this.particles.length < this.maxParticles * 2) {
        this.particles.push({
          type: 'explosion',
          obj: mesh, mat,
          life: 0.6 + Math.random() * 0.4,
          maxLife: 1.0,
          vel: { x: Math.cos(angle) * spd, y: vy, z: Math.sin(angle) * spd }
        });
      } else {
        this.scene.remove(mesh);
        geo.dispose(); mat.dispose();
      }
    }
  }

  update(dt) {
    const toRemove = [];
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.obj);
        if (p.obj.geometry) p.obj.geometry.dispose();
        if (p.mat) p.mat.dispose();
        toRemove.push(p);
        continue;
      }

      const frac = p.life / p.maxLife;

      if (p.type === 'spark' || p.type === 'explosion' || p.type === 'blood') {
        p.obj.position.x += p.vel.x * dt;
        p.obj.position.y += p.vel.y * dt;
        p.obj.position.z += p.vel.z * dt;
        p.vel.y -= 9 * dt; // gravity
        if (p.obj.material) {
          p.obj.material.opacity = frac;
          p.obj.scale.setScalar(frac * 0.5 + 0.5);
        }
      }

      if (p.type === 'light') {
        p.obj.intensity *= Math.pow(0.001, dt * 15);
      }
    }
    for (const p of toRemove) {
      this.particles.splice(this.particles.indexOf(p), 1);
    }
  }

  dispose() {
    for (const p of this.particles) {
      this.scene.remove(p.obj);
      if (p.obj.geometry) p.obj.geometry.dispose();
      if (p.obj.material) p.obj.material.dispose();
    }
    this.particles = [];
  }
}
