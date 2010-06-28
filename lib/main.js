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

exports.main = function(options, callback) {
  require("tab-browser").whenContentLoaded(
    function(window) {
      if (onBugzillaPage(window)) {
        tweakBugzilla(window.document);
      }
    }
  );
};

function onBugzillaPage(window) {
  if ("window" in window) {
    window = window.window;
  }
  return window.location.protocol == "https:" &&
         /bugzilla(-[a-zA-Z]+)*\.mozilla\.org/.test(window.location.href);
}

function tweakBugzilla(d) {
    // run on both bugzilla.m.o and bugzilla-stage-tip.m.o
    if (!/bugzilla(-[a-zA-Z]+)*\.mozilla\.org/.test(d.location.href))
        return;

    // Create autocomplete widgets for places where user IDs are typed
    autoCompleteUser(d, "#newcc", true); // CC field on bug pages
    autoCompleteUser(d, "#assigned_to"); // bug assignee
    autoCompleteUser(d, "input[type=text][name^=requestee_type-]", true); // requestee's on attachment pages
    autoCompleteUser(d, "input[name=email1],input[name=email2]"); // user fields on search page
    autoCompleteUser(d, "input[name=cc]", true); // CC field on new bug page
    autoCompleteUser(d, "input[name=assigned_to]"); // assignee field on new bug page
    autoCompleteUser(d, "input[name=new_watchedusers]", true); // user watch field in user email prefs

    if (!d.getElementById("comments")) // don't process the mid-air collision pages
      return;

    // Strip "Bug " from titles for better tab readability
    if (/^Bug /.test(d.title))
        d.title = d.title.slice(4);

    // Make the comment box bigger
    var commentBox = d.querySelector("#comment");
    if (commentBox)
        commentBox.rows=20;

    addAssignToSelfButton(d);

    attachmentDiffLinkify(d);

    // Mark up history along right hand edge
    var historyLink = d.querySelector("link[title='Bug Activity']");
    if (!historyLink)
        return;

    // Add our own style for bugzilla-tweaks
    var style = d.createElement("style");
    style.setAttribute("type", "text/css");
    style.appendChild(d.createTextNode(
        ".bztw_history { border: none; font-weight: normal; width: 58em; margin-left: 5em; }" +
        ".bztw_inlinehistory { font-weight: normal; width: 56em; }" +
        ".bztw_history .old, .bztw_inlinehistory .old { text-decoration: line-through; }" +
        ".bztw_history .sep:before { content: \" \"; }" +
        ".bztw_unconfirmed { font-style: italic; }" +
        "tr.bz_tr_obsolete.bztw_plusflag { display: table-row !important; }" +
        '.bztw_historyitem + .bztw_historyitem:before { content: "; "; }'
    ));
    d.getElementsByTagName("head")[0].appendChild(style);
    style = d.createElement("style");
    style.setAttribute("type", "text/css");
    style.id = "bztw_cc";
    style.appendChild(d.createTextNode(
        ".bztw_cc { display: none; }" +
        '.bztw_historyitem.bztw_cc + .bztw_historyitem:before { content: ""; }' +
        '.bztw_historyitem:not([class~="bztw_cc"]) ~ .bztw_historyitem.bztw_cc + .bztw_historyitem:before { content: "; "; }'
    ));
    d.getElementsByTagName("head")[0].appendChild(style);

    /*
    // Allow toggling of CC event displays using a context menu entry
    var contextMenu = require("context-menu");
    var style = d.getElementById("bztw_cc");
    var ccMenuItem = contextMenu.Item({
        label: "Toggle CC History",
        context: onBugzillaPage,
        onClick: function() style.disabled = !style.disabled
    });
    contextMenu.add(ccMenuItem);
    d.defaultView.addEventListener("unload", function() {
        contextMenu.remove(ccMenuItem);
    }, false);
    */

    var userNameCache = {};
    function getUserName(email) {
        if (email in userNameCache) {
            return userNameCache[email];
        }
        var emailLink = d.querySelectorAll("a.email");
        for (var i = 0; i < emailLink.length; ++i) {
            if (emailLink[i].href == "mailto:" + email) {
                return userNameCache[email] = htmlEncode(trimContent(emailLink[i]));
            }
        }
        return email;
    }

    // collect the flag names
    var flagNames = [], flags = {}, flagOccurrences = {};
    var flagRows = d.querySelectorAll("#flags tr");
    for (var i = 0; i < flagRows.length; ++i) {
        var item = flagRows[i].querySelectorAll("td");
        if (!item[1])
            continue;
        var name = trimContent(item[1]).replace('\u2011', '-', 'g');
        flagNames.push(name);
        flags[name] = item[1];
    }
    flagRows = d.querySelectorAll(".field_label[id^=field_label_cf_]");
    for (var i = 0; i < flagRows.length; ++i) {
        var name = trimContent(flagRows[i]).replace(/\:$/, '')
                                           .replace('\u2011', '-', 'g');
        flagNames.push(name);
        flags[name] = flagRows[i];
    }
    var flagCounter = 1;
    function findFlag(item) {
        function lookup(name) {
            name = name.replace('\u2011', '-', 'g');
            for (var i = 0; i < flagNames.length; ++i) {
                var quotedFlagName = flagNames[i].replace('.', '\\.', 'g')
                                                 .replace('\u2011', '-', 'g');
                if ((new RegExp('^' + quotedFlagName)).test(name)) {
                    return [flagNames[i]];
                }
            }
            return [];
        }
        var base = item[4] ? 2 : 0;
        // handle normal flags
        if (trimContent(item[base]) == 'Flag') {
            var result = [];
            var tmp = lookup(trimContent(item[base + 1]));
            if (tmp.length) {
                result.push(tmp[0]);
            }
            tmp = lookup(trimContent(item[base + 2]));
            if (tmp.length) {
                result.push(tmp[0]);
            }
            return result;
        }
        // handle special pseudo-flags
        return lookup(trimContent(item[base]));
    }

    var DataStore = new DataStoreCtor(d);

    var AttachmentFlagHandler = new AttachmentFlagHandlerCtor();
    AttachmentFlagHandler.determineInterestingFlags(d);

    var CheckinComment = new CheckinCommentCtor();
    CheckinComment.initialize(d, AttachmentFlagHandler._interestingFlags);
    if (CheckinComment.isValid()) {
        var message = d.getElementById("__bz_tw_checkin_comment");
        if (message) {
            message = message.textContent;
            /*
            var copyCheckinCommentItem = contextMenu.Item({
                label: "Copy Check-in Comment",
                context: onBugzillaPage,
                onClick: function() require("clipboard").set(message)
            });
            contextMenu.add(copyCheckinCommentItem);
            d.defaultView.addEventListener("unload", function() {
                contextMenu.remove(copyCheckinCommentItem);
            }, false);
            */
        }
    }

    var iframe = d.createElement('iframe');
    iframe.src = historyLink.href;
    iframe.style.display = "none";
    iframe.addEventListener("load", function() {
        preprocessDuplicateMarkers(d, iframe.contentDocument);

        var historyItems = iframe.contentDocument.querySelectorAll('#bugzilla-body tr');
        var commentTimes = d.querySelectorAll('.bz_comment_time');

        // Sometimes the history will stack several changes together,
        // and we'll want to append the data from the Nth item to the
        // div created in N-1
        var i=0, j=0, flagsFound;
        for (; i < historyItems.length; i++) {
            var item = historyItems[i].querySelectorAll("td");
            if (!item[1])
                continue;

            var reachedEnd = false;
            for (; j < commentTimes.length; j++) {
                if (trimContent(item[1]) > trimContent(commentTimes[j])) {
                    if (j < commentTimes.length - 1) {
                        continue;
                    } else {
                        reachedEnd = true;
                    }
                }

                var commentHead = commentTimes[j].parentNode;

                var mainUser = commentHead.querySelector(".bz_comment_user a.email")
                                          .href
                                          .substr(7);
                var user = trimContent(item[0]);
                var mainTime = trimContent(commentTimes[j]);
                var time = trimContent(item[1]);
                var inline = (mainUser == user && time == mainTime);

                var currentDiv = d.createElement("div");
                var userPrefix = '';
                if (inline) {
                    // assume that the change was made by the same user
                    commentHead.appendChild(currentDiv);
                    currentDiv.setAttribute("class", "bztw_inlinehistory");
                } else {
                    // the change was made by another user
                    if (!reachedEnd) {
                        var parentDiv = commentHead.parentNode;
                        if (parentDiv.previousElementSibling &&
                            parentDiv.previousElementSibling.className.indexOf("bztw_history") >= 0) {
                            currentDiv = parentDiv.previousElementSibling;
                        } else {
                            parentDiv.parentNode.insertBefore(currentDiv, parentDiv);
                        }
                    } else {
                        var parentDiv = commentHead.parentNode;
                        if (parentDiv.nextElementSibling &&
                            parentDiv.nextElementSibling.className.indexOf("bztw_history") >= 0) {
                            currentDiv = parentDiv.nextElementSibling;
                        } else {
                            parentDiv.parentNode.appendChild(currentDiv);
                        }
                    }
                    currentDiv.setAttribute("class", "bz_comment bztw_history");
                    userPrefix += "<a class=\"email\" href=\"mailto:" +
                                  htmlEncode(trimContent(item[0])) + "\" title=\"" +
                                  htmlEncode(trimContent(item[1])) +"\">" +
                                  getUserName(trimContent(item[0])) + "</a>: ";
                }
                // check to see if this is a flag setting
                flagsFound = findFlag(item);
                for (var idx = 0; idx < flagsFound.length; ++idx) {
                    var flag = flagsFound[idx];
                    flagOccurrences[flag] = 'flag' + flagCounter;
                    if (inline) {
                        var anchor = d.createElement("a");
                        anchor.setAttribute("name", "flag" + flagCounter);
                        commentHead.insertBefore(anchor, commentHead.firstChild);
                    } else {
                        userPrefix += '<a name="flag' + flagCounter + '"></a>';
                    }
                    ++flagCounter;
                }

                var attachmentFlagAnchors = AttachmentFlagHandler.handleItem(user, item);
                if (inline) {
                    for (var idx = 0; idx < attachmentFlagAnchors.length; ++idx) {
                        var anchor = d.createElement("a");
                        anchor.setAttribute("name", attachmentFlagAnchors[idx]);
                        commentHead.insertBefore(anchor, commentHead.firstChild);
                    }
                } else {
                    userPrefix += attachmentFlagAnchors.map(function(name) '<a name="' + name + '"></a>').join("");
                }

                var ccOnly = (trimContent(item[2]) == 'CC');
                var ccPrefix = ccOnly ? '<span class="bztw_cc bztw_historyitem">' :
                                        '<span class="bztw_historyitem">',
                    ccSuffix = '</span>';
                var html = userPrefix +
                           ccPrefix +
                           transformType(trimContent(item[2]), d, trimContent(item[3]),
                                         trimContent(item[4])) + ": " +
                           formatTransition(trimContent(item[3]), trimContent(item[4]),
                                            trimContent(item[2]), d, iframe.contentDocument);

                var nextItemsCount = item[0].rowSpan;
                for (var k = 1; k < nextItemsCount; ++k) {
                    ccOnly = false;
                    item = historyItems[++i].querySelectorAll("td")
                    ccPrefix = (trimContent(item[0]) == 'CC') ?
                        '<span class="bztw_cc bztw_historyitem">' : '<span class="bztw_historyitem">';
                    // avoid showing a trailing semicolon if the previous entry wasn't a CC and this one is
                    var prefix = ccSuffix + ccPrefix;
                    // check to see if this is a flag setting
                    flagsFound = findFlag(item);
                    for (var idx = 0; idx < flagsFound.length; ++idx) {
                        var flag = flagsFound[idx];
                        flagOccurrences[flag] = 'flag' + flagCounter;
                        if (inline) {
                            var anchor = d.createElement("a");
                            anchor.setAttribute("name", "flag" + flagCounter);
                            commentHead.insertBefore(anchor, commentHead.firstChild);
                        } else {
                            prefix += '<a name="flag' + flagCounter + '"></a>';
                        }
                        ++flagCounter;
                    }

                    var attachmentFlagAnchors = AttachmentFlagHandler.handleItem(user, item);
                    if (inline) {
                        for (var idx = 0; idx < attachmentFlagAnchors.length; ++idx) {
                            var anchor = d.createElement("a");
                            anchor.setAttribute("name", attachmentFlagAnchors[idx]);
                            commentHead.insertBefore(anchor, commentHead.firstChild);
                        }
                    } else {
                        prefix += attachmentFlagAnchors.map(function(name) '<a name="' + name + '"></a>').join("");
                    }

                    html += prefix +
                            transformType(trimContent(item[0]), d, trimContent(item[1]),
                                          trimContent(item[2])) + ": " +
                            formatTransition(trimContent(item[1]), trimContent(item[2]),
                                             trimContent(item[0]), d, iframe.contentDocument);
                }
                html += ccSuffix;
                if (ccOnly) {
                    html = '<div class="bztw_cc">' + html + '</div>';
                } else {
                    html = '<div>' + html + '</div>';
                }
                currentDiv.innerHTML += html;
                break;
            }
        }

        handleEmptyCollapsedBoxes(d);

        // Set the latest flag links if necessary
        for (var flagName in flagOccurrences) {
            flags[flagName].innerHTML = '<a href="#' + flagOccurrences[flagName] + '">'
                + flags[flagName].innerHTML + '</a>';
        }

        AttachmentFlagHandler.setupLinks(d);
    },true);
    d.body.appendChild(iframe);
}

var TransformValues = {
    linkifyURLs: function (str) {
        return str.replace(/((https?|ftp)\:\/\/[\S]+)/g, '<a href="$1">$1</a>');
    },
    linkifyBugAndCommentNumbers: function (str) {
        return str.replace(/(bug )(\d+) (comment )(\d+)/gi, '<a href="show_bug.cgi?id=$2#c$4">$1\n$2 $3\n$4</a>');
    },
    linkifyCommentNumbers: function (str) {
        return str.replace(/(comment (\d+))/gi, '<a href="#c$2">$1</a>');
    },
    linkifyBugNumbers: function (str) {
        return str.replace(/(bug (\d+))/gi, '<a href="show_bug.cgi?id=$2">$1</a>');
    },
    linkifyDependencies: function (str, type, doc, histDoc) {
        switch (type) {
        case "Blocks":
        case "Depends on":
        case "Duplicate":
            str = str.replace(/\d+/g, function(str) {
                var link = histDoc.querySelector("a[href='show_bug.cgi?id=" + str + "']");
                if (link) {
                    var class_ = '';
                    if (/bz_closed/i.test(link.className)) {
                        class_ += 'bz_closed ';
                    } else if (/bztw_unconfirmed/i.test(link.className)) {
                        class_ += 'bztw_unconfirmed ';
                    }
                    var parent = link.parentNode;
                    if (parent) {
                        if (parent.tagName.toLowerCase() == "i") {
                            class_ += 'bztw_unconfirmed ';
                        }
                        if (/bz_closed/i.test(parent.className)) {
                            class_ += 'bz_closed ';
                        }
                    }
                    str = applyClass(class_,
                                     '<a title="' + htmlEncode(link.title) + '" href="show_bug.cgi?id=' + htmlEncode(str) + '"' +
                                     (link.hasAttribute("name") ? (' name="' + htmlEncode(link.getAttribute("name")) + '"') : '') +
                                     '>' + htmlEncode(str) + '</a>');
                }
                return str;
            });
        }
        return str;
    }
};

function transform(str, type, doc, histDoc) {
    for (var funcname in TransformValues) {
        var func = TransformValues[funcname];
        str = func.call(null, str, type, doc, histDoc);
    }
    return str
}

var TransformTypes = {
    linkifyAttachments: function (str, doc) {
        return str.replace(/(Attachment #(\d+))/g, function (str, x, id) {
            var link = doc.querySelector("a[href='attachment.cgi?id=" + id + "']");
            if (link) {
                var class_ = '';
                if (/bz_obsolete/i.test(link.className)) {
                    class_ += 'bz_obsolete ';
                }
                var parent = link.parentNode;
                if (parent && /bz_obsolete/i.test(parent.className)) {
                    class_ += 'bz_obsolete ';
                }
                if (link.querySelector(".bz_obsolete")) {
                    class_ += 'bz_obsolete ';
                }
                str = applyClass(class_,
                                 '<a title="' + htmlEncode(trimContent(link)) + '" href="attachment.cgi?id=' +
                                 htmlEncode(id) + '&action=edit">' + htmlEncode(str) + '</a>');
            }
            return str;
        });
    },
    changeDependencyLinkTitles: function (str, doc, old, new_) {
        switch (str) {
        case "Blocks":
        case "Depends on":
            if (old.length && !new_.length) { // if the dependency was removed
                str = "No longer " + str[0].toLowerCase() + str.substr(1);
            }
            break;
        }
        return str;
    }
};

function transformType(str, doc, old, new_) {
    for (var funcname in TransformTypes) {
        var func = TransformTypes[funcname];
        str = func.call(null, str, doc, old, new_);
    }
    return str;
}

// new is a keyword, which makes this function uglier than I'd like
function formatTransition(old, new_, type, doc, histDoc) {
    if (old.length) {
        old = transform(htmlEncode(old), type, doc, histDoc);
        var setOldStyle = true;
        switch (type) {
        case "Blocks":
        case "Depends on":
            setOldStyle = false;
            break;
        }
        if (setOldStyle) {
            old = '<span class="old">' + old + '</span>';
        }
    }
    if (new_.length) {
        new_ = '<span class="new">' + transform(htmlEncode(new_), type, doc, histDoc) + '</span>';
    }
    var mid = '';
    if (old.length && new_.length) {
        mid = ' <span style="font-size: 150%;">&rArr;</span> ';
    }
    return old + mid + new_;
}

function trimContent(el) {
    return el.textContent.trim();
}

function AttachmentFlag(flag) {
    for (var name in flag)
        this[name] = flag[name];
}
AttachmentFlag.prototype = {
    equals: function(flag) {
        if (this.type != flag.type ||
            this.name != flag.name ||
            this.setter != flag.setter ||
            ("requestee" in this && !("requestee" in flag)) ||
            ("requestee" in flag && !("requestee" in this)))
            return false;
        return this.requestee == flag.requestee;
    }
};

var reAttachmentDiff = /attachment\.cgi\?id=(\d+)&action=diff$/i;
var reBugIdLocation = /\/show_bug\.cgi\?id=(\d+)/;
var reviewBoardUrlBase = "http://reviews.visophyte.org/";
/**
 * Whenever we find a patch with a diff, insert an additional link to asuth's
 * review board magic.
 */
function attachmentDiffLinkify(doc) {
  var bugMatch = reBugIdLocation.exec(doc.location.href);
  if (!bugMatch)
    return;
  var bug_id = bugMatch[1];

  var table = doc.getElementById("attachment_table");
  if (!table)
    return;
  var rows = table.querySelectorAll("tr");
  for (var i = 0; i < rows.length; ++i) {
    var item = rows[i].querySelectorAll("td");
    if (item.length != 3)
      continue;
    // get the ID of the attachment
    var links = item[2].querySelectorAll("a");
    if (links.length != 2)
      continue;
    var match = reAttachmentDiff.exec(links[1].href);
    if (match) {
      var attach_id = match[1];
      var parentNode = links[1].parentNode;
      parentNode.appendChild(doc.createTextNode(" | "));
      var linkNode = doc.createElement("a");
      linkNode.href = reviewBoardUrlBase + "r/bzpatch/bug" + bug_id + "/attach" + attach_id + "/";
      linkNode.textContent = "Review";
      parentNode.appendChild(linkNode);
    }
  }
}

function AttachmentFlagHandlerCtor() {
    this._db = {};
    this._interestingFlags = {};
}
AttachmentFlagHandlerCtor.prototype = {
    determineInterestingFlags: function (doc) {
        var table = doc.getElementById("attachment_table");
        if (!table)
            return;
        var rows = table.querySelectorAll("tr");
        for (var i = 0; i < rows.length; ++i) {
            var item = rows[i].querySelectorAll("td");
            if (item.length != 3 ||
                item[1].className.indexOf("bz_attach_flags") < 0 ||
                trimContent(item[1]) == "no flags")
                continue;
            // get the ID of the attachment
            var link = item[0].querySelector("a");
            if (!link)
                continue;
            var match = this._reAttachmentHref.exec(link.href);
            if (match) {
                var attachmentID = match[1];
                if (!(attachmentID in this._interestingFlags)) {
                    this._interestingFlags[attachmentID] = [];
                }
                for (var el = item[1].firstChild; el.nextSibling; el = el.nextSibling) {
                    if (el.nodeType != el.TEXT_NODE)
                        continue;
                    var text = trimContent(el).replace('\u2011', '-', 'g');
                    if (!text)
                        continue;
                    match = this._reParseInterestingFlag.exec(text);
                    if (match) {
                        var flag = {};
                        flag.setter = match[1];
                        flag.name = match[2];
                        if (match[4] == "+" || match[4] == "-") {
                            flag.type = match[4];
                        } else {
                            flag.type = "?";
                            if (match[7]) {
                                flag.requestee = match[7];
                            }
                        }

                        // always show the obsolete attachments with a + flag
                        if (flag.type == "+") {
                            var parent = link.parentNode;
                            while (parent) {
                                if (parent.tagName.toLowerCase() == "tr") {
                                    if (/bz_tr_obsolete/i.test(parent.className)) {
                                        parent.className += " bztw_plusflag";
                                    }
                                    break;
                                }
                                parent = parent.parentNode;
                            }
                        }

                        // try to put the flag name and type part in a span which we will
                        // use in setupLinks to inject links into.
                        match = this._reLinkifyInterestingFlag.exec(text);
                        if (match) {
                            el.textContent = match[1];
                            if (match[3]) {
                                var textNode = doc.createTextNode(match[3]);
                                el.parentNode.insertBefore(textNode, el.nextSibling);
                            }
                            var span = doc.createElement("span");
                            span.textContent = match[2];
                            el.parentNode.insertBefore(span, el.nextSibling);

                            flag.placeholder = span;
                        }

                        this._interestingFlags[attachmentID].push(new AttachmentFlag(flag));
                    }
                }
            }
        }
    },
    handleItem: function (name, item) {
        var anchorsCreated = [];
        var base = item[4] ? 2 : 0;
        var what = trimContent(item[base]);
        var match = this._reAttachmentFlagName.exec(what);
        if (match) {
            var id = match[1];
            if (!(id in this._db)) {
                this._db[id] = [];
            }
            name = name.split('@')[0]; // convert the name to the fraction before the @
            var added = this._parseData(name, trimContent(item[base + 2]));
            for (var i = 0; i < added.length; ++i) {
                var flag = added[i];
                if (!(id in this._interestingFlags))
                    continue;
                for (var j = 0; j < this._interestingFlags[id].length; ++j) {
                    if (flag.equals(this._interestingFlags[id][j])) {
                        // found an interesting flag
                        this._interestingFlags[id][j].anchor = this.anchorName;
                        anchorsCreated.push(this.anchorName);
                        this._counter++;
                        break;
                    }
                }
            }
        }
        return anchorsCreated;
    },
    setupLinks: function (doc) {
        for (var id in this._interestingFlags) {
            for (var i = 0; i < this._interestingFlags[id].length; ++i) {
                var flag = this._interestingFlags[id][i];
                if ("placeholder" in flag &&
                    "anchor" in flag) {
                    var link = doc.createElement("a");
                    link.href = "#" + flag.anchor;
                    link.textContent = flag.placeholder.textContent;
                    flag.placeholder.replaceChild(link, flag.placeholder.firstChild);
                }
            }
        }
    },
    _parseData: function (name, str) {
        var items = str.replace('\u2011', '-', 'g').split(', '), flags = [];
        for (var i = 0; i < items.length; ++i) {
            if (!items[i].length)
                continue;

            var match = this._reParseRequest.exec(items[i]);
            if (match) {
                var flag = {};
                flag.name = match[1];
                flag.setter = name;
                if (match[4]) {
                    flag.requestee = match[4];
                }
                flag.type = match[2];
                flags.push(new AttachmentFlag(flag));
            }
        }
        return flags;
    },
    _counter: 1,
    get anchorName() {
        return "attachflag" + this._counter;
    },
    _reParseRequest: /^(.+)([\?\-\+])(\((.+)@.+\))?$/,
    _reParseInterestingFlag: /^(.+):\s+(.+)(([\-\+])|\?(\s+(\((.+)\)))?)$/,
    _reLinkifyInterestingFlag: /^(.+:\s+)(.+[\-\+\?])(\s+\(.+\))?$/,
    _reAttachmentHref: /attachment\.cgi\?id=(\d+)$/i,
    _reAttachmentFlagName: /^Attachment\s+#(\d+)\s+Flag$/i
};

function CheckinCommentCtor() {
    this.bugNumber = null;
    this.summarySpan = null;
    this.checkinFlags = "";
}
CheckinCommentCtor.prototype = {
  initialize: function(doc, flags) {
    this.bugNumber = getBugNumber(doc);
    var summarySpan = doc.getElementById("short_desc_nonedit_display");
    if (summarySpan) {
        this.summary = summarySpan.textContent;
    }
    var checkinFlagsMap = {};
    for (var id in flags) {
        for (var i = 0; i < flags[id].length; ++i) {
            var flag = flags[id][i];
            if (flag.type == "+") {
                var name = flag.name;
                if (name == "review") {
                    name = "r";
                } else if (name == "superreview") {
                    name = "sr";
                } else if (name == "ui-review") {
                    name = "ui-r";
                } else if (name == "feedback") {
                    name = "f";
                }
                if (!(name in checkinFlagsMap)) {
                    checkinFlagsMap[name] = {};
                }
                checkinFlagsMap[name][flag.setter]++;
            }
        }
    }
    var flagsOrdered = [];
    for (var name in checkinFlagsMap) {
        flagsOrdered.push(name);
    }
    flagsOrdered.sort(function (a, b) {
        function convertToNumber(x) {
            switch (x) {
            case "f":
                return -4;
            case "r":
                return -3;
            case "sr":
                return -2;
            case "ui-r":
                return -1;
            default:
                return 0;
            }
        }
        var an = convertToNumber(a);
        var bn = convertToNumber(b);
        if (an == 0 && bn == 0) {
            return a < b ? -1 : (a = b ? 0 : 1);
        } else {
            return an - bn;
        }
    });
    var checkinFlags = [];
    for (var i = 0; i < flagsOrdered.length; ++i) {
        var name = flagsOrdered[i];
        var flag = name + "=";
        var setters = [];
        for (var setter in checkinFlagsMap[name]) {
            setters.push(setter);
        }
        flag += setters.join(",");
        checkinFlags.push(flag);
    }
    this.checkinFlags = checkinFlags.join(" ");
    var div = doc.createElement("div");
    div.setAttribute("style", "display: none;");
    div.id = "__bz_tw_checkin_comment";
    div.appendChild(doc.createTextNode(this.toString()));
    doc.body.appendChild(div);
  },
  isValid: function() {
      return this.bugNumber != null &&
             this.summary != null;
  },
  toString: function() {
    if (!this.isValid()) {
        return "";
    }
    var message = "Bug " + this.bugNumber + " - " + this.summary;
    if (this.checkinFlags.length) {
        message += "; " + this.checkinFlags;
    }
    return message;
  }
};

function DataStoreCtor(doc) {
  this.storage = doc.defaultView.localStorage;
  this.data = {};
  this.bugNumber = null;
  function visualizeStoredData() {
    var data = "";
    for (var i = 0; i < window.localStorage.length; ++i) {
      var key = window.localStorage.key(i);
      data += key + ": " + JSON.parse(window.localStorage.getItem(key).toString()).toSource() + "\n";
    }
    open("data:text/html,<pre>" + escape(htmlEncode(data)) + "</pre>");
  }
  function clearStoredData() {
    var count = window.localStorage.length;
    if (count > 0) {
      if (window.confirm("You currently have data stored for " + count + " bugs.\n\n" +
                         "Are you sure you want to clear this data?  This action cannot be undone.")) {
        window.localStorage.clear();
      }
    } else {
      alert("You don't have any data stored about your bugs");
    }
  }
  var script = doc.createElement("script");
  script.appendChild(doc.createTextNode(visualizeStoredData.toSource() +
                                        clearStoredData.toSource() +
                                        htmlEncode.toSource()));
  doc.body.appendChild(script);
  this.initialize(doc);
}

DataStoreCtor.prototype = {
  initialize: function(doc) {
    this.bugNumber = getBugNumber(doc);
    var data = this._ensureEntry(this.bugNumber, this.data);
    // last visited date
    data.visitedTime = (new Date()).getTime();
    // last comment count
    data.commentCount = doc.querySelectorAll(".bz_comment").length;
    // last status of bug flags
    var flags = this._ensureEntry("flags", data);
    var flagRows = doc.querySelectorAll("#flags tr");
    for (var i = 0; i < flagRows.length; ++i) {
      var flagCols = flagRows[i].querySelectorAll("td");
      if (flagCols.length != 3) {
        continue;
      }
      var flagName = trimContent(flagCols[1]);
      var flagValue = flagCols[2].querySelector("select");
      if (flagValue) {
        flagValue = flagValue.value;
      } else {
        continue;
      }
      flags[flagName] = flagValue;
    }
    flagRows = doc.querySelectorAll(".field_label[id^=field_label_cf_]");
    for (var i = 0; i < flagRows.length; ++i) {
      var flagName = trimContent(flagRows[i]).replace(/:$/, "");
      var flagValue = flagRows[i].parentNode.querySelector("select");
      if (flagValue) {
        flagValue = flagValue.value;
      } else {
        continue;
      }
      flags[flagName] = flagValue;
    }
    // last attachments
    var attachmentTable = doc.getElementById("attachment_table");
    var attachmentRows = attachmentTable.querySelectorAll("tr");
    for (var i = 0; i < attachmentRows.length; ++i) {
      var attachmentCells = attachmentRows[i].querySelectorAll("td");
      if (attachmentCells.length != 3) {
        continue;
      }
      var link = attachmentCells[0].querySelector("a");
      var match = this._reAttachmentHref.exec(link.href);
      if (match) {
        var attachmentID = match[1];
        var attachment = this._ensureEntry("attachments", data);
        var attachmentFlags = this._ensureArray(attachmentID, attachment);
        for (var el = attachmentCells[1].firstChild; el.nextSibling; el = el.nextSibling) {
          if (el.nodeType != el.TEXT_NODE) {
            continue;
          }
          var text = trimContent(el);
          if (!text) {
            continue;
          }
          match = this._reParseInterestingFlag.exec(text);
          if (match) {
            var flag = {};
            flag.setter = match[1];
            flag.name = match[2];
            if (match[4] == "+" || match[4] == "-") {
                flag.type = match[4];
            } else {
                flag.type = "?";
                if (match[7]) {
                    flag.requestee = match[7];
                }
            }
            attachmentFlags.push(flag);
          }
        }
      }
    }
    // Write data to storage
    for (var key in this.data) {
      this._ensure(key, this.storage, JSON.stringify(this.data[key]));
    }
  },
  _ensure: function(entry, obj, val) {
    if (obj.toString().indexOf("[object Storage]") >= 0) {
      obj.setItem(entry, val);
    } else {
      if (typeof obj[entry] == "undefined")
        obj[entry]  = val;
      return obj[entry];
    }
  },
  _ensureEntry: function(entry, obj) {
    return this._ensure(entry, obj, {});
  },
  _ensureArray: function(entry, obj) {
    return this._ensure(entry, obj, []);
  },
  _reParseInterestingFlag: /^(.+):\s+(.+)(([\-\+])|\?(\s+(\((.+)\)))?)$/,
  _reAttachmentHref: /attachment\.cgi\?id=(\d+)$/i
};

function getBugNumber(doc) {
  var idField = doc.querySelector("form[name=changeform] input[name=id]");
  if (idField) {
    return idField.value;
  }
  return null;
}

function getUserName(doc) {
  var links = doc.querySelectorAll("#header .links li");
  var last = links[links.length - 1];
  if (last.innerHTML.indexOf("logout") >= 0) {
    return trimContent(last.lastChild);
  }
  return null;
}

function preprocessDuplicateMarkers(mainDoc, histDoc) {
    var comments = mainDoc.querySelectorAll(".bz_comment");
    var reDuplicate = /^\s*\*\*\*\s+Bug\s+(\d+)\s+has\s+been\s+marked\s+as\s+a\s+duplicate\s+of\s+this\s+bug.\s+\*\*\*\s*$/i;
    var row = 0;
    var rows = histDoc.querySelectorAll("#bugzilla-body tr");
    for (var i = 1 /* comment 0 can never be a duplicate marker */;
         i < comments.length; ++i) {
        var textHolder = comments[i].querySelector(".bz_comment_text");
        var match = reDuplicate.exec(trimContent(textHolder));
        if (match) {
            // construct the table row to be injected in histDoc
            var bugID = match[1];
            var email = comments[i].querySelector(".bz_comment_user .email")
                                   .href
                                   .substr(7);
            var link = textHolder.querySelector("a");
            var title = link.title;
            var time = trimContent(comments[i].querySelector(".bz_comment_time"));
            var what = 'Duplicate';
            var removed = '';
            var number = trimContent(comments[i].querySelector(".bz_comment_number")).
                         replace(/[^\d]+/g, '');
            var class_ = '';
            if (/bz_closed/i.test(link.className + " " + link.parentNode.className)) {
                class_ += 'bz_closed ';
            }
            if (link.parentNode.tagName.toLowerCase() == 'i') {
                class_ += 'bztw_unconfirmed ';
            }
            var added = '<a href="show_bug.cgi?id=' + bugID + '" title="' +
                        htmlEncode(title) + '" name="c' + number + '" class="' + class_ +
                        '">' + bugID + '</a>';

            // inject the table row
            var reachedEnd = false;
            for (; row < rows.length; ++row) {
                var cells = rows[row].querySelectorAll("td");
                if (cells.length != 5)
                    continue;
                if (time > trimContent(cells[1])) {
                    if (row < rows.length - 1) {
                        continue;
                    } else {
                        reachedEnd = true;
                    }
                }
                if (time == trimContent(cells[1])) {
                    cells[0].rowSpan++;
                    cells[1].rowSpan++;
                    var rowContents = [what, removed, added];
                    var tr =  histDoc.createElement("tr");
                    rowContents.forEach(function (cellContents) {
                        var td = histDoc.createElement("td");
                        td.innerHTML = cellContents;
                        tr.appendChild(td);
                    });
                    if (row != rows.length - 1) {
                        rows[row].parentNode.insertBefore(tr, rows[row+1]);
                    } else {
                        rows[row].parentNode.appendChild(tr);
                    }
                } else {
                    var rowContents = [email, time, what, removed, added];
                    var tr =  histDoc.createElement("tr");
                    rowContents.forEach(function (cellContents) {
                        var td = histDoc.createElement("td");
                        td.innerHTML = cellContents;
                        tr.appendChild(td);
                    });
                    if (reachedEnd) {
                        rows[row].parentNode.appendChild(tr);
                    } else {
                        rows[row].parentNode.insertBefore(tr, rows[row]);
                    }
                }
                break;
            }

            // remove the comment from the main doc
            comments[i].parentNode.removeChild(comments[i]);
        }
    }
}

function handleEmptyCollapsedBoxes(doc) {
    // first, try to get the display style of a CC field (any would do)
    var historyBoxes = doc.querySelectorAll(".bztw_history");
    for (var i = 0; i < historyBoxes.length; ++i) {
        var box = historyBoxes[i];
        for (var j = 0; j < box.childNodes.length; ++j) {
            var child = box.childNodes[j], found = true;
            if (child.nodeType != child.ELEMENT_NODE)
                continue;
            if (child.className == "sep") {
                // separators are insignificant
                continue;
            } else if (!/bztw_cc/.test(child.className)) {
                found = false;
                break;
            }
        }
        if (found) {
            box.className += " bztw_cc";
        }
    }
}

function applyClass(class_, html) {
    return '<span class="' + class_ + '">' + html + '</span>';
}

function htmlEncode(str) {
    return str.replace('&', '&amp;', 'g')
              .replace('<', '&lt;', 'g')
              .replace('>', '&gt;', 'g')
              .replace('"', '&quot;', 'g');
}

function autoCompleteUser(doc, field, multiple) {
  // First, inject our autocomplete helper if needed
  const helperID = "bztw_autocomplete_helper";
  if (!doc.getElementById(helperID)) {
    function getAuthParams() {
      const BZTW_AC_DISABLE = "jetpack.bugzillaTweaks.userAutoCompleteDisabled";
      var prefs = require("preferences-service");
      if (prefs.get(BZTW_AC_DISABLE, false))
        return null;

      var bzCookies = require("cookiemanager").getHostCookies("bugzilla.mozilla.org");
      var loginID = null, auth = null;
      for (var i = 0; i < bzCookies.length; ++i) {
        var cookie = bzCookies[i];
        switch (cookie.name) {
        case "Bugzilla_login":
          loginID = cookie.value;
          break;
        case "Bugzilla_logincookie":
          auth = cookie.value;
          break;
        }
      }
      if (loginID != null && auth != null) {
        return "userid=" + loginID + "&cookie=" + auth;
      }
      return null;
    }
    function bztw_setupUserAutoComplete(field, multiple) {
      var Bugzilla = {
        BASE_URL: "https://api-dev.bugzilla.mozilla.org/latest/user?" + BZTW_AUTHPARAMS + "&match=",
        currReq: null,
        getUsers: function(query, success, prefix) {
          function onLoad() {
            var suggs = [];
            var results = JSON.parse(xhr.responseText);
            // Use a maximum of 100 elements
            results.users.splice(100, 999999);
            results.users.forEach(function (user) {
              suggs.push({label: user.real_name || user.name,
                          value: prefix + user.name});
            });
            success(suggs);
          }
          if (this.currReq) {
            this.currReq.abort();
          }
          var xhr = new XMLHttpRequest();
          var url = this.BASE_URL + encodeURI(query);
          xhr.open("GET", url);
          xhr.setRequestHeader("Accept", "application/json");
          xhr.setRequestHeader("Content-Type", "application/json");
          xhr.addEventListener("load", onLoad, false);
          xhr.send(null);
          this.currReq = xhr;
        }
      };

      var options = {
        minLength: 3,
        delay: 1000,
        source: function(request, response) {
          var prefix = "";
          if (multiple) {
            var commaIndex = request.term.lastIndexOf(",");
            if (commaIndex >= 0) {
              prefix = request.term.substr(0, commaIndex + 1);
              request.term = request.term.substr(commaIndex + 1).trim();
            }
          }
          Bugzilla.getUsers(request.term, response, prefix);
        }
      };
      $(field).autocomplete(options);
    }
    var authParams = getAuthParams();
    if (!authParams)
      return;
    var link = doc.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = "https://ajax.googleapis.com/ajax/libs/jqueryui/1.8.0/themes/base/jquery-ui.css";
    doc.querySelector("head").appendChild(link);
    var style = doc.createElement("style");
    style.type = "text/css";
    style.appendChild(doc.createTextNode(
        ".ui-autocomplete { max-height: 400px; font-size: 100%; overflow-y: scroll; }"
      ));
    doc.querySelector("head").appendChild(style);
    var script = doc.createElement("script");
    script.type = "text/javascript";
    script.src = "https://ajax.googleapis.com/ajax/libs/jquery/1.4.2/jquery.min.js";
    doc.body.appendChild(script);
    script = doc.createElement("script");
    script.type = "text/javascript";
    script.src = "https://ajax.googleapis.com/ajax/libs/jqueryui/1.8/jquery-ui.min.js";
    doc.body.appendChild(script);
    script = doc.createElement("script");
    script.id = helperID;
    script.type = "text/javascript";
    script.appendChild(doc.createTextNode("var BZTW_AUTHPARAMS = '" + authParams + "';" +
                                          bztw_setupUserAutoComplete.toSource()));
    doc.body.appendChild(script);
  }
  var script = doc.createElement("script");
  script.type = "text/javascript";
  script.appendChild(doc.createTextNode(
    "bztw_setupUserAutoComplete(\"" + field + "\", " + (!!multiple) + ");"
  ));
  doc.body.appendChild(script);
}

function addAssignToSelfButton(d) {
  var userName = getUserName(d);
  if (userName) {
    // see if the bug is already assigned to the user
    var assignee = d.getElementById("assigned_to");
    if (assignee && assignee.value != userName) {
      var button = d.createElement("input");
      button.type = "button";
      button.value = "Assign To Me";
      button.addEventListener("click", function(e) {
        e.preventDefault();
        assignee.value = userName;
        var reset = d.getElementById("set_default_assignee");
        if (reset) {
          reset.checked = false;
        }
        container.classList.add("bz_default_hidden");
        d.getElementById("bz_assignee_input").classList.remove("bz_default_hidden");
        assignee.focus();
        button.removeEventListener("click", arguments.callee, false);
      }, false);
      var container = d.getElementById("bz_assignee_edit_container");
      container.appendChild(button);
    }
  }
}
