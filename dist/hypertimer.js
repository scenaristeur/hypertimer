/**
 * hypertimer.js
 * https://github.com/enmasseio/hypertimer
 *
 * A timer running faster or slower than real-time, and in continuous or
 * discrete time.
 *
 * @version 0.0.1
 * @date    2014-07-14
 *
 * @license
 * Copyright (C) 2014 Almende B.V., http://almende.com
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy
 * of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define(factory);
	else if(typeof exports === 'object')
		exports["hypertimer"] = factory();
	else
		root["hypertimer"] = factory();
})(this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

  var HyperTimer = __webpack_require__(1);

  /**
   * Create a HyperTimer
   * @param {Object} [options]  The following options are available:
   *                            rate: Number The rate of speed of hyper time with
   *                                         respect to real-time in milliseconds
   *                                         per millisecond. By default, rate
   *                                         is 1. Note that rate can even be a
   *                                         negative number.
   * @returns {HyperTimer}
   */
  module.exports = function (options) {
    return new HyperTimer(options);
  };


/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

  var util = __webpack_require__(2);

  // enum for type of timeout
  var TYPE = {
    TIMEOUT: 0,
    INTERVAL: 1,
    TRIGGER: 2
  };

  /**
   * Create a new HyperTimer
   * @constructor
   * @param {Object} [options]  The following options are available:
   *                            rate: Number The rate of speed of hyper time with
   *                                         respect to real-time in milliseconds
   *                                         per millisecond. By default, rate
   *                                         is 1. Note that rate can even be a
   *                                         negative number.
   */
  function HyperTimer (options) {
    if (!(this instanceof HyperTimer)) {
      throw new SyntaxError('Constructor must be called with the new operator');
    }

    // TODO: make internal properties readonly?

    // options
    this.rate = 1;             // number of milliseconds per milliseconds

    // properties
    this.running = false;   // true when running
    this.realTime = null;   // timestamp. the moment in real-time when hyperTime was set
    this.hyperTime = null;  // timestamp. the start time in hyper-time

    this.timeouts = [];     // array with all running timeouts
    this.intervals = [];    // array with all running intervals
    this.timeout = null;    // running timer

    this.config(options);         // apply options
    this.setTime(util.nowReal()); // set time as current real time
    this.continue();              // start the timer
  }

  /**
   * Change configuration options of the hypertimer, or retrieve current
   * configuration.
   * @param {Object} [options]  The following options are available:
   *                            rate: Number The rate of speed of hyper time with
   *                                         respect to real-time in milliseconds
   *                                         per millisecond. By default, rate
   *                                         is 1. Note that rate can even be a
   *                                         negative number.
   * @return {Object} Returns the applied configuration
   */
  HyperTimer.prototype.config = function(options) {
    if (options) {
      if ('rate' in options) {
        var newRate = Number(options.rate);
        if (isNaN(newRate)) {
          throw new TypeError('Rate must be a number');
        }
        // TODO: add option rate='discrete'
        this.hyperTime = this.now();
        this.realTime = util.nowReal();
        this.rate = newRate;
      }
    }

    // reschedule running timeouts
    this._schedule();

    // return a copy of the configuration options
    return {
      rate: this.rate
    };
  };

  /**
   * Set the time of the timer. To get the current time, use getTime() or now().
   * @param {Number | Date} time  The time in hyper-time.
   */
  HyperTimer.prototype.setTime = function (time) {
    if (time instanceof Date) {
      this.hyperTime = time.valueOf();
    }
    else {
      var newTime = Number(time);
      if (isNaN(newTime)) {
        throw new TypeError('Time must be a Date or number');
      }
      this.hyperTime = newTime;
    }

    // reschedule running timeouts
    this._schedule();
  };

  /**
   * Returns the current time of the timer in hyper-time as a number.
   * See also getTime().
   * @return {number} The time
   */
  HyperTimer.prototype.now = function () {
    if (this.running) {
      // TODO: implement performance.now() / process.hrtime(time) for high precision calculation of time interval
      var realInterval = util.nowReal() - this.realTime;
      var hyperInterval = realInterval * this.rate;
      return this.hyperTime + hyperInterval;
    }
    else {
      return this.hyperTime;
    }
  };

  /**
   * Continue the timer.
   */
  HyperTimer.prototype.continue = function() {
    this.realTime = util.nowReal();
    this.running = true;

    // reschedule running timeouts
    this._schedule();
  };

  /**
   * Pause the timer. The timer can be continued again with `continue()`
   */
  HyperTimer.prototype.pause = function() {
    this.hyperTime = this.now();
    this.realTime = null;
    this.running = false;

    // reschedule running timeouts (pauses them)
    this._schedule();
  };

  /**
   * Returns the current time of the timer in hyper-time as Date.
   * See also now().
   * @return {Date} The time
   */
  // rename to getTime
  HyperTimer.prototype.getTime = function() {
    return new Date(this.now());
  };

  /**
   * Get the value of the hypertimer. This function returns the result of getTime().
   * @return {Date} current time
   */
  HyperTimer.prototype.valueOf = HyperTimer.prototype.getTime;

  /**
   * Return a string representation of the current hyper-time.
   * @returns {string} String representation
   */
  HyperTimer.prototype.toString = function () {
    return this.getTime().toString();
  };

  /**
   * Set a timeout, which is triggered after a delay is expired in hyper-time.
   * @param {{type: number, time: number, callback: Function}} params
   * @return {number} Returns an id which can be used to cancel the timeout.
   */
  HyperTimer.prototype._addTimeout = function(params) {
    var id = idSeq++;
    params.id = id; // TODO: not nice to adjust params.

    // insert the new timeout at the right place in the array, sorted by time
    if (this.timeouts.length > 0) {
      var i = this.timeouts.length - 1;
      while (i >= 0 && this.timeouts[i].time > params.time) {
        i--;
      }

      // insert the new timeout in the queue. Note that the timeout is
      // inserted *after* existing timeouts with the exact *same* time,
      // so the order in which they are executed is deterministic
      this.timeouts.splice(i + 1, 0, params);
    }
    else {
      // queue is empty, append the new timeout
      this.timeouts.push(params);
    }

    // schedule the timeouts
    this._schedule();

    return id;
  };

  /**
   * Set a timeout, which is triggered after a delay is expired in hyper-time.
   * See also setTrigger.
   * @param {Function} callback   Function executed when delay is exceeded.
   * @param {number} delay        The delay in milliseconds. When the rate is
   *                              zero, or the delay is smaller or equal to
   *                              zero, the callback is triggered immediately.
   * @return {number} Returns a timeoutId which can be used to cancel the
   *                  timeout using clearTimeout().
   */
  HyperTimer.prototype.setTimeout = function(callback, delay) {
    var timestamp = this.now() + delay;
    if (isNaN(timestamp)) {
      throw new TypeError('Delay must be a number');
    }

    return this._addTimeout({
      type: TYPE.TIMEOUT,
      time: timestamp,
      callback: callback
    });
  };

  /**
   * Set a trigger, which is triggered after a delay is expired in hyper-time.
   * See also getTimeout.
   * @param {Function} callback   Function executed when delay is exceeded.
   * @param {Date | number} time  An absolute moment in time (Date) when the
   *                              callback will be triggered. When the rate is
   *                              zero, or the date is a Date in the past,
   *                              the callback is triggered immediately.
   * @return {number} Returns a triggerId which can be used to cancel the
   *                  trigger using clearTrigger().
   */
  HyperTimer.prototype.setTrigger = function (callback, time) {
    var timestamp = Number(time);
    if (isNaN(timestamp)) {
      throw new TypeError('Time must be a Date or number');
    }

    return this._addTimeout({
      type: TYPE.TRIGGER,
      time: timestamp,
      callback: callback
    });
  };


  /**
   * Trigger a callback every interval. Optionally, a start date can be provided
   * to specify the first time the callback must be triggered.
   * See also setTimeout and setTrigger.
   * @param {Function} callback         Function executed when delay is exceeded.
   * @param {number} interval           Interval in milliseconds.
   * @param {Date | number} [firstTime] An absolute moment in time (Date) when the
   *                                    callback will be triggered the first time.
   *                                    By default, start = now() + interval.
   * @return {number} Returns a intervalId which can be used to cancel the
   *                  trigger using clearInterval().
   */
  HyperTimer.prototype.setInterval = function(callback, interval, firstTime) {
    // TODO: implement setInterval
  };

  /**
   * Reschedule all queued timeouts
   * @private
   */
  HyperTimer.prototype._schedule = function() {
    var me = this;
    var next = this.timeouts[0];
    if (this.running && next) {
      // schedule next timeout
      var time = next.time;
      var delay = time - this.now();
      var realDelay = delay / this.rate;

      function trigger() {
        // execute all expired timeouts
        while (me.timeouts.length > 0  &&
            ((me.timeouts[0].time <= time) || !isFinite(me.timeouts[0].time))) {
          var timeout = me.timeouts.shift();
          timeout.callback();
        }

        // initialize next round of timeouts
        me._schedule();
      }

      this.timeout = setTimeout(trigger, realDelay);
    }
    else {
      // cancel timer when running
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }
    }
  };

  /**
   * Cancel a timeout
   * @param {number} timeoutId   The id of a timeout
   */
  HyperTimer.prototype.clearTimeout = function(timeoutId) {
    // find the timeout in the queue
    for (var i = 0; i < this.timeouts.length; i++) {
      if (this.timeouts[i].id === timeoutId) {
        // remove this timeout from the queue
        this.timeouts.splice(i, 1);

        // reschedule timeouts
        this._schedule();
        break;
      }
    }
  };

  /**
   * Cancel a trigger
   * @param {number} triggerId   The id of a trigger
   */
  HyperTimer.prototype.clearTrigger = HyperTimer.prototype.clearTimeout;

  HyperTimer.prototype.clearInterval = HyperTimer.prototype.clearTimeout;

  // TODO: implement a function clear to clear all timeouts?

  // counter for unique timeout id's
  var idSeq = 0;

  module.exports = HyperTimer;


/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

  
  /* istanbul ignore else */
  if (typeof Date.now === 'function') {
    /**
     * Helper function to get the current time
     * @return {number} Current time
     */
    exports.nowReal = function () {
      return Date.now();
    }
  }
  else {
    /**
     * Helper function to get the current time
     * @return {number} Current time
     */
    exports.nowReal = function () {
      return new Date().valueOf();
    }
  }


/***/ }
/******/ ])
})
