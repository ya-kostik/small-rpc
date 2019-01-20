const isFunction = require('lodash/isFunction');
const PathMixin = require('./PathMixin');

class Inspector {
  constructor() {
    this.lib = {};
    this.module = {};
    this.method = {};
    this.event = {};
    this.all = [];
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

  use(name, middleware) {
    if (!middleware) {
      middleware = name;
      name = null;
    }
    if (!this.isMiddleware(middleware)) {
      throw new TypeError('Middleware is not a function');
    }
    if (!name) {
      this.all.push(middleware);
      return this;
    }
    this.checkName(name);
    const split = name.split('.');
    let middlewares;
    if (split.length === 1) {
      middlewares = this.get(name);
    } else if (split.length === 2) {
      this.checkModuleName(name);
      middlewares = this.get(name, 'module');
    } else if (split.length === 3) {
      this.checkModuleName(`${split[0]}.${split[1]}`);
      if (split[2] === '') throw new TypeError('name of method is invalid');
      middlewares = this.get(name, 'method');
    } else {
      throw new TypeError('name is invalid');
    }
    middlewares.push(middleware);
    return this;
  }

  /**
   * get middlewares by name and type
   * @param  {String} name          of lib or lib.module
   * @param  {String} [type='libs'] type of middlewares
   * @return {Array}                middlewares
   */
  get(name, type = 'lib') {
    const place = this[type];
    let middlewares = place[name];
    if (!middlewares) {
      middlewares = [];
      place[name] = middlewares;
    }
    return middlewares;
  }

  /**
   * call all midllewares for a specific action
   * @param  {Object}  payload of current rpc request
   * @param  {Object}  action
   * @param  {Mixed}   subload additional arguments for middleware
   * @param  {Array}   positions names of middlewares to call
   * @return {Promise}
   */
  async call(payload, action, subload = undefined, positions = ['all', 'lib', 'module', 'method']) {
    const [lib, module, method] = this.makePathFromAction(action, true, true);
    const names = { lib, module, method };
    let name = '';
    for (const position of positions) {
      let middlewares;

      if (position === 'all') {
        middlewares = this.all;
      } else {
        if (name.length) name += '.';
        if (position !== 'event') name += names[position];
        else name += names.method;
        middlewares = this[position][name];
      }

      if (!(middlewares && middlewares.length)) continue;
      for (const middleware of middlewares) {
        if (isFunction(middleware)) {
          // If middleware is a simple function
          if ((await middleware(payload, action, this, subload)) === false) return false;
        } else if (isFunction(middleware.call)) {
          // If middleware is a object-like middleware
          if ((await middleware.call(payload, action, this, subload)) === false) return false;
        }
      }
    }
    return true;
  }
}

module.exports = PathMixin(Inspector);
