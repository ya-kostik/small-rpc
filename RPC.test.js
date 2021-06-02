/* global test expect jest */

const RPC = require('./RPC');
// const EE = require('events');
// class MyEE extends EE {}

test('create rpc', () => {
  const rpc = new RPC();
  expect(rpc.libs).toBeDefined();
});

test('set, get, remove, replace rpc libs', () => {
  const rpc = new RPC();
  const lib = { a: {} };
  const lib2 = { b: {} };
  const lib3 = { c: {} };
  rpc.setLib('test', lib);
  expect(rpc.getLib('test')).toBe(lib);
  expect(rpc.getModule('test.a')).toBe(lib.a);
  rpc.setLib('test', lib2);
  expect(rpc.getLib('test')).toBe(lib2);
  rpc.setLib('test2', lib3);
  expect(rpc.getLib('test2')).toBe(lib3);
  rpc.removeLib('test2');
  expect(rpc.getLib('test2')).toBe(null);
  rpc.setLib(lib);
  expect(rpc.getLib('main')).toBe(lib);
  expect(rpc.getModule('pick.me')).toBe(null);
  expect(rpc.getModule('test.me')).toBe(null);
  // set invalid lib
  expect(() => rpc.setLib('main', null)).toThrow(new TypeError('lib is not an object'));
  expect(() => rpc.setLib(null, null)).toThrow(new TypeError('name is not a string'));
  expect(() => rpc.setLib('', null)).toThrow(new TypeError('name is empty'));
  expect(() => rpc.getModule('main.a.b.c')).
  toThrow(new TypeError('invalid name of module, it should be string with two dot notated values'));
  // get module returns main module
  expect(rpc.getLib()).toBe(lib);
  expect(rpc.getModule('a')).toBe(lib.a);
});

test('add module to the lib', () => {
  const rpc = new RPC();
  const lib = {};
  rpc.setLib(lib);
  const module = {};
  const module2 = {};
  rpc.setModule('a', module);
  expect(rpc.getModule('main.a')).toBe(module);
  rpc.setModule('b.a', module2);
  expect(rpc.getModule('b.a')).toBe(module2);
  expect(() => {
    rpc.setModule('c', null);
  }).toThrow(new TypeError('module is not an object'));
});

test('call to rpc', async () => {
  const echoMessage = 'echo';
  const module = {
    done(echo) {
      expect(echo).toBe(echoMessage);
      return echoMessage + '.' + echoMessage;
    },
    next(echo) {
      expect(echo).toBe(echoMessage + '.' + echoMessage);
      return echo + '.' + echoMessage;
    },
    merge(data) {
      expect(data).toBe(undefined);
      return { echo: true };
    },
    abc: () => ({ a: 'a', b: 'b', c: 'c' })
  }
  const rpc = new RPC();
  rpc.setModule('hello', module);
  // flat
  let result = await rpc.call({}, {
    module: 'hello',
    method: 'done',
    arguments: [echoMessage],
    flat: true
  });
  expect(result.payload).toBe(echoMessage + '.' + echoMessage);
  // no flat
  result = await rpc.call({}, {
    module: 'hello',
    method: 'next',
    arguments: result.payload
  });
  expect(result.payload).
  // merging
  toBe(echoMessage + '.' + echoMessage + '.' + echoMessage);
  result = await rpc.call({}, {
    module: 'hello',
    method: 'merge',
    merge: true
  });
  expect(result.echo).toBe(true);
  // backtyping
  result = await rpc.call({}, {
    module: 'hello',
    method: 'merge',
    backType: 'PONG'
  });
  expect(result.type).toBe('PONG');
  // filtering
  result = await rpc.call({}, {
    module: 'hello',
    method: 'abc',
    filter: ['a', 'b']
  });
  expect(result.payload.a).toBe('a');
  expect(result.payload.b).toBe('b');
  expect(result.payload.c).toBe(undefined);
  // filtering with merge
  result = await rpc.call({}, {
    module: 'hello',
    method: 'abc',
    merge: true,
    filter: ['a', 'b']
  });
  expect(result.a).toBe('a');
  expect(result.b).toBe('b');
  expect(result.c).toBe(undefined);
});

test('adding middlewares', async () => {
  const path = [
    'all middleware',
    'lib middleware',
    'module 1 middleware',
    'module 2 middleware',
    'module\'s 1 ping method middleware'
  ];
  const toBe = {
    [path[0]]: 3,
    [path[1]]: 2,
    [path[2]]: 2,
    [path[3]]: 1,
    [path[4]]: 2
  }
  const counter = {};
  const rpc = new RPC();
  rpc.use(() => {
    // all middleware
    if (!counter[path[0]]) counter[path[0]] = 0;
    counter[path[0]] += 1;
  });
  rpc.use('main', () => {
    // main lib middleware
    if (!counter[path[1]]) counter[path[1]] = 0;
    counter[path[1]] += 1;
  });
  rpc.use('main.module1', () => {
    if (!counter[path[2]]) counter[path[2]] = 0;
    counter[path[2]] += 1;
  });
  rpc.use('add.module2', () => {
    if (!counter[path[3]]) counter[path[3]] = 0;
    counter[path[3]] += 1;
  });
  rpc.use('main.module1.ping', () => {
    if (!counter[path[4]]) counter[path[4]] = 0;
    counter[path[4]] += 1;
  });
  expect(rpc.before.all.length).toBe(1);
  expect(rpc.before.lib.main).toBeDefined();
  expect(rpc.before.lib.main.length).toBe(1);
  expect(rpc.before.module['main.module1']).toBeDefined();
  expect(rpc.before.module['main.module1'].length).toBe(1);
  expect(rpc.before.module['add.module2']).toBeDefined();
  expect(rpc.before.module['add.module2'].length).toBe(1);
  rpc.setModule('module1', { ping() { return 'pong' } });
  rpc.setModule('add.module2', { pinging() { return 'ponging' } });
  await Promise.all([
    rpc.call({}, {
      module: 'module1',
      method: 'ping'
    }),
    rpc.call({}, {
      module: 'module1',
      method: 'ping'
    }),
    rpc.call({}, {
      lib: 'add',
      module: 'module2',
      method: 'pinging'
    })
  ]);
  expect(toBe).toEqual(counter);
});

test('stop middlewares', async () => {
  const rpc = new RPC();
  let counter = 0;
  rpc.use(() => {
    counter += 1;
    return false;
  });
  rpc.use(() => {
    counter += 1;
  });
  rpc.setModule('module1', { ping() { return 'pong' } });
  const result = await rpc.safeCall({}, {
    module: 'module1',
    method: 'ping'
  });
  expect(result).toBe(undefined);
  expect(counter).toBe(1);
});

test('safe call catch errors', async () => {
  const rpc = new RPC();
  RPC.log = null;
  let result = await rpc.safeCall({});
  expect(result.type).toBe(rpc.types['client/rpc'].ERROR);
  rpc.use(() => {
    const err = new Error('Hi! I am Error!');
    err.code = 400;
    throw err;
  });
  result = await rpc.safeCall({}, { method: 'hi' });
  expect(result.payload.code).toBe(400);
  RPC.log = console;
});

test('after middlewares', async () => {
  let counter = 0;
  const middleware = jest.fn(() => counter += 1);
  const rpc = new RPC();
  rpc.setModule('main', { hi: () => counter += 1 });
  RPC.log = null;
  rpc.after.use(middleware);
  let res = await rpc.call({}, { module: 'main', method: 'hi' });
  expect(middleware.mock.calls.length).toBe(1);
  // Before after middlewares it should be 1
  expect(res.payload).toBe(1);
  // After after middlewares =) it should be 2
  expect(counter).toBe(2);
  const stopMiddleware = jest.fn(() => false);
  rpc.after.use(stopMiddleware);
  res = await rpc.call({}, { module: 'main', method: 'hi' });
  expect(middleware.mock.calls.length).toBe(2);
  expect(counter).toBe(4);
  expect(res).not.toBeDefined();
});

test('after middlewares has result action', (cb) => {
  const rpc = new RPC();
  rpc.setModule('main', { hi: () => true });
  rpc.after.use((payload, action, rpc, out) => {
    expect(out.payload).toBe(true);
    cb();
  });
  rpc.call({}, { module: 'main', method: 'hi' });
});
