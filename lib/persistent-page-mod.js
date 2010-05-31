var timer = require("timer");

function PersistentPageMod(window, callback) {
  memory.track(this);
  this.window = window;
  this.callback = callback;
  this.window.addEventListener("unload", this, false);
  this.window.addEventListener("DOMSubtreeModified", this, false);
  this.doMod();
  require("unload-2").ensure(this);
}

PersistentPageMod.prototype = {
  REPLACE_DELAY: 100,
  doMod: function doMod() {
    try {
      this.callback.call(undefined, this.window);
    } catch (e) {
      console.exception(e);
    }
    this.timerID = null;
  },
  handleEvent: function handleEvent(event) {
    switch (event.type) {
    case "unload":
      if (event.target == this.window.document)
        this.unload();
      break;
    case "DOMSubtreeModified":
      if (this.timerID == null) {
        // Wait a bit to do the replacing. Otherwise, we just get called
        // tons of times in a tiny period and end up hanging the browser
        // for a while.
        var self = this;
        this.timerID = timer.setTimeout(function() self.doMod(),
                                        this.REPLACE_DELAY);
      }
      break;
    }
  },
  unload: function unload() {
    if (this.timerID != null) {
      timer.clearTimeout(this.timerID);
      this.timerID = null;
    }
    this.window.removeEventListener("DOMSubtreeModified", this, false);
    this.window.removeEventListener("unload", this, false);
  }
};

require("errors").catchAndLogProps(PersistentPageMod.prototype,
                                   "handleEvent");

var register = exports.register = function register(window, callback) {
  new PersistentPageMod(window, callback);
};
