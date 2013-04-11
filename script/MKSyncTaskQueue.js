var MKSyncTaskQueue = function() {
	var queue = [],
		currentTask,
		errorQueue = [],
		nextTaskTimer;

	var errorContentTemplate = chrome.i18n.getMessage('noteErrorTemplate');

	function endCurrentTask() {
		//检查当前的任务是否完成
		if (!currentTask) {
			return true;
		}
		if (currentTask.processState == 'success') {
			if (queue.length > 0) {
				NotifyTips.showPersistent('syncTaskSuccess', currentTask.note.note.title, function() {
					NotifyTips.showPersistent('nextTask', queue[0].note.note.title);
				});
			} else if (errorQueue.length > 0) {
				NotifyTips.showTemporary('syncTaskSuccess', currentTask.note.note.title, function() {
					NotifyTips.refresh();
				});
			} else {
				NotifyTips.showTemporary('syncTaskSuccess', currentTask.note.note.title, function() {
					console.log('clear')
					NotifyTips.clear();
				});
			}
			currentTask = null;
			return true;
		} else if (currentTask.processState == 'fail') {
			if (++currentTask.errorCount >= 3) {
				MKSyncTaskQueue.addError(currentTask);
				currentTask = null;
				if (queue.length > 0) {
					NotifyTips.showPersistent('nextTask', queue[0].note.note.title);
				} else {
					NotifyTips.showError()
				}
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
				queue.push(task);
				NotifyTips.showTemporary('syncTaskAdd', task.note.note.title);
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
				}, 1000 * 5)
			})
		},
		end: function() {
			if (endCurrentTask()) {
				MKSyncTaskQueue.start();
			}
		},
		addError: function(task) {
			errorQueue.push(task);
		},
		getErrorContentHTML: function() {
			var html = '';
			for (var index in errorQueue) {
				if (!errorQueue[index].note || !errorQueue[index].note.note) continue;
				var note = errorQueue[index].note.note;
				html += errorContentTemplate.replaceTemplate([note.title, errorQueue[index].guid])
			}
			return html;
		},
		clear: function() {
			queue = [];
		},
		clearError: function() {
			errorQueue = [];
		},
		repeat: function(taskGuid) {
			var index = getErrorIndex(taskGuid);
			var task = errorQueue[index];
			task.errorCount = 0;
			errorQueue = errorQueue.removeAt(index);
			MKSyncTaskQueue.add(task);
			MKSyncTaskQueue.start();
			NotifyTips.refresh(); //重新刷新提示
		},
		remove: function(taskGuid) {
			var index = getErrorIndex(taskGuid);
			var task = errorQueue[index];
			errorQueue = errorQueue.removeAt(index);
			if (queue.length == 0 && currentTask == null && errorQueue.length == 0) {
				NotifyTips.close();
			} else {
				NotifyTips.refresh(); //重新刷新提示
			}
		},
		getErrorQueue: function() {
			return errorQueue;
		}
	}
}();