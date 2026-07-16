/**
 * Three.js Memory & Resource Disposer Utility
 * Prevents memory leaks by disposing geometries, materials, maps, and controls.
 */

export function disposeThreeObject(obj) {
  if (!obj) return;

  if (obj.children) {
    for (let i = obj.children.length - 1; i >= 0; i--) {
      disposeThreeObject(obj.children[i]);
      obj.remove(obj.children[i]);
    }
  }

  if (obj.geometry) {
    obj.geometry.dispose();
  }

  if (obj.material) {
    if (Array.isArray(obj.material)) {
      obj.material.forEach(disposeMaterial);
    } else {
      disposeMaterial(obj.material);
    }
  }
}

function disposeMaterial(mat) {
  if (!mat) return;

  // Dispose material textures
  const mapKeys = [
    'map', 'bumpMap', 'normalMap', 'roughnessMap', 'metalnessMap',
    'alphaMap', 'envMap', 'lightMap', 'aoMap', 'displacementMap'
  ];

  for (const key of mapKeys) {
    if (mat[key] && typeof mat[key].dispose === 'function') {
      mat[key].dispose();
    }
  }

  if (typeof mat.dispose === 'function') {
    mat.dispose();
  }
}

export function disposeScene(scene, renderer, controls, animFrameId) {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
  }

  if (controls && typeof controls.dispose === 'function') {
    controls.dispose();
  }

  if (scene) {
    disposeThreeObject(scene);
  }

  if (renderer) {
    if (renderer.domElement && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    if (typeof renderer.dispose === 'function') {
      renderer.dispose();
    }
  }
}
