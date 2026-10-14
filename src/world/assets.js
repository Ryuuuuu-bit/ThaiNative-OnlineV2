// Register a factory (e.g. () => gltf.scene.clone()) before building the world.
// Models use a ground-level origin; dimensions/footprints remain layout-owned.
const factories = new Map();
export function registerAsset(id, factory) {
  factories.set(id, factory);
}
export function assetOrFallback(placement, fallback) {
  const object = factories.has(placement.assetId)
    ? factories.get(placement.assetId)(placement)
    : fallback(placement);
  object.position.set(placement.x ?? 0, placement.y ?? 0, placement.z ?? 0);
  object.userData.placementId = placement.id;
  object.userData.assetId = placement.assetId;
  object.traverse((child) => {
    if (child.isMesh && !child.userData.excludeAO) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return object;
}
export function hasAsset(id) {
  return factories.has(id);
}
