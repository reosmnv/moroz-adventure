Главная проблема коммуникации: игра объясняет цель путешествия, но почти не объясняет управление и совместные действия. Особенно уязвимы приглашение друзей, заряд Рамиля, восстановление после падения и потери связи.

Это аудит текущего кода, только чтение. Литературное качество сценария не оцениваю. Длительности и условия показа подтверждены кодом; читаемость на телефоне и фактические перекрытия требуют визуальной проверки.

В цитатах `\n` означает перенос строки, `\u2014` обозначает исходное длинное тире. `{…}` обозначает подставляемое значение.

**1. Открыл ссылку → главное меню**

| Что видит игрок | Источник |
|---|---|
| «НЕСУЩЕСТВУЮЩАЯ» | [story.ts:1](/home/agent/games/birthday-coop/client/src/story.ts:1), [index.html:10](/home/agent/games/birthday-coop/client/index.html:10) |
| «кооп на четверых» | [index.html:59](/home/agent/games/birthday-coop/client/index.html:59) |
| «Новая игра», «Войти по коду», «Тест-режим», «Настройки» | [index.html:63](/home/agent/games/birthday-coop/client/index.html:63) |
| «Войти в комнату {код}», если ссылка содержит код | [main.ts:51](/home/agent/games/birthday-coop/client/src/main.ts:51) |
| «Продолжить · {код}», если сохранён действующий токен | [main.ts:47](/home/agent/games/birthday-coop/client/src/main.ts:47) |
| «Поверни телефон горизонтально» | [index.html:95](/home/agent/games/birthday-coop/client/index.html:95) |

Что понятно: новая игра и вход по коду различаются; приглашённому предлагается конкретная комната.

Что мешает:

- «кооп на четверых» можно прочитать как требование собрать ровно четырёх. Игра допускает до четырёх клиентов, включая двоих: [GameRoom.ts:82](/home/agent/games/birthday-coop/server/src/GameRoom.ts:82).
- «Войти в комнату» и «Продолжить» оформлены второстепенными кнопками, а «Новая игра» остаётся основной. Приглашённого подталкивают создать отдельную комнату.
- «Продолжить» выглядит как сохранение прохождения. Фактически это кратковременный возврат по токену с локальным сроком 60 секунд: [session.ts:127](/home/agent/games/birthday-coop/client/src/session.ts:127).
- Поворот телефона закрывает игру полноэкранным сообщением, но сам по себе не ставит её на паузу. Оверлей управляется CSS: [index.html:40](/home/agent/games/birthday-coop/client/index.html:40).
- При наличии приглашения, продолжения и тестового входа получается шесть кнопок. На низком горизонтальном экране нужно проверить доступность нижних действий. Прокрутка страницы отключена: [index.html:16](/home/agent/games/birthday-coop/client/index.html:16).

Чего не хватает: короткого объяснения «2–4 игрока, у каждого свой телефон» и приоритета приглашения.

Дополнительно: при установке на домашний экран название берётся из манифеста, где пока «Кооп: прототип» и «Кооп»: [manifest.webmanifest:2](/home/agent/games/birthday-coop/client/public/manifest.webmanifest:2).

**2. Новая игра онлайн / офлайн**

| Что видит игрок | Источник |
|---|---|
| «Новая игра» | [index.html:69](/home/agent/games/birthday-coop/client/index.html:69) |
| «С друзьями (онлайн)», «Одна на телефоне (офлайн)», «Назад» | [index.html:70](/home/agent/games/birthday-coop/client/index.html:70) |
| «Подключаюсь…» / «Загружаю…» | [main.ts:98](/home/agent/games/birthday-coop/client/src/main.ts:98) |
| «Не удалось: {техническая ошибка}» | [main.ts:112](/home/agent/games/birthday-coop/client/src/main.ts:112) |

Что понятно: совместная игра отделена от одиночной.

Что мешает:

- «Одна на телефоне» длиннее необходимого и адресовано только игроку женского рода.
- «С друзьями» не объясняет, что сначала создаётся комната, затем нужно отдельно отправить приглашение.
- «Офлайн» может обещать запуск сайта без интернета. В коде это локальная симуляция; гарантированной предварительной загрузки всех ресурсов через service worker не найдено.
- Сообщение загрузки находится в меню. После `startGame()` меню сразу скрывается, хотя Phaser ещё загружает ресурсы. Отдельного прогресса загрузки сцены нет: [main.ts:109](/home/agent/games/birthday-coop/client/src/main.ts:109), [scene.ts:68](/home/agent/games/birthday-coop/client/src/scene.ts:68).
- Ошибка подключения выводится как сообщение исключения. Причина и следующий шаг могут оказаться техническими или англоязычными.

Чего не хватает: «Создать комнату», объяснения приглашения, понятной ошибки и состояния загрузки до появления выбора героя.

Сообщения этого этапа видит только человек, который запускает игру.

**3. Позвал друга / друг вошёл по ссылке или коду**

| Что видит игрок | Источник |
|---|---|
| «Позвать друга», только внутри паузы онлайн | [index.html:85](/home/agent/games/birthday-coop/client/index.html:85), [main.ts:107](/home/agent/games/birthday-coop/client/src/main.ts:107) |
| «Код комнаты», сам код, поле ссылки | [index.html:90](/home/agent/games/birthday-coop/client/index.html:90) |
| «Скопировать», «Поделиться», «Назад» | [index.html:91](/home/agent/games/birthday-coop/client/index.html:91) |
| «Друг открывает ссылку или вводит код в меню» | [index.html:92](/home/agent/games/birthday-coop/client/index.html:92) |
| «Скопировано» / «Выдели и скопируй вручную» | [main.ts:204](/home/agent/games/birthday-coop/client/src/main.ts:204) |
| «Войти по коду», поле «КОД», «Войти», «Назад» | [index.html:72](/home/agent/games/birthday-coop/client/index.html:72) |
| «Код из 5 символов» | [main.ts:65](/home/agent/games/birthday-coop/client/src/main.ts:65) |

Что понятно: есть два способа приглашения, предусмотрен запасной способ копирования.

Что мешает:

- После создания комнаты игрок попадает к выбору героя и завязке. Приглашение до боя ему не предлагают.
- Чтобы найти приглашение, нужно догадаться открыть «Паузу».
- «Скопировать» не уточняет, копируется код или ссылка. Код расположен заметнее ссылки, поэтому ожидание может быть противоположным фактическому действию.
- Валидация требует пять латинских букв или цифр, а сообщает только длину.
- Длинная инструкция «Выдели и скопируй вручную» заменяет текст кнопки. Это уже инструкция, а не действие; она может раздвинуть строку кнопок.
- Ошибка системного «Поделиться» молча проглатывается вместе с отменой: [main.ts:198](/home/agent/games/birthday-coop/client/src/main.ts:198).
- Нет сообщений «Друг подключился», «Друг выбирает героя», количества участников или готовности команды.

Кто видит: окно приглашения только открывший его игрок. Остальные получают общую паузу, но не объяснение «друг отправляет приглашение». При входе гостя остальные видят героя после выбора, без отдельного уведомления.

Чего не хватает: предложения пригласить сразу после создания комнаты и ясного статуса состава команды.

**4. Выбор героя**

| Что видит игрок | Источник |
|---|---|
| «Кем играешь?», «Назад» | [index.html:82](/home/agent/games/birthday-coop/client/index.html:82) |
| «Анастасия», «Надежда», «Kris», «Рамиль» | [sim.ts:50](/home/agent/games/birthday-coop/shared/src/sim.ts:50), [sim.ts:51](/home/agent/games/birthday-coop/shared/src/sim.ts:51), [sim.ts:52](/home/agent/games/birthday-coop/shared/src/sim.ts:52), [sim.ts:53](/home/agent/games/birthday-coop/shared/src/sim.ts:53) |
| «сейчас», «занят» | [main.ts:158](/home/agent/games/birthday-coop/client/src/main.ts:158) |
| «Персонаж занят» | [session.ts:113](/home/agent/games/birthday-coop/client/src/session.ts:113), [GameRoom.ts:105](/home/agent/games/birthday-coop/server/src/GameRoom.ts:105) |

Что понятно: выбирается один из четырёх героев; занятые варианты отключены.

Что мешает:

- Портрет и имя не объясняют различия управления.
- Нажатие сразу подтверждает выбор. Во время ожидания сервера нет «Выбираем…».
- «Назад» при первом выборе выводит из комнаты в меню, при смене героя возвращает к паузе. Одинаковая подпись скрывает разные последствия.
- «Персонаж занят» используется и когда смена запрещена из-за перехода, вставки, смены фазы или победы: [sim.ts:286](/home/agent/games/birthday-coop/shared/src/sim.ts:286), [GameRoom.ts:113](/home/agent/games/birthday-coop/server/src/GameRoom.ts:113). Это ложная причина ошибки.
- При четырёх занятых героях поменяться персонажами нельзя через существующий выбор. Объяснения нет.

Чего не хватает: одной строки роли и особенностей каждого героя, например «Рамиль: захваты и телепорты. Суперприём заряжается перекуром».

Кто видит: каждый свой выбор; сведения о занятости общие.

**5. Завязка**

Точные тексты:

| Текст | Источник |
|---|---|
| «Уведомление» | [story.ts:5](/home/agent/games/birthday-coop/client/src/story.ts:5) |
| «Уважаемая Анастасия Мороз! По данным единого реестра вы не существуете. Ваша учётная запись удалена. Обжаловать решение можно лично в главном МФЦ.» | [story.ts:6](/home/agent/games/birthday-coop/client/src/story.ts:6) |
| «Как это не существую?!» | [story.ts:7](/home/agent/games/birthday-coop/client/src/story.ts:7) |
| «Подъезд 3. Утро.»; «Надя уже накрасилась. Kris зарядила камеру.»; «Настю надо вернуть в реестр.» | [story.ts:8](/home/agent/games/birthday-coop/client/src/story.ts:8) |
| «ПОГНАЛИ» | [story.ts:54](/home/agent/games/birthday-coop/client/src/story.ts:54) |

Цель понятна: добраться до главного МФЦ и вернуть Настю в реестр. Первый экран ждёт нажатия, поэтому ограничение времени чтения отсутствует.

Проблемы подачи:

- Второй экран печатает текст по 30 мс на символ. Касание ускоряет печать, но эта возможность не обозначена: [story.ts:39](/home/agent/games/birthday-coop/client/src/story.ts:39).
- «ПОГНАЛИ» обещает начало действия. Если гость закончил раньше создателя комнаты, сервер всё ещё держит завязку. Объяснения ожидания нет: [GameRoom.ts:161](/home/agent/games/birthday-coop/server/src/GameRoom.ts:161).
- Создатель может запустить мир, пока другие читают. Их герои остаются в состоянии `away`, но команда не видит причины.
- Вошедший после окончания общей завязки её не получает. Краткого напоминания цели и управления для него нет.
- Регистр интерфейсной кнопки «ПОГНАЛИ» выбивается из «Продолжить», «Назад», «Ещё раз».

Чего не хватает: «Коснись, чтобы показать текст целиком», «Ждём создателя комнаты» и краткого ввода для позднего участника.

**6. Бой и обучение управлению**

Тексты HUD:

| Текст | Источник |
|---|---|
| Имена героев; при достаточной ширине у напарников добавляются «2P», «3P», «4P» | [ui.ts:328](/home/agent/games/birthday-coop/client/src/ui.ts:328) |
| «{число} HP», на сжатой панели | [ui.ts:327](/home/agent/games/birthday-coop/client/src/ui.ts:327) |
| «1P» над своим героем; имя над чужим; резервная подпись «2P» | [scene.ts:467](/home/agent/games/birthday-coop/client/src/scene.ts:467) |
| «БОЙ {пройдено}/{всего}», «ВПЕРЁД» | [ui.ts:346](/home/agent/games/birthday-coop/client/src/ui.ts:346) |
| «{число} HITS!», только у Анастасии от пяти попаданий | [ui.ts:364](/home/agent/games/birthday-coop/client/src/ui.ts:364) |
| «Перекур», только у Рамиля | [ui.ts:261](/home/agent/games/birthday-coop/client/src/ui.ts:261) |
| «×4», «×8», «×16», «×32», «×64» как следующая ступень суперприёма Рамиля | [ui.ts:382](/home/agent/games/birthday-coop/client/src/ui.ts:382) |
| «ТЕСТ», только в тестовой комнате | [ui.ts:112](/home/agent/games/birthday-coop/client/src/ui.ts:112) |
| «!», предупреждение над врагом | [scene.ts:448](/home/agent/games/birthday-coop/client/src/scene.ts:448) |
| «-{урон}», «+{лечение}» | [scene.ts:584](/home/agent/games/birthday-coop/client/src/scene.ts:584), [scene.ts:338](/home/agent/games/birthday-coop/client/src/scene.ts:338) |

Подписи второй кнопки:

| Герой | Точные подписи | Источник |
|---|---|---|
| Анастасия | «Апперкот», «Кросс», «Добивание»; в превращении «Локоть с разворота», «Колено», «Ураган» | [hero-data.ts:198](/home/agent/games/birthday-coop/shared/src/hero-data.ts:198), [hero-data.ts:199](/home/agent/games/birthday-coop/shared/src/hero-data.ts:199); выбор подписи [ui.ts:468](/home/agent/games/birthday-coop/client/src/ui.ts:468) |
| Надежда | «Пощёчина», «По яйцам», «Самурай» | [hero-data.ts:196](/home/agent/games/birthday-coop/shared/src/hero-data.ts:196) |
| Kris | «Вспышка» | [hero-data.ts:200](/home/agent/games/birthday-coop/shared/src/hero-data.ts:200) |
| Рамиль | «Телепорт», «С разворота», «Огонь», «К ним» | [hero-data.ts:36](/home/agent/games/birthday-coop/shared/src/hero-data.ts:36) |

В словаре также есть «Суперман», «Хай-кик», «Колено в прыжке», но текущий выбор подписи второй кнопки их не использует. Это не действующие подсказки первой серии.

Основные пробелы:

- Нет обучения движению: стик появляется при касании слева, бег включается при отклонении почти до упора: [ui.ts:215](/home/agent/games/birthday-coop/client/src/ui.ts:215), [ui.ts:295](/home/agent/games/birthday-coop/client/src/ui.ts:295).
- У основной атаки и большинства специальных кнопок только иконки. Не объяснено, что для серии нужны повторные нажатия.
- «Серия A», «B», «U» встречаются в комментариях к коду, но буквенных подписей этих кнопок игрок не видит. Обучение через эти обозначения будет непонятным без дополнительной маркировки.
- Насмешка вызывается нажатием на собственный портрет. Портрет не обозначен как кнопка: [ui.ts:205](/home/agent/games/birthday-coop/client/src/ui.ts:205).
- Заряд у большинства героев растёт от попаданий. **У Рамиля попадания его не заряжают**, нужен удерживаемый перекур: [sim.ts:442](/home/agent/games/birthday-coop/shared/src/sim.ts:442), [sim.ts:970](/home/agent/games/birthday-coop/shared/src/sim.ts:970). Одно слово «Перекур» этого не объясняет.
- У Анастасии превращение и снежная буря тратят общий заряд. У Kris шар имеет отдельный заряд от вспышек. Одинаковая подача колец скрывает разные правила: [ui.ts:397](/home/agent/games/birthday-coop/client/src/ui.ts:397).
- «×4» у Рамиля можно принять за множитель урона. Это приглашение продолжить ступень ударами, но глагола нет. Окно продолжения составляет 0,8 секунды: [hero-data.ts:29](/home/agent/games/birthday-coop/shared/src/hero-data.ts:29).
- Полная, пульсирующая кнопка Рамиля без доступных целей может не сработать; объяснения нет: [sim.ts:944](/home/agent/games/birthday-coop/shared/src/sim.ts:944).
- «К ним» не объясняет, к кому произойдёт телепорт.
- Каждый игрок видит над собой «1P». Обсуждение «первый игрок» между четырьмя людьми становится ненадёжным.
- При сжатии панелей имена становятся размером 5 игровых пикселей, здоровье 6: [ui.ts:165](/home/agent/games/birthday-coop/client/src/ui.ts:165), [ui.ts:328](/home/agent/games/birthday-coop/client/src/ui.ts:328). Это существенный риск читаемости на небольшом телефоне.
- Длинная подпись «Локоть с разворота» размещается слева от кнопки без переноса и занимает часть боевого поля: [ui.ts:182](/home/agent/games/birthday-coop/client/src/ui.ts:182).

Кто видит: свои подсказки кнопок, счётчик попаданий и ступень суперприёма каждый видит индивидуально. Панели показывают всех, начиная с самого себя. Боевые события рассылаются всем, но слова над персонажами читаются только в пределах собственной камеры.

**Боевые реплики и всплывающие слова**

Все найденные группы:

| Тексты | Источник |
|---|---|
| «В эфире тишина. Сейчас будет громко»; «Дубль второй не понадобится» | [sim.ts:50](/home/agent/games/birthday-coop/shared/src/sim.ts:50) |
| «Ты точно ко мне?»; «Не строй планов»; «Шансов не было»; «Очередь занимай»; «А котик у тебя есть?» | [sim.ts:51](/home/agent/games/birthday-coop/shared/src/sim.ts:51) |
| «Свет плохой, давай ещё дубль»; «Стоп, снято»; «Улыбочку» | [sim.ts:52](/home/agent/games/birthday-coop/shared/src/sim.ts:52) |
| «Ща-ща, докурю»; «Не суетись»; «Я даже не встал толком»; «Перекур, мужики»; «Без нервов» | [sim.ts:53](/home/agent/games/birthday-coop/shared/src/sim.ts:53) |
| «Ща-ща, подождите, докурю»; «Минуту, я на перекуре»; «Не торопите»; «Ещё затяжечку»; «Сейчас-сейчас»; «Пять минут, мужики» | [hero-data.ts:34](/home/agent/games/birthday-coop/shared/src/hero-data.ts:34) |
| «Всё, погнали» при полном заряде Рамиля | [sim.ts:974](/home/agent/games/birthday-coop/shared/src/sim.ts:974) |
| «Прикрою!»; «Насть, я в кадре»; «Страховка на месте»; «Работаем вдвоём» | [hero-data.ts:182](/home/agent/games/birthday-coop/shared/src/hero-data.ts:182) |
| «Мальчики, не ссорьтесь» | [hero-data.ts:183](/home/agent/games/birthday-coop/shared/src/hero-data.ts:183) |
| «ВЖУХ», «ПОКА!», «Я ТУТ», «НА!» | [hero-data.ts:114](/home/agent/games/birthday-coop/shared/src/hero-data.ts:114), [hero-data.ts:115](/home/agent/games/birthday-coop/shared/src/hero-data.ts:115), [hero-data.ts:117](/home/agent/games/birthday-coop/shared/src/hero-data.ts:117), [hero-data.ts:118](/home/agent/games/birthday-coop/shared/src/hero-data.ts:118) |
| «БУМ!», «ВЖУХ!», «ОП!», «ХРЯСЬ!» | [hero-data.ts:124](/home/agent/games/birthday-coop/shared/src/hero-data.ts:124), [hero-data.ts:125](/home/agent/games/birthday-coop/shared/src/hero-data.ts:125), [hero-data.ts:127](/home/agent/games/birthday-coop/shared/src/hero-data.ts:127), [hero-data.ts:128](/home/agent/games/birthday-coop/shared/src/hero-data.ts:128); повторы [hero-data.ts:133](/home/agent/games/birthday-coop/shared/src/hero-data.ts:133) |
| «УРАГАН!» | [hero-data.ts:136](/home/agent/games/birthday-coop/shared/src/hero-data.ts:136) |
| «ХЛЯСЬ!», «БАМ!», «ШЛЁП!», «ОЙ!» | [hero-data.ts:140](/home/agent/games/birthday-coop/shared/src/hero-data.ts:140), [hero-data.ts:141](/home/agent/games/birthday-coop/shared/src/hero-data.ts:141), [hero-data.ts:143](/home/agent/games/birthday-coop/shared/src/hero-data.ts:143), [hero-data.ts:144](/home/agent/games/birthday-coop/shared/src/hero-data.ts:144) |
| «СТОП!», «ВЖУХ!» | [hero-data.ts:150](/home/agent/games/birthday-coop/shared/src/hero-data.ts:150), [hero-data.ts:151](/home/agent/games/birthday-coop/shared/src/hero-data.ts:151) |
| «СТРАЙК!»; «ВЖУХ»; «Я ТУТ» | [sim.ts:753](/home/agent/games/birthday-coop/shared/src/sim.ts:753), [sim.ts:836](/home/agent/games/birthday-coop/shared/src/sim.ts:836), [sim.ts:840](/home/agent/games/birthday-coop/shared/src/sim.ts:840) |
| «БУМ!», «БАХ!», «ХРЯСЬ!»; «ЛОВИ!»; «ОПА!»; «ПЫХ!» | [sim.ts:894](/home/agent/games/birthday-coop/shared/src/sim.ts:894), [sim.ts:908](/home/agent/games/birthday-coop/shared/src/sim.ts:908), [sim.ts:920](/home/agent/games/birthday-coop/shared/src/sim.ts:920), [sim.ts:934](/home/agent/games/birthday-coop/shared/src/sim.ts:934) |
| «ВЖЖЖЖ!» | [scene.ts:632](/home/agent/games/birthday-coop/client/src/scene.ts:632) |
| «2 УДАРА!», «4 УДАРА!», «8 УДАРОВ!», «16 УДАРОВ!», «32 УДАРА!», «64 УДАРА!» | [scene.ts:227](/home/agent/games/birthday-coop/client/src/scene.ts:227) |
| «ХВАТИТ.» на двух ступенях; «ВСЁ.»; «ВСЁ!»; «ВОН!»; «ШЕСТЬДЕСЯТ ЧЕТЫРЕ!» | [hero-data.ts:35](/home/agent/games/birthday-coop/shared/src/hero-data.ts:35) |

Комиксные слова исчезают примерно за 0,65 секунды: [scene.ts:137](/home/agent/games/birthday-coop/client/src/scene.ts:137). Для «БУМ!» это нормально; для «ШЕСТЬДЕСЯТ ЧЕТЫРЕ!» уже мало.

Пузыри реплик держатся 2 секунды, новая реплика того же персонажа заменяет предыдущую: [scene.ts:345](/home/agent/games/birthday-coop/client/src/scene.ts:345). Перекур выдаёт очередную реплику каждые 1,6 секунды. Для чтения длинной фразы одновременно с боем это тесно.

«Прикрою!» и «Страховка на месте» сопровождают атакующий шар, а не щит или лечение: [sim.ts:535](/home/agent/games/birthday-coop/shared/src/sim.ts:535). Как реплики персонажа допустимы, но использовать их как единственное объяснение способности нельзя. То же относится к «Всё, погнали» вместо явного сообщения о полном заряде.

**7. Знакомства с врагами**

| Имя | Подпись | Реплика | Источник |
|---|---|---|---|
| «ВАТНИК» | «Искренний. Тупой. Против всего.» | «Феминистка? Да ещё и с девушкой? В МОЁМ подъезде?!» | [intros.ts:3](/home/agent/games/birthday-coop/shared/src/intros.ts:3) |
| «ОМОН» | «Бьёт, кого скажут.» | «Нам сказали \u2014 мы бьём. Кого \u2014 неважно.» | [intros.ts:4](/home/agent/games/birthday-coop/shared/src/intros.ts:4) |
| «ОМОН СО ЩИТОМ» | «Стена. Буквально.» | «Проход закрыт. Причина \u2014 не положено.» | [intros.ts:5](/home/agent/games/birthday-coop/shared/src/intros.ts:5) |
| «ЗЭК» | «Освободился вчера. Работает за УДО.» | «Мне за тебя срок скостят. Ничего личного, сестрёнка.» | [intros.ts:6](/home/agent/games/birthday-coop/shared/src/intros.ts:6) |
| «ЧИНОВНИК» | «Представитель системы.» | «Вас нет в реестре. Значит, вас нет. Следующий!» | [intros.ts:7](/home/agent/games/birthday-coop/shared/src/intros.ts:7) |
| «ИНФОЦЫГАН» | «Проплачен. Дважды.» | «Мне заплатили за хейт. Курс «Как не существовать» \u2014 со скидкой!» | [intros.ts:8](/home/agent/games/birthday-coop/shared/src/intros.ts:8) |
| «ИНФОЦЫГАНКА» | «Тоже проплачена. Сторис уже снят.» | «Девочки, это заказ! Лайк, если тоже против Насти!» | [intros.ts:9](/home/agent/games/birthday-coop/shared/src/intros.ts:9) |
| «ШАМАН» | «Встаёт. Всегда.» | «Я русский! Я иду до конца! А ты \u2014 не существуешь.» | [intros.ts:10](/home/agent/games/birthday-coop/shared/src/intros.ts:10) |
| «ПИЗДУЛИНА ЕКАТЕРИНА» | «Блокирует всё, что видит.» | «Настя? Такой нет. Я проверила. Заблокировать.» | [intros.ts:11](/home/agent/games/birthday-coop/shared/src/intros.ts:11) |

Подача:

- Мир останавливается на вставку, это помогает чтению.
- Полная длительность 2,8 секунды: [sim.ts:37](/home/agent/games/birthday-coop/shared/src/sim.ts:37).
- Реплика раскрывается за первые 0,6 секунды: [scene.ts:736](/home/agent/games/birthday-coop/client/src/scene.ts:736).
- Любое касание игрового экрана посылает пропуск: [ui.ts:204](/home/agent/games/birthday-coop/client/src/ui.ts:204).
- Пропуск любого активного игрока сокращает вставку для всех до оставшихся максимум 0,3 секунды: [sim.ts:1570](/home/agent/games/birthday-coop/shared/src/sim.ts:1570).

Проблема: четыре игрока продолжают нажимать атаки, а вставка появляется внезапно. Она может исчезнуть прежде, чем команда прочитает имя. При этом кнопки «Пропустить» и объяснения коллективного действия нет.

Чего не хватает: защищённого времени чтения и отдельного управления пропуском.

С точки зрения обучения особенно не хватает объяснения щита. «Стена. Буквально.» не говорит, что помогает обход сзади. Блокирование действительно снижает фронтальный урон, но отдельный текстовый ответ на событие `block` не отображается: [sim.ts:407](/home/agent/games/birthday-coop/shared/src/sim.ts:407).

**8. Переходы локаций**

Карточки:

| Малая строка | Название | Источник |
|---|---|---|
| «08:47. НАСТЮ ТОЛЬКО ЧТО СТЁРЛИ» | «ПОДЪЕЗД 3» | [route-data.ts:15](/home/agent/games/birthday-coop/shared/src/route-data.ts:15) |
| «ДО МЕТРО 300 МЕТРОВ. И ТОЛПА» | «ДВОР» | [route-data.ts:43](/home/agent/games/birthday-coop/shared/src/route-data.ts:43) |
| «ТУРНИКЕТЫ НЕ ДЛЯ НЕСУЩЕСТВУЮЩИХ» | ««БЕГОВАЯ»» | [route-data.ts:65](/home/agent/games/birthday-coop/shared/src/route-data.ts:65) |
| «СЛЕДУЮЩАЯ СТАНЦИЯ: ПРОБЛЕМЫ» | «ВАГОН» | [route-data.ts:83](/home/agent/games/birthday-coop/shared/src/route-data.ts:83) |
| «СЕГОДНЯ КОНЦЕРТ. БИЛЕТОВ НЕТ» | ««МАЯКОВСКАЯ»» | [route-data.ts:98](/home/agent/games/birthday-coop/shared/src/route-data.ts:98) |
| «ТУТ ПРОДАЮТ КУРС «КАК СУЩЕСТВОВАТЬ»» | «МОСКВА-СИТИ» | [route-data.ts:121](/home/agent/games/birthday-coop/shared/src/route-data.ts:121) |
| «ОКНО 1. ПОСЛЕДНЯЯ ИНСТАНЦИЯ» | «ГЛАВНЫЙ МФЦ» | [route-data.ts:143](/home/agent/games/birthday-coop/shared/src/route-data.ts:143) |

Служебная навигация:

- «↓\nВЫХОД»: [scene.ts:747](/home/agent/games/birthday-coop/client/src/scene.ts:747).
- «→\nВЫХОД» / «→\nВПЕРЁД»: [scene.ts:756](/home/agent/games/birthday-coop/client/src/scene.ts:756).
- «СТАНЦИЯ!»: [scene.ts:764](/home/agent/games/birthday-coop/client/src/scene.ts:764).

Что понятно: направление движения и доступный выход подсвечиваются.

Что мешает:

- «БОЙ 0/3» означает число уже завершённых боёв, но грамматически выглядит номером текущего.
- Между боями HUD сохраняет «БОЙ n/m». Нет ясного различия «сейчас дерёмся» и «можно идти дальше».
- После зачистки вагона HUD уже говорит «ВПЕРЁД», хотя выход ещё ждёт остановки поезда 2,5 секунды: [sim.ts:36](/home/agent/games/birthday-coop/shared/src/sim.ts:36), [sim.ts:1780](/home/agent/games/birthday-coop/shared/src/sim.ts:1780).
- «СТАНЦИЯ!» показывается одну секунду и не сообщает действие. В эту секунду подсказки выхода специально скрыты: [scene.ts:938](/home/agent/games/birthday-coop/client/src/scene.ts:938).
- Для перехода достаточно одного живого активного игрока в зоне выхода. Остальным не объясняют, почему их перенесло: [sim.ts:1784](/home/agent/games/birthday-coop/shared/src/sim.ts:1784).
- Карточка занимает центр, живёт 1,73 секунды, из которых около 1,4 секунды остаётся между въездом и выездом. Она не останавливает бой: [stage.ts:6](/home/agent/games/birthday-coop/client/src/stage.ts:6), [stage.ts:99](/home/agent/games/birthday-coop/client/src/stage.ts:99).
- При позднем входе в локацию её карточка может пройти за выбором героя. Для стадий после первой откладывания карточки до выбора нет: [scene.ts:789](/home/agent/games/birthday-coop/client/src/scene.ts:789).

Кто видит: карточку каждый на своём клиенте при создании локации; переход общий. Стрелки зависят от собственной камеры.

Тексты окружения тоже участвуют в навигации:

| Надписи | Источник |
|---|---|
| «ПОДЪЕЗД 3», «ПОДЪЕЗД 4», «ПОДЪЕЗД 5» | [route-data.ts:35](/home/agent/games/birthday-coop/shared/src/route-data.ts:35), [route-data.ts:36](/home/agent/games/birthday-coop/shared/src/route-data.ts:36), [route-data.ts:37](/home/agent/games/birthday-coop/shared/src/route-data.ts:37) |
| «БЕГОВАЯ», «ВЫХОД 3» | [route-data.ts:58](/home/agent/games/birthday-coop/shared/src/route-data.ts:58), [route-data.ts:59](/home/agent/games/birthday-coop/shared/src/route-data.ts:59) |
| «ВЫХОД В ГОРОД», «БЕГОВАЯ», «К ПОЕЗДАМ» | [route-data.ts:75](/home/agent/games/birthday-coop/shared/src/route-data.ts:75), [route-data.ts:76](/home/agent/games/birthday-coop/shared/src/route-data.ts:76), [route-data.ts:77](/home/agent/games/birthday-coop/shared/src/route-data.ts:77) |
| «МАЯКОВСКАЯ» в двух местах | [route-data.ts:114](/home/agent/games/birthday-coop/shared/src/route-data.ts:114), [route-data.ts:115](/home/agent/games/birthday-coop/shared/src/route-data.ts:115) |
| «ГЛАВНЫЙ МФЦ» | [route-data.ts:136](/home/agent/games/birthday-coop/shared/src/route-data.ts:136) |
| «ВХОД», «ТАЛОНЫ», «ОХРАНА» | [route-data.ts:151](/home/agent/games/birthday-coop/shared/src/route-data.ts:151), [route-data.ts:152](/home/agent/games/birthday-coop/shared/src/route-data.ts:152), [route-data.ts:153](/home/agent/games/birthday-coop/shared/src/route-data.ts:153) |
| Номера «1», «2», «3», «4», «5», «6» | [route-data.ts:154](/home/agent/games/birthday-coop/shared/src/route-data.ts:154), далее по одной надписи на строках 155, 156, 157, 158, 159 |
| «ВАШ ТАЛОН\nА-000», «ОЖИДАЙТЕ\nВЫЗОВА», «ДЕТИ», «ФОТО», «АРХИВ» | [route-data.ts:160](/home/agent/games/birthday-coop/shared/src/route-data.ts:160), [route-data.ts:161](/home/agent/games/birthday-coop/shared/src/route-data.ts:161), [route-data.ts:162](/home/agent/games/birthday-coop/shared/src/route-data.ts:162), [route-data.ts:163](/home/agent/games/birthday-coop/shared/src/route-data.ts:163), [route-data.ts:164](/home/agent/games/birthday-coop/shared/src/route-data.ts:164) |
| Номера «7», «8», «9», «10», «11», «12» | [route-data.ts:165](/home/agent/games/birthday-coop/shared/src/route-data.ts:165), далее по одной надписи на строках 166, 167, 168, 169, 170 |
| «ВЫ НЕ\nСУЩЕСТВ.», «101», «РУКОВОДИТЕЛЬ», «102», «ОБЪЯВЛЕНИЯ» | [route-data.ts:171](/home/agent/games/birthday-coop/shared/src/route-data.ts:171), [route-data.ts:172](/home/agent/games/birthday-coop/shared/src/route-data.ts:172), [route-data.ts:173](/home/agent/games/birthday-coop/shared/src/route-data.ts:173), [route-data.ts:174](/home/agent/games/birthday-coop/shared/src/route-data.ts:174), [route-data.ts:175](/home/agent/games/birthday-coop/shared/src/route-data.ts:175) |
| «ПЕРЕРЫВ\n13-14», «АРХИВ 2», «ФОТО», «ГЛАВНОЕ ОКНО», «СТАТУС:\nНЕ СУЩ.», «ВЕРНУТЬ\nНАСТЮ» | [route-data.ts:176](/home/agent/games/birthday-coop/shared/src/route-data.ts:176), [route-data.ts:177](/home/agent/games/birthday-coop/shared/src/route-data.ts:177), [route-data.ts:178](/home/agent/games/birthday-coop/shared/src/route-data.ts:178), [route-data.ts:179](/home/agent/games/birthday-coop/shared/src/route-data.ts:179), [route-data.ts:180](/home/agent/games/birthday-coop/shared/src/route-data.ts:180), [route-data.ts:181](/home/agent/games/birthday-coop/shared/src/route-data.ts:181) |

«ОЖИДАЙТЕ ВЫЗОВА» выглядит инструкцией, хотя ожидание не продвигает игру. «ВАШ ТАЛОН А-000» расходится с финальным «ТАЛОН А-001». «ВЕРНУТЬ НАСТЮ» может выглядеть действием, но финал запускается зачисткой последнего боя, без взаимодействия с табличкой.

**9. Боссы**

| Текст | Источник |
|---|---|
| «ШАМАН», «ПИЗДУЛИНА ЕКАТЕРИНА» над полосой здоровья | [boss-data.ts:11](/home/agent/games/birthday-coop/shared/src/boss-data.ts:11), [boss-data.ts:12](/home/agent/games/birthday-coop/shared/src/boss-data.ts:12), отображение [scene.ts:529](/home/agent/games/birthday-coop/client/src/scene.ts:529) |
| «ВСТАЮ!» и «♪» во время концерта | [boss-show.ts:39](/home/agent/games/birthday-coop/client/src/boss-show.ts:39) |
| «ВСТАЮ!» при атаке | [scene.ts:198](/home/agent/games/birthday-coop/client/src/scene.ts:198) |
| «ЗАБЛОКИРОВАНО» | [scene.ts:203](/home/agent/games/birthday-coop/client/src/scene.ts:203) |
| «Я РУССКИЙ!» | [scene.ts:207](/home/agent/games/birthday-coop/client/src/scene.ts:207) |
| «ВСТАЮ ЕЩЁ РАЗ!» / «ДОСТУП ЗАПРЕЩЁН» при смене фазы | [scene.ts:212](/home/agent/games/birthday-coop/client/src/scene.ts:212) |
| «ОТМЕНЁН!» / «РАЗБЛОКИРОВАНО!» при победе | [scene.ts:212](/home/agent/games/birthday-coop/client/src/scene.ts:212) |
| «Я люблю только Катеньку» в ответ на поцелуй | [boss-data.ts:11](/home/agent/games/birthday-coop/shared/src/boss-data.ts:11) |

Что понятно: появился особый противник с большим запасом здоровья; победа отмечается.

Что мешает:

- Одинаковое «ВСТАЮ!» используется как концертная декорация и результат опасной атаки. Оно не может надёжно предупреждать об опасности.
- Боевые реплики появляются при исполнении атаки. Игроку нельзя полагаться на их чтение для уклонения.
- «ЗАБЛОКИРОВАНО» может означать заблокированный удар игрока или отключённое управление, хотя это эффект атаки босса.
- «ДОСТУП ЗАПРЕЩЁН» не объясняет переход к усиленной фазе.
- Поцелуй не действует на обоих боссов, но ответная реплика есть только у Шамана: [sim.ts:605](/home/agent/games/birthday-coop/shared/src/sim.ts:605).
- Нет объяснения, что подсвеченные области пола опасны.

Реплики атак держатся около 1,2 секунды: [scene.ts:189](/home/agent/games/birthday-coop/client/src/scene.ts:189). Концертные надписи появляются каждые 2,5 секунды и исчезают за 1,8 секунды: [boss-show.ts:38](/home/agent/games/birthday-coop/client/src/boss-show.ts:38).

Кто видит: события общие; полосу босса все, слова над ним только при попадании в свою камеру.

**10. Смерть / рестарт**

| Что видит игрок | Источник |
|---|---|
| Падение, пустое здоровье; отдельного объяснения нет | [sim.ts:1602](/home/agent/games/birthday-coop/shared/src/sim.ts:1602) |
| «ЗАНОВО: БОЙ {n}/{m}» | [scene.ts:407](/home/agent/games/birthday-coop/client/src/scene.ts:407) |

Правила по коду:

- Если активный напарник жив, упавший возвращается через 5 секунд с половиной здоровья.
- Если все активные игроки упали, происходит автоматический рестарт.
- Завершённые бои сохраняются; текущий бой или текущий этап босса перезапускается.
- Заряды сбрасываются.

Источники: [sim.ts:29](/home/agent/games/birthday-coop/shared/src/sim.ts:29), [sim.ts:1606](/home/agent/games/birthday-coop/shared/src/sim.ts:1606), [sim.ts:1755](/home/agent/games/birthday-coop/shared/src/sim.ts:1755).

Игроку эти правила не сообщены. Он может ждать помощи, нажимать всё подряд или искать перезапуск в меню.

Баннер рестарта держится 1,5 секунды и не создаёт отдельной паузы: [scene.ts:409](/home/agent/games/birthday-coop/client/src/scene.ts:409). Он занимает центр и закрывает часть возобновлённого боя. Номер отличается по смыслу от текущего HUD: «БОЙ 0/3» против «ЗАНОВО: БОЙ 1/3».

Кто видит: общий рестарт все. Личного сообщения упавшему и сообщения оставшимся в живых нет.

**11. Пауза / настройки / смена героя / выход**

| Текст | Источник |
|---|---|
| «Пауза», «Продолжить», «Сменить героя», «Настройки», «Позвать друга», «В главное меню» | [index.html:83](/home/agent/games/birthday-coop/client/index.html:83) |
| «Паузу поставил друг» | [main.ts:215](/home/agent/games/birthday-coop/client/src/main.ts:215) |
| «Звук»: «вкл» / «выкл» | [main.ts:176](/home/agent/games/birthday-coop/client/src/main.ts:176) |
| «Вспышки ударов»: «полные» / «мягкие» / «выкл» | [main.ts:177](/home/agent/games/birthday-coop/client/src/main.ts:177) |
| «Тряска экрана»: «вкл» / «выкл» | [main.ts:178](/home/agent/games/birthday-coop/client/src/main.ts:178) |
| «Настройки», «Назад» | [index.html:87](/home/agent/games/birthday-coop/client/index.html:87) |
| «Выйти?», «Прогресс встречи пропадёт», «Да», «Нет» | [index.html:88](/home/agent/games/birthday-coop/client/index.html:88) |

Что понятно: основные действия собраны в одном месте; текущие значения настроек видны.

Проблемы:

- Пауза общая, а снять её может любой участник: [GameRoom.ts:169](/home/agent/games/birthday-coop/server/src/GameRoom.ts:169). Текст не сообщает этого.
- «Друг» не идентифицирует одного из трёх напарников.
- Друг может возобновить бой, пока у человека открыты настройки, приглашение или выбор героя. Вложенный экран останется, явного сообщения о продолжении нет.
- Настройки локальны, но это не сказано. В общей паузе можно принять изменение за настройку всей комнаты.
- «Полные» и «мягкие» не вполне объясняют визуальную разницу.
- «Прогресс встречи» вводит новый термин вместо используемого «боя».
- Подтверждение выхода неточно. Офлайн игрок теряет всё текущее прохождение, а онлайн его выход не стирает прохождение оставшихся друзей: [session.ts:138](/home/agent/games/birthday-coop/client/src/session.ts:138), [GameRoom.ts:259](/home/agent/games/birthday-coop/server/src/GameRoom.ts:259).
- «Да» и «Нет» заставляют повторно читать вопрос; «Выйти» и «Остаться» яснее.
- Нет объяснения, что при смене сохраняются здоровье и основной заряд: [sim.ts:314](/home/agent/games/birthday-coop/shared/src/sim.ts:314).

**12. Потеря связи и ошибки**

| Текст | Где находится |
|---|---|
| «Связь потеряна», «Переподключиться», «В главное меню» | [index.html:89](/home/agent/games/birthday-coop/client/index.html:89) |
| «Переподключаюсь…» при ручном действии | [main.ts:135](/home/agent/games/birthday-coop/client/src/main.ts:135) |
| «Не удалось вернуться в комнату» | [main.ts:136](/home/agent/games/birthday-coop/client/src/main.ts:136) |
| «Срок возврата в комнату истёк» | [session.ts:184](/home/agent/games/birthday-coop/client/src/session.ts:184) |
| «связь потеряна, переподключаюсь…» | [session.ts:224](/home/agent/games/birthday-coop/client/src/session.ts:224) |
| «отключён, жду возврата в игру…» | [session.ts:234](/home/agent/games/birthday-coop/client/src/session.ts:234) |
| «переподключаюсь…» | [session.ts:245](/home/agent/games/birthday-coop/client/src/session.ts:245) |
| «не удалось вернуться: {ошибка}» | [session.ts:254](/home/agent/games/birthday-coop/client/src/session.ts:254) |
| «офлайн», «подключение…», «онлайн», «вышел» как служебные статусы | [session.ts:70](/home/agent/games/birthday-coop/client/src/session.ts:70), [session.ts:156](/home/agent/games/birthday-coop/client/src/session.ts:156), [session.ts:204](/home/agent/games/birthday-coop/client/src/session.ts:204), [session.ts:233](/home/agent/games/birthday-coop/client/src/session.ts:233) |

Ключевое различие: последние статусы хранятся в `session.status`, но выводятся только при `?debug`: [main.ts:219](/home/agent/games/birthday-coop/client/src/main.ts:219).

При `onDrop` меняется статус, но не включается оверлей потери связи. При ручном переподключении `connectionLost` также сбрасывается до результата. Поэтому обычный игрок может видеть замершую сцену без состояния «Восстанавливаем связь».

Дополнительные пробелы:

- При первом открытии окна потери связи пояснение может быть пустым.
- Не сообщено, что сервер держит место 60 секунд: [GameRoom.ts:78](/home/agent/games/birthday-coop/server/src/GameRoom.ts:78).
- После истечения срока предлагается снова переподключаться тем же способом, хотя нужен новый вход.
- Остальным игрокам отключение или уход в другое приложение передаётся лишь затемнением панели: [ui.ts:338](/home/agent/games/birthday-coop/client/src/ui.ts:338).
- Нет различения «комната не найдена», «комната заполнена», «сервер недоступен».
- Глобальные ошибки JavaScript выводятся сырым текстом в красной области, дописываются без ограничения и не имеют действия восстановления: [main.ts:29](/home/agent/games/birthday-coop/client/src/main.ts:29), [index.html:39](/home/agent/games/birthday-coop/client/index.html:39).

Это самый серьёзный участок: человек не понимает, ждать ли, перезагружать ли страницу или просить новую ссылку.

**13. Тестовая панель**

| Текст | Источник |
|---|---|
| «Тест-режим», «Онлайн», «Офлайн», «Назад» | [index.html:76](/home/agent/games/birthday-coop/client/index.html:76) |
| «Подъезд 3», «Двор», ««Беговая»», «Вагон», ««Маяковская»», «Москва-Сити», «Главный МФЦ» | Генерация из карточек: [main.ts:73](/home/agent/games/birthday-coop/client/src/main.ts:73), уточнения [main.ts:78](/home/agent/games/birthday-coop/client/src/main.ts:78) |
| «Сервер: {URL}» | [main.ts:53](/home/agent/games/birthday-coop/client/src/main.ts:53) |
| «ТЕСТ» | [index.html:49](/home/agent/games/birthday-coop/client/index.html:49) |
| «Заряд ульты», «+3 врага» | [index.html:52](/home/agent/games/birthday-coop/client/index.html:52) |
| «Убить врагов», «Вылечить всех» | [index.html:53](/home/agent/games/birthday-coop/client/index.html:53) |
| «Бессмертие: выкл» / «Бессмертие: вкл», «→ Локация» | [index.html:54](/home/agent/games/birthday-coop/client/index.html:54), [main.ts:213](/home/agent/games/birthday-coop/client/src/main.ts:213) |
| `{local/online} #{код} · {статус}\nfps {число} · ping {число} мс\ntick {число} · звук {состояние}` | [main.ts:221](/home/agent/games/birthday-coop/client/src/main.ts:221) |

Сейчас `TEST_TOOLS = true`, поэтому тестовый вход доступен из главного меню: [sim.ts:24](/home/agent/games/birthday-coop/shared/src/sim.ts:24). В обычной новой игре сама панель скрыта, это сделано правильно.

Проблемы текста:

- «Заряд ульты» выглядит названием параметра; действие лучше назвать глаголом.
- «→ Локация» не говорит, что происходит переход вперёд и затрагивает всю команду.
- «Бессмертие» действует на себя, «Вылечить всех» на команду. Разница адресатов выражена только у одной кнопки.
- Нажатие названия локации сразу запускает игру, хотя сетка и выделение могут восприниматься как выбор перед отдельным стартом.
- Технический URL здесь уместен для тестирования, но в подарочном входе тестовый раздел отвлекает.

**14. Финал → «Ещё раз»**

| Текст | Источник |
|---|---|
| «ОКНО 1 · ТАЛОН А-001» | [story.ts:11](/home/agent/games/birthday-coop/client/src/story.ts:11) |
| «Запись восстановлена. Анастасия Мороз существует.» | [story.ts:12](/home/agent/games/birthday-coop/client/src/story.ts:12) |
| «С днём рождения, Настя!» | [story.ts:13](/home/agent/games/birthday-coop/client/src/story.ts:13) |
| «Ты есть. И это лучшее, что случилось с этим реестром.»; «Твои Надя и Kris» | [story.ts:14](/home/agent/games/birthday-coop/client/src/story.ts:14) |
| «Ещё раз» | [story.ts:15](/home/agent/games/birthday-coop/client/src/story.ts:15) |

Разрешение цели понятно: запись восстановлена, игра закончилась поздравлением.

Проблемы действия и подачи:

- «Ещё раз» не перезапускает игру. Кнопка выводит конкретного игрока из комнаты в чистое меню: [scene.ts:484](/home/agent/games/birthday-coop/client/src/scene.ts:484), [session.ts:138](/home/agent/games/birthday-coop/client/src/session.ts:138).
- Четверо могут нажать её и независимо создать четыре комнаты. Как повторить вместе, не объяснено.
- Финал появляется после задержки, затем последовательно печатает строки; возможность ускорить печать не обозначена.
- Финал видят все, но каждый читает и закрывает его самостоятельно.
- «Твои Надя и Kris» не перечисляет Рамиля. Это требует решения автора подарка только в том случае, если подпись должна представлять всю команду. Автоматически менять её по числу игроков не следует.

**Итоговая таблица проблем и готовых формулировок**

«Блокер» ниже означает риск самостоятельно не вернуться в основной сценарий. Это оценка пользовательского пути, а не утверждение о воспроизведённом техническом падении.

| Проблема | Где | Серьёзность | Предложение с готовым текстом |
|---|---|---|---|
| Неясно, нужны ли ровно четверо | [index.html:59](/home/agent/games/birthday-coop/client/index.html:59) | важно | «Для 2–4 игроков. У каждого свой телефон». Одиночный режим обозначить отдельно. |
| Приглашение конкурирует с новой игрой | [main.ts:51](/home/agent/games/birthday-coop/client/src/main.ts:51) | важно | По ссылке основная кнопка «Присоединиться к друзьям», подпись «Комната {код}». |
| «Продолжить» обещает сохранение | [main.ts:47](/home/agent/games/birthday-coop/client/src/main.ts:47) | важно | «Вернуться в комнату {код}». Не называть краткий реконнект сохранением. |
| Приглашение спрятано в паузе | [index.html:85](/home/agent/games/birthday-coop/client/index.html:85) | важно | После создания: «Комната создана. Отправь ссылку друзьям». Действия «Позвать друзей», «Выбрать героя». |
| Неясные названия режима | [index.html:70](/home/agent/games/birthday-coop/client/index.html:70) | важно | «Создать комнату» и «Играть соло». Под соло: «Без подключения к игровому серверу». |
| Пустое ожидание загрузки | [main.ts:109](/home/agent/games/birthday-coop/client/src/main.ts:109), [scene.ts:68](/home/agent/games/birthday-coop/client/src/scene.ts:68) | важно | Держать «Загружаем игру…» до готовности сцены; при ошибке «Не удалось загрузить игру. Попробуй ещё раз». |
| Ошибки входа не дают выхода | [main.ts:112](/home/agent/games/birthday-coop/client/src/main.ts:112) | блокер | По причине: «Комната не найдена. Проверь код или попроси новую ссылку»; «В комнате уже 4 игрока»; «Не удалось связаться с сервером. Проверь интернет и попробуй ещё раз». |
| Неполное объяснение кода и копирования | [main.ts:65](/home/agent/games/birthday-coop/client/src/main.ts:65), [main.ts:204](/home/agent/games/birthday-coop/client/src/main.ts:204) | важно | «Введи 5 латинских букв или цифр»; кнопка «Копировать ссылку»; успех «Ссылка скопирована»; ошибку вынести рядом: «Не удалось скопировать. Выдели ссылку и скопируй вручную». |
| Герои без описания | [main.ts:155](/home/agent/games/birthday-coop/client/src/main.ts:155) | важно | «Анастасия: ближний бой и ледяная буря»; «Надежда: быстрые серии и поцелуй»; «Kris: вспышки и атаки издалека»; «Рамиль: захваты, телепорты и перекур». |
| Нет обучения базовым действиям | [ui.ts:203](/home/agent/games/birthday-coop/client/src/ui.ts:203) | важно | Три привязанные к элементам подсказки: «Веди пальцем слева, чтобы двигаться»; «Отклони стик до края, чтобы бежать»; «Нажимай кнопку удара несколько раз для серии». Повторный доступ через «Управление». |
| Неясно, как зарядить Рамиля | [ui.ts:261](/home/agent/games/birthday-coop/client/src/ui.ts:261), [sim.ts:970](/home/agent/games/birthday-coop/shared/src/sim.ts:970) | важно | «Удерживай «Перекур», чтобы зарядить суперприём». При готовности локально: «Суперприём готов». |
| Продолжение суперприёма не объяснено | [ui.ts:382](/home/agent/games/birthday-coop/client/src/ui.ts:382) | важно | Вместо одного «×4»: «Нажми ещё» и «4 удара». До первой активации: «Повторяй нажатия суперприёма, чтобы дойти до 64 ударов». |
| Разные заряды выглядят одинаково | [ui.ts:397](/home/agent/games/birthday-coop/client/src/ui.ts:397) | важно | Для Анастасии: «Превращение и буря используют общий заряд». Для Kris: «Попадания вспышкой заряжают шар». Давать в обучении, не постоянным абзацем над боем. |
| «1P», «HP», «HITS!» и неопределённое «К ним» | [scene.ts:467](/home/agent/games/birthday-coop/client/src/scene.ts:467), [ui.ts:327](/home/agent/games/birthday-coop/client/src/ui.ts:327), [hero-data.ts:36](/home/agent/games/birthday-coop/shared/src/hero-data.ts:36) | важно | «Ты» над своим героем; здоровье «{текущее}/{максимум}»; счётчик «Серия: {n}»; «К ним» → «К цели». Имя Kris сохранить. |
| Четыре панели слишком мелкие | [ui.ts:328](/home/agent/games/birthday-coop/client/src/ui.ts:328) | важно | Сохранить читаемый размер, сократить служебные подписи. Например «Ты» рядом со своей панелью вместо дополнительных номеров игроков. Проверить четырёх участников на узком экране. |
| Необъяснённое ожидание после завязки | [GameRoom.ts:165](/home/agent/games/birthday-coop/server/src/GameRoom.ts:165) | важно | «Ждём создателя комнаты». Для позднего входа: «Вы помогаете Насте добраться до главного МФЦ». |
| Случайный пропуск знакомства за всех | [ui.ts:204](/home/agent/games/birthday-coop/client/src/ui.ts:204), [sim.ts:1571](/home/agent/games/birthday-coop/shared/src/sim.ts:1571) | важно | Убрать пропуск обычным боевым касанием; после защищённого времени чтения показывать отдельную кнопку «Пропустить для всех». |
| Щит и опасные зоны не объяснены | [intros.ts:5](/home/agent/games/birthday-coop/shared/src/intros.ts:5), [scene.ts:518](/home/agent/games/birthday-coop/client/src/scene.ts:518) | важно | Для щита: «Обойди со спины». Перед первым боссом: «Уходи из подсвеченных зон на полу». |
| «БОЙ 0/3» и разные смыслы счётчиков | [ui.ts:346](/home/agent/games/birthday-coop/client/src/ui.ts:346), [scene.ts:407](/home/agent/games/birthday-coop/client/src/scene.ts:407) | важно | В бою «Бой 1/3», между боями «Дальше →», на рестарте «Повтор боя 1/3». Либо честный счётчик «Пройдено: 0/3», но не смешивать варианты. |
| Поезд велит идти до открытия выхода | [ui.ts:346](/home/agent/games/birthday-coop/client/src/ui.ts:346), [scene.ts:764](/home/agent/games/birthday-coop/client/src/scene.ts:764) | важно | Во время торможения «Поезд останавливается…», после «Выходи из вагона →». Перед общим переходом «Команда переходит дальше». |
| Карточки короткие и закрывают действие | [stage.ts:99](/home/agent/games/birthday-coop/client/src/stage.ts:99) | важно | Показать карточку до активного боя, затем оставить компактное название, например «Двор · К метро →». Не увеличивать время перекрытия продолжающегося боя. |
| Фоновые команды похожи на игровые | [route-data.ts:161](/home/agent/games/birthday-coop/shared/src/route-data.ts:161), [route-data.ts:181](/home/agent/games/birthday-coop/shared/src/route-data.ts:181) | важно | «ОЖИДАЙТЕ ВЫЗОВА» → «ЭЛЕКТРОННАЯ ОЧЕРЕДЬ». «ВЕРНУТЬ НАСТЮ» → «ВОССТАНОВЛЕНИЕ ЗАПИСИ». Талон унифицировать как «А-001». |
| Нет причины отказа способности на боссе | [sim.ts:605](/home/agent/games/birthday-coop/shared/src/sim.ts:605) | важно | При первом неудачном поцелуе: «На боссов поцелуй не действует». Реплику Шамана сохранить отдельно. |
| Смена фазы похожа на системный запрет | [scene.ts:212](/home/agent/games/birthday-coop/client/src/scene.ts:212) | важно | Дополнительная короткая подпись «Босс усилился». Слова персонажа оставить художественным слоем. |
| Падение не объясняет восстановление | [sim.ts:1602](/home/agent/games/birthday-coop/shared/src/sim.ts:1602) | важно | Упавшему «Вернёшься через {n} с, если напарник продержится»; живым «Продержитесь {n} с: {имя} вернётся». Нужен доступный клиенту таймер. |
| Рестарт не объясняет сохранённый прогресс | [scene.ts:407](/home/agent/games/birthday-coop/client/src/scene.ts:407) | важно | «Команда упала. Повтор боя 2/3». При первом поражении: «Пройденные бои сохранены». Показать до возобновления атак. |
| Область действия паузы и настроек скрыта | [main.ts:215](/home/agent/games/birthday-coop/client/src/main.ts:215) | важно | «Пауза для всех. Продолжить может любой». «Паузу поставил: {герой}». В настройках: «Только на этом телефоне». Возобновление не должно оставлять игрока без сообщения за закрывающим бой экраном. |
| Неверная причина отказа смены героя | [GameRoom.ts:115](/home/agent/games/birthday-coop/server/src/GameRoom.ts:115) | важно | Для занятости «Герой уже выбран другом». Для ограничения сцены «Сейчас сменить героя нельзя. Дождись конца сцены». При четырёх занятых героях «Все герои заняты. Обмен сейчас недоступен». |
| Неточное подтверждение выхода | [index.html:88](/home/agent/games/birthday-coop/client/index.html:88) | важно | Офлайн: «Выйти в меню? Это прохождение не сохранится». Онлайн: «Выйти из комнаты? Друзья смогут продолжить». Кнопки «Выйти», «Остаться». |
| Автовосстановление связи невидимо | [session.ts:224](/home/agent/games/birthday-coop/client/src/session.ts:224), [session.ts:245](/home/agent/games/birthday-coop/client/src/session.ts:245) | блокер | Сразу показывать «Восстанавливаем связь…». После возврата кратко «Ты снова в игре». Пока запрос выполняется, состояние не скрывать. |
| Истёкший возврат оставляет неверное действие | [session.ts:243](/home/agent/games/birthday-coop/client/src/session.ts:243) | блокер | «Время возврата истекло. Войди заново по ссылке или коду комнаты». Действие «Войти заново», если комната доступна, или «В главное меню». |
| Нет статуса отсутствующего друга | [ui.ts:338](/home/agent/games/birthday-coop/client/src/ui.ts:338) | важно | На панели «Нет связи» / «Отошёл». Краткие уведомления «{герой} вернулся», «{герой} вышел». |
| Сырая глобальная ошибка перекрывает игру | [main.ts:29](/home/agent/games/birthday-coop/client/src/main.ts:29) | важно | «Произошла ошибка. Попробуй перезагрузить игру». Действия «Перезагрузить», «Подробности». Техническую строку оставить в подробностях. |
| Тестовые действия неоднозначны | [index.html:52](/home/agent/games/birthday-coop/client/index.html:52) | косметика | «Зарядить суперприём», «Добавить 3 врагов», «Убрать всех врагов», «Вылечить команду», «Моё бессмертие: выкл», «Следующая локация». |
| «Ещё раз» обещает перезапуск | [story.ts:15](/home/agent/games/birthday-coop/client/src/story.ts:15), [scene.ts:484](/home/agent/games/birthday-coop/client/src/scene.ts:484) | важно | При текущем поведении кнопка «В главное меню». Под ней: «Чтобы сыграть вместе ещё раз, создайте новую комнату и отправьте друзьям ссылку». |
| Непоследовательное оформление | [story.ts:54](/home/agent/games/birthday-coop/client/src/story.ts:54), [main.ts:177](/home/agent/games/birthday-coop/client/src/main.ts:177), [manifest.webmanifest:2](/home/agent/games/birthday-coop/client/public/manifest.webmanifest:2) | косметика | «Погнали»; вспышки «Яркие / Мягкие / Выкл»; название установленной игры «НЕСУЩЕСТВУЮЩАЯ». |

Для терминологии предлагаю один набор: **бой, локация, команда, герой, суперприём, заряд суперприёма**. Буквы A/B/U оставить внутренними обозначениями кода. «Встреча» и «ульта» не нужны в интерфейсе, если остальная игра их не объясняет.

**Топ-10 правок к 07.11 по пользе и трудозатратам**

| Приоритет | Правка | Польза | Трудозатраты |
|---|---|---|---|
| 1 | Показать состояние связи при любом обрыве и понятный выход при истечении возврата | Не даёт принять временный обрыв за сломанную игру | Средние: состояния клиента и проверка сети |
| 2 | Добавить короткое обучение движению, повторным нажатиям и удержанию перекура | Открывает основные возможности всех героев; особенно критично для Рамиля | Средние |
| 3 | Предложить приглашение сразу после создания комнаты; «Копировать ссылку» | Позволяет собрать команду без объяснений автора подарка | Небольшие или средние |
| 4 | Заменить технические ошибки входа понятными причинами и действиями | Помогает войти по неверному, старому или заполненному коду | Небольшие |
| 5 | Объяснить падение и повтор боя; минимум статическим текстом, затем таймером | Убирает ожидание помощи и страх потери всего прохождения | Небольшие для текста, средние для таймера |
| 6 | Убрать случайный пропуск вставок боевыми касаниями | Даёт всем четверым увидеть знакомства и предупреждение о щите | Средние, нужна сетевая проверка |
| 7 | Исправить счётчик боя и состояния выхода из вагона | Убирает «нулевой бой» и ложную команду идти | Небольшие |
| 8 | Уточнить общую паузу, локальные настройки и подтверждение выхода | Предотвращает неожиданный выход и неверные ожидания команды | Небольшие; защита вложенных экранов потребует отдельной логики |
| 9 | Переименовать «Ещё раз» в «В главное меню» и объяснить повтор вместе | Завершает путь честным действием без четырёх случайных комнат | Минимальные |
| 10 | Проверить и упростить HUD на четырёх игроках: читаемые имена, «Ты», короткие подписи | Помогает узнавать себя и понимать кнопки в основной конфигурации подарка | Средние, нужна визуальная приёмка |

**Границы аудита и проверки**

Проверены все запрошенные файлы. В `ramil-tips.ts` находятся координаты кончика сигареты и рук, а не пользовательские подсказки. В `encounters.ts` нет самостоятельных текстов для игрока. `settings.ts` хранит значения; подписи настроек находятся в `main.ts`.

В старом режиме `old`, который обычное меню не запускает, дополнительно остаются:

- «ТЕСТ: МАНЕКЕН», «ВОЛНА {n}»: [ui.ts:346](/home/agent/games/birthday-coop/client/src/ui.ts:346).
- «ПОДЪЕЗД 3», «ПРОДУКТЫ», «ЦВЕТЫ», «МАГАЗИНЫ», «БЕГОВАЯ»: [level.ts:27](/home/agent/games/birthday-coop/client/src/level.ts:27), далее строки 28, 29, 30, 31.
- «УРОВЕНЬ 1», «ДОМ НА БЕГОВОЙ»: [level.ts:59](/home/agent/games/birthday-coop/client/src/level.ts:59), [level.ts:60](/home/agent/games/birthday-coop/client/src/level.ts:60).

Использованы `rg --files`, `rg -n`, `nl -ba`, чтение правил проекта и проверка `git diff --stat` / `git diff --numstat`. Последние две команды вернули пустой вывод. **Изменённых мной файлов нет.** Сборку, тесты, сервер и браузер не запускал: для этого аудита они не требовались. Скриншотов нет. Текст внутри растровых ассетов отдельно не распознавался.

Claude при приёмке стоит проверить: четыре клиента с разной скоростью чтения; вход после начала боя; случайные касания во вставках; обрыв и возврат до и после 60 секунд; снятие паузы другим игроком при открытых настройках; падение одного и всех; вагон; финал и выход каждого участника. В браузере отдельно проверить HUD и все меню при 667×375, более низкой видимой области и четырёх панелях. Читаемость на iPhone и звук проверяет mr.R.