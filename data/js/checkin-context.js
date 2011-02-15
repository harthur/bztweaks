on('click', function(node, data) {
  var message = document.getElementById("__bz_tw_checkin_comment");
  postMessage(message.textContent);
});

on('context', function(node) {
  if (!onBugzillaPage(document.URL))
    return false;
  var message = document.getElementById("__bz_tw_checkin_comment");
  return !!message;
});
