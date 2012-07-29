/**
 * @file: Mostly API functions
 */

// Name space
var TW = TW || {};

/**
 * @type {Object}
 */
TW.settings = {
  defaults: {
    checkInterval: 5000, // How often we check for old tabs.
    badgeCounterInterval: 6000, // How often we update the # of closed tabs in the badge.
    minutesInactive: 20, // How many minutes before we consider a tab "stale" and ready to close.
    minTabs: 5, // Stop acting if there are only minTabs tabs open.
    maxTabs: 100, // Just to keep memory / UI in check.  No UI for this.
    lockedIds: new Array(),  // An array of tabids which have been explicitly locked by the user.
    whitelist: new Array() // An array of patterns to check against.  If a URL matches a pattern, it is never locked.
  }
}



/**
 * Returns the number of milliseconds that tabs should stay open for without being used.
 *
 * @return {Number}
 */
TW.settings.stayOpen = function() {
  return parseInt(this.get('minutesInactive')) * 60000;
}

/**
 *
 * @param value
 * @see TW.settings.set
 */
TW.settings.setminutesInactive = function(value) {
  if ( parseInt(value) < 0 || parseInt(value) > 720 ){
    throw Error("Minutes Inactive must be greater than 0 and less than 720");
  }
  // Reset the tabTimes since we changed the setting
  TW.TabManager.tabTimes = {};
  chrome.tabs.query({windowType: 'normal'}, TW.TabManager.initTabs);

  localStorage['minutesInactive'] = value;
}

/**
 *
 * @param value
 * @see TW.settings.set
 */
TW.settings.setminTabs = function(value) {
  if (parseInt(value) != value) {
    throw Error("Minimum tabs must be a number");
  }
  localStorage['minTabs'] = value;
}

/**
 * @param value
 * @see TW.settings.set
 */
TW.settings.setwhitelist = function(value) {
  // It should be an array, but JS is stupid: http://javascript.crockford.com/remedial.html
  if (typeof(value) != 'object') {
    throw new Error('Whitelist should be an array, ' + typeof(value) + ' given');
  }

  localStorage['whitelist'] = JSON.stringify(value);
}

/**
 * Either calls a getter function or retunrs directly from localstorage.
 *
 * * If the value is a struct (object or array) it is JSONified.
 * @param key
 * @return {*}
 */
TW.settings.get = function(key) {
  if (typeof this[key] == 'function') {
    return this[key]();
  }

  if(typeof localStorage[key] == 'undefined') {
    if (this.defaults[key]) {
      return this.defaults[key];
    }
    throw Error('Undefined setting "' + key + '"');
  }

  if (JSON.parse(localStorage[key])) {
    return JSON.parse(localStorage[key]);
  } else {
    return localStorage[key];
  }

}

/**
 * Sets a value in localStorage.  Can also call a setter.
 *
 * If the value is a struct (object or array) it is JSONified.
 *
 * @param key
 *  Settings keyword string.
 * @param value
 * @return {*}
 */
TW.settings.set = function(key, value) {
  // Magic setter functions are set{fieldname}
  if (typeof this["set" + key] == 'function') {
    return this["set" + key](value);
  }
  if (typeof(value) == 'object') {
    value = JSON.stringify(value);
  }
  localStorage[key] = value;
}

TW.idleChecker = {
  lastRun: null,
  logRun: function(time) {
    this.lastRun = time;
  },
  timeSinceLastRun: function(time) {
    if (this.lastRun == null) {
      return 0;
    }
    return parseInt(time) - parseInt(this.lastRun);
  }
}

/**
 * Stores the tabs in a separate variable to log Last Accessed time.
 * @type {Object}
 */
TW.TabManager = {
  tabTimes: {},
  closedTabs: new Array()
};

TW.TabManager.initTabs = function (tabs) {
  for (var i=0; i < tabs.length; i++) {
    TW.TabManager.updateLastAccessed(tabs[i]);
  }
}

/**
 * Takes a tabId or a tab object
 * @param {mixed} tabId
 *  Tab ID or Tab object.
 */
TW.TabManager.updateLastAccessed = function (tabId) {
  if (typeof tabId == "object") {
    tabId = tabId.id
  }
  TW.TabManager.tabTimes[tabId] = new Date().getTime();
}

/**
 * Kinda frivolous.  Abstracterbation FTW!
 * @param tabId
 */
TW.TabManager.removeTab = function(tabId) {
  delete TW.TabManager.tabTimes[tabId];
}

/**
 * @param time
 *  If null, returns all.
 * @return {Array}
 */
TW.TabManager.getOlderThen = function(time) {
  var ret = Array();
  for (var i in this.tabTimes) {
    if (this.tabTimes.hasOwnProperty(i)) {
      if (time == null || this.tabTimes[i] < time) {
        ret.push(parseInt(i));
      }
    }
  }

  return ret;
}

/**
 * Wrapper function basically
 * @return {Array}
 */
TW.TabManager.getAll = function() {
  return TW.TabManager.getOlderThen();
}

TW.TabManager.closedTabs = {
  tabs: new Array()
};

TW.TabManager.closedTabs.findById = function(id) {
  for (var i = 0; i < this.tabs.length; i++) {
    if(this.tabs[i].id == id) {
      return i;
    }
  }
}

TW.TabManager.closedTabs.saveTabs = function(tabs) {
  var maxTabs = TW.settings.get('maxTabs');
  for (var i=0; i < tabs.length; i++) {
    if (tabs[i] == null) {
      console.log('Weird bug, backtrace this...');
    }
    tabs[i].closedAt = new Date().getTime();
    this.tabs.unshift(tabs[i]);
  }

  if ((this.tabs.length - maxTabs) > 0) {
    this.tabs = this.tabs.splice(0, maxTabs);
  }
  console.log('Saved ' + tabs.length + ' tabs');
}

TW.TabManager.closedTabs.clear = function() {
  this.tabs = new Array(); 
}

TW.TabManager.isWhitelisted = function(url) {
  var whitelist = TW.settings.get("whitelist");
  for (var i=0; i < whitelist.length; i++) {
    if (url.indexOf(whitelist[i]) != -1) {
      return true;
    }
  }
  return false;
}

TW.TabManager.isLocked = function(tabId) {
  var lockedIds = TW.settings.get("lockedIds");
  if (lockedIds.indexOf(tabId) != -1) {
    return true;
  }
  return false;
}

TW.TabManager.lockTab = function(tabId) {
  var lockedIds = TW.settings.get("lockedIds");

  if (tabId > 0 && lockedIds.indexOf(tabId) == -1) {
    lockedIds.push(tabId);
  }
  TW.settings.set('lockedIds', lockedIds);
}

TW.TabManager.unlockTab = function(tabId) {  
  var lockedIds = TW.settings.get("lockedIds");
  if (lockedIds.indexOf(tabId) > -1) {
    lockedIds.splice(lockedIds.indexOf(tabId), 1);
  }
  TW.settings.set('lockedIds', lockedIds);
}

TW.TabManager.updateClosedCount = function() {
  var storedTabs = TW.TabManager.closedTabs.tabs.length;
  if (storedTabs == 0) {
    storedTabs = '';
  }
  chrome.browserAction.setBadgeText({text: storedTabs.toString()});
}

/**
 * Creates and updates context menus.
 */
TW.contextMenuHandler = {
  lockActionId: null,
  createContextMenus: function () {
    var lockItem = function(onClickData, selectedTab) {
      TW.TabManager.lockTab(selectedTab.id);
    }

    var lockAction = {
      'type': 'checkbox',
      'title': "Never close this tab",
      'onclick': lockItem
    };

    this.lockActionId = chrome.contextMenus.create(lockAction);
  },
  
  updateContextMenus: function(tabId) {
    chrome.contextMenus.update(this.lockActionId, {'checked': TW.TabManager.isLocked(tabId)});
  }
}


TW.Updater = {
  updates: {},
  firstInstall: function() {
    var notification = window.webkitNotifications.createNotification(
      'img/icon48.png',                      // The image.
      'Tab Wrangler is installed',
      'Tab wrangler is now auto-closing tabs after ' + TW.settings.get('minutesInactive') + ' minutes. \n\
  To change this setting, click on the new icon on your URL bar.'
      );
    notification.show();
  },
  //@todo: refactor this into a couple functions
  run: function() {
    chrome.storage.sync.get('version', function(items) {
      // Whatever is set in chrome.storage (if anything)
      var currentVersion;

      // The version from the manifest file
      var manifestVersion = parseFloat(chrome.app.getDetails().version);

      // If items[version] is undefined, the app has either not been installed, 
      // or it is an upgrade from when we were not storing the version.
      if (typeof items['version'] != 'undefined') {
        currentVersion = items['version'];
      }

      if (!currentVersion) {
        // Hardcoded here to make the code simpler.
        // This is the first update for users upgrading from when we didn't store
        // a version.
        this.updates[2.1].fx();
        chrome.storage.sync.set({
          'version': manifestVersion
        },function() {
          firstInstall();
        });
      } else if (currentVersion < manifestVersion) {
        for (var i in this.updates) {
          if (this.updates.hasOwnProperty(i)) {
            if (i > currentVersion) {
              this.updates[i].fx();
            }

            // This is the version we are updating to.
            if (i == manifestVersion) {
              // Post 2.0 updates.
              chrome.storage.sync.set({
                'version': manifestVersion
              },function() {
                if (typeof this.updates[i].finished == 'function') {
                  this.updates[i].finished();
                }
              });
            }
          }
        }
      }
    }); 
  }

  
}

// These are also run for users with no currentVersion set.
// This update is for the 1.x -> 2.x users
TW.Updater.updates[2.1] = {
  fx: function() {
    var map = {
      'minutes_inactive' : 'minutesInactive',
      'closed_tab_ids' : null,
      'closed_tab_titles': null,
      'closed_tab_urls' : null,
      'closed_tab_icons' : null,
      'closed_tab_actions': null,
      'locked_ids' : 'lockedIds',
      'popup_view' : null
    }

    var oldValue;

    for (var i in map) {
      if (map.hasOwnProperty(i)) {
        oldValue = localStorage[i];
        if (oldValue) {
          if (map[i] != null) {
            localStorage[map[i]] = oldValue;
          }
          localStorage.removeItem(i);
        }
      }
    }
  }
}

TW.Updater.updates[2.2] = {
  fx: function() {
  // No-op
  },

  finished: function() {

    var updateTxt = ''
    + '<strong>Changes:</strong>'
    + '<ul>'
    + '<li> Resets timer when minTabs is reached <span class="label label-success">Feature</span></li>'
    + '<li> Syncs settings between computers <span class="label label-success">Feature</span></li>'
    + '<li> Right-click to lock tab <span class="label label-success">Feature</span></li>'
    + '</ul>';

    var notification = window.webkitNotifications.createHTMLNotification(
      'notification.html?title=Version 2.2&message=' + updateTxt
      );
    notification.show();
  }
}



/**
 * Possible test, later...

TW.TabManager.addTab({id: 1, title: 'Google', url: 'http://google.com'});
console.log(TW.TabManager.tabs);

setTimeout(function() {
  TW.TabManager.addTab({id: 2, title: 'Yahoo', url: 'http://yahoo.com'});
  console.log(TW.TabManager.tabs);
}, 2000);

setTimeout(function() {
  TW.TabManager.addTab({id: 3, title: 'Facebook.com', url: 'http://facebook.com'});
  console.log(TW.TabManager.tabs);
}, 5000)

setTimeout(function() {
  TW.TabManager.addTab({id: 1, title: 'Google', url: 'http://google.com'});
  console.log(TW.TabManager.tabs);
}, 8000)
*/





