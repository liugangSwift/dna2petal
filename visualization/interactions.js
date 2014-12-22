/*
 * @auther: Seven Lju
 * @date:   2014-12-22
 * Petal Interaction
 *   callback : mouse event callback, e.g. {mousemove: function (target, positions, extra) { ... }}
 *              positions = [x, y] or [x, y, t] or [[x1, y1], [x2, y2], ...] or [[x1, y1, t1], [x2, y2, t2], ...]
 */
function PetalInteraction(callback) {

  var config = {
    axis: {
      x: 'clientX',
      y: 'clientY'
    },
    hold: {
      enable: true,
      last: 1000        /* ms */,
      tolerance: 5      /* px */
    },
    combo: {
      enable: true,
      holdable: false   /* hold for seconds and combo */,
      timingable: false /* count time for combo interval */,
      tolerance: -1     /* px, combo click (x,y) diff */,
      timeout: 200      /* ms, timeout to reset counting */
    }
  };

  var target = null;
  var state = {}, lock = {};
  interaction_init();
  if (!callback) callback = {};

  function interaction_init() {
    state.hold = null;
    state.combo = null;

    if (lock.checkHold !== null) clearTimeout(lock.checkHold);
    if (lock.checkCombo !== null) clearTimeout(lock.checkCombo);
    lock.holdBeatCombo = false;
    lock.mouseDown = false;
    lock.checkHold = null;
    lock.checkCombo = null;
  }

  function clone_mouse_event(e) {
    var result = {
      type: e.type,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      button: e.which || e.button
    };
    result[config.axis.x] = e[config.axis.x];
    result[config.axis.y] = e[config.axis.y];
    return result;
  }

  function check_distance(x0, y0, x, y, d) {
    if (d < 0) return false;
    var dx = x - x0, dy = y - y0;
    return Math.sqrt(dx*dx+dy*dy) > d;
  }

  function check_combo() {
    switch (state.combo.count) {
    case 0: // move out and then in
      break;
    case 1: // click
      if (callback.click) callback.click(target, state.combo.positons[0]);
      break;
    case 2: // double click
      if (callback.dblclick) callback.dblclick(target, state.combo.positions);
      break;
    default: // combo click
      if (callback.comboclick) callback.comboclick(target, state.combo.positions);
    }
    lock.holdBeatCombo = false;
    state.combo = null;
    lock.checkCombo = null;
  }

  function check_hold() {
    if (lock.mouseDown) {
      if (callback.mousehold) callback.mousehold(target, [state.hold.x, state.hold.y]);
      if (!config.combo.holdable) lock.holdBeatCombo = true;
    }
   lock.checkHold = null;
  }

  function do_combo_down(x, y) {
    if (!lock.mouseDown) return;
    if (lock.checkCombo !== null) clearTimeout(lock.checkCombo);
    if (!state.combo) state.combo = {count: 0, positions: []};
    state.combo.x = x;
    state.combo.y = y;
    state.combo.timestamp = new Date().getTime();
    state.combo.count ++;
  }

  function do_combo_up(x, y) {
    if (!state.combo) return;
    var pos = [x, y];
    if (config.combo.timingable) {
      pos[2] = new Date().getTime() - state.combo.timestamp;
    }
    state.combo.positions.push(pos);
    if (config.combo.tolerance >= 0) {
      if (check_distance(state.combo.x, state.combo.y,
                         x, y, config.combo.tolerance)) {
        // mouse moved
        check_combo();
        return;
      }
    }
    if (!config.combo.holdable) {
      if (lock.holdBeatCombo) {
        // mouse hold
        check_combo();
        return;
      }
    }
    lock.checkCombo = setTimeout(check_combo, config.combo.timeout);
  }

  function do_hold(x, y, checkMoved) {
    // if mouse not down, skip
    if (!lock.mouseDown) return;
    if (checkMoved !== true) checkMoved = false;
    if (checkMoved) {
      // if move a distance and stop to hold
      if (!check_distance(state.hold.x, state.hold.y,
                          x, y, config.hold.tolerance)) {
        return;
      }
    }
    // recount time
    if (lock.checkHold !== null) clearTimeout(lock.checkHold);
    if (!state.hold) state.hold = {};
    state.hold.x = x;
    state.hold.y = y;
    lock.checkHold = setTimeout(check_hold, config.hold.last);
  }

  function event_mousedown(e) {
    var x = e[config.axis.x], y = e[config.axis.y];
    lock.mouseDown = true;
    if (config.hold.enable) do_hold(x, y, false);
    if (config.combo.enable) do_combo_down(x, y);
    if (callback.mousedown) callback.mousedown(target, [x, y], clone_mouse_event(e));
  }

  function event_mousemove(e) {
    var x = e[config.axis.x], y = e[config.axis.y];
    if (config.hold.enable) do_hold(x, y, true);
    if (callback.mousemove) callback.mousemove(target, [x, y], clone_mouse_event(e));
  }

  function event_mouseup(e) {
    var x = e[config.axis.x], y = e[config.axis.y];
    if (config.combo.enable) do_combo_up(x, y);
    lock.mouseDown = false;
    state.hold = null;
    if (callback.mouseup) callback.mouseup(target, [x, y], clone_mouse_event(e));
  }

  function event_mouseout(e) {
    var x = e[config.axis.x], y = e[config.axis.y];
    if (lock.mouseDown) {
      if (lock.checkHold !== null) clearTimeout(lock.checkHold);
      if (lock.checkCombo !== null) clearTimeout(lock.checkCombo);
      if (config.combo.enable && state.combo) {
        check_combo();
      }
      state.hold = null;
      state.combo = null;
      lock.mouseDown = false;
    }
    if (callback.mouseout) callback.mouseout(target, [x, y], clone_mouse_event(e));
  }

  function event_mouseenter(e) {
    var x = e[config.axis.x], y = e[config.axis.y];
    var button = e.which || e.button;
    if (button > 0) {
      lock.mouseDown = true;
      if (config.hold.enable) do_hold(x, y, false);
      if (config.combo.enable) state.combo = {count: 0, positions: []};
    }
    if (callback.mouseenter) callback.mouseenter(target, [x, y], clone_mouse_event(e));
  }

  var _event_touch_map_mouse = {
    touchstart: 'mousedown',
    touchmove:  'mousemove',
    touchend:   'mouseup'
  };
  function event_touch_to_mouse(e) {
    e.preventDefault();
    var touches = e.changedTouches;
    if (touches.length > 1) {
      // TODO: pinch action
      return;
    }
    var touch = touches[0];
    var type = _event_touch_map_mouse[e.type];
    var f = document.createEvent("MouseEvents");
    f.initMouseEvent(type, true, true,
                     target.ownerDocument.defaultView, 0,
                     touch.screenX, touch.screenY,
                     touch.clientX, touch.clientY,
                     e.ctrlKey, e.altKey, e.shiftKey, e.metaKey,
                     0, null);
    target.dispatchEvent(f);
  }

  return {
    config: function () {
      return config;
    },
    bind: function (element) {
      target = element;
      interaction_init();
      element.addEventListener('mousedown', event_mousedown);
      element.addEventListener('mousemove', event_mousemove);
      element.addEventListener('mouseup', event_mouseup);
      element.addEventListener('mouseout', event_mouseout);
      element.addEventListener('mouseenter', event_mouseenter);
      element.addEventListener('touchstart', event_touch_to_mouse);
      element.addEventListener('touchmove', event_touch_to_mouse);
      element.addEventListener('touchend', event_touch_to_mouse);
    },
    unbind: function (element) {
      element.removeEventListener('mousedown', event_mousedown);
      element.removeEventListener('mousemove', event_mousemove);
      element.removeEventListener('mouseup', event_mouseup);
      element.removeEventListener('mouseout', event_mouseout);
      element.removeEventListener('mouseenter', event_mouseenter);
      element.removeEventListener('touchstart', event_touch_to_mouse);
      element.removeEventListener('touchmove', event_touch_to_mouse);
      element.removeEventListener('touchend', event_touch_to_mouse);
      interaction_init();
      target = null;
    }
  };
}