import test from 'node:test';
import assert from 'node:assert/strict';
import {equipmentDefences,parseEquipmentStat} from '../equipment-defences.js';

test('the equipment picker reads die formulas and fixed values',()=>{
  assert.equal(parseEquipmentStat('INS size +2'),2);
  assert.equal(parseEquipmentStat('DEX die +1'),1);
  assert.equal(parseEquipmentStat('INS size'),0);
  assert.equal(parseEquipmentStat('11'),11);
  assert.equal(parseEquipmentStat('+2'),2);
  assert.equal(parseEquipmentStat('-3'),-3);
});

test('an existing Sage Robe gains its missing bonuses from the saved notes',()=>{
  const oldRobe={slot:'Armor',name:'Sage Robe',defence:0,magic_defence:0,initiative:-2,
    notes:'Basic · basic · 200z · DEF DEX size +1 · MDEF INS size +2 · INIT -2'};
  assert.deepEqual(equipmentDefences([oldRobe],8,10),{defence:9,magicDefence:12,initiative:-2});
  assert.deepEqual(equipmentDefences([{...oldRobe,defence:1,magic_defence:2}],8,10),
    {defence:9,magicDefence:12,initiative:-2});
});

test('a fixed armour defence replaces the die while shield bonuses still apply',()=>{
  const plate={slot:'Armor',defence:11,magic_defence:0,initiative:-3,
    notes:'Basic · DEF 11 · MDEF INS size +1'};
  const shield={slot:'Off hand · Shield',defence:2,magic_defence:2,
    notes:'Basic · DEF +2 · MDEF +2'};
  assert.deepEqual(equipmentDefences([plate,shield],12,8),
    {defence:13,magicDefence:11,initiative:-3});
});

test('fixed Magic Defense on armour replaces Insight and keeps bonuses from other items',()=>{
  const armour={slot:'Armour',defence:12,magic_defence:12,notes:'DEF 12 · MDEF 12'};
  const shield={slot:'Shield',defence:2,magic_defence:2,notes:'DEF +2 · MDEF +2'};
  assert.deepEqual(equipmentDefences([armour,shield],8,10),
    {defence:14,magicDefence:14,initiative:0});
  assert.deepEqual(equipmentDefences([{slot:'Armor',magic_defence:12}],8,10),
    {defence:8,magicDefence:12,initiative:0});
});

test('stowed armour does not contribute, and weapon boosts are still additive',()=>{
  const stowed={slot:'Loadout',name:'Sage Robe',defence:0,magic_defence:0,
    notes:'Stored in loadout · DEF DEX size +1 · MDEF INS size +2'};
  const weapon={slot:'Two hands',defence:0,magic_defence:2,
    notes:'Magic Defense Boost: +2 MDEF.'};
  assert.deepEqual(equipmentDefences([stowed,weapon],8,10),
    {defence:8,magicDefence:12,initiative:0});
  assert.equal(equipmentDefences([{slot:'Armor',magic_defence:6,notes:'MDEF +6'}],8,10).magicDefence,16);
});
