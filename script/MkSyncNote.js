var MkSyncNote = function(noteData, option, stateEvent) {
    var defaultData = {
        title: '[未命名笔记]',
        sourceurl: '',
        notecontent: '',
        tags: '',
        categoryid: '',
        noteid: '',
        importance: 0
    };
    this.option = option || {};
    this.images = [];
    noteData = noteData || {};
    this.note = {};
    $.extend(this.note, defaultData, noteData);
    this.noteEl = $('<div></div>').append(this.note.notecontent);
    this.note.notecontent = ''; //this.noteEl.html();
    if (!stateEvent) {
        this.syncState = {};
        this.syncState.setState = function() {};
    } else {
        this.syncState = stateEvent;
    }
}
MkSyncNote.prototype.init = function() {
    console.log('noteInit');
    var self = this,
        option = self.option,
        content = self.note.notecontent;
    this.images = [];
    NotifyTips.showPersistent('noteInit', self.note.title);
    self.post(function(data) {
        console.log('note.init.success');
        self.note.noteid = data.Note.NoteID;
        self.note.notecontent = content;
        NotifyTips.showPersistent('noteInitSuccess', self.note.title);
        self.syncState.setState('note.init.success', arguments);
    }, function() {
        NotifyTips.showPersistent('noteInitFail', self.note.title);
        self.syncState.setState('note.init.fail', arguments);
    })
}
MkSyncNote.prototype.saveImage = function() {
    var self = this;
    NotifyTips.showPersistent('saveImages', self.note.title);
    self.saveImages();
}
MkSyncNote.prototype.saveContent = function() {
    var self = this;
    self.note.notecontent = self.noteEl.html();
    self.post(function(data) {
        self.syncState.setState('save.saveContent.success', arguments);
    }, function() {
        self.syncState.setState('save.saveContent.fail', arguments)
    })
}
MkSyncNote.prototype.post = function(successCallback, failCallback) {
    var self = this,
        option = self.option,
        images = self.images,
        note = self.note;
    $.ajax({
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        },
        type: 'POST',
        url: option.baseUrl + '/note/save',
        data: JSON.stringify(note),
        success: function(data) {
            if (data.error) {
                if (data.error == 'notlogin') {
                    NotifyTips.showPersistent('syncTaskAdd');
                } else {
                    NotifyTips.showPersistent('SaveNoteFailed');
                }
                failCallback && failCallback();
                return;
            }
            successCallback && successCallback(data);
        },
        error: function(jqXHR, textStatus, errorThrown) {
            failCallback && failCallback();
        }
    });
}
MkSyncNote.prototype.delete = function() {
    var self = this,
        option = self.option,
        noteid = self.note.noteid;
    $.ajax({
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        },
        url: option.baseUrl + "/note/delete",
        type: "POST",
        data: '{"noteIds":"' + noteid + '"}',
        success: function(data) {
            // NotifyTips.showPersistent('noteDeleteFail', self.note.title);
            self.syncState.setState('note.delete.success', self.note.title);
        },
        error: function() {
            // NotifyTips.showPersistent('noteDeleteFail', self.note.title);
            self.syncState.setState('note.delete.fail')
        }
    });
}
MkSyncNote.prototype.saveImages = function() {
    var self = this,
        option = self.option,
        note = self.note;
    var imgs = $(self.noteEl).find('img'),
        filteredImg = [];
    //maikuNoteOptions.serializeImg 要修改 改成传入参数而不是全局的
    if (maikuNoteOptions.serializeImg) {
        for (var i = 0; i < imgs.length; i++) {
            var img = imgs[i];
            if (img.src.indexOf('data:image/') >= 0) continue; //有些插件在页面上有图
            if (img.src in filteredImg) continue;

            var obj = {};
            obj[img.src] = 1;
            filteredImg.push(obj);
            self.images.push(new MkSyncImage(img));
        }
    }
    if (self.images.length) {
        NotifyTips.showPersistent('uploadImages');
        var syncImages = new MkSyncImages(note, self.images, option);
        syncImages.upload(function(htmlImages, serverImages) {
            for (var i = 0; i < serverImages.length; i++) {
                var serverQueueItem = serverImages[i],
                    htmlQueueItem = htmlImages[i];
                for (var j = 0; j < serverQueueItem.length; j++) {
                    var serverImgData = serverQueueItem[j];
                    htmlQueueItem[j].image.src = serverImgData.Url;
                }
            }
            NotifyTips.showPersistent('uploadImagesSuccess');
            self.syncState.setState('save.images.success')
        }, function() {
            NotifyTips.showPersistent('uploadImagesFail');
            self.syncState.setState('save.images.fail', arguments)
        })
    } else {
        //不需要保存图片只要将状态设置为图片已经完成上传，继续后续事件
        self.syncState.setState('save.images.success')
    }
}
MkSyncNote.prototype.saveMHTML = function(tab) {
    var self = this;
    NotifyTips.showPersistent('noteSaveAsMHTML', self.note.title);
    chrome.pageCapture.saveAsMHTML({
        tabId: tab.id
    }, function(mhtmlBlob) {
        MkFileSystem.create(mhtmlBlob.size, self.note.title + '.mhtml', mhtmlBlob, function(file) {
            var formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'Attachment');
            formData.append('id', self.note.noteid);
            $.ajax({
                url: self.option.baseUrl + "/attachment/save",
                type: "POST",
                data: formData,
                processData: false,
                contentType: false,
                success: function(data) {
                    NotifyTips.showPersistent('noteMHTMLSuccess', self.note.title);
                    self.syncState.setState('note.mhtml.success', arguments);
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    NotifyTips.showPersistent('noteMHTMLFail', self.note.title);
                    self.syncState.setState('note.mhtml.fail', arguments);
                }
            });
        })
    });
}