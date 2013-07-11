var MKSyncTask = function(noteData, option) {
    this.state = new MKEvent();
    this.note = new MkSyncNote(noteData, option, this.state);
    this.option = option;
    this.processState = '';
    this.errorCount = 0; //任务出错次数
    this.guid = String.createGuid();
}
MKSyncTask.prototype.sync = function(callback) {
    if(this.option.isSaveMHTML == true && this.option.tab){
        this.syncAsMTHML(callback);
    }
    else{
        this.syncNormal(callback);
    }
}
MKSyncTask.prototype.syncNormal = function(callback) {
    var self = this,
        note = self.note,
        syncState = this.state;
    try {
        /**
         * MKSyncTask的sync来组织具体的同步逻辑
         * 任务的同步方法决定同步完成后的回调
         * 如果每次处理的回调不同，可以继承扩展当前的MKSyncTask
         * 让每个MkSyncNote对象继承Backbone.Events
         */
        this.note.note.noteid = '';
        syncState.off("changeState");
        syncState.on('changeState', function(state, data) {
            if (state == 'note.init') {
                //笔记正在初始化
                note.init();
            } else if (state == 'note.init.success') {
                note.saveImage();
            } else if (state == 'note.init.fail') {
                self.end('fail')
            } else if (state == 'save.images.success') {
                note.saveContent();
            } else if (state == 'save.images.fail') {
                note.delete();
            } else if (state == 'save.saveContent.success') {
                self.end('success');
                callback && callback()
            } else if (state == 'save.saveContent.fail') {
                note.delete();
            } else if (state == 'note.delete.success') {
                self.end('fail');
            } else if (state == 'note.delete.fail') {
                self.end('fail');
            }
        })
        syncState.setState('note.init');
    } catch (e) {
        console.log(e);
        self.end('fail');
    }
}
MKSyncTask.prototype.syncAsMTHML = function(callback) {
    var self = this,
        note = self.note,
        syncState = this.state;
    try {
        /**
         * MKSyncTask的sync来组织具体的同步逻辑
         * 任务的同步方法决定同步完成后的回调
         * 如果每次处理的回调不同，可以继承扩展当前的MKSyncTask
         * 让每个MkSyncNote对象继承Backbone.Events
         */
        this.note.note.noteid = '';
        syncState.off("changeState");
        syncState.on('changeState', function(state, data) {
            if (state == 'note.init') {
                //笔记正在初始化
                note.init();
            } else if (state == 'note.init.success') {
                note.saveMHTML(self.option.tab);
            } else if (state == 'note.init.fail') {
                self.end('fail')
            } else if (state == 'note.mhtml.success') {
                self.end('success');
                callback && callback()
            } else if (state == 'note.mhtml.fail') {
                note.delete();
            } else if (state == 'note.delete.success') {
                self.end('fail');
            } else if (state == 'note.delete.fail') {
                self.end('fail');
            }
        })
        syncState.setState('note.init');
    } catch (e) {
        self.end('fail');
    }
}
MKSyncTask.prototype.end = function(state) {
    this.processState = state;
    MkFileSystem.removeFiles(); //将存储的数据图片删除
    MKSyncTaskQueue.end();
}
MKSyncTask.prototype.repeat = function(callback) {
    NotifyTips.showTemporary('noteRepeatSave',this.note.note.title);
    console.log('repeat');
    this.sync(callback);
}