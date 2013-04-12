//@huntbao @mknote
//All right reserved
(function() {
	'use strict';
	var contextMenuForSites = {
		init: function() {
			var self = this;
			chrome.extension.onConnect.addListener(function(port) {
				switch (port.name) {
					case 'link.weibo':
						self.weiboLinkHandler(port);
						break;
						// case 'review.douban':
						// 	self.doubanReviewHandler(port);
						// 	break;
					default:
						break;
				}
			});
		},
		weiboLinkHandler: function(port) {
			var that = maikuNote;
			port.onMessage.addListener(function(msg) {
				if (msg.error) {
					ReadyErrorNotify.show('weiboClipError', 1000 * 2)
				} else {
					var content = msg.content,
						tag = '新浪微博';
					var note = {
						title: msg.title,
						sourceurl: msg.sourceurl,
						notecontent: content,
						tags: tag
					}
					that.syncNote(note);
				}
			});
		},
		weibo: function() {
			var self = this;
			window.maikuNote.initContextMenus(function() {
				chrome.contextMenus.create({
					contexts: ['link'],
					title: chrome.i18n.getMessage('clipLinkContextMenuWeibo'),
					onclick: function(info, tab) {
						chrome.tabs.executeScript(null, {
							code: "maikuClipper.getLinkInfoByUrlWeibo('" + info.linkUrl + "');"
						});
					}
				});
			});
		},
	}
	window.maikuNoteUtil = {
		createParticularContextMenu: function(host) {
			switch (host) {
				case 'weibo.com':
				case 'www.weibo.com':
				case 's.weibo.com':
				case 'e.weibo.com':
					contextMenuForSites.weibo();
					break;
				default:
					window.maikuNote.initContextMenus();
					break;
			}
		}
	}
	contextMenuForSites.init();
})();