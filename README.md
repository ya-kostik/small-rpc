# Small RPC

Простой RPC для проекта. Можно использовать как с HTTP, так и с сокетами, так и с любым другим транспортом.
Вытащен и допилен из RPC Redbone, работает на одном с ним протоколе.

## Установка
```sh
npm install small-rpc
```
или через Yarn
```sh
yarn add small-rpc
```

## Использование на сервере
Важно понимать, что библиотека использует `async`/`await` и вам понадобится NodeJS версии 8 или выше.
### Подключение
```javascript
const RPC = require('small-rpc');
const rpc = new RPC();

// Добавляем объект для вызова (module):
rpc.setModule('profile', new Profile());
```

```javascript
const { json, send } = require('micro');
// вызов механизма rpc, например, внутри модуля micro
module.exports = async (req, res) => {
  const action = json(req, { limit = '0.3mb', encoding = 'utf8' });
  try {
    send(res, 200, await rpc.call({ req, res }, action));
  } catch(err) {
    send(req, 500, 'Internal Server Error');
  }
};
```

### Валидация `action`
RPC валидирует `action` самостоятельно, и по-умолчанию стреляет обычным `Error`, если с `action` что-то не так.

Чтобы более точно отлавливать такие ошибки можно использовать свой наследник от `Error`.

```javascript
class MyError extends Error {};

RPC.Error = MyError;

const { json, send } = require('micro');
module.exports = async (req, res) => {
  const action = json(req, { limit = '0.3mb', encoding = 'utf8' });
  try {
    return send(res, 200, await rpc.call({ req, res }, action));
  } catch(err) {
    if (err.constructor === MyError) {
      return send(req, 400, MyError.message);
    }
    return send(req, 500, 'Internal Server Error');
  }
};
```

### Добавление библиотеки модулей
Вы можете добавлять объекты пачками, и разделять их на библиотеки.
```javascript
const RPC = require('small-rpc');
const rpc = new RPC();

// Добавляем модели mongoose в RPC
rpc.setLib('mongoose', mongoose.models);
```

Вы также можете дополнить любую библиотеку еще одним модулем:
```javascript
// Добавит модуль Profile в библиотеку mongoose
rpc.setModule('mongoose.Profile', Profile);
```

Если вы добавляете модуль, без указания библиотеки, он добавляется в библиотеку по-умолчанию — `main`.
Также если вызвать `setLib` с одним аргументом, и передать просто объект он будет записан как библиотека `main`.

```javascript
// Записываем модели mongoose как библиотеку `main`
rpc.setLib(mongoose.models);

// Добавляем объект для вызова profile (из которого мы будем вызывать методы) в библиотеку `main`
rpc.setModule('profile', new Profile());
```

### Middleware
Вы можете использовать `middleware` функции, чтобы определять уровни доступа и дополнительную бизнес-логику.

`Middleware` бывают четырех типов:
1. Все запросы
2. Для конкретной библиотеки
3. Для конкретного модуля
4. Для конкретного метода

Все они задаются через метод `use`
```javascript
rpc.use((payload, action) => {
  // Выполнится для всех запросов
});

rpc.use('main', (payload, action) => {
  // Выполнится для всех запросов к библиотеке `main`
});

rpc.use('mongoose', (payload, action) => {
  // Выполнится для всех запросов к библиотеке `mongoose`
});

rpc.use('mongoose.Profile', (payload, action) => {
  // Выполнится для всех запросов к библиотеке `mongoose` и модулю `Profile`
});

rpc.use('mongoose.Profile.login', (payload, action) => {
  // Выполнится для всех запросов к библиотеке `mongoose` и модулю `Profile` при вызове метода `login`
});
```

Чтобы остановить поток выполнения `middleware` нужно просто вернуть `false` из той `middleware` на которой вы хотите остановиться.

```javascript
rpc.use((payload, action) => {
  if (!action.jwt) return false;
});
```

## Возвращаемый `action`

После того как механизмы RPC отработают, метод `call` вернет специальный объект — `action`, который можно сразу отправить клиенту. Его анатомия:
```javascript
{
  "type": "@@client/rpc/RETURN",
  "id": "ID от запроса, если он был",
  "payload": "То что вернул метод"
}
```

Если во время выполнения `middleware` были остановлены, то `call` вернет `undefined`, вместо готового `action`. Вы можете использовать это в качестве признака того, что до вызова метода не дошло.

Любой метод из модуля будет вызван с `await`,  то есть методы могут возвращать `Promise` и в ответ попадет результат его штатного разрешения.

Если вы хотите, чтобы при возникновении ошибок автоматически генерировался возвращаемый `action`, используйте `safeCall` вместо обычного `call`. В таком случае при возникновении ошибки, которую можно перехватить, т. ч. асинхронной, будет сгенерирован `action`:
```javascript
{
  "type": "@@client/rpc/ERROR",
  "id": "ID от запроса, если он был",
  "payload": {
    "message": "Сообщение ошибки",
    "code": "Eсли у ошибки был код, то он тут будет"
  }
}
```
> `type` — может измениться в зависимости от входящего `action`.

Вы можете переопределить метод генерации ответов, для этого нужно заменить методы:
- `makeOutAction(result, inAction)` — для успешных вызовов
- `makeErrorAction(error, inAction)` — если возникла ошибка


## Анатомия входящего `action`
```json
{
  "type": "@@service/rpc/CALL",
  "id": "F12AE83",
  "lib": "main",
  "module": "main",
  "method": "echo",
  "arguments": ["Hello Redbone RPC"],
  "flat": true,
  "backType": null,
  "merge": false,
  "filter": null,
  "errorType": null
}
```

- `id` — запроса, задается клиентом. Будет прикладываться ко всем ответам протокола. Допустима строка до 24 символов, можно передать число, но в ответе, оно будет передано как строка.
- `lib` — имя библиотеки объектов, `main` — библиотека по-умолчанию
- `module` — имя модуля в библиотеке — `main`  — модуль по-умолчанию
- `method` — имя метода в библиотеке — обязательное поле
- `arguments` — любое значение которое будет передано в качестве аргумента метода, который будет вызван
- `flat` — если в `arguments` передать массив, а `flat` задать как `true`, то массив будет разложен по аргументам метода
- `backType` — тип который будет передан в ответном `action`, если `null` или поле не задано, то будет использован тип по-умолчанию
- `merge` — если передать как `true`, то ответные данные будут лежать в корне действия, а не поля `payload`. Учтите, что `type` и `id` могут быть перекрыты в этом случае. Если результатом выполнения метода оказался не объект, то `merge` не будет иметь действия, и данные все равно будут находиться внутри поля `payload`
- `filter` — массив полей, которые нужно вернуть, если в ответе от метода был получен объект
- `errorType` — тип который будет передан в ответном `action` когда произойдет ошибка вызова (catch любой ошибки). Если задать как `null` будет использован тип по-умолчанию. (Только при `safeCall` или ручном модерировании ошибок).
