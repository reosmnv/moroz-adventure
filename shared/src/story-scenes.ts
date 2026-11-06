import type { StoryTextId } from './story-content.ts';
export type ActorRef = string;
export type StoryStep =
  | { kind: 'line'; id: StoryTextId; speaker: string; at?: ActorRef }
  | { kind: 'card'; id: StoryTextId }
  | { kind: 'caption'; id: StoryTextId; ms?: number }
  | { kind: 'phone'; ids: StoryTextId[]; at?: ActorRef }
  | { kind: 'composition'; id: StoryTextId; images: string[] }
  | { kind: 'act'; actor: ActorRef; do: 'spawn' | 'walk' | 'face' | 'exit' | 'pose'; look?: string; x?: number; y?: number; ms?: number; facing?: 1 | -1; pose?: string; keep?: boolean; rel?: boolean }
  | { kind: 'act'; actor: 'camera'; do: 'focus'; x: number; ms?: number }
  | { kind: 'state'; id: string; value: string };
export interface StoryScene { id: string; trigger: string; x?: number; steps: StoryStep[] }
const spawn = (actor: ActorRef, look: string, x: number, y = 200, keep = false): StoryStep =>
  ({ kind: 'act', actor, do: 'spawn', look, x, y, facing: -1, keep, rel: true });
const walk = (actor: ActorRef, x: number, y = 200, ms = 700): StoryStep =>
  ({ kind: 'act', actor, do: 'walk', x, y, ms, rel: true });
const focus = (x: number, ms = 600): StoryStep => ({ kind: 'act', actor: 'camera', do: 'focus', x, ms });
const face = (actor: ActorRef, facing: 1 | -1): StoryStep => ({ kind: 'act', actor, do: 'face', facing });
export const STORY_SCENES: StoryScene[] = [
  { id: 'prologue', trigger: 'start', steps: [
    { kind: 'caption', id: 'title.1' }, { kind: 'caption', id: 'title.2' },
    { kind: 'phone', ids: ['intro.body'], at: 'anastasia' },
    { kind: 'line', id: 'intro.button', speaker: 'anastasia' },
    focus(160), face('anastasia', 1), face('nadezhda', 1), face('ramil', 1), face('kris', 1),
    { kind: 'line', id: 'go.a1', speaker: 'nadezhda' },
    { kind: 'line', id: 'go.a3', speaker: 'ramil' },
    { kind: 'line', id: 'go.a4', speaker: 'kris' },
    { kind: 'line', id: 'go.a5', speaker: 'kris' },
    { kind: 'line', id: 'go.b4', speaker: 'nadezhda' },
    { kind: 'line', id: 'go.b5', speaker: 'kris' },
    { kind: 'state', id: 'recording', value: 'on' },
  ] },
  { id: 'street_vat', trigger: 'stage:0', x: 480, steps: [
    focus(570), spawn('vat1', 'vatnik', 290, 153), walk('vat1', 250, 195),
    { kind: 'line', id: 'vat.2', speaker: 'Ватник', at: 'vat1' }, spawn('vat2', 'vatnik', 290, 153), walk('vat2', 310, 225),
    { kind: 'line', id: 'vat.4', speaker: 'Ватник', at: 'vat2' },
    { kind: 'line', id: 'vat.5', speaker: 'Ватник', at: 'vat1' }, { kind: 'line', id: 'rdy.1', speaker: 'anastasia' },
    { kind: 'line', id: 'rdy.3', speaker: 'kris' }, { kind: 'line', id: 'rdy.4', speaker: 'ramil' },
  ] },
  { id: 'arch', trigger: 'clear:0:1', x: 900, steps: [
    focus(2530), spawn('omon1', 'omon', 280, 153), spawn('vat1', 'vatnik', 240, 165),
    walk('omon1', 160, 205), walk('vat1', 220, 225),
    { kind: 'line', id: 'arch.1', speaker: 'ОМОН', at: 'omon1' }, { kind: 'line', id: 'arch.4', speaker: 'ОМОН', at: 'omon1' },
    { kind: 'line', id: 'arch.5', speaker: 'ОМОН', at: 'omon1' }, { kind: 'line', id: 'arch.6', speaker: 'Ватник', at: 'vat1' },
    { kind: 'line', id: 'arch.7', speaker: 'nadezhda' }, { kind: 'line', id: 'arch.8', speaker: 'ОМОН', at: 'omon1' },
  ] },
  { id: 'vestibule', trigger: 'stage:2', x: 320, steps: [
    focus(260),
    { kind: 'line', id: 'vst.1', speaker: 'anastasia' }, { kind: 'line', id: 'vst.2', speaker: 'kris' },
    { kind: 'line', id: 'vst.3', speaker: 'nadezhda' }, { kind: 'line', id: 'vst.4', speaker: 'anastasia' },
    spawn('omon1', 'omon', 360, 170), walk('omon1', 230, 200, 600),
    { kind: 'line', id: 'vst.5', speaker: 'ОМОН', at: 'omon1' }, { kind: 'line', id: 'vst.6', speaker: 'ramil' },
  ] },
  { id: 'wagon', trigger: 'stage:3', x: 320, steps: [
    focus(270), spawn('zek1', 'zek', 240, 157), spawn('zek2', 'zek', 340, 157),
    { kind: 'act', actor: 'zek1', do: 'pose', pose: 'getup', ms: 600 }, walk('zek1', 230, 205, 400),
    { kind: 'line', id: 'wg.1', speaker: 'Зэк', at: 'zek1' }, { kind: 'line', id: 'wg.2', speaker: 'ramil' },
    { kind: 'act', actor: 'zek2', do: 'pose', pose: 'getup', ms: 600 }, walk('zek2', 305, 225, 400),
    { kind: 'line', id: 'wg.3', speaker: 'Зэк', at: 'zek2' }, { kind: 'line', id: 'wg.4', speaker: 'Зэк', at: 'zek1' },
    { kind: 'line', id: 'wg.6', speaker: 'ramil' },
  ] },
  { id: 'mayak', trigger: 'stage:4', x: 320, steps: [
    focus(270), spawn('official', 'clerk', 360, 170), walk('official', 250),
    { kind: 'line', id: 'may.1', speaker: 'anastasia' }, { kind: 'line', id: 'may.2', speaker: 'Чиновник', at: 'official' },
    { kind: 'line', id: 'may.3', speaker: 'anastasia' }, { kind: 'line', id: 'may.4', speaker: 'Чиновник', at: 'official' },
    { kind: 'line', id: 'may.5', speaker: 'ramil' }, { kind: 'line', id: 'may.6', speaker: 'anastasia' },
  ] },
  { id: 'shaman', trigger: 'boss:shaman', steps: [
    focus(940),
    { kind: 'line', id: 'sh.1', speaker: 'anastasia' }, { kind: 'line', id: 'sh.2', speaker: 'kris' },
  ] },
  { id: 'pizdulina', trigger: 'boss:pizdulina', steps: [
    focus(1100), spawn('pizdulina', 'pizdulina', 190),
    { kind: 'line', id: 'pz.1', speaker: 'Пиздулина', at: 'pizdulina' }, { kind: 'line', id: 'pz.2', speaker: 'Пиздулина', at: 'pizdulina' },
    { kind: 'line', id: 'pz.3', speaker: 'nadezhda' }, { kind: 'line', id: 'pz.4', speaker: 'ramil' },
  ] },
  { id: 'local_mfc', trigger: 'clear:4:1', x: 1440, steps: [
    { kind: 'card', id: 'lmfc.1' }, focus(610), spawn('clerk', 'clerk', 150, 195), face('clerk', -1),
    { kind: 'line', id: 'lmfc.2', speaker: 'Сотрудница МФЦ', at: 'clerk' },
    { kind: 'line', id: 'lmfc.3', speaker: 'Сотрудница МФЦ', at: 'clerk' }, { kind: 'line', id: 'lmfc.4', speaker: 'ramil' },
  ] },
  { id: 'city', trigger: 'stage:5', x: 340, steps: [
    focus(310), spawn('info_f', 'info_f', 265), spawn('info_m', 'info_m', 360, 220), face('info_f', -1),
    { kind: 'phone', ids: ['cty.t1', 'cty.t2', 'cty.t3'], at: 'info_f' },
    { kind: 'line', id: 'cty.1', speaker: 'Инфоцыганка', at: 'info_f' }, { kind: 'line', id: 'cty.2', speaker: 'Инфоцыган', at: 'info_m' },
    { kind: 'line', id: 'cty.3', speaker: 'anastasia' }, { kind: 'line', id: 'cty.4', speaker: 'kris' },
    { kind: 'line', id: 'cty.5', speaker: 'ramil' },
  ] },
  { id: 'milonov', trigger: 'clear:6:2', x: 2280, steps: [
    { kind: 'card', id: 'mfc.last' }, focus(2530), spawn('milonov', 'milonov', 187, 153, true),
    walk('milonov', 187, 185, 500), face('milonov', -1),
    { kind: 'line', id: 'mil.1', speaker: 'Милонов', at: 'milonov' }, { kind: 'line', id: 'mil.2', speaker: 'anastasia' },
    { kind: 'line', id: 'mil.3', speaker: 'Милонов', at: 'milonov' }, { kind: 'line', id: 'mil.p4', speaker: 'Милонов', at: 'milonov' },
    { kind: 'line', id: 'mil.p5', speaker: 'Милонов', at: 'milonov' },
  ] },
  { id: 'leverage', trigger: 'clear:6:2', x: 2280, steps: [
    focus(2530), face('kris', 1),
    { kind: 'line', id: 'lev.1', speaker: 'kris' }, { kind: 'line', id: 'lev.3', speaker: 'kris' },
    { kind: 'line', id: 'lev.4', speaker: 'Милонов', at: 'milonov' }, { kind: 'line', id: 'lev.5', speaker: 'anastasia' },
    { kind: 'line', id: 'lev.6', speaker: 'Милонов', at: 'milonov' },
    { kind: 'phone', ids: ['res.1', 'res.2'], at: 'milonov' }, { kind: 'state', id: 'wanted', value: 'off' },
  ] },
  { id: 'sender', trigger: 'clear:6:2', x: 2280, steps: [
    focus(2530),
    { kind: 'phone', ids: ['prf.1', 'prf.2'], at: 'milonov' },
    { kind: 'line', id: 'prf.3', speaker: 'nadezhda' }, { kind: 'line', id: 'prf.4', speaker: 'anastasia' },
    { kind: 'line', id: 'hck.1', speaker: 'ramil' },
    { kind: 'phone', ids: ['hck.2', 'hck.3', 'hck.4', 'hck.5'], at: 'ramil' },
    { kind: 'line', id: 'hck.7', speaker: 'ramil' },
  ] },
  { id: 'katya', trigger: 'boss:katya', steps: [
    focus(2770), spawn('katya', 'katya', 360, 200), walk('katya', 200, 200, 1800), face('katya', -1),
    { kind: 'act', actor: 'katya', do: 'pose', pose: 'cast', ms: 850 },
    { kind: 'act', actor: 'katya', do: 'pose', pose: 'idle' },
    { kind: 'card', id: 'ins.katya.name' },
    { kind: 'line', id: 'kat.1', speaker: 'Катя', at: 'katya' }, { kind: 'line', id: 'kat.2', speaker: 'anastasia' },
  ] },
  { id: 'withdrawal', trigger: 'victory', steps: [
    focus(4000), spawn('katya', 'katya', 230, 205),
    { kind: 'phone', ids: ['kat.withdraw'], at: 'katya' }, { kind: 'phone', ids: ['push.7'], at: 'anastasia' },
    { kind: 'composition', id: 'fin.4', images: ['ui/portrait-prime.png', 'ui/nadya/portrait.png', 'ui/kris/portrait.png', 'ui/ramil/portrait.png', 'ui/story/katya-pl.png'] },
    { kind: 'line', id: 'fin.1', speaker: 'anastasia' }, { kind: 'line', id: 'fin.2', speaker: 'nadezhda' },
    { kind: 'line', id: 'fin.3', speaker: 'anastasia' },
    { kind: 'line', id: 'fin.5', speaker: 'ramil' },
    { kind: 'state', id: 'finaleReady', value: 'on' },
  ] },
];
export const storyScene = (id: string) => STORY_SCENES.find(scene => scene.id === id);
