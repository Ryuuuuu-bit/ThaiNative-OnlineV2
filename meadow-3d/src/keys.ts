/** KeyboardEvent.code bindings shared by the game controller and tests. First entry is primary. */
export const KEYS={
 attack:['Space','KeyJ'],slot1:['Digit1'],slot2:['Digit2'],slot3:['Digit3'],slot4:['Digit4'],slot5:['Digit5'],slot6:['Digit6'],slot7:['Digit7'],slot8:['Digit8'],slot9:['Digit9'],slot10:['Digit0'],dash:['ShiftLeft','ShiftRight'],
 inventory:['KeyI'],mute:['KeyM'],potion:['KeyR'],auto:['KeyF','KeyT'],nextTarget:['Tab'],pause:['Escape'],stats:['KeyC'],skills:['KeyK'],
 up:['KeyW','ArrowUp'],down:['KeyS','ArrowDown'],left:['KeyA','ArrowLeft'],right:['KeyD','ArrowRight'],
} as const;
export const isKey=(binding:keyof typeof KEYS,code:string)=>(KEYS[binding] as readonly string[]).includes(code);
