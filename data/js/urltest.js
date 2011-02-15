function onBugzillaPage(url) {
  return /https:\/\/bugzilla(-[a-zA-Z]+)*\.mozilla\.org/.test(url);
}