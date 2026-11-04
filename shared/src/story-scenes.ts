import type { StoryTextId } from './story-content.ts';

export type ActorRef = string;
export type StoryStep =
  | { kind: 'line'; id: StoryTextId; speaker: string; at?: ActorRef }
  | { kind: 'card'; id: StoryTextId }
  | { kind: 'phone'; ids: StoryTextId[]; at?: ActorRef }
  | { kind: 'composition'; id: StoryTextId; images: string[] }
  | { kind: 'act'; actor: ActorRef; do: 'spawn' | 'walk' | 'face' | 'exit' | 'pose'; look?: string; x?: number; y?: number; ms?: number; facing?: 1 | -1; pose?: string; keep?: boolean }
  | { kind: 'act'; actor: 'camera'; do: 'focus'; x: number; ms?: number }
  | { kind: 'state'; id: string; value: string };
export interface StoryScene { id: string; trigger: string; steps: StoryStep[] }

export const STORY_SCENES: StoryScene[] = [
  { id: 'prologue', trigger: 'start', steps: [
    { kind: 'card', id: 'title.1' }, { kind: 'card', id: 'title.2' },
    { kind: 'phone', ids: ['intro.title', 'intro.body', 'intro.foot', 'intro.button'] },
    { kind: 'line', id: 'go.a1', speaker: 'nadezhda' },
    { kind: 'line', id: 'go.a3', speaker: 'ramil' },
    { kind: 'line', id: 'go.a4', speaker: 'kris' },
    { kind: 'line', id: 'go.a5', speaker: 'kris' },
    { kind: 'line', id: 'go.b4', speaker: 'nadezhda' },
    { kind: 'line', id: 'go.b5', speaker: 'kris' },
    { kind: 'state', id: 'recording', value: 'on' },
  ] },
  { id: 'street_vat', trigger: 'stage:0', steps: [
    { kind: 'line', id: 'vat.2', speaker: 'Ватник' }, { kind: 'line', id: 'vat.4', speaker: 'Ватник' },
    { kind: 'line', id: 'vat.5', speaker: 'Ватник' }, { kind: 'line', id: 'rdy.1', speaker: 'anastasia' },
    { kind: 'line', id: 'rdy.3', speaker: 'kris' }, { kind: 'line', id: 'rdy.4', speaker: 'ramil' },
  ] },
  { id: 'arch', trigger: 'clear:0:1', steps: [
    { kind: 'line', id: 'arch.1', speaker: 'ОМОН' }, { kind: 'line', id: 'arch.4', speaker: 'ОМОН' },
    { kind: 'line', id: 'arch.5', speaker: 'ОМОН' }, { kind: 'line', id: 'arch.6', speaker: 'Ватник' },
    { kind: 'line', id: 'arch.7', speaker: 'nadezhda' }, { kind: 'line', id: 'arch.8', speaker: 'ОМОН' },
  ] },
  { id: 'vestibule', trigger: 'stage:2', steps: [
    { kind: 'line', id: 'vst.1', speaker: 'anastasia' }, { kind: 'line', id: 'vst.2', speaker: 'kris' },
    { kind: 'line', id: 'vst.3', speaker: 'nadezhda' }, { kind: 'line', id: 'vst.4', speaker: 'anastasia' },
    { kind: 'line', id: 'vst.5', speaker: 'ОМОН' }, { kind: 'line', id: 'vst.6', speaker: 'ramil' },
  ] },
  { id: 'wagon', trigger: 'stage:3', steps: [
    { kind: 'line', id: 'wg.1', speaker: 'Зэк' }, { kind: 'line', id: 'wg.2', speaker: 'ramil' },
    { kind: 'line', id: 'wg.3', speaker: 'Зэк' }, { kind: 'line', id: 'wg.4', speaker: 'Зэк' },
    { kind: 'line', id: 'wg.6', speaker: 'ramil' },
  ] },
  { id: 'mayak', trigger: 'stage:4', steps: [
    { kind: 'line', id: 'may.1', speaker: 'anastasia' }, { kind: 'line', id: 'may.2', speaker: 'Чиновник' },
    { kind: 'line', id: 'may.3', speaker: 'anastasia' }, { kind: 'line', id: 'may.4', speaker: 'Чиновник' },
    { kind: 'line', id: 'may.5', speaker: 'ramil' }, { kind: 'line', id: 'may.6', speaker: 'anastasia' },
  ] },
  { id: 'shaman', trigger: 'boss:shaman', steps: [
    { kind: 'line', id: 'sh.1', speaker: 'anastasia' }, { kind: 'line', id: 'sh.2', speaker: 'kris' },
  ] },
  { id: 'pizdulina', trigger: 'boss:pizdulina', steps: [
    { kind: 'line', id: 'pz.1', speaker: 'Пиздулина' }, { kind: 'line', id: 'pz.2', speaker: 'Пиздулина' },
    { kind: 'line', id: 'pz.3', speaker: 'nadezhda' }, { kind: 'line', id: 'pz.4', speaker: 'ramil' },
  ] },
  { id: 'local_mfc', trigger: 'clear:4:1', steps: [
    { kind: 'card', id: 'lmfc.1' }, { kind: 'line', id: 'lmfc.2', speaker: 'Сотрудница МФЦ' },
    { kind: 'line', id: 'lmfc.3', speaker: 'Сотрудница МФЦ' }, { kind: 'line', id: 'lmfc.4', speaker: 'ramil' },
  ] },
  { id: 'city', trigger: 'stage:5', steps: [
    { kind: 'phone', ids: ['cty.t1', 'cty.t2', 'cty.t3'] },
    { kind: 'line', id: 'cty.1', speaker: 'Инфоцыганка' }, { kind: 'line', id: 'cty.2', speaker: 'Инфоцыган' },
    { kind: 'line', id: 'cty.3', speaker: 'anastasia' }, { kind: 'line', id: 'cty.4', speaker: 'kris' },
    { kind: 'line', id: 'cty.5', speaker: 'ramil' },
  ] },
  { id: 'milonov', trigger: 'clear:6:2', steps: [
    { kind: 'card', id: 'mfc.last' },
    { kind: 'line', id: 'mil.1', speaker: 'Милонов' }, { kind: 'line', id: 'mil.2', speaker: 'anastasia' },
    { kind: 'line', id: 'mil.3', speaker: 'Милонов' }, { kind: 'line', id: 'mil.p4', speaker: 'Милонов' },
    { kind: 'line', id: 'mil.p5', speaker: 'Милонов' },
  ] },
  { id: 'leverage', trigger: 'clear:6:2', steps: [
    { kind: 'line', id: 'lev.1', speaker: 'kris' }, { kind: 'line', id: 'lev.3', speaker: 'kris' },
    { kind: 'line', id: 'lev.4', speaker: 'Милонов' }, { kind: 'line', id: 'lev.5', speaker: 'anastasia' },
    { kind: 'line', id: 'lev.6', speaker: 'Милонов' },
    { kind: 'phone', ids: ['res.1', 'res.2'] }, { kind: 'state', id: 'wanted', value: 'off' },
  ] },
  { id: 'sender', trigger: 'clear:6:2', steps: [
    { kind: 'phone', ids: ['prf.1', 'prf.2'] },
    { kind: 'line', id: 'prf.3', speaker: 'nadezhda' }, { kind: 'line', id: 'prf.4', speaker: 'anastasia' },
    { kind: 'line', id: 'hck.1', speaker: 'ramil' },
    { kind: 'phone', ids: ['hck.2', 'hck.3', 'hck.4', 'hck.5'] },
    { kind: 'line', id: 'hck.7', speaker: 'ramil' },
  ] },
  { id: 'katya', trigger: 'boss:katya', steps: [
    { kind: 'card', id: 'ins.katya.name' },
    { kind: 'line', id: 'kat.1', speaker: 'Катя' }, { kind: 'line', id: 'kat.2', speaker: 'anastasia' },
  ] },
  { id: 'withdrawal', trigger: 'victory', steps: [
    { kind: 'phone', ids: ['kat.withdraw'] }, { kind: 'phone', ids: ['push.7'] },
    { kind: 'composition', id: 'fin.4', images: ['ui/portrait-prime.png', 'ui/nadya/portrait.png', 'ui/kris/portrait.png', 'ui/ramil/portrait.png', 'ui/story/katya-pl.png'] },
    { kind: 'line', id: 'fin.1', speaker: 'anastasia' }, { kind: 'line', id: 'fin.2', speaker: 'nadezhda' },
    { kind: 'line', id: 'fin.3', speaker: 'anastasia' },
    { kind: 'line', id: 'fin.5', speaker: 'ramil' },
    { kind: 'state', id: 'finaleReady', value: 'on' },
  ] },
];
export const storyScene = (id: string) => STORY_SCENES.find(scene => scene.id === id);
