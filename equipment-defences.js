// Armour can set a fixed defence or add to the corresponding Attribute die.
// Shield and weapon values are bonuses. The original rulebook notation lives
// in each item's notes, including on items saved before the picker was fixed.
export function parseEquipmentStat(value){
  const text=String(value??'').trim();
  if(/^[+-]?\d+$/.test(text))return Number(text);
  const formula=text.match(/^(?:DEX|INS)\s*(?:die|size)?(?:\s*([+-])\s*(\d+))?$/i);
  return formula ? (formula[1]==='-'?-1:1)*Number(formula[2]||0) : 0;
}

function score(item,field,label){
  const notes=String(item.notes||'');
  const notation=notes.match(label==='defence'
    ? /(?:^|[·\n])\s*DEF\s+((?:DEX|INS)\s*(?:die|size)?(?:\s*[+-]\s*\d+)?|[+-]?\d+)/i
    : /(?:^|[·\n])\s*(?:M\.?\s*DEF|MAGIC\s+DEFEN[CS]E)\s+((?:DEX|INS)\s*(?:die|size)?(?:\s*[+-]\s*\d+)?|[+-]?\d+)/i)?.[1]?.trim();
  const entered=Number(item[field]);
  const value=(Number.isFinite(entered) && entered!==0 ? entered : parseEquipmentStat(item[field])) || parseEquipmentStat(notation);
  const expression=notation||String(item[field]??'').trim();
  return {value,fixed:value>=6&&!/^(?:DEX|INS)\b|^\+/.test(expression)};
}

export function equipmentDefences(equipment,dexSize,insSize){
  let defenceBase=null,magicDefenceBase=null,defenceBonus=0,magicDefenceBonus=0,initiative=0;
  for(const item of equipment||[]){
    const slot=String(item.slot||'').trim().toLowerCase();
    if(slot.startsWith('loadout'))continue;
    const armor=/armor|armour/.test(slot);
    const def=score(item,'defence','defence');
    const mdef=score(item,'magic_defence','magic_defence');
    if(armor&&def.fixed)defenceBase=Math.max(defenceBase??def.value,def.value);
    else defenceBonus+=def.value;
    if(armor&&mdef.fixed)magicDefenceBase=Math.max(magicDefenceBase??mdef.value,mdef.value);
    else magicDefenceBonus+=mdef.value;
    initiative+=Number(item.initiative)||0;
  }
  return {
    defence:(defenceBase??dexSize)+defenceBonus,
    magicDefence:(magicDefenceBase??insSize)+magicDefenceBonus,
    initiative
  };
}
