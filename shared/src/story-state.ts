import { STORY_CONTENT } from './story-content.ts';
import { clampToLane } from './levels.ts';
import { ROUTE } from './route-data.ts';
import { VOKZAL_ARENA } from './encounters.ts';
import { CHARACTERS, TEST_TOOLS, VIEW_W, addPlayer, stepActors, createWorld, testSummon, testHeal, encountersOf, prepareStoryEncounter, placeStoryFormation, stopStoryHeroes, step, type World } from './sim.ts';
import type { EnemyKind } from './enemy-data.ts';
import { storyScene, STORY_SCENES, type StoryStep } from './story-scenes.ts';

const ACTOR_EXIT_MARGIN = 128;

export interface StoryProgress { scene: string; index: number; completed: string[]; flags: Record<string, string>; actKey?: string; actMs?: number }
export const createStoryProgress = (): StoryProgress => ({ scene: '', index: 0, completed: [], flags: {} });
export const storyStep = (story: StoryProgress): StoryStep | undefined => storyScene(story.scene)?.steps[story.index];
export const storyStepKey = (story: StoryProgress): string => story.scene ? `${story.scene}:${story.index}` : '';

export function startStory(story: StoryProgress, trigger: string, world?: World): boolean {
  if (story.scene) return false;
  const scene = STORY_SCENES.find(s => s.trigger === trigger && !story.completed.includes(s.id));
  if (!scene) return false;
  if (world) stopStoryHeroes(world);
  story.scene = scene.id; story.index = 0;
  applyStoryState(story);
  return true;
}

function applyStoryState(story: StoryProgress, world?: World) {
  while (storyStep(story)?.kind === 'state') {
    const step = storyStep(story)!;
    if (step.kind === 'state') story.flags[step.id] = step.value;
    story.index++;
  }
  const scene = storyScene(story.scene);
  if (scene && story.index >= scene.steps.length) {
    story.completed.push(scene.id); story.scene = ''; story.index = 0;
    story.actKey = undefined; story.actMs = undefined;
    if (world) {
      for (const [id, actor] of Object.entries(world.actors)) if (!actor.keep) delete world.actors[id];
      world.storyCamX = undefined;
      if (world.storyEncounter) world.storyEncounter.waiting = false;
      for (const enemy of Object.values(world.enemies)) if (enemy.storyWaiting) { enemy.storyWaiting = false; enemy.storyAdvanceMs = 600; }
    }
  }
}

export function advanceStory(story: StoryProgress, key: string, world?: World): boolean {
  if (!key || key !== storyStepKey(story) || !storyStep(story) || ['act', 'caption'].includes(storyStep(story)!.kind)) return false;
  story.index++;
  applyStoryState(story, world);
  return true;
}

export function wantedStatus(world: { level: string; stage: number; enc: { cleared: number }; storyPizDown?: boolean }, story: StoryProgress) {
  if (world.level !== 'route' || story.flags.wanted === 'off') return { stars: 0, reward: 0 };
  const stage = world.stage, cleared = world.enc.cleared;
  const stars = stage > 5 || stage === 5 && cleared >= 1 ? 5 : stage >= 5 || world.storyPizDown ? 4 : stage >= 3 || stage === 2 && cleared >= 1 ? 3
    : stage >= 1 || cleared >= 2 ? 2 : cleared >= 1 ? 1 : 0;
  const reward = stage >= 4 || stage === 3 && cleared >= 1 ? 500000 : stars >= 3 ? 150000 : 0;
  return { stars, reward };
}

type StoryWorld = { level: string; stage: number; won: boolean; enc: { cleared: number }; enemies: Record<string, { boss?: string; hp: number }>; players: Record<string, { x: number; hp: number; connected: boolean; away: boolean }>; storyStrict?: boolean };
export function pendingStory(story: StoryProgress, world: StoryWorld) {
  if (world.level !== 'route' || story.scene) return undefined;
  const triggers = [`stage:${world.stage}`, ...Array.from({ length: world.enc.cleared + 1 }, (_, n) => `clear:${world.stage}:${n}`)];
  for (const enemy of Object.values(world.enemies)) if (enemy.boss && enemy.hp > 0) triggers.push(`boss:${enemy.boss}`);
  if (world.won) triggers.push('victory');
  return triggers.flatMap(trigger => STORY_SCENES.filter(s => s.trigger === trigger && !story.completed.includes(s.id)))[0];
}
const SCENE_FIGHTS: Record<string, { index: number; refs: [string, EnemyKind][] }> = {
  street_vat: { index: 0, refs: [['vat1', 'vatnik'], ['vat2', 'vatnik']] },
  arch: { index: 1, refs: [['omon1', 'omon'], ['vat1', 'vatnik']] },
  vestibule: { index: 0, refs: [['omon1', 'omon']] },
  wagon: { index: 0, refs: [['zek1', 'zek'], ['zek2', 'zek']] },
  mayak: { index: 0, refs: [['official', 'clerk']] },
  city: { index: 0, refs: [['info_f', 'info_f'], ['info_m', 'info_m']] },
};
function prepareScene(world: World, scene: NonNullable<ReturnType<typeof storyScene>>) {
  if (scene.id === 'milonov' && !world.actors.milonov) {
    world.actors.milonov = { id: 'milonov', look: 'milonov', x: scene.x!, y: 185, tx: scene.x!, ty: 185,
      facing: -1, anim: 'idle', speed: 0, keep: true };
  }
  const fight = SCENE_FIGHTS[scene.id];
  if (fight) prepareStoryEncounter(world, fight.index, scene.x!, fight.refs);
  if (scene.trigger.startsWith('boss:')) {
    const enemies = Object.values(world.enemies).filter(e => e.hp > 0);
    if (enemies.some(e => !e.storyWaiting)) {
      enemies.sort((a, b) => a.x - b.x);
      const right = world.enc.lock?.[1] ?? Math.max(...enemies.map(e => e.x)) + 12;
      placeStoryFormation(world, enemies, Math.min(...enemies.map(e => e.x), right - 12 - (enemies.length - 1) * 24));
    }
    for (const e of enemies) {
      e.storyWaiting = true; e.anim = 'idle'; e.animMs = 0; e.enterMs = 0;
      e.entered = true; e.entering = false; e.phase = 'none'; e.phaseMs = 0; e.token = undefined;
    }
  }
}
export function startStoryForWorld(story: StoryProgress, world: StoryWorld): boolean {
  const scene = pendingStory(story, world);
  if (!scene) return false;
  const alive = Object.values(world.players).filter(p => p.hp > 0 && p.connected && !p.away);
  if (!alive.length) return false;
  const full = 'pending' in world ? world as World : undefined;
  if (full) prepareScene(full, scene);
  const boss = scene.trigger.startsWith('boss:') ? Object.values(world.enemies).find(e => e.boss === scene.trigger.slice(5) && e.hp > 0) : undefined;
  const x = scene.x ?? (boss && 'x' in boss ? Number(boss.x) : undefined);
  const fight = SCENE_FIGHTS[scene.id];
  const speakers = full && fight ? Object.values(full.enemies).filter(e => e.hp > 0 && fight.refs.some(([ref]) => e.id.endsWith('--' + ref))) : [];
  const dialogueX = speakers.length ? Math.max(...speakers.map(e => e.x)) : x;
  const threshold = dialogueX === undefined ? undefined : Math.max(dialogueX - 220, full && fight ? encountersOf(full)[fight.index].arena[0] + 20 : 0);
  if (threshold !== undefined && world.storyStrict !== false && (!alive.length || alive.some(p => p.x < threshold))) return false;
  return startStory(story, scene.trigger, full);
}

// Единственное перемещение группы в сюжете разрешено только тестовым запуском.
export function testStoryScene(story: StoryProgress, world: World, id: string, strict: boolean): boolean {
  if (!TEST_TOOLS || !world.testTools || typeof strict !== 'boolean') return false;
  const scene = storyScene(id);
  if (!scene) return false;
  const vokzal = ROUTE.findIndex(stage => stage.id === 'vokzal');
  const stages: Record<string, number> = { shaman: 4, pizdulina: 4, katya: vokzal, withdrawal: vokzal, prologue: 0 };
  const stage = /^(stage|clear):/.test(scene.trigger) ? Number(scene.trigger.split(':')[1]) : stages[id] ?? 0;
  const fresh = createWorld(world.seed, true, 'route', stage);
  for (const old of Object.values(world.players)) {
    const p = addPlayer(fresh, old.id, old.char);
    p.connected = old.connected; p.away = old.away; p.viewX = old.viewX; p.viewW = old.viewW;
  }
  for (const key of Object.keys(world)) if (!(key in fresh)) delete (world as unknown as Record<string, unknown>)[key];
  Object.assign(world, fresh, { storyStrict: strict });
  testSummon(world); testHeal(world);
  const bossX: Record<string, number> = { shaman: 940, pizdulina: 1100, katya: VOKZAL_ARENA[1] - 20, withdrawal: VOKZAL_ARENA[1] - 20 };
  const fight = SCENE_FIGHTS[id];
  const anchor = Math.max((scene.x ?? bossX[id] ?? 320) - 150, fight ? encountersOf(world)[fight.index].arena[0] + 74 : 0);
  Object.values(world.players).forEach((p, i) => {
    // Герои встают вразброс (по x и y), а не стопкой; все правее порога строгой проверки x.
    Object.assign(p, clampToLane(world, anchor - i * 18, [205, 178, 232, 192][i % 4]), { god: true, connected: true, away: false, anim: 'idle', animMs: 0 });
  });
  Object.assign(story, createStoryProgress());
  const n = STORY_SCENES.indexOf(scene);
  story.completed = STORY_SCENES.slice(0, n).map(s => s.id);
  world.enc.index = world.enc.cleared = scene.trigger.startsWith('clear:') ? Number(scene.trigger.split(':')[2]) : 0;
  if (scene.trigger.startsWith('boss:')) {
    const boss = scene.trigger.slice(5);
    const encounters = encountersOf(world), index = encounters.findIndex(e => e.bosses?.some(id => id === boss));
    const encounter = encounters[index];
    world.enc.index = world.enc.cleared = index;
    world.enc.lock = [...encounter.arena]; world.enc.wave = encounter.waves.length - 1;
    world.enc.bossIndex = encounter.bosses!.findIndex(id => id === boss);
    step(world, {});
  }
  if (['leverage', 'sender'].includes(id)) {
    world.actors.milonov = { id: 'milonov', look: 'milonov', x: anchor + 160, y: 185, tx: anchor + 160, ty: 185, facing: -1, anim: 'idle', speed: 0, keep: true };
  }
  if (id === 'withdrawal') world.won = true;
  prepareScene(world, scene); stopStoryHeroes(world);
  if (fight) {
    const speakers = Object.values(world.enemies).filter(e => fight.refs.some(([ref]) => e.id.endsWith('--' + ref)));
    const near = Math.max(anchor, Math.max(...speakers.map(e => e.x)) - 160);
    Object.values(world.players).forEach((p, i) => Object.assign(p, clampToLane(world, near - i * 18, p.y)));
  }
  const boss = Object.values(world.enemies).find(e => e.boss === scene.trigger.slice(5));
  if (scene.trigger.startsWith('boss:') && boss) Object.values(world.players).forEach((p, i) => {
    Object.assign(p, clampToLane(world, boss.x - 150 - i * 18, p.y));
  });
  const xs = Object.values(world.players).map(p => p.x);
  world.storyCamX = (Math.min(...xs) + Math.max(...xs)) / 2;
  for (const p of Object.values(world.players)) { p.viewW = p.viewW ?? 600; p.viewX = Math.max(0, world.storyCamX - p.viewW / 2); }
  story.scene = id; story.index = 0;
  return true;
}
export function testStoryStrict(world: World, strict: boolean) {
  if (TEST_TOOLS && world.testTools && typeof strict === 'boolean') world.storyStrict = strict;
}

// Команды не могут пропустить act. Все клиенты получают уже рассчитанное состояние.
export function tickStory(story: StoryProgress, world: World, dtMs: number) {
  let left = Math.max(0, dtMs);
  while (story.scene) {
    const action = storyStep(story);
    if (action?.kind !== 'act' && action?.kind !== 'caption') { stepActors(world, left); return; }
    const key = storyStepKey(story);
    if (story.actKey !== key) {
      story.actKey = key;
      story.actMs = Math.max(0, action.ms ?? (action.kind === 'caption' ? Math.max(2200, 55 * STORY_CONTENT[action.id].length) : 0));
      if (action.kind === 'act') {
        if (action.do === 'focus') {
          const heroes = Object.values(world.players).filter(p => p.hp > 0);
          const xs = heroes.map(p => p.x);
          const center = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : action.x;
          world.storyCamX = center;
          story.actMs = Math.max(500, story.actMs);
        }
        else {
          const player = Object.values(world.players).find(p => p.char === action.actor);
          const hero = CHARACTERS.some(c => c.id === action.actor);
          const xs = Object.values(world.players).filter(p => p.hp > 0).map(p => p.x);
          const base = xs.length ? Math.max(...xs) : 0;
          const targetX = action.x === undefined ? undefined : clampToLane(world, action.x + (action.rel ? base : 0), action.y ?? 200).x;
          if (hero) {
            if (player && action.facing) player.facing = action.facing;
            story.actMs = 0;
          }
          else {
            if (action.do === 'spawn') {
              const x = targetX ?? 0;
              const y = action.y ?? 200;
              world.actors[action.actor] = { id: action.actor, look: action.look ?? action.actor,
                x, y, tx: x, ty: y, facing: action.facing ?? 1, anim: 'idle', speed: 0, keep: action.keep };
            }
            const actor = world.actors[action.actor];
            if (actor) {
              if (action.facing) actor.facing = action.facing;
              if (action.do === 'walk' || action.do === 'exit') {
                actor.tx = targetX ?? actor.x; actor.ty = action.y ?? actor.y;
                // Уход без координаты ведёт за край всех экранов, включая широкие.
                if (action.do === 'exit' && action.x === undefined) {
                  const players = Object.values(world.players).filter(p => p.connected && !p.away && p.hp > 0);
                  const widths = players.map(p => p.viewW ?? VIEW_W);
                  const center = world.storyCamX ?? base;
                  const edges = players.map(p => (p.viewX ?? center - (p.viewW ?? VIEW_W) / 2) + (actor.facing > 0 ? p.viewW ?? VIEW_W : 0));
                  actor.tx = actor.facing > 0 ? Math.max(actor.x, center + Math.max(VIEW_W, ...widths) / 2, ...edges) + ACTOR_EXIT_MARGIN
                    : Math.min(actor.x, center - Math.max(VIEW_W, ...widths) / 2, ...edges) - ACTOR_EXIT_MARGIN;
                }
                actor.speed = Math.hypot(actor.tx - actor.x, actor.ty - actor.y) * 1000 / Math.max(1, action.ms ?? 0);
                actor.anim = 'walk';
                if (!action.ms) { actor.x = actor.tx; actor.y = actor.ty; actor.anim = 'idle'; }
              }
              if (action.do === 'pose') actor.anim = action.pose ?? 'idle';
            }
          }
        }
      }
    }
    const elapsed = Math.min(left, story.actMs ?? 0);
    stepActors(world, elapsed); left -= elapsed; story.actMs = (story.actMs ?? 0) - elapsed;
    if (story.actMs > 0) return;
    if (action.kind === 'act' && action.do === 'exit') delete world.actors[action.actor];
    story.index++; story.actKey = undefined;
    applyStoryState(story, world);
  }
}
