"""Physical overrides independent of texture packing. Never changes aspect ratios or UVs."""
TARGET_HEIGHTS = {
 'env-painted': {'signpost':1.8,'fence-span':1.1,'campfire':.5,'bench':.95,'flowers-lavender':.38,'flowers-pink':.36,'flowers-white':.32,'flowers-yellow':.32,'grass-1':.36,'grass-2':.4,'grass-3':.4,'reeds-3':1.1},
 'env-forest': {'pine':10.,'oak':8.5,'silver':9.,'hollow':8.,'lantern':2.6,'campfire':.5,'fern':.85,'reeds':1.2},
}
def apply_world_scale(manifest, family):
 for asset in manifest['assets']:
  target=TARGET_HEIGHTS[family].get(asset['name'])
  if target:
   factor=target/asset['worldSize'][1]
   asset['worldSize']=[v*factor for v in asset['worldSize']]
   if 'trunkWidth' in asset: asset['trunkWidth']*=factor
  asset['worldScale']=asset['worldSize'][1]/(asset['sourcePixelSize'][1]/113)
 manifest['scaleReference']={'heroMetres':1.8,'method':'uniform worldSize; source pixels and atlas UVs unchanged'}
 return manifest
