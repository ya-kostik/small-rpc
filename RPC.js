const isObject = require('lodash/isObject');
const isFunction = require('lodash/isFunction');
const pick = require('lodash/pick');

const PathMixin = require('./PathMixin');
const Inspector = require('./Inspector');

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
    this.before = new Inspector(this);
    this.after = new Inspector(this);
    this.types = RPC.TYPES;
    this.call = this.call.bind(this);
    this.safeCall = this.safeCall.bind(this);
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
    this.before.use(name, middleware);
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
   * Process action before making things with it
   * @param  {Object}  payload   of rpc request
   * @param  {Object}  action    action
   * @param  {Array}  positions  names of middlewares to call
   * @return {Promise}
   */
  async _processActionBefore(payload, action, positions) {
    const path = this.makePathFromAction(action);
    const resultFromMiddlewares = await this.before.call(payload, action, positions);
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
    // Before middlewares
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
    // After middlewares
    const afterResult = await this.after.call(payload, action, out);
    if (!afterResult) return;
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

module.exports = PathMixin(RPC);
