// Сюжетные реплики sim, порядок героев: Настя, Надя, Kris, Рамиль.
import { STORY_CONTENT as T } from './story-content.ts';
export const LINES = {
  ready: ['Сейчас как могну', 'Сейчас бы в Париж', 'Свет. Камера…', 'Ну все погнали уже'],
  won: ['Следующий!', 'Скучно', 'Снято. Дальше', 'Ну вот, а вы нервничали'],
  friend: ['{имя}, вставай!', 'Не лежи, некрасиво', 'Держись, я рядом', 'Подъём, я прикрою. Наверное'],
  down: ['Звук пропал…', 'Ой', 'Камеру держите!', 'Я просто прилёг'],
  stage: ['Ещё не конец света', 'Пошли, пока тушь держится', 'Меняем локацию', 'Дальше без меня? Шучу'],
  last: { shaman: T['sh.last'], pizdulina: T['pz.last'] } as Record<string, string>,
  kiss: T['sh.tip'],
};
export const LINE_HEROES = ['anastasia', 'nadezhda', 'kris', 'ramil'];
export const CALL_NAMES = ['Насть', 'Надь', 'Kris', 'Рамиль'];
