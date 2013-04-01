(function() {
	var maikuNotePopup = {
		init: function() {
			var self = this;
			self.addEvents();
		},
		addEvents: function() {
			var self = this;
			$('#optionbtn').click(function(e) {
				chrome.extension.sendRequest({
					name: 'createoptionstab'
				});
				return false;
			});
			$('#closebtn').click(function(e) {
				console.log('close12');
				parent.postMessage({
					name: 'closefrommaikupopup'
				}, '*');
				return false;
			});
		}
	}
	$(function() {
		maikuNotePopup.init();
		parent.postMessage({
            name: 'pageCompleted'
        }, '*');
	});
})();