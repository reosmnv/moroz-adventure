import { storyScene, STORY_SCENES, type StoryStep } from './story-scenes.ts';

export interface StoryProgress { scene: string; index: number; completed: string[]; flags: Record<string, string> }
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

function applyStoryState(story: StoryProgress) {
  while (storyStep(story)?.kind === 'state') {
    const step = storyStep(story)!;
    if (step.kind === 'state') story.flags[step.id] = step.value;
    story.index++;
  }
  const scene = storyScene(story.scene);
  if (scene && story.index >= scene.steps.length) {
    story.completed.push(scene.id); story.scene = ''; story.index = 0;
  }
}

export function advanceStory(story: StoryProgress, key: string): boolean {
  if (!key || key !== storyStepKey(story) || !storyStep(story)) return false;
  story.index++;
  applyStoryState(story);
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
