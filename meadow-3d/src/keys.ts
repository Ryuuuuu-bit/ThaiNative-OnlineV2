/** KeyboardEvent.code bindings shared by the game controller and tests. First entry is primary. */
export const KEYS={
 attack:['Space','KeyJ'],spin:['KeyQ'],meteor:['KeyE'],dash:['ShiftLeft','ShiftRight'],
 potion:['KeyR'],auto:['KeyF','KeyT'],nextTarget:['Tab'],pause:['Escape'],stats:['KeyC'],
 up:['KeyW','ArrowUp'],down:['KeyS','ArrowDown'],left:['KeyA','ArrowLeft'],right:['KeyD','ArrowRight'],
} as const;
export const isKey=(binding:keyof typeof KEYS,code:string)=>(KEYS[binding] as readonly string[]).includes(code);
