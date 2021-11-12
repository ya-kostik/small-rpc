/* global test expect */

const RPC = require('../RPC');
const Whitelist = require('./Whitelist');

test('Whitelist using', async () => {
  const whitelist = new Whitelist([
    'add.john'
  ]);
  const rpc = new RPC();

  let counter = 0;
  const add = () => counter += 1;

  const mainLib = {
    user: { hi: add, getPassword: add },
    group: { hi: add, getSecret: add }
  };

  const addLib = {
    me: { hi: add },
    john: { hi: add, bye: add }
  };

  rpc.use(whitelist);
  rpc.setLib(mainLib);
  rpc.setLib('add', addLib);

  // ok
  await rpc.call({}, { lib: 'add', module: 'john', method: 'hi' });
  // ok
  await rpc.call({}, { lib: 'add', module: 'john', method: 'bye' });

  expect(counter).toBe(2);
  counter = 0;

  whitelist.parseList({ main: { user: { hi: true } } }, false);

  // ok
  await rpc.call({}, { lib: 'add', module: 'john', method: 'hi' });
  // ok
  await rpc.call({}, { lib: 'add', module: 'john', method: 'bye' });
  // ok
  await rpc.call({}, { module: 'user', method: 'hi' });
  // not ok
  await rpc.call({}, { module: 'user', method: 'getPassword' });

  expect(counter).toBe(3);
  counter = 0;

  whitelist.parseList(new Map([
    ['main.user.hi', true],
    ['main.group', (payload, action) => !!action.token],
    ['add', true],
    // should replace “add: true” record
    ['add.me.hi', false]
  ]));
  // not ok
  await rpc.call({}, { lib: 'add', module: 'me', method: 'hi' });
  // not ok
  await rpc.call({}, { module: 'group', method: 'getSecret' });
  // ok
  await rpc.call({}, { module: 'group', method: 'getSecret', token: true });
  // ok
  await rpc.call({}, { module: 'group', method: 'hi', token: true });
  // not ok
  await rpc.call({}, { module: 'user', method: 'getPassword' });
  // ok
  await rpc.call({}, { module: 'user', method: 'hi' });
  await rpc.call({}, { lib: 'invalid', module: 'invalid', method: 'invalid' });
  expect(counter).toBe(3);
  counter = 0;
  // not ok
  expect(await rpc.call({}, { module: 'user', method: 'toString' })).toBeUndefined();
});
