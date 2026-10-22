import './portal-expansion.css';
import {REGIONS,WORLD_MAX_LEVEL,worldData} from './world-catalog';
const meadow='/assets/web/meadow-dawn-1600-v1.jpg';
import yokai from '../assets/biome-yokai-v1.webp?url';
import dragon from '../assets/biome-dragon-v1.webp?url';
import ocean from '../assets/biome-ocean-v1.webp?url';
import astral from '../assets/biome-astral-v1.webp?url';
import confluence from '../assets/biome-confluence-v1.webp?url';
const illustrations={meadow,yokai,dragon,ocean,astral,confluence};
const host=document.querySelector('#realm-new-world');
if(host)for(const [id,image]of Object.entries(illustrations)){
 const region=REGIONS.find(r=>r.id===id)!;const link=document.createElement('a');link.className='realm-region-card'+(id==='meadow'?'':' realm-landmark-card');link.href='/world.html?region='+id;
 const img=document.createElement('img');img.src=image;img.alt=region.name;img.loading='lazy';img.width=700;img.height=460;
 const copy=document.createElement('div'),level=document.createElement('span'),title=document.createElement('h3'),myth=document.createElement('p');
 level.textContent='Lv.'+(region.levels[0]===region.levels[1]?region.levels[0]:region.levels.join('–'));title.textContent=region.name;myth.textContent=region.myth;
 copy.append(level,title,myth);link.append(img,copy);host.append(link);
}
const regionCount=document.querySelector('[data-world-regions]');if(regionCount)regionCount.textContent=String(REGIONS.length);
const maxLevel=document.querySelector('[data-world-max]');if(maxLevel)maxLevel.textContent=String(WORLD_MAX_LEVEL);
const cards=document.querySelector('[data-world-cards]');if(cards)cards.textContent=String(worldData.items.items.filter(i=>i.type==='card').length);
