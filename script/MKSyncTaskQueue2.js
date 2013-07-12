if (!webkitNotifications.createHTMLNotification) {

	var MKSyncTaskQueue = function() {
		var queue = [],
			currentTask,
			errorQueue = [],
			nextTaskTimer,
			baseUrl = chrome.i18n.getMessage('baseUrl');

		var errorContentTemplate = chrome.i18n.getMessage('noteErrorTemplate');

		function endCurrentTask() {
			//检查当前的任务是否完成
			if (!currentTask) {
				return true;
			}
			if (currentTask.processState == 'success') {
				var viewUrl = baseUrl + '/note/previewfull/' + currentTask.note.note.noteid;
				NotifyTips.show('syncTaskSuccess2', [currentTask.note.note.title, viewUrl]);
				currentTask = null;
				return true;
			} else if (currentTask.processState == 'fail') {
				if (++currentTask.errorCount >= 3) {
					currentTask.failed = true;
					// MKSyncTaskQueue.addError(currentTask);
					NotifyTips.show('syncTaskFail', currentTask.note.note.title);
					currentTask = null;
					return true;
				} else {
					currentTask.repeat(function() {
						clearTimeout(nextTaskTimer)
						nextTaskTimer = setTimeout(function() {
							MKSyncTaskQueue.start();
						}, 1000 * 5)
					});
					return false;
				}
			} else {
				return false;
			}
		}

		function getErrorIndex(taskGuid) {
			var index;
			for (index in errorQueue) {
				var task = errorQueue[index];
				if (task.guid == taskGuid) {
					break;
				}
			}
			return index;
		}

		return {
			add: function(task) {
				maikuNote.insureLogin(function() {
					NotifyTips.show('syncTaskAdd', task.note.note.title);
					queue.push(task);
					MKSyncTaskQueue.start();
				});
			},
			start: function() {
				if (!endCurrentTask()) return;

				currentTask = queue.shift();
				if (!currentTask) return;

				//每隔5秒执行下个任务不然短时间一直请求服务器，服务器会认为非法
				currentTask.sync(function() {
					clearTimeout(nextTaskTimer)
					nextTaskTimer = setTimeout(function() {
						MKSyncTaskQueue.start();
					}, 1000 * 10)
				})
			},
			end: function() {
				if (endCurrentTask()) {
					clearTimeout(nextTaskTimer)
					nextTaskTimer = setTimeout(function() {
						MKSyncTaskQueue.start();
					}, 1000 * 10)
				}
			},
			addError: function(task) {
				errorQueue.push(task);
			},
			getErrorContentHTML: function() {
				return;
			},
			clear: function() {
				queue = [];
			},
			clearError: function() {
				errorQueue = [];
			},
			repeat: function(taskGuid) {
				return;
				// var index = getErrorIndex(taskGuid);
				// var task = errorQueue[index];
				// task.errorCount = 0;
				// errorQueue = errorQueue.removeAt(index);
				// MKSyncTaskQueue.add(task);
				// NotifyTips.refresh(); //重新刷新提示
			},
			remove: function(taskGuid) {
				return;
				// var index = getErrorIndex(taskGuid);
				// var task = errorQueue[index];
				// errorQueue = errorQueue.removeAt(index);
				// if (queue.length == 0 && currentTask == null && errorQueue.length == 0) {
				// 	NotifyTips.close();
				// } else {
				// 	NotifyTips.refresh(); //重新刷新提示
				// }
			},
			getErrorQueue: function() {
				return;
				// return errorQueue;
			}
		}
	}();
}