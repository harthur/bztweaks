/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Bugzilla Tweaks.
 *
 * The Initial Developer of the Original Code is Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Johnathan Nightingale <johnath@mozilla.com>
 *   Ehsan Akhgari <ehsan@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var self = require("self"),
    contextMenu = require("context-menu"),
    pageMod = require("page-mod");

exports.main = function(options, callback) {
  pageMod.PageMod({
    include: ["*.mozilla.org", "*.bugzilla.org"], // filtered further in the page mod script
    contentScriptWhen: 'ready',
    contentScriptFile: [self.data.url('js/urltest.js'),
                        self.data.url('js/bug-page-mod.js'),
                        self.data.url('js/jquery-1.5.min.js'),
                        self.data.url('js/jquery.sparkline.min.js'),
                        self.data.url('js/orange-page-mod.js')],
    onAttach: function(worker) {
      worker.on('message', function(data) {
        if(data.orangeUrl) {
          require("request").Request({
            url: data.orangeUrl,
            onComplete: function(resp) {
              worker.postMessage(resp.json);
            }
          }).get();
        }
      });
    }
  });

  // Allow toggling of CC event displays using a context menu entry
  contextMenu.Item({
    label: "Toggle CC History",
    contentScriptFile: [self.data.url('js/urltest.js'),
                        self.data.url('js/cc-context.js')]
  });

  contextMenu.Item({
    label: "Copy Check-in Comment",
    contentScriptFile: [self.data.url('js/urltest.js'),
                        self.data.url('js/checkin-context.js')],
    onMessage: function (comment) {
       require("clipboard").set(comment);
    }
  });
};
