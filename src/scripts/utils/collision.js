import * as THREE from 'three';

/**
 * AABB (Axis-Aligned Bounding Box) & Grid Collision Module
 * Checks bounds overlapping and grid boundaries for room furniture placement.
 */

export function getRotatedDimensions(gw, gd, rotation) {
  const steps = Math.floor(((rotation || 0) / 90) % 4);
  let w = gw;
  let d = gd;
  for (let i = 0; i < steps; i++) {
    const tmp = w;
    w = d;
    d = tmp;
  }
  return { w, d };
}

export function getItemAABB(gx, gy, gw, gd, rotation) {
  const { w, d } = getRotatedDimensions(gw, gd, rotation);
  return new THREE.Box2(
    new THREE.Vector2(gx, gy),
    new THREE.Vector2(gx + w - 0.05, gy + d - 0.05) // Slight padding epsilon to prevent seam false-positives
  );
}

export function checkGridBounds(gx, gy, gw, gd, rotation, gridW, gridD) {
  const { w, d } = getRotatedDimensions(gw, gd, rotation);
  return gx >= 0 && gy >= 0 && gx + w <= gridW && gy + d <= gridD;
}

export function checkAABBCollision(newItem, placedItems, furnitureCatalog, gridW, gridD, excludeId = null) {
  const catalogDef = furnitureCatalog[newItem.type];
  if (!catalogDef) return false;

  const newGw = catalogDef.gw || 1;
  const newGd = catalogDef.gd || 1;

  // Check room grid boundary
  if (!checkGridBounds(newItem.gx, newItem.gy, newGw, newGd, newItem.rotation, gridW, gridD)) {
    return true; // Colliding with room wall boundary
  }

  const boxNew = getItemAABB(newItem.gx, newItem.gy, newGw, newGd, newItem.rotation);

  for (const existing of placedItems) {
    if (excludeId && existing.id === excludeId) continue;

    const existingDef = furnitureCatalog[existing.type];
    if (!existingDef) continue;

    const boxExisting = getItemAABB(
      existing.gx,
      existing.gy,
      existingDef.gw || 1,
      existingDef.gd || 1,
      existing.rotation
    );

    if (boxNew.intersectsBox(boxExisting)) {
      return true; // Overlap collision detected
    }
  }

  return false;
}
