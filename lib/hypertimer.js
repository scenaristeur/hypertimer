var util = require('./util');

// enum for type of timeout
var TYPE = {
  TIMEOUT: 0,
  INTERVAL: 1,
  TRIGGER: 2
};

/**
 * Create a new hypertimer
 * @param {Object} [options]  The following options are available:
 *                            rate: number The rate of speed of hyper time with
 *                                         respect to real-time in milliseconds
 *                                         per millisecond. By default, rate
 *                                         is 1. Note that rate can even be a
 *                                         negative number.
 */
function hypertimer(options) {
  // options
  var rate = 1;             // number of milliseconds per milliseconds

  // properties
  var running = false;   // true when running
  var realTime = null;   // timestamp. the moment in real-time when hyperTime was set
  var hyperTime = null;  // timestamp. the start time in hyper-time
  var timeouts = [];     // array with all running timeouts
  var timeoutId = null;  // currently running timer
  var idSeq = 0;         // counter for unique timeout id's

  // exported timer object with public functions and variables
  var timer = {};

  /**
   * Change configuration options of the hypertimer, or retrieve current
   * configuration.
   * @param {Object} [options]  The following options are available:
   *                            rate: number  The rate (in milliseconds per
   *                                          millisecond) at which the timer
   *                                          runs, with respect to real-time
   *                                          speed. By default, rate is 1.
   *                                          Note that rate can even be a
   *                                          negative number.
   * @return {Object} Returns the applied configuration
   */
  timer.config = function(options) {
    if (options) {
      if ('rate' in options) {
        var newRate = Number(options.rate);
        if (isNaN(newRate)) {
          throw new TypeError('rate must be a number');
        }
        // TODO: add option rate='discrete'
        hyperTime = timer.now();
        realTime = util.nowReal();
        rate = newRate;
      }
    }

    // reschedule running timeouts
    _schedule();

    // return a copy of the configuration options
    return {
      rate: rate
    };
  };

  /**
   * Set the time of the timer. To get the current time, use getTime() or now().
   * @param {number | Date} time  The time in hyper-time.
   */
  timer.setTime = function (time) {
    if (time instanceof Date) {
      hyperTime = time.valueOf();
    }
    else {
      var newTime = Number(time);
      if (isNaN(newTime)) {
        throw new TypeError('time must be a Date or number');
      }
      hyperTime = newTime;
    }

    // reschedule running timeouts
    _schedule();
  };

  /**
   * Returns the current time of the timer as a number.
   * See also getTime().
   * @return {number} The time
   */
  timer.now = function () {
    if (running) {
      // TODO: implement performance.now() / process.hrtime(time) for high precision calculation of time interval
      var realInterval = util.nowReal() - realTime;
      var hyperInterval = realInterval * rate;
      return hyperTime + hyperInterval;
    }
    else {
      return hyperTime;
    }
  };

  /**
   * Continue the timer.
   */
  timer['continue'] = function() {
    realTime = util.nowReal();
    running = true;

    // reschedule running timeouts
    _schedule();
  };

  /**
   * Pause the timer. The timer can be continued again with `continue()`
   */
  timer.pause = function() {
    hyperTime = timer.now();
    realTime = null;
    running = false;

    // reschedule running timeouts (pauses them)
    _schedule();
  };

  /**
   * Returns the current time of the timer as Date.
   * See also now().
   * @return {Date} The time
   */
// rename to getTime
  timer.getTime = function() {
    return new Date(timer.now());
  };

  /**
   * Get the value of the hypertimer. This function returns the result of getTime().
   * @return {Date} current time
   */
  timer.valueOf = timer.getTime;

  /**
   * Return a string representation of the current hyper-time.
   * @returns {string} String representation
   */
  timer.toString = function () {
    return timer.getTime().toString();
  };

  /**
   * Set a timeout, which is triggered when the timeout occurs in hyper-time.
   * See also setTrigger.
   * @param {Function} callback   Function executed when delay is exceeded.
   * @param {number} delay        The delay in milliseconds. When the rate is
   *                              zero, or the delay is smaller or equal to
   *                              zero, the callback is triggered immediately.
   * @return {number} Returns a timeoutId which can be used to cancel the
   *                  timeout using clearTimeout().
   */
  timer.setTimeout = function(callback, delay) {
    var id = idSeq++;
    var timestamp = timer.now() + delay;
    if (isNaN(timestamp)) {
      throw new TypeError('delay must be a number');
    }

    // add a new timeout to the queue
    _queueTimeout({
      id: id,
      type: TYPE.TIMEOUT,
      time: timestamp,
      callback: callback
    });

    // reschedule the timeouts
    _schedule();

    return id;
  };

  /**
   * Set a trigger, which is triggered when the timeout occurs in hyper-time.
   * See also getTimeout.
   * @param {Function} callback   Function executed when timeout occurs.
   * @param {Date | number} time  An absolute moment in time (Date) when the
   *                              callback will be triggered. When the rate is
   *                              zero, or the date is a Date in the past,
   *                              the callback is triggered immediately.
   * @return {number} Returns a triggerId which can be used to cancel the
   *                  trigger using clearTrigger().
   */
  timer.setTrigger = function (callback, time) {
    var id = idSeq++;
    var timestamp = Number(time);
    if (isNaN(timestamp)) {
      throw new TypeError('time must be a Date or number');
    }

    // add a new timeout to the queue
    _queueTimeout({
      id: id,
      type: TYPE.TRIGGER,
      time: timestamp,
      callback: callback
    });

    // reschedule the timeouts
    _schedule();

    return id;
  };


  /**
   * Trigger a callback every interval. Optionally, a start date can be provided
   * to specify the first time the callback must be triggered.
   * See also setTimeout and setTrigger.
   * @param {Function} callback         Function executed when delay is exceeded.
   * @param {number} interval           Interval in milliseconds. When interval
   *                                    is smaller than zero or is infinity, the
   *                                    interval will be set to zero and triggered
   *                                    with a maximum rate.
   * @param {Date | number} [firstTime] An absolute moment in time (Date) when the
   *                                    callback will be triggered the first time.
   *                                    By default, firstTime = now() + interval.
   * @return {number} Returns a intervalId which can be used to cancel the
   *                  trigger using clearInterval().
   */
  timer.setInterval = function(callback, interval, firstTime) {
    var id = idSeq++;

    var _interval = Number(interval);
    if (isNaN(_interval)) {
      throw new TypeError('interval must be a number');
    }
    if (_interval < 0 || !isFinite(_interval)) {
      _interval = 0;
    }

    var timestamp;
    if (firstTime != undefined) {
      timestamp = Number(firstTime);
      if (isNaN(timestamp)) {
        throw new TypeError('firstTime must be a Date or number');
      }
    }
    else {
      // firstTime is undefined or null
      timestamp = (timer.now() + _interval);
    }

    // add a new timeout to the queue
    _queueTimeout({
      id: id,
      type: TYPE.INTERVAL,
      time: timestamp,
      interval: _interval,
      //firstTime: timestamp,
      //occurrence: 0,
      callback: callback
    });

    // reschedule the timeouts
    _schedule();

    return id;
  };

  /**
   * Cancel a timeout
   * @param {number} timeoutId   The id of a timeout
   */
  timer.clearTimeout = function(timeoutId) {
    // find the timeout in the queue
    for (var i = 0; i < timeouts.length; i++) {
      if (timeouts[i].id === timeoutId) {
        // remove this timeout from the queue
        timeouts.splice(i, 1);

        // reschedule timeouts
        _schedule();
        break;
      }
    }
  };

  /**
   * Cancel a trigger
   * @param {number} triggerId   The id of a trigger
   */
  timer.clearTrigger = timer.clearTimeout;

  timer.clearInterval = timer.clearTimeout;

  /**
   * Returns a list with the id's of all timeouts
   * @returns {number[]} Timeout id's
   */
  timer.list = function () {
    return timeouts.map(function (timeout) {
      return timeout.id;
    });
  };

  /**
   * Clear all timeouts
   */
  timer.clear = function () {
    // empty the queue
    timeouts = [];

    // reschedule
    _schedule();
  };

  /**
   * Add a timeout to the queue. After the queue has been changed, the queue
   * must be rescheduled by executing _reschedule()
   * @param {{type: number, time: number, callback: Function}} params
   * @private
   */
  function _queueTimeout(params) {
    // insert the new timeout at the right place in the array, sorted by time
    if (timeouts.length > 0) {
      var i = timeouts.length - 1;
      while (i >= 0 && timeouts[i].time > params.time) {
        i--;
      }

      // insert the new timeout in the queue. Note that the timeout is
      // inserted *after* existing timeouts with the exact *same* time,
      // so the order in which they are executed is deterministic
      timeouts.splice(i + 1, 0, params);
    }
    else {
      // queue is empty, append the new timeout
      timeouts.push(params);
    }
  }

  /**
   * Reschedule all queued timeouts
   * @private
   */
  function _schedule() {
    var timeout;
    var next = timeouts[0];

    // cancel timer when running
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    if (running && next) {
      // schedule next timeout
      var time = next.time;
      var delay = time - timer.now();
      var realDelay = delay / rate;

      function trigger() {
        // execute all expired timeouts
        var intervals = [];
        while (timeouts.length > 0  &&
            ((timeouts[0].time <= time) || !isFinite(timeouts[0].time))) {
          timeout = timeouts[0];

          // execute the callback
          try {
            timeout.callback();
          } catch (err) {
            // silently ignore errors thrown by the callback
          }

          // in case of an interval we have to reschedule on next cycle
          if (timeout.type === TYPE.INTERVAL && timeouts[0] === timeout) {
            // timeout is not removed inside the callback, reschedule it
            intervals.push(timeout);
          }
          timeouts.shift();
        }

        // reschedule intervals
        for (var i = 0; i < intervals.length; i++) {
          timeout = intervals[i];
          // FIXME: adding the interval each occurrence will give round-off errors.
          //        however, when multliplying the firstTime with the number of occurrences,
          //        we cannot easily swith the rate at any time.
          //timeout.occurrence++;
          //timeout.time = timeout.firstTime + timeout.interval * timeout.occurrence * (rate < 0 ? -1 : 1);
          timeout.time += timeout.interval * (rate < 0 ? -1 : 1);
          _queueTimeout(timeout);
        }

        // initialize next round of timeouts
        _schedule();
      }

      timeoutId = setTimeout(trigger, realDelay);
    }
  }

  Object.defineProperty(timer, 'running', {
    get: function () {
      return running;
    }
  });

  timer.config(options);         // apply options
  timer.setTime(util.nowReal()); // set time as current real time
  timer.continue();              // start the timer

  return timer;
}

module.exports = hypertimer;