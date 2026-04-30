import * as THREE from 'three';

export class Submarine {
  public mesh: THREE.Group;
  public propeller: THREE.Group;

  constructor() {
    this.mesh = new THREE.Group();
    this.propeller = new THREE.Group();
    this.createModel();
  }

  private createModel() {
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.4, flatShading: true });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, flatShading: true });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x1a5fff, metalness: 0.8, roughness: 0.2, flatShading: true });

    // Main Body
    const bodyGeo = new THREE.CapsuleGeometry(0.8, 1.8, 4, 12);
    const body = new THREE.Mesh(bodyGeo, yellowMat);
    body.rotation.z = Math.PI / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    this.mesh.add(body);

    // Turret
    const turretGeo = new THREE.CylinderGeometry(0.35, 0.4, 0.8, 8);
    const turret = new THREE.Mesh(turretGeo, yellowMat);
    turret.position.y = 0.8;
    turret.position.x = 0.2;
    turret.castShadow = true;
    this.mesh.add(turret);

    // Periscope
    const pScopeGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6);
    const pScope = new THREE.Mesh(pScopeGeo, darkMat);
    pScope.position.set(0.2, 1.4, 0);
    this.mesh.add(pScope);

    const pScopeLensGeo = new THREE.BoxGeometry(0.15, 0.1, 0.25);
    const pScopeLens = new THREE.Mesh(pScopeLensGeo, darkMat);
    pScopeLens.position.set(0.25, 1.7, 0);
    this.mesh.add(pScopeLens);

    // Portholes
    [0.78, -0.78].forEach(zPos => {
      for (let i = 0; i < 3; i++) {
        const portGroup = new THREE.Group();
        portGroup.position.set(-0.6 + i * 0.7, 0, zPos);
        const frameGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.05, 8);
        const frame = new THREE.Mesh(frameGeo, darkMat);
        frame.rotation.x = Math.PI / 2;
        portGroup.add(frame);
        const glassGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.06, 8);
        const glass = new THREE.Mesh(glassGeo, blueMat);
        glass.rotation.x = Math.PI / 2;
        portGroup.add(glass);
        this.mesh.add(portGroup);
      }
    });

    // Propeller base
    const propBaseGeo = new THREE.CylinderGeometry(0.15, 0.3, 0.4, 6);
    const propBase = new THREE.Mesh(propBaseGeo, yellowMat);
    propBase.position.x = -1.8;
    propBase.rotation.z = Math.PI / 2;
    this.mesh.add(propBase);

    // Propeller Blades
    const bladeGeo = new THREE.BoxGeometry(0.05, 0.8, 0.2);
    const blade1 = new THREE.Mesh(bladeGeo, darkMat);
    const blade2 = new THREE.Mesh(bladeGeo, darkMat);
    blade2.rotation.x = Math.PI / 2;
    this.propeller.add(blade1, blade2);
    this.propeller.position.x = -2;
    this.mesh.add(this.propeller);

    // Tail Fins
    const finGeo = new THREE.BoxGeometry(0.4, 0.05, 1.2);
    const fin = new THREE.Mesh(finGeo, yellowMat);
    fin.position.x = -1.5;
    this.mesh.add(fin);

    this.mesh.position.y = 0.7;
  }
}
