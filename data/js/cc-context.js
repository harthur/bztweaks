on('click', function(node, data) {
  var style = document.getElementById("bztw_cc");
  style.disabled = !style.disabled;
});

on('context', function(node) {
  return onBugzillaPage(document.URL);
});
