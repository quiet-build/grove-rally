/**
 * Grove Rally — derived from Trigger Rally Online Edition
 * https://github.com/CodeArtemis/TriggerRally
 * Reviewed revision: 079ac53216b74598b652ce3bf11478beb5c6832b
 * Original author: jareiko / http://www.jareiko.net/
 * Copyright (C) 2012-2013 Code Artemis
 *
 * This file is a GPL-3.0 derivative: AMD define() wrappers were replaced with
 * ES modules so Vite can bundle it. Physics and helper logic are otherwise the
 * upstream source. Trigger Rally Content (maps, cars, art) is NOT included.
 */

import util from './util.js';
/**
 * @author jareiko / http://www.jareiko.net/
 */

  var exports = {};

  var on = function(topic, fn) {
    var handlers = this._handlers || (this._handlers = {});
    var handler = handlers[topic] || (handlers[topic] = []);
    handler.push(fn);
  };

  var off = function(topic, fn) {
    var handlers = this._handlers;
    if (!handlers) return;
    var handler = handlers[topic];
    if (!handler) return;
    var idx;
    while ((idx = handler.indexOf(fn)) != -1) {
      handler.splice(idx, 1);
    };
  };

  var trigger = function(topic) {
    var handlers = this._handlers;
    if (!handlers) return;
    var handler = handlers[topic];
    if (!handler) return;
    var args = util.arraySlice(arguments, 1);
    handler.forEach(function(fn) {
      fn.apply(null, args);
    });
  };

  exports.PubSub = function() {};
  exports.PubSub.mixin = function(obj) {
    obj.on = on;
    obj.off = off;
    obj.trigger = trigger;

    // Deprecated methods.
    obj.subscribe = on;
    obj.publish = trigger;
  };
  exports.PubSub.mixin(exports.PubSub.prototype);
export default /** @type {any} */ (exports);
