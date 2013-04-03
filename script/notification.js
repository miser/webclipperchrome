//@huntbao @mknote
//All right reserved
(function($) {
	$(function() {
		var clipperError = chrome.i18n.getMessage('ClipperNotReady');
		$('#content').html(clipperError);
		var changeContent = function(data) {
			$('#content').html(data.content);
			$('#error').html(data.error);
		};
		chrome.extension.onMessage.addListener(function(request, sender) {
			if (!sender || sender.id !== chrome.i18n.getMessage("@@extension_id")) return;
			if (request.name == 'sendnotification') {
				changeContent(request.data);
			}
		});
	});
})(jQuery);