(function() {
	window.MKTestUtil = {};
	MKTestUtil.loadFile = function(url, callback) {
		var xhr = new XMLHttpRequest();
		xhr.open('GET', url, true);
		xhr.onload = function(e) {
			if (this.status == 200) {
				callback();
			}
		}
		xhr.onerror = function() {
			throw new Error('load file onerror');
		}
		xhr.send(null);
	}
})();