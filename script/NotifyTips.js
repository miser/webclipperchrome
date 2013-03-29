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
    var getContent = function() {
        var arg = arguments;
        while (typeof arg[0] == 'object') {
            arg = arg[0];
        }
        if (!arg && arg.length <= 0) return;
        var key = arg[0];
        var tips = chrome.i18n.getMessage(key);
        var ary = [].slice.call(arg, 1);
        for (var i = 0; i < ary.length; i++) {
            var content = ary[i];
            if (content == undefined) continue;

            var reg = new RegExp('\\{' + i + '\\}', 'g')
            tips = tips.replace(reg, ary[i]);
        }
        return tips;
    }
    var getData = function() {
        var content = getContent(arguments)
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
        }, 2000);
    }
    var getCallback = function(args) {
        if (args && args[args.length - 1] && args[args.length - 1] instanceof Function) {
            return args[args.length - 1];
        }
        return;
    }

    var init = function(args) {
        var data = getData(args);
        var obj = {};
        obj.data = data;
        obj.callback = getCallback(args);
        return obj;
    }


    return {
        showPersistent: function() {
            if (!notification) create();
            persistent = init(arguments);
            showTipsPersistent();
        },
        showTemporary: function() {
            if (!notification) create();
            temporary = init(arguments);
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
        getNotificationData:function(){
            var data = {
                content: '',
                title: '',
                error: '',
                clipperError: clipperError
            };
            return data;
        }
    }
}()