import {readFileSync} from 'node:fs';

// Canon from the published Soboda Discovery Center, not real-world zoology.
export const sobodaLore=Object.freeze({
  name:'Soboda',archive:'/soboda',world:'Fictional creature and Discovery Center archive in Jack Sander’s creative world.',
  appearance:'A hunched, mostly hairless tan creature with an elongated pointed muzzle, large dark eyes, small humanlike ears, a long neck, thin bent forelimbs, large folded hindquarters, a long tapering tail, and dark hair on its scalp and along its spine. The original archive photograph and expanded view define its identity.',
  habitat:'Caves and forests of the Taiga; the first encounter in the archive was in Alaska in the 1960s.',
  diet:'Omnivore.',recordedEncounters:40,
  evidence:'Almost humanlike footprints and strands of hair. Its hair is described as having the texture and pungence of American black bear hair.',
  behavior:'Imitates animal and human sounds to lure prey. When threatened it stands on its hind feet and screams to frighten predators.',
  lifeCycle:'The archive gives a lifespan of around one month, says it switches sexes to procreate, and lays eggs around trees, ponds, or caves. The deliberately absurd original notes say it bleeds smegma if killed.',
  timeline:[{when:'1960s',event:'First encounter in Alaska.'},{when:'2005',event:'The fictional archive claims a DNA link and describes Soboda as an ancestor of the American black bear.'},{when:'circa 2021',event:'First sketch in the visual archive.'}],
  discoverer:{name:'Dr. Rasha',born:'New York, 1940',role:'In the fictional archive, leader of the NYU Discovery Center for Medicine and Care and discoverer of Soboda.',story:'The archive says he is 9 feet 7 inches tall, has seven children and three wives, has rib tattoos, went off the grid, died in Madrid, and that his preserved brain powers NYU. These are fictional story details, not a real biography.'},
  visualArchive:['The iconic photograph','The preserved specimen attributed to Dr. Rasha','First sketch, circa 2021','An AI-generated expanded interpretation','Zooted Soboda: “High Soboda, more dangerous.”'],
  motto:'#PRESERVETHESOBODA',
  song:{title:'soboda',album:'prodigy genius',trackNumber:7,href:'/prodigygenius#track-7'}
});

export const sobodaReference=Object.freeze({id:'soboda',subject:'soboda',description:'The actual Soboda archive creature, using its iconic photograph and expanded view. Choose for a Soboda creature, specimen, cryptid, or Discovery Center image with no depiction of Jack requested.'});
export function sobodaReferenceImages(){return [
  readFileSync(new URL('../assets/soboda/iconic.webp',import.meta.url)),
  readFileSync(new URL('../assets/soboda/expanded.webp',import.meta.url))
]}
export const mentionsSoboda=text=>/\b(?:soboda|sobota|saboda|sabota)\b/i.test(text||'');
