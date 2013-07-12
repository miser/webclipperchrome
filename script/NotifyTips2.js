/**
 * 当前又任何任务在执行是 都要显示提示窗口
 * 正在处理的任务状态是持续的提醒状态，
 * 瞬间操作为临时提醒，如将某某笔记加入到同步列队中等，仅显示几秒钟钟后，又显示当前的操作
 */

if (!webkitNotifications.createHTMLNotification) {

    var NotifyTips = function() {
        // var persistent,
        //     temporary, notification, notificationTimer, clipperError = chrome.i18n.getMessage('ClipperNotReady');
        // var sendMessage = function(data) {
        //     if (!chrome.extension.sendMessage) return;
        //     chrome.extension.sendMessage({
        //         name: 'sendnotification',
        //         data: data
        //     });
        // }
        var create = function(data) {
            var notification = webkitNotifications.createNotification('images/icons/48x48.png', '', data.data.content);

            notification.addEventListener('close', function(e) {
                notification = null;
            });
            notification.addEventListener('display', function(e) {
                setTimeout(function() {
                    notification.close();
                }, 1000 * 2)
            });
            notification.show();
        }
        var getContent = function(key, options) {
            var tipsContent;
            if (options instanceof Array) {
                tipsContent = options;
            } else if (typeof options == 'string') {
                tipsContent = [options];
            } else {
                tipsContent = options.content;
            }
            if (!(tipsContent instanceof Array)) {
                tipsContent = [];
            }
            var tips = chrome.i18n.getMessage(key);
            for (var i = 0; i < tipsContent.length; i++) {
                var content = tipsContent[i],
                    tipsReg = new RegExp('\\{' + i + '\\}', 'g');
                tips = tips.replace(tipsReg, content);
            }
            return tips;
        }
        var getData = function(key, options) {
            var content = getContent(key, options)
            var data = {
                content: content,
                title: '',
                error: '',
                clipperError: ''
            }
            return data;
        }

        var init = function(key, options, callback) {
            var data = getData(key, options);
            var obj = {};
            obj.data = data;
            obj.data.key = key;
            obj.timer = options.timer;
            obj.callback = callback; //getCallback(args);
            return obj;
        }


        return {
            show: function(key, options) {
                var data = init(key, options);
                create(data)
            },
            showPersistent: function() {},
            showTemporary: function() {}
        }
    }();

    var ReadyErrorNotify = (function() {

        var notification = null;
        return {
            show: function(key, timer) {
                if (notification) return;
                key = key || 'ClipperNotReady';
                var errorContent = chrome.i18n.getMessage(key);
                notification = webkitNotifications.createNotification('images/icons/48x48.png', '', errorContent);
                notification.addEventListener('close', function(e) {
                    notification = null;
                });
                notification.show();
                var close = this.close;
                if (!isNaN(timer)) {
                    setTimeout(function() {
                        close();
                    }, timer);
                }
            },
            close: function() {
                if (notification) notification.close();
            }
        }
    }());
}