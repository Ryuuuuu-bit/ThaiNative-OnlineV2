import * as T from 'three';

/**
 * Painted actors and billboard props face the camera, so a plain sprite has one depth: its foot.
 * Against real 3D geometry (city walls, stalls) that is wrong — a wall half a metre behind the
 * hero is nearer the camera than the hero's head and cuts it off — and below the foot the ground
 * wins and swallows paws and roots. These patches give every upright card the depth of a vertical
 * plane standing on its anchor (the same pixels, only the depth changes). Two such cards still sort
 * by their feet exactly as before, while walls, roofs and the ground now sort physically.
 */
const VIEW = new T.Vector3(9, 16, 13);
/** Props at least this tall (metres) can hide a hero and get the see-through cut-out. */
export const TALL_PROP = 1.6;
/** Name tags and HP bars draw after the world, never hidden by it. */
export const OVERLAY_ORDER = 10;
/** Depth gained per metre of screen height for a vertical plane under the fixed camera tilt. */
export const UPRIGHT_TAN = VIEW.y / Math.hypot(VIEW.x, VIEW.z);
// Above the anchor: a vertical card. Below it (paws, roots): the ground just in front of the foot,
// which the anchor's few centimetres of height keep above the real ground.
const LIFT_GLSL = `float uprightLift(float up){return up>0.?up*${UPRIGHT_TAN.toFixed(4)}:-up*${(1 / UPRIGHT_TAN).toFixed(4)};}\n`;

/**
 * See-through: fragments of tall props or buildings that hide the local hero are dithered away in
 * a soft ellipse around the hero's body. xyz = hero foot in view space, w = 1 when active.
 */
export const seeThrough = {
	uSeeThrough: {value: new T.Vector4()},
	uSeeThroughSize: {value: new T.Vector2(.75, 1.25)},
};
const SEE_THROUGH_GLSL = `uniform vec4 uSeeThrough;uniform vec2 uSeeThroughSize;varying vec3 vUprightView;
float seeThroughBayer(vec2 p){vec2 q=mod(floor(p),4.);float b=mod(q.x*2.+q.y*3.+floor(q.x*.5)*4.+floor(q.y*.5)*6.,8.);return (b+.5)/8.;}
`;
const SEE_THROUGH_FRAGMENT = `if(uSeeThrough.w>.5){vec2 seeD=(vUprightView.xy-uSeeThrough.xy-vec2(0.,uSeeThroughSize.y))/uSeeThroughSize;float seeR=length(seeD);float heroZ=uSeeThrough.z+max(vUprightView.y-uSeeThrough.y,0.)*${UPRIGHT_TAN.toFixed(4)};
if(seeR<1.&&vUprightView.y>uSeeThrough.y+.3&&vUprightView.z>heroZ+.25){float keep=mix(.3,1.,smoothstep(.55,1.,seeR));if(seeThroughBayer(gl_FragCoord.xy)>keep)discard;}}
`;
const view = new T.Vector3();
/** Call once per frame after the camera moved; pass null to switch the cut-out off. */
export function updateSeeThrough(camera: T.Camera, foot: {x: number; z: number} | null) {
	const u = seeThrough.uSeeThrough.value;
	if (!foot) { u.w = 0; return; }
	view.set(foot.x, .035, foot.z).applyMatrix4(camera.matrixWorldInverse);
	u.set(view.x, view.y, view.z, 1);
}

function chain(material: T.Material, key: string, patch: (shader: T.WebGLProgramParametersWithUniforms) => void) {
	if (material.userData.upright?.includes(key)) return material;
	// The default cache key is onBeforeCompile's source, so read it before wrapping: every wrapper
	// has the same source and would otherwise share one program between unrelated materials.
	const before = material.onBeforeCompile, keyBefore = material.customProgramCacheKey.call(material) + '|' + key;
	material.onBeforeCompile = (shader, renderer) => { before.call(material, shader, renderer); patch(shader); };
	material.customProgramCacheKey = () => keyBefore;
	material.userData.upright = [...(material.userData.upright || []), key];
	material.needsUpdate = true;
	return material;
}

/** Sprite (hero, monsters, NPC sprites): depth of a vertical card on `center`. */
export function uprightSprite<M extends T.SpriteMaterial>(material: M): M {
	return chain(material, 'upright-sprite-v1', shader => {
		shader.vertexShader = LIFT_GLSL + shader.vertexShader.replace('mvPosition.xy += rotatedPosition;', 'mvPosition.xy += rotatedPosition;\n\tmvPosition.z += uprightLift( rotatedPosition.y );');
	}) as M;
}

/**
 * Camera-facing plane meshes (instanced or single) whose local origin is the ground anchor.
 * With `occluder`, the prop also dithers away where it hides the local hero.
 */
export function uprightCard<M extends T.Material>(material: M, occluder = false): M {
	return chain(material, occluder ? 'upright-card-see-v1' : 'upright-card-v1', shader => {
		shader.vertexShader = LIFT_GLSL + 'varying vec3 vUprightView;\n' + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
	vec4 uprightAnchor = vec4( 0., 0., 0., 1. );
	#ifdef USE_INSTANCING
	uprightAnchor = instanceMatrix * uprightAnchor;
	#endif
	uprightAnchor = modelViewMatrix * uprightAnchor;
	mvPosition.z += uprightLift( mvPosition.y - uprightAnchor.y );
	gl_Position = projectionMatrix * mvPosition;
	vUprightView = mvPosition.xyz;`);
		if (occluder) seeThroughFragment(shader);
	}) as M;
}

/** Real 3D geometry (city buildings, walls, stalls): unchanged depth, dithered where it hides the hero. */
export function seeThroughSolid<M extends T.Material>(material: M): M {
	return chain(material, 'see-through-solid-v1', shader => {
		shader.vertexShader = 'varying vec3 vUprightView;\n' + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n\tvUprightView = mvPosition.xyz;');
		seeThroughFragment(shader);
	}) as M;
}

function seeThroughFragment(shader: T.WebGLProgramParametersWithUniforms) {
	Object.assign(shader.uniforms, seeThrough);
	shader.fragmentShader = SEE_THROUGH_GLSL + shader.fragmentShader.replace('void main() {', 'void main() {\n' + SEE_THROUGH_FRAGMENT);
}
