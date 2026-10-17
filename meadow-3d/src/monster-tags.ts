const elements:Record<string,string>={neutral:'ไร้ธาตุ',water:'น้ำ',earth:'ดิน',fire:'ไฟ',wind:'ลม',holy:'ศักดิ์สิทธิ์',dark:'มืด',ghost:'วิญญาณ',poison:'พิษ',undead:'อันเดด'};
const sizes:Record<string,string>={small:'เล็ก',medium:'กลาง',large:'ใหญ่'};
const races:Record<string,string>={formless:'ไร้รูปร่าง',brute:'สัตว์',plant:'พืช',insect:'แมลง',demon:'ปีศาจ',undead:'อันเดด',demihuman:'กึ่งมนุษย์',dragon:'มังกร',fish:'ปลา',angel:'เทวดา'};

export function updateMonsterTags(container:HTMLElement,monster?:{element:string;size:string;race:string}){
 const signature=JSON.stringify(monster?[monster.element,monster.size,monster.race]:[]);
 if(container.dataset.monsterTags===signature)return;
 container.dataset.monsterTags=signature;
 container.replaceChildren();
 for(const [kind,label,value]of [
  ['element','ธาตุ',monster?elements[monster.element]??monster.element:'—'],
  ['size','ขนาด',monster?sizes[monster.size]??monster.size:'—'],
  ['race','เผ่า',monster?races[monster.race]??monster.race:'—']
 ]){
  const tag=document.createElement('span');tag.className=`monster-tag monster-tag-${kind}`;
  tag.textContent=`${label} ${value}`;container.append(tag);
 }
}
