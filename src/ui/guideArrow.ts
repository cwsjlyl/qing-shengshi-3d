import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3
} from '@babylonjs/core';

export type GuideArrow = {
  setTarget: (pos: { x: number; y: number; z: number } | null) => void;
  setVisible: (on: boolean) => void;
  update: (player: { x: number; y: number; z: number }, dt: number) => void;
  dispose: () => void;
};

/** 輕量 3D 箭嘴：跟在主角前方，指向出口／目標。 */
export function createGuideArrow(scene: Scene): GuideArrow {
  const root = new TransformNode('guide-arrow-root', scene);
  const mat = new StandardMaterial('guide-arrow-mat', scene);
  mat.diffuseColor = new Color3(0.95, 0.78, 0.25);
  mat.emissiveColor = new Color3(0.55, 0.35, 0.05);
  mat.specularColor = new Color3(0.2, 0.15, 0.05);

  // Local +Z is forward. Cone tip points +Z.
  const head = MeshBuilder.CreateCylinder(
    'guide-head',
    { height: 0.36, diameterTop: 0, diameterBottom: 0.28, tessellation: 6 },
    scene
  );
  head.parent = root;
  head.rotation.x = Math.PI / 2;
  head.position.z = 0.28;
  head.material = mat;
  head.isPickable = false;
  head.renderingGroupId = 1;

  const shaft = MeshBuilder.CreateCylinder(
    'guide-shaft',
    { height: 0.42, diameter: 0.09, tessellation: 6 },
    scene
  );
  shaft.parent = root;
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = -0.05;
  shaft.material = mat;
  shaft.isPickable = false;
  shaft.renderingGroupId = 1;

  let target: Vector3 | null = null;
  let visible = false;
  let bob = 0;
  root.setEnabled(false);

  const meshes: Mesh[] = [shaft, head];

  return {
    setTarget(pos) {
      if (!pos) {
        target = null;
        return;
      }
      target = new Vector3(pos.x, pos.y, pos.z);
    },
    setVisible(on) {
      visible = on && !!target;
      root.setEnabled(visible);
    },
    update(player, dt) {
      if (!visible || !target) {
        root.setEnabled(false);
        return;
      }
      bob += dt;
      const dx = target.x - player.x;
      const dz = target.z - player.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.6) {
        root.setEnabled(false);
        return;
      }
      const yaw = Math.atan2(dx, dz);
      const ahead = 1.15;
      root.position.set(
        player.x + Math.sin(yaw) * ahead,
        player.y + 1.55 + Math.sin(bob * 3.2) * 0.06,
        player.z + Math.cos(yaw) * ahead
      );
      root.rotation.y = yaw;
      root.setEnabled(true);
      for (const m of meshes) m.isVisible = true;
    },
    dispose() {
      shaft.dispose();
      head.dispose();
      root.dispose();
      mat.dispose();
    }
  };
}
