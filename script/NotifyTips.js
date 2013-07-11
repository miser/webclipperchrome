/**
 * 当前又任何任务在执行是 都要显示提示窗口
 * 正在处理的任务状态是持续的提醒状态，
 * 瞬间操作为临时提醒，如将某某笔记加入到同步列队中等，仅显示几秒钟钟后，又显示当前的操作
 */
var NotifyTips = function() {
    var persistent,
    temporary, notification, notificationTimer, clipperError = chrome.i18n.getMessage('ClipperNotReady');
    var sendMessage = function(data) {
        if (!chrome.extension.sendMessage) return;
        chrome.extension.sendMessage({
            name: 'sendnotification',
            data: data
        });
    }
    var create = function() {
        notification = webkitNotifications.createHTMLNotification('notification.html');
        notification.addEventListener('close', function(e) {
            notification = null;
        });
        var isInit = true;
        notification.onclick = function() {
            chrome.extension.getViews({
                type: "notification"
            }).forEach(function(win) {
                if (isInit == true) {
                    isInit = false;
                    $('.repeat-btn', win.document).die('click').live('click', function() {
                        MKSyncTaskQueue.repeat($(this).attr('data-guid'));
                    })
                    $('.cancel-btn', win.document).die('click').live('click', function() {
                        MKSyncTaskQueue.remove($(this).attr('data-guid'));
                    })
                }
            });
        };
        notification.show();
    }
    var getContent = function(key, options) {
        var tipsContent;
        if (options instanceof Array) {
            tipsContent = options;
        } else if (typeof options == 'string') {
            tipsContent = [options];
        } else {
            tipsContent =  options.content;
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

    var showTipsPersistent = function() {
        clearTimeout(notificationTimer);
        persistent.data.error = MKSyncTaskQueue.getErrorContentHTML();
        sendMessage(persistent.data);
    }

    var showTipsTemporary = function() {
        clearTimeout(notificationTimer);
        sendMessage(temporary.data);

        (function(temporary) {
            notificationTimer = setTimeout(function() {
                temporary && temporary.callback && temporary.callback();
                var errorQueue = MKSyncTaskQueue.getErrorQueue();
                if (persistent && persistent.data) {
                    sendMessage(persistent.data);
                } else if (errorQueue && errorQueue.length > 0) {
                    NotifyTips.refresh();
                } else {
                    notification && notification.cancel();
                }
            }, temporary.timer || 2000);
        })(temporary)
    }
    // var getCallback = function(args) {
    //     if (args && args[args.length - 1] && args[args.length - 1] instanceof Function) {
    //         return args[args.length - 1];
    //     }
    //     return;
    // }

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
        showPersistent: function(key, options, callback) {
            if (!notification) create();
            options = options || {};
            persistent = init(key, options, callback);
            //需要给notification.html 第一次加载的时候调用
            this.notificationData = persistent.data;
            showTipsPersistent();
        },
        showTemporary: function(key, options, callback) {
            if (!notification) create();
            options = options || {};
            temporary = init(key, options, callback);
            //需要给notification.html 第一次加载的时候调用
            this.notificationData = temporary.data;
            showTipsTemporary();
        },
        clear: function() {
            persistent = null,
            temporary = null,
            notificationTimer = null;
        },
        showError: function() {
            var error = MKSyncTaskQueue.getErrorContentHTML();
            var data = {
                content: '',
                title: '',
                error: error
            }
            sendMessage(data)
        },
        refresh: function() {
            NotifyTips.showPersistent();
        },
        close: function() {
            NotifyTips.clear();
            notification.close();
            notification = null;
        },
        tipsClipperNotReady: function() {
            if (!notification) create();
            clearTimeout(notificationTimer);
            persistent = {};
            var data = NotifyTips.getNotificationData();
            persistent.data = data;
            sendMessage(persistent.data);
        },
        getNotificationData: function() {
            var data = {
                content: '',
                title: '',
                error: '',
                clipperError: clipperError
            };
            return data;
        }
    }
}();

var ReadyErrorNotify = (function() {

    var notification = null;
    return {
        show: function(key, timer) {
            if (notification) return;

            notification = webkitNotifications.createHTMLNotification('readyerror.html');
            notification.addEventListener('close', function(e) {
                notification = null;
            });
            notification.show();
            key = key || 'ClipperNotReady';
            var errorContent = chrome.i18n.getMessage(key);
            var data = {
                content: errorContent
            }
            //需要给notification.html 第一次加载的时候调用
            this.notificationData = data;
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