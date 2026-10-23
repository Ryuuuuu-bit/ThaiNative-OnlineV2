import type {MapId} from '@the-beginning-online/shared/maps';

const grass='/assets/field-painted-v2/grass.webp';
/** Ground-only grades keep characters, combat tells and item colours readable. */
export function fieldPalette(id:MapId){
 switch(id){
  case 'meadow':return {surface:grass,filter:'saturate(.92) brightness(1.02)',tint:'#d8cf7220',wear:'95,119,39'};
  case 'forest':return {surface:grass,filter:'saturate(.8) hue-rotate(8deg) brightness(.85)',tint:'#315f4820',wear:'41,79,47'};
  case 'grove':return {surface:grass,filter:'saturate(.85) sepia(.18) brightness(.96)',tint:'#c59b4722',wear:'141,111,48'};
  case 'himmapan':case 'dragon':return {surface:grass,filter:'saturate(.75) hue-rotate(15deg) brightness(.94)',tint:'#499a8320',wear:'46,110,86'};
  case 'yokai':return {surface:grass,filter:'saturate(.65) hue-rotate(9deg) brightness(.87)',tint:'#657d6922',wear:'63,92,67'};
  case 'fae':return {surface:grass,filter:'saturate(.65) hue-rotate(20deg) brightness(.92)',tint:'#8d9d9c22',wear:'78,112,95'};
  case 'frost':return {filter:'saturate(.88) brightness(1.1)',tint:'#edf7ff16',wear:'155,185,214'};
  case 'ocean':return {filter:'saturate(.8) brightness(1.12)',tint:'#f4e8ce22',wear:'116,185,182'};
  case 'astral':case 'confluence':return {filter:'saturate(.5) brightness(1.24)',tint:'#b7bdd52a',wear:'146,152,186'};
  case 'abyss':return {filter:'saturate(.55) brightness(1.15)',tint:'#777f9020',wear:'93,108,131'};
  case 'canyon':return {surface:'/assets/field-painted-v2/gravel.webp',filter:'saturate(.65) brightness(1.2)',tint:'#b9ab8526',wear:'107,102,77'};
  case 'summit':return {surface:'/assets/field-painted-v2/gravel.webp',filter:'saturate(.4) brightness(1.18)',tint:'#b4c1de44',wear:'130,144,178'};
  case 'ruins':return {filter:'saturate(.6) brightness(1.12)',tint:'#9c9b7820',wear:'92,103,67'};
  case 'temple':return {filter:'saturate(.55) brightness(1.2)',tint:'#d6ccaa33',wear:'151,145,109'};
  case 'desert':return {filter:'saturate(.85) brightness(1.06)',tint:'#dfbd7b16',wear:'187,146,86'};
  case 'volcano':return {filter:'saturate(.8) brightness(1.07)',tint:'#5a484820',wear:'92,61,49'};
  default:return {filter:'none',tint:'#00000000',wear:'95,119,39'};
 }
}
