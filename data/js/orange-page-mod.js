const dayMs = 24 * 60 * 60 * 1000,
      limit = 28;

on('message', function(data) {
  var total = 0,
      days = [],
      date = Date.now() - (limit + 1) * dayMs;
  for(var i = 0; i < limit; i++) {
    var iso = dateString(new Date(date));
    days.push(data[iso] ? data[iso].orangecount : 0);
    date += dayMs;
  }
  displayGraph(days);
  displayCount(days[days.length - 1])
});

function displayGraph(dayCounts) {
  var max = dayCounts.reduce(function(max, count) {
    return count > max ? count : max;
  });

  var graph = $("<div id='orange-graph'></div>")
              .attr("title", "failures over the past month, max in a day: " + max)
              .css("float", "left")
              .appendTo($("#orange-bottom-box"));

  $('#orange-graph').sparkline(dayCounts, {
    width: "70px",
    height: "38px"
  });
}

function displayCount(count) {
  var container = $("<div id='orange-count'></div>")
    .css("float", "left")
    .css("margin-left", "8px")
    .appendTo($("#orange-bottom-box"));

  $("<div>" + count + " failures</div>")
    .css("font-size", "1.5em")
    .appendTo(container);
  
  $("<div>in the past day</div>")
    .css("font-size", "0.9em")
    .appendTo(container);
}

function dateString(date) {
  function norm(part) {
    return JSON.stringify(part).length == 2 ? part : '0' + part;
  }
  return date.getFullYear()
    + "-" + norm(date.getMonth() + 1)
    + "-" + norm(date.getDate());
}

function createOrangeBox(bugId) {
  var bugUrl = 'http://brasstacks.mozilla.com/orangefactor/?display=Bug&bugid=' + bugId;

  var container = $("<a id='orange-box' href='" + bugUrl + "'></a>")
    .css("display", "block")
    .css("padding", "5px 7px 6px 5px")
    .css("border", "1px solid #EFD9C4")
    .css("overflow", "auto")
  	.css("float", "left")
    .css("margin", "7px 0 15px 0")
    .css("box-shadow","2px 2px 5px orange")
    .css("text-decoration", "none");
    
  $("<div>orange factor</div>")
    .css("font-weight", "bold")
    .css("font-size", "1.1em")
    .css("text-align", "center")
    .css("color", "#EC6E00")
    .css("margin-bottom", "6px")
    .appendTo(container);
    
  $("<div id='orange-bottom-box'></div>")
    .appendTo(container);

  $("#bz_show_bug_column_1").append(container);
}


function orangify(d) {
  if (!onBugzillaPage(d.URL))
      return;

  var whiteboard = d.querySelector("#status_whiteboard");
  if(whiteboard && /\[orange\]/.test(whiteboard.value)) {
    var id = getBugNumber(d);
    createOrangeBox(id);

    var endday = dateString(new Date(Date.now() - 1 * dayMs));
    var startday = dateString(new Date(Date.now() - (limit + 1) * dayMs));
    var url = "http://brasstacks.mozilla.com/orangefactor/count?startday=" + startday 
               + "&endday=" + endday + "&bugid=" + id;
    postMessage({bugid: id, orangeUrl: url});
  }
}

orangify(document);