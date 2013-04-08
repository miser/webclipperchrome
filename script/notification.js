//@huntbao @mknote
//All right reserved
(function($) {
	$(function() {
		var backgroundPage = chrome.extension.getBackgroundPage(),
			notificationData = backgroundPage.NotifyTips.notificationData;
		$('#content').html(notificationData.content);
		var changeContent = function(data) {
			$('#content').html(data.content);
			$('#error').html(data.error);
		};
		chrome.extension.onMessage.addListener(function(request, sender) {
			console.log(request.data);
			if (!sender || sender.id !== chrome.i18n.getMessage("@@extension_id")) return;
			if (request.name == 'sendnotification') {
				changeContent(request.data);
			}
		});
	});
})(jQuery);