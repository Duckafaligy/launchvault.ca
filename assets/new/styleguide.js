/* Style guide page only: toast demo buttons + "replay the reveals".
   Runs (deferred) before motion.js starts, so it can keep the untouched markup: motion.js rewrites headings, counters and pins. */
(function () {
  var boxes = Array.prototype.map.call(document.querySelectorAll('.sg-replay'), function (b) { return [b, b.innerHTML]; });
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-sg-toast]');
    if (t) { var p = t.dataset.sgToast.split('|'); LV.toast(p[0], { type: p[1] }); }
    if (e.target.closest('#sg-replay')) boxes.forEach(function (b) { b[0].innerHTML = b[1]; LV.init(b[0]); });
  });
})();
