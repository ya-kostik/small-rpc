const isObject = require('lodash/isObject');
const isFunction = require('lodash/isFunction');
const pick = require('lodash/pick');
const TYPES = require('./RPC.TYPES');

/**
 * Middleware — is a function or object with call method
 * Receive: payload, action and rpc instance
 * Use it for your authorisation logic,
 * or other checks and preprocessings of action and payload
 * @typedef Middleware
 * @type {(Function|Object)}
 */


/**
 * Small remote procedure call lib
 * @class RPC
 * @prop {Object} libs — hash of all libs
 */
class RPC {
  constructor() {
    this.libs = {};
    this.before = {
      lib: {},
      module: {},
      method: {},
      event: {},
      all: []
    }
    this.types = RPC.TYPES;
    this.call = this.call.bind(this);
    this.safeCall = this.safeCall.bind(this);
  }

  /**
   * check, is name correct?
   * @param  {String} name your name
   * @return {RPC}         this
   */
  checkName(name) {
    if (typeof name !== 'string') {
      throw new TypeError('name is not a string');
    }
    if (!name.length) {
      throw new TypeError('name is empty');
    }
    return this;
  }

  /**
   * check, is module name correct?
   * @param  {String} name lib.module name
   * @return {Array}       name splited by dot
   */
  checkModuleName(name) {
    const split = name.split('.');
    if (split.length !== 2) {
      if (split.length !== 1) {
        throw new TypeError('invalid name of module, it should be string with two dot notated values');
      }
      split.unshift('main');
    }
    return split;
  }

  /**
   * return true, if middleware is a middleware
   * @param  {Middleware}  middleware function or object with call method
   * @return {Boolean}          result of test
   */
  isMiddleware(middleware) {
    if (!middleware) return false;
    if (isFunction(middleware)) return true;
    if (middleware && middleware.call) return true;
    return false;
  }

  /**
   * set lib for RPC
   * @param {String} [name='main'] of lib
   * @param {Object} lib  hash of modules to call
   * @return {RPC}        this
   */
  setLib(name, lib) {
    if (isObject(name)) {
      lib = name;
      name = 'main'
    }
    this.checkName(name);
    if (!isObject(lib)) throw new TypeError('lib is not an object');
    this.libs[name] = lib;
    return this;
  }

  /**
   * returns lib by name
   * @param  {String} [name='main'] of lib
   * @return {Object}          lib
   */
  getLib(name = 'main') {
    return this.libs[name] || null;
  }

  /**
   * returns module by "lib.module" name
   * @param  {String} name lib.module name
   * @return {Object|null} module
   */
  getModule(name) {
    this.checkName(name);
    const split = this.checkModuleName(name);
    const lib = this.getLib(split[0]);
    if (!lib) return null;
    const module = lib[split[1]];
    if (!isObject(module)) return null;
    return module;
  }

  /**
   * remove lib from RPC
   * @param  {String} name of lib
   * @return {RPC}         this
   */
  removeLib(name) {
    delete this.checkName(name).libs[name];
    return this;
  }

  /**
   * set module by doted name
   * if lib does not exists, create it
   * @param {String} name lib.module name
   * @param {Object} module to add
   */
  setModule(name, module) {
    this.checkName(name);
    const split = this.checkModuleName(name);
    if (!isObject(module)) throw new TypeError('module is not an object');
    let lib = this.libs[split[0]];
    if (!lib) {
      lib = {};
      this.libs[split[0]] = lib;
    }
    this.libs[split[0]][split[1]] = module;
  }

  /**
   * get middlewares by name and type
   * @param  {String} name          of lib or lib.module
   * @param  {String} [type='libs'] type of middlewares
   * @return {Array}                middlewares
   */
  _getMiddlewares(name, type = 'lib') {
    const place = this.before[type];
    let middlewares = place[name];
    if (!middlewares) {
      middlewares = [];
      place[name] = middlewares;
    }
    return middlewares;
  }

  /**
   * use middleware;
   * you can rpc.use(middleware) to add middleware for all libs,
   * rpc(lib, middleware) to add middleware for a specific lib by name,
   * rpc(module, middleware) to add middleware for a specific module,
   * by name with dot notation (lib.module)
   * @param  {String} name       of lib or name.lib
   * @param  {Middleware} middleware
   * @return {RPC}               this
   */
  use(name, middleware) {
    if (!middleware) {
      middleware = name;
      name = null;
    }
    if (!this.isMiddleware(middleware)) {
      throw new TypeError('Middleware is not a function');
    }
    if (!name) {
      this.before.all.push(middleware);
      return this;
    }
    this.checkName(name);
    const split = name.split('.');
    let middlewares;
    if (split.length === 1) {
      middlewares = this._getMiddlewares(name);
    } else if (split.length === 2) {
      this.checkModuleName(name);
      middlewares = this._getMiddlewares(name, 'module');
    } else if (split.length === 3) {
      this.checkModuleName(`${split[0]}.${split[1]}`);
      if (split[2] === '') throw new TypeError('name of method is invalid');
      middlewares = this._getMiddlewares(name, 'method');
    } else {
      throw new TypeError('name is invalid');
    }
    middlewares.push(middleware);
    return this;
  }

  /**
   * check action. Is it valid?
   * @param  {Object} action to validate
   * @return {RPC} this
   */
  checkCallAction(action) {
    if (!action.module) action.module = 'main';
    if (!action.method) action.method = 'main';
    if (action.event) {
      throw new RPC.Error('Event can\'t be set in CALL type');
    }
    return this;
  }

  /**
   * create doted path from action params
   * @param {Object} action
   * @param {Boolean} [isArray=false] path will be an array, not a string
   * @param {Boolean} [addMethod=false] add method or event into a path
   * @return {String|Array}
   */
  makePathFromAction(action, isArray = false, addMethod = false) {
    if (isArray) {
      let path = [];
      if (action.lib) path[0] = action.lib + '';
      else path[0] = 'main';
      path[1] = action.module + '';
      if (addMethod) {
        if (action.method) path[2] = action.method + '';
        else if (action.event) path[2] = action.event + '';
      }
      return path;
    }
    let path = '';
    if (action.lib) path += action.lib + '.';
    path += action.module;
    if (addMethod) {
      if (action.method) path += '.' + action.method;
      else if (action.event) path += '.' + action.event;
    }
    return path;
  }

  /**
   * call all midllewares for a specific action
   * @param  {Object}  payload of current rpc request
   * @param  {Object}  action
   * @param  {Array}   positions names of middlewares to call
   * @return {Promise}
   */
  async _callMiddlewares(payload, action, positions = ['all', 'lib', 'module', 'method']) {
    const [lib, module, method] = this.makePathFromAction(action, true, true);
    const names = { lib, module, method };
    let name = '';
    for (const position of positions) {
      let middlewares;

      if (position === 'all') {
        middlewares = this.before.all;
      } else {
        if (name.length) name += '.';
        if (position !== 'event') name += names[position];
        else name += names.method;
        middlewares = this.before[position][name];
      }

      if (!(middlewares && middlewares.length)) continue;
      for (const middleware of middlewares) {
        if (isFunction(middleware)) {
          // If middleware is a simple function
          if ((await middleware(payload, action, this)) === false) return false;
        } else if (isFunction(middleware.call)) {
          // If middleware is a object-like middleware
          if ((await middleware.call(payload, action, this)) === false) return false;
        }
      }
    }
    return true;
  }

  /**
   * Process action before making things with it
   * @param  {Object}  payload   of rpc request
   * @param  {Object}  action    action
   * @param  {Array}  positions  names of middlewares to call
   * @return {Promise}
   */
  async _processActionBefore(payload, action, positions) {
    const path = this.makePathFromAction(action);
    const resultFromMiddlewares = await this._callMiddlewares(payload, action, positions);
    if (resultFromMiddlewares === false) return;
    const module = this.getModule(path);
    if (!module) throw new RPC.Error('Module not found');
    return { module, path };
  }

  makeOutAction(result, inAction, type) {
    if (!type) type = this.types['client/rpc'].RETURN;
    const out = {};
    if (inAction.filter && Array.isArray(inAction.filter)) {
      if (isObject(result)) {
        result = pick(result, inAction.filter);
      }
    }
    if (inAction.merge && isObject(result)) {
      Object.assign(out, result);
    } else {
      out.payload = result;
    }
    if (inAction.backType && typeof inAction.backType === 'string') {
      out.type = inAction.backType;
    } else {
      out.type = type;
    }
    if (inAction.id !== undefined) out.id = inAction.id + '';
    return out;
  }

  /**
   * call method by action
   * @param  {Object} payload of rpc request
   * @param  {Object} action
   * @param  {String} action.type
   * @param  {String} [action.id]
   * @param  {String} action.backType
   * @param  {Mixed}  action.arguments
   * @param  {Boolean} action.flat
   * @param  {Boolean} action.merge
   */
  async call(payload, action) {
    this.checkCallAction(action);
    const beforeResult = await this._processActionBefore(payload, action);
    if (!beforeResult) return;
    const module = beforeResult.module;
    if (!isFunction(module[action.method])) {
      throw new RPC.Error('Method not found');
    }
    let result;
    if (action.flat && Array.isArray(action.arguments)) {
      result = await module[action.method](...action.arguments);
    } else if (action.arguments !== undefined) {
      result = await module[action.method](action.arguments);
    } else {
      result = await module[action.method]();
    }
    const out = this.makeOutAction(result, action);
    return out;
  }

  /**
   * make Error Action from In action and Error
   * @param  {Object} action in action
   * @param  {Error} err error
   * @return {Object} error action
   */
  makeErrorAction(err, inAction) {
    const errorAction = {
      type: (inAction && inAction.errorType) || this.types['client/rpc'].ERROR,
      payload: {
        message: err.message
      }
    };
    if (err.code) errorAction.payload.code = err.code;
    return errorAction;
  }

  /**
   * call method by action with auto wrap errors
   * @param  {Object} payload of rpc request
   * @param  {Object} action
   * @param  {String} action.type
   * @param  {String} [action.id]
   * @param  {String} action.backType
   * @param  {Mixed}  action.arguments
   * @param  {Boolean} action.flat
   * @param  {Boolean} action.merge
   */
  async safeCall(payload, action) {
    try {
      return await this.call(payload, action);
    } catch (err) {
      return this.catcher(err, action);
    }
  }

  /**
   * call when error on safeCall occurs
   * @param  {Error} err
   * @param  {Object} action
   * @return {Object} error action
   */
  catcher(err, action) {
    if (RPC.log && RPC.log.error) RPC.log.error('RPC Error', err);
    return this.makeErrorAction(err, action);
  }
}

RPC.Error = Error;
RPC.log = console;
RPC.TYPES = Object.freeze({
  'service/rpc': TYPES.service,
  'client/rpc': TYPES.client
});

module.exports = RPC;
