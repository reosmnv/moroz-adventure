import { CHARACTERS, stepActors, type World } from './sim.ts';
import { storyScene, STORY_SCENES, type StoryStep } from './story-scenes.ts';

export interface StoryProgress { scene: string; index: number; completed: string[]; flags: Record<string, string>; actKey?: string; actMs?: number }
export const createStoryProgress = (): StoryProgress => ({ scene: '', index: 0, completed: [], flags: {} });
export const storyStep = (story: StoryProgress): StoryStep | undefined => storyScene(story.scene)?.steps[story.index];
export const storyStepKey = (story: StoryProgress): string => story.scene ? `${story.scene}:${story.index}` : '';

export function startStory(story: StoryProgress, trigger: string): boolean {
  if (story.scene) return false;
  const scene = STORY_SCENES.find(s => s.trigger === trigger && !story.completed.includes(s.id));
  if (!scene) return false;
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
      for (const [id, actor] of Object.entries(world.actors)) if (!actor.keep || scene.id === 'sender') delete world.actors[id];
      world.storyCamX = undefined;
    }
  }
}

export function advanceStory(story: StoryProgress, key: string, world?: World): boolean {
  if (!key || key !== storyStepKey(story) || !storyStep(story) || storyStep(story)?.kind === 'act') return false;
  story.index++;
  applyStoryState(story, world);
  return true;
}

export function wantedStatus(world: { level: string; stage: number; enc: { cleared: number }; storyPizDown?: boolean }, story: StoryProgress) {
  if (world.level !== 'route' || story.flags.wanted === 'off') return { stars: 0, reward: 0 };
  const stage = world.stage, cleared = world.enc.cleared;
  const stars = stage >= 5 ? 5 : world.storyPizDown ? 4 : stage >= 3 || stage === 2 && cleared >= 1 ? 3
    : stage >= 1 || cleared >= 2 ? 2 : cleared >= 1 ? 1 : 0;
  const reward = stage >= 4 || stage === 3 && cleared >= 1 ? 500000 : stars >= 3 ? 150000 : 0;
  return { stars, reward };
}

export function startStoryForWorld(story: StoryProgress, world: {
  level: string; stage: number; won: boolean; enc: { cleared: number };
  enemies: Record<string, { boss?: string; hp: number }>;
}): boolean {
  if (world.level !== 'route' || story.scene) return false;
  const triggers = [`stage:${world.stage}`, `clear:${world.stage}:${world.enc.cleared}`];
  for (const enemy of Object.values(world.enemies)) if (enemy.boss && enemy.hp > 0) triggers.push(`boss:${enemy.boss}`);
  if (world.won) triggers.push('victory');
  return triggers.some(trigger => startStory(story, trigger));
}

// Команды не могут пропустить act. Все клиенты получают уже рассчитанное состояние.
export function tickStory(story: StoryProgress, world: World, dtMs: number) {
  let left = Math.max(0, dtMs);
  while (story.scene) {
    const action = storyStep(story);
    if (action?.kind !== 'act') { stepActors(world, left); return; }
    const key = storyStepKey(story);
    if (story.actKey !== key) {
      story.actKey = key; story.actMs = Math.max(0, action.ms ?? 0);
      if (action.do === 'focus') world.storyCamX = action.x;
      else {
        const player = Object.values(world.players).find(p => p.char === action.actor);
        const hero = CHARACTERS.some(c => c.id === action.actor);
        if (hero && !player) story.actMs = 0;
        else {
          if (action.do === 'spawn' || player && !world.actors[action.actor]) {
            const x = action.do === 'spawn' ? action.x ?? player?.x ?? 0 : player?.x ?? 0;
            const y = action.do === 'spawn' ? action.y ?? player?.y ?? 200 : player?.y ?? 200;
            world.actors[action.actor] = { id: action.actor, look: action.look ?? action.actor,
              x, y, tx: x, ty: y, facing: action.facing ?? 1, anim: 'idle', speed: 0, keep: action.keep };
          }
          const actor = world.actors[action.actor];
          if (actor) {
            if (action.facing) actor.facing = action.facing;
            if (action.do === 'walk' || action.do === 'exit') {
              actor.tx = action.x ?? actor.x; actor.ty = action.y ?? actor.y;
              actor.speed = Math.hypot(actor.tx - actor.x, actor.ty - actor.y) * 1000 / Math.max(1, action.ms ?? 0);
              actor.anim = 'walk';
              if (!action.ms) { actor.x = actor.tx; actor.y = actor.ty; actor.anim = 'idle'; }
            }
            if (action.do === 'pose') actor.anim = action.pose ?? 'idle';
          }
        }
      }
    }
    const elapsed = Math.min(left, story.actMs ?? 0);
    stepActors(world, elapsed); left -= elapsed; story.actMs = (story.actMs ?? 0) - elapsed;
    if (story.actMs > 0) return;
    if (action.do === 'exit') delete world.actors[action.actor];
    story.index++; story.actKey = undefined;
    applyStoryState(story, world);
  }
}
