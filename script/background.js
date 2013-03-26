//@huntbao @mknote
//All right reserved
//Notice: chrome version below 20 will not work for this extension
//(since it has no chrome.extension.sendMessage method and Blob() constructor is illegal and etc.)
(function($) {
    'use strict';
    window.maikuNote = {
        init: function() {
            var self = this;
            self.jQuerySetUp();
            self.browserAction();
            self.initManagement();
            self.initExtensionConnect();
            self.initTabEvents();
            self.initExtensionRequest();
            self.showExtensionGuide();
            //self.removeFileSystems();
            //self.initOmnibox();
        },
        browserAction: function() {
            var self = this;
            chrome.browserAction.onClicked.addListener(function(tab) {
                if (!chrome.extension.sendMessage) {
                    self.notifyHTML(chrome.i18n.getMessage("BrowserTooLower"), 30000);
                    return;
                }
                self.createPopup();
            });
        },
        createPopup: function() {
            chrome.tabs.executeScript(null, {
                code: "maikuClipper.createPopup();"
            });
        },
        closePopup: function() {
            chrome.tabs.executeScript(null, {
                code: "maikuClipper.closePopup();"
            });
        },
        initContextMenus: function(beforeCreate) {
            var self = this;
            if (!chrome.extension.sendMessage) {
                return;
            }
            if (self.isCreatingContextMenus) return;
            self.isCreatingContextMenus = true;
            chrome.contextMenus.removeAll(function() {
                self.createTopPriorityContextMenu();
                beforeCreate && beforeCreate();
                self.createNormalContextMenus();
            });
        },
        createTopPriorityContextMenu: function() {
            var self = this;
            chrome.contextMenus.create({
                contexts: ['selection'],
                title: chrome.i18n.getMessage("clipSelectionContextMenu"),
                onclick: function(info, tab) {
                    chrome.tabs.executeScript(tab.id, {
                        code: "maikuClipper.getSelectedContent();"
                    });
                }
            });
        },
        createNormalContextMenus: function() {
            var self = this;
            chrome.contextMenus.create({
                contexts: ['image'],
                title: chrome.i18n.getMessage('clipImageContextMenu'),
                onclick: function(info, tab) {
                    self.saveImgs({
                        imgs: [info.srcUrl],
                        title: tab.title,
                        imgTitles: [tab.title],
                        sourceurl: tab.url
                    });
                }
            });
            chrome.contextMenus.create({
                contexts: ['link'],
                title: chrome.i18n.getMessage('clipLinkContextMenu'),
                onclick: function(info, tab) {
                    chrome.tabs.executeScript(tab.id, {
                        code: "maikuClipper.getLinkInfoByUrl('" + info.linkUrl + "');"
                    });
                }
            });
            chrome.contextMenus.create({
                contexts: ['page'],
                title: chrome.i18n.getMessage('clipPageContextMenu'),
                onclick: function(info, tab) {
                    self.notifyHTML(chrome.i18n.getMessage('IsClippingPage'), false);
                    chrome.tabs.executeScript(tab.id, {
                        code: "maikuClipper.getPageContent();"
                    });
                }
            });
            chrome.contextMenus.create({
                contexts: ['page'],
                title: chrome.i18n.getMessage('clipAllImageContextMenu'),
                onclick: function(info, tab) {
                    chrome.tabs.executeScript(tab.id, {
                        code: "maikuClipper.getAllImages();"
                    });
                }
            });
            chrome.contextMenus.create({
                contexts: ['page'],
                title: chrome.i18n.getMessage('clipAllLinkContextMenu'),
                onclick: function(info, tab) {
                    chrome.tabs.executeScript(tab.id, {
                        code: "maikuClipper.getAllLinks();"
                    });
                }
            });
            chrome.contextMenus.create({
                type: 'separator',
                contexts: ['all']
            });

            chrome.contextMenus.create({
                contexts: ['page'],
                title: chrome.i18n.getMessage('clipPageUrlContextMenu'),
                onclick: function(info, tab) {
                    var content = '<img src="' + tab.favIconUrl + '" title="' + tab.title + '" alt="' + tab.title + '"/>' + '<a href="' + tab.url + '" title="' + tab.title + '">' + tab.url + '</a>';
                    self.saveNote(tab.title, tab.url, content);
                }
            });
            chrome.contextMenus.create({
                contexts: ['page'],
                title: chrome.i18n.getMessage('pageCaptureContextMenu'),
                onclick: function(info, tab) {
                    self.insureLogin(function() {
                        chrome.pageCapture.saveAsMHTML({
                            tabId: tab.id
                        }, function(mhtmlBlob) {
                            self.notifyHTML(chrome.i18n.getMessage('IsClippingPage'), false);
                            window.requestFileSystem(TEMPORARY, mhtmlBlob.size, function(fs) {
                                self.writeBlobAndSendFile(fs, mhtmlBlob, tab.title + '.mhtml', function(file) {
                                    self.notifyHTML(chrome.i18n.getMessage('pageCaptureUploading'));
                                    var formData = new FormData();
                                    formData.append('file', file);
                                    formData.append('type', 'Attachment');
                                    $.ajax({
                                        url: self.baseUrl + "/attachment/save/",
                                        type: "POST",
                                        data: formData,
                                        processData: false,
                                        contentType: false,
                                        success: function(data) {
                                            if (data.error) {
                                                //todo: server error, pending note...
                                                console.log('Internal error: ')
                                                console.log(data.error)
                                                return;
                                            }
                                            var d = data.Attachment;
                                            self.removeFile(d.FileName, d.FileSize);
                                            self.saveNote(tab.title, tab.url, '', '', '', d.NoteID);
                                        },
                                        error: function(jqXHR, textStatus, errorThrown) {
                                            console.log('xhr error: ')
                                            console.log(textStatus)
                                        }
                                    });

                                }, function() {
                                    self.notifyHTML(chrome.i18n.getMessage('pageCaptureFailed'));
                                });
                            }, self.onFileError);
                        });
                    });
                }
            });

            chrome.contextMenus.create({
                type: 'separator',
                contexts: ['all']
            });
            chrome.contextMenus.create({
                title: chrome.i18n.getMessage("newNoteContextMenu"),
                contexts: ['all'],
                onclick: function(info, tab) {
                    self.createPopup();
                }
            });
            chrome.contextMenus.create({
                type: 'separator',
                contexts: ['all']
            });
            chrome.contextMenus.create({
                title: chrome.i18n.getMessage("RetrieveRemoteImg"),
                contexts: ['all'],
                type: 'checkbox',
                checked: maikuNoteOptions.serializeImg || false,
                onclick: function(info, tab) {
                    self.setMaikuOption('serializeImg', info.checked);
                }
            });
            self.isCreatingContextMenus = false;
        },
        insureLogin: function(callback) {
            var self = this;
            if (self.userData) {
                callback && callback();
            } else {
                self.notifyHTML(chrome.i18n.getMessage('NotLogin'), false);
                self.checkLogin(function() {
                    callback && callback();
                });
            }
        },
        saveNote: function(title, sourceurl, notecontent, tags, categoryid, noteid, importance, successCallback, failCallback) {
            var self = this;
            self.insureLogin(function() {
                self._saveNote(title, sourceurl, notecontent, tags, categoryid, noteid, importance, successCallback, failCallback);
            });
        },
        _saveNote: function(title, sourceurl, notecontent, tags, categoryid, noteid, importance, successCallback, failCallback) {
            var self = this;
            if (!title && !notecontent) {
                self.notifyHTML(chrome.i18n.getMessage('CannotSaveBlankNote'));
                return;
            }
            var dataObj = {
                title: self.getTitleByText(title),
                sourceurl: sourceurl,
                notecontent: notecontent,
                tags: tags || '',
                categoryid: categoryid || '',
                noteid: noteid || '',
                importance: importance || 0
            }
            self.notifyHTML(chrome.i18n.getMessage('IsSavingNote'), false);
            $.ajax({
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                },
                type: 'POST',
                url: self.baseUrl + '/note/save',
                data: JSON.stringify(dataObj),
                success: function(data) {
                    if (data.error) {
                        if (data.error == 'notlogin') {
                            self.notifyHTML(chrome.i18n.getMessage('NotLogin'));
                        } else {
                            self.notifyHTML(chrome.i18n.getMessage('SaveNoteFailed'));
                        }
                        failCallback && failCallback();
                        return;
                    }
                    successCallback && successCallback();
                    var successTip = chrome.i18n.getMessage('SaveNoteSuccess'),
                        viewURL = self.baseUrl + '/note/previewfull/' + data.Note.NoteID,
                        viewTxt = chrome.i18n.getMessage('ViewText');
                    self.notifyHTML(successTip + '<a href="' + viewURL + '" target="_blank" id="closebtn">' + viewTxt + '</a>', 10000);
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    failCallback && failCallback();
                    self.notifyHTML(chrome.i18n.getMessage('SaveNoteFailed'));
                }
            });
        },
        saveImgs: function(msg, successCallback, failCallback) {
            var self = this;
            self.insureLogin(function() {
                self._saveImgs(msg, successCallback, failCallback);
            });
        },
        _saveImgs: function(msg, successCallback, failCallback) {
            var self = this,
                content = '',
                imgs = msg.imgs,
                titles = msg.imgTitles,
                saveNormalNote = function() {
                    for (var i = 0, l = imgs.length; i < l; i++) {
                        content += '<img src="' + imgs[i] + '" title="' + titles[i] + '" alt="' + titles[i] + '"><br />';
                    }
                    self.saveNote(msg.title, msg.sourceurl, content, msg.tags);
                }
            if (maikuNoteOptions.serializeImg) {
                //retrieve remote images
                self.notifyHTML(chrome.i18n.getMessage('isRetrievingRemoteImgTip'), false);
                var totalImgNum = imgs.length,
                    serializeSucceedImgNum = 0,
                    serializeFailedImgNum = 0,
                    serializeSucceedImgIndex = [],
                    serializeSucceedImgIndexByOrder = {},
                    files = {},
                    removeFiles = function() {
                        for (var idx in files) {
                            self.removeFile(files[idx].name, files[idx].size);
                        }
                    },
                    checkComplete = function() {
                        if (serializeSucceedImgNum + serializeFailedImgNum == totalImgNum) {
                            if (serializeFailedImgNum == totalImgNum) {
                                //all images retrieve failed
                                if (failCallback) {
                                    //is replace images in page content
                                    failCallback(true);
                                } else {
                                    self.notifyHTML(chrome.i18n.getMessage('RetrieveImagesFailed'));
                                    saveNormalNote();
                                }
                                return false;
                            }
                            for (var i = 0, l = serializeSucceedImgIndex.length; i < l; i++) {
                                serializeSucceedImgIndexByOrder[serializeSucceedImgIndex[i]] = i.toString();
                            }
                            self.notifyHTML(chrome.i18n.getMessage('isUploadingImagesTip'), false);

                            var currentCompletedCount = 0;
                            for (var itemIndex in formDataQueue) {
                                var formDataItem = formDataQueue[itemIndex];
                                (function(index) {
                                    $.ajax({
                                        url: self.baseUrl + "/attachment/savemany/",
                                        type: "POST",
                                        data: formDataItem,
                                        processData: false,
                                        contentType: false,
                                        success: function(data) {
                                            if (data.error) {
                                                //todo: server error, pending note...
                                                console.log('Internal error: ');
                                                console.log(data.error);
                                                if (failCallback) {
                                                    failCallback(true);
                                                }
                                                removeFiles();
                                                return;
                                            }
                                            if (successCallback) {
                                                //is replace images in page content
                                                successCallback(data, needReplaceImgsQueue[index], data[0].NoteID, ++currentCompletedCount >= formDataQueue.length);
                                            } else {
                                                var d, noteId = data[0].NoteID,
                                                    realIndex;
                                                for (var i = 0, l = totalImgNum; i < l; i++) {
                                                    realIndex = serializeSucceedImgIndexByOrder[i];
                                                    if (realIndex) {
                                                        d = data[realIndex];
                                                        content += '<img src="' + d.Url + '" title="' + titles[i] + '" alt="' + titles[i] + '"><br />';
                                                        delete serializeSucceedImgIndexByOrder[i];
                                                    } else {
                                                        content += '<img src="' + imgs[i] + '" title="' + titles[i] + '" alt="' + titles[i] + '"><br />';
                                                    }
                                                }
                                                if (++currentCompletedCount >= formDataQueue.length) {
                                                    self.saveNote(msg.title, msg.sourceurl, content, msg.tags, '', noteId);
                                                }
                                            }
                                            if (currentCompletedCount >= formDataQueue.length) {
                                                removeFiles();
                                            }
                                        },
                                        error: function(jqXHR, textStatus, errorThrown) {
                                            console.log('xhr error: ')
                                            console.log(textStatus)
                                            removeFiles();
                                            self.notifyHTML(chrome.i18n.getMessage('UploadImagesFailed'));
                                        }
                                    });
                                })(itemIndex);
                            }
                        }
                    };
                // formData = new FormData();
                // formData.append('type', maikuNoteOptions.imageAttachment ? 'Attachment' : 'Embedded');
                // formData.append('categoryId', msg.categoryId || '');
                // formData.append('id', msg.id || '');
                var maxUploadSize = 1024 * 1024 * 10,
                    currentUploadSize = 0,
                    formDataQueue = [],
                    needReplaceImgsQueue = [],
                    formData, needReplaceImgsAry;
                for (var i = 0, l = totalImgNum; i < l; i++) {
                    self.downloadImage(imgs[i], i, function(file, idx) {
                        serializeSucceedImgNum++;
                        // serializeSucceedImgIndex.push(idx);
                        if (currentUploadSize + file.size > maxUploadSize || !formData || !needReplaceImgsAry) {
                            formData = self.createFormData(msg.id, maikuNoteOptions.imageAttachment, msg.categoryId);
                            formDataQueue.push(formData);
                            needReplaceImgsAry = [];
                            needReplaceImgsQueue.push(needReplaceImgsAry)
                            currentUploadSize = 0;
                        }
                        currentUploadSize += file.size;
                        formData.append('file' + idx, file);
                        files[idx] = file;
                        needReplaceImgsAry.push(imgs[idx])
                        checkComplete();
                    }, function(idx) {
                        serializeFailedImgNum++;
                        checkComplete();
                    });
                }
            } else {
                saveNormalNote();
            }
        },
        createFormData: function(noteId, type, categoryId) {
            var f = new FormData();
            f.append('type', type ? 'Attachment' : 'Embedded');
            f.append('categoryId', categoryId || '');
            f.append('id', noteId || '');
            return f;
        },
        initExtensionConnect: function() {
            var self = this;
            chrome.extension.onConnect.addListener(function(port) {
                switch (port.name) {
                    case 'gethost':
                        self.gethostHandlerConnect(port);
                        break;
                    case 'savenotefrompopup':
                        self.savenotefrompopupHandler(port);
                        break;
                    case 'allimages':
                        self.allimagesHandlerConnect(port);
                        break;
                    case 'link':
                        self.linkHandlerConnect(port);
                        break;
                    case 'alllinks':
                        self.alllinksHandlerConnect(port);
                        break;
                    case 'getpagecontent':
                    case 'getselectedcontent':
                        self.getpagecontentConnect(port);
                        break;
                    case 'maikuclipperisnotready':
                        self.maikuclipperisnotreadyHandlerConnect(port);
                        break;
                    case 'actionfrompopupinspecotr':
                        self.actionfrompopupinspecotrHandler(port);
                        break;
                    case 'noarticlefrompage':
                        self.noarticlefrompageHandler(port);
                        break;
                    default:
                        break;
                }
            });
        },
        gethostHandlerConnect: function(port) {
            var self = this;
            port.onMessage.addListener(function(data) {
                maikuNoteUtil.createParticularContextMenu(data.host);
            });
        },
        savenotefrompopupHandler: function(port) {
            var self = this;
            // var taskQueue = MKSyncTaskQueue();
            port.onMessage.addListener(function(msg) {
                var note = {
                    title: msg.title,
                    sourceurl: msg.sourceurl,
                    notecontent: msg.notecontent,
                    tags: msg.tags,
                    categoryid: msg.categoryid
                }
                MKSyncTaskQueue.add(new MKSyncTask(note, self))
                MKSyncTaskQueue.start()
                //     var defaultData = {
                //     title: '[未命名笔记]',
                //     sourceurl: '',
                //     notecontent: '',
                //     tags: '',
                //     categoryid: '',
                //     noteid: '',
                //     importance: 0
                // };
                /*
                var normalSave = function() {
                        self.saveNote(msg.title, msg.sourceurl, msg.notecontent, msg.tags, msg.categoryid, '', '', function() {
                            self.closePopup();
                        });
                    }
                if(maikuNoteOptions.serializeImg) {
                    var content = $('<div></div>').append(msg.notecontent),
                        imgs = content.find('img'),
                        needReplaceImgs = [],
                        filteredImg = {},
                        filteredImgTitles = [],
                        isToSave = function(url) {
                            var suffix = url.substr(url.length - 4);
                            return /^\.(gif|jpg|png)$/.test(suffix);
                        }
                    if(imgs.length > 0) {
                        for(var i = 0, img, l = imgs.length, src; i < l; i++) {
                            img = imgs[i];
                            src = img.src;
                            // 图片的格式不仅仅有gif,jpg,png 可能还有别的
                            // 也有可能没有扩展名或含有"?"+随机字符串的格式
                            // 暂时去掉
                            // if(!isToSave(src)) continue;
                            if(filteredImg[src]) continue;
                            filteredImg[src] = 1;
                            filteredImgTitles.push(img.title || img.alt || '');
                            needReplaceImgs.push(img);
                        }
                        self.saveImgs({
                            imgs: Object.keys(filteredImg),
                            imgTitles: filteredImgTitles,
                            title: msg.title,
                            sourceurl: msg.sourceurl,
                            categoryId: msg.categoryid
                        }, function(uploadedImageData, needReplaceQueueItem, noteId, isSave) {
                            var realIndex, d, needImg;
                            for(var i = 0, l = uploadedImageData.length; i < l; i++) {
                                if((d = uploadedImageData[i]) && (needImg = needReplaceQueueItem[i])) {
                                    needImg.src = d.Url;
                                }
                                // realIndex = serializeSucceedImgIndexByOrder[i];
                                // if(realIndex) {
                                //     d = uploadedImageData[realIndex];
                                //     needReplaceImgs[i].src = d.Url;
                                //     delete serializeSucceedImgIndexByOrder[i];
                                // }
                            }
                            if(isSave) {
                                self.saveNote(msg.title, msg.sourceurl, content.html(), msg.tags, msg.categoryid, noteId, '', function() {
                                    self.closePopup();
                                });
                            }
                        }, function() {
                            //all images upload failed or serialize failed, just save the clipped content
                            normalSave();
                        });
                    } else {
                        normalSave();
                    }
                } else {
                    normalSave();
                }
                */
            });
        },
        allimagesHandlerConnect: function(port) {
            var self = this;
            port.onMessage.addListener(function(msg) {
                self.saveImgs(msg);
            });
        },
        linkHandlerConnect: function(port) {
            var self = this;
            port.onMessage.addListener(function(msg) {
                var content = '<a href="' + msg.linkUrl + '" title="' + msg.title + '">' + msg.text + '</a>';
                self.saveNote(msg.title, msg.sourceurl, content);
            });
        },
        alllinksHandlerConnect: function(port) {
            var self = this;
            port.onMessage.addListener(function(msg) {
                var content = '',
                    links = msg.links;
                for (var i = 0, l = links.length, link; i < l; i++) {
                    link = links[i];
                    content += '<a href="' + link.linkUrl + '" title="' + link.title + '">' + link.text + '</a><br />';
                }
                self.saveNote(msg.title, msg.sourceurl, content);
            });
        },
        getpagecontentConnect: function(port) {
            var self = this;
            port.onMessage.addListener(function(msg) {
                if (maikuNoteOptions.serializeImg) {
                    var content = $('<div></div>').append(msg.content),
                        imgs = content.find('img'),
                        needReplaceImgs = [],
                        filteredImg = {},
                        filteredImgTitles = [],
                        isToSave = function(url) {
                            var suffix = url.substr(url.length - 4);
                            return /^\.(gif|jpg|png)$/.test(suffix);
                        }
                    if (imgs.length === 0) {
                        self.saveNote(msg.title, msg.sourceurl, msg.content);
                        return;
                    }
                    for (var i = 0, img, l = imgs.length, src; i < l; i++) {
                        img = imgs[i];
                        src = img.src;
                        if (!isToSave(src)) continue;
                        if (filteredImg[src]) continue;
                        filteredImg[src] = 1;
                        filteredImgTitles.push(img.title || img.alt || '');
                        needReplaceImgs.push(img);
                    }
                    self.saveImgs({
                        imgs: Object.keys(filteredImg),
                        imgTitles: filteredImgTitles,
                        title: msg.title,
                        sourceurl: msg.sourceurl
                    }, function(uploadedImageData, serializeSucceedImgIndexByOrder, noteId) {
                        var realIndex, d;
                        for (var i = 0, l = needReplaceImgs.length; i < l; i++) {
                            realIndex = serializeSucceedImgIndexByOrder[i];
                            if (realIndex) {
                                d = uploadedImageData[realIndex];
                                needReplaceImgs[i].src = d.Url;
                                delete serializeSucceedImgIndexByOrder[i];
                            }
                        }
                        self.saveNote(msg.title, msg.sourceurl, content.html(), '', '', noteId);
                    }, function() {
                        //all images upload failed or serialize failed, just save the page
                        self.saveNote(msg.title, msg.sourceurl, msg.content);
                    });
                } else {
                    self.saveNote(msg.title, msg.sourceurl, msg.content);
                }
            });
        },
        maikuclipperisnotreadyHandlerConnect: function(port) {
            var self = this;
            port.onMessage.addListener(function(msg) {
                self.notifyHTML(chrome.i18n.getMessage('ClipperNotReady'));
            });
        },
        actionfrompopupinspecotrHandler: function(port) {
            var self = this;
            port.onMessage.addListener(function(data) {
                //send to popup
                chrome.tabs.sendRequest(port.sender.tab.id, {
                    name: 'actionfrompopupinspecotr',
                    data: data
                });
            });
        },
        noarticlefrompageHandler: function(port) {
            var self = this;
            port.onMessage.addListener(function(data) {
                self.notifyHTML(chrome.i18n.getMessage('NoArticleFromPage'));
            });
        },
        onFileError: function(err) {
            for (var p in FileError) {
                if (FileError[p] == err.code) {
                    console.log('Error code: ' + err.code + 'Error info: ' + p);
                    break;
                }
            }
        },
        writeBlobAndSendFile: function(fs, blob, fileName, successCallback, errorCallback, imgIndex) {
            var self = this;
            fs.root.getFile(fileName, {
                create: true
            }, function(fileEntry) {
                fileEntry.createWriter(function(fileWriter) {
                    fileWriter.onwrite = function(e) {
                        console.log('Write completed.');
                        fileEntry.file(function(file) {
                            successCallback(file, imgIndex);
                        });
                    };
                    fileWriter.onerror = function(e) {
                        console.log('Write failed: ' + e.toString());
                    };
                    fileWriter.write(blob);
                }, self.onFileError);
            }, self.onFileError);
        },
        downloadImage: function(url, imgIndex, successCallback, errorCallback) {
            var self = this;
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = function(e) {
                if (this.status == 200) {
                    var suffix = url.split('.'),
                        blob = new Blob([this.response], {
                            type: 'image/' + suffix[suffix.length - 1]
                        }),
                        parts = url.split('/'),
                        fileName = parts[parts.length - 1];
                    window.requestFileSystem(TEMPORARY, this.response.byteLength, function(fs) {
                        self.writeBlobAndSendFile(fs, blob, fileName, successCallback, errorCallback, imgIndex);
                    }, self.onFileError);
                }
            }
            xhr.onerror = function() {
                console.log('retrieve remote image xhr onerror')
                errorCallback && errorCallback(imgIndex);
            }
            xhr.onabort = function() {
                console.log('retrieve remote image xhr onabort')
                errorCallback && errorCallback(imgIndex);
            }
            xhr.send(null);
        },
        removeFile: function(fileName, fileSize) {
            var self = this;
            window.requestFileSystem(TEMPORARY, fileSize, function(fs) {
                fs.root.getFile(fileName, {}, function(fileEntry) {
                    fileEntry.remove(function() {
                        console.log('File ' + fileName + ' removed.');
                    }, self.onFileError);
                }, self.onFileError);
            }, self.onFileError);
        },
        notify: function(content, lastTime, title, icon) {
            //deprecated
            if (!content) return;
            title = title || '';
            icon = icon || '../images/icons/48x48.png';
            if (self.notification) self.notification.cancel();
            self.notification = webkitNotifications.createNotification(
            icon, title, content);
            self.notification.show();
            if (lastTime !== false) {
                setTimeout(function() {
                    self.notification.cancel();
                }, lastTime || 5000);
            }
        },
        notifyHTML: function(content, lastTime, title) {
            if (!content) return;
            var self = this;
            self.notificationData = {
                content: content,
                title: title || ''
            }
            if (self.notification) {
                clearTimeout(self.notificationTimer);
                //chrome version below 20 has no such method
                if (chrome.extension.sendMessage) {
                    chrome.extension.sendMessage({
                        name: 'sendnotification',
                        data: self.notificationData
                    });
                }
            } else {
                self.notification = webkitNotifications.createHTMLNotification('notification.html');
                self.notification.addEventListener('close', function(e) {
                    self.notification = null;
                });
                self.notification.show();
            }
            if (lastTime !== false) {
                self.notificationTimer = setTimeout(function() {
                    self.notification && self.notification.cancel();
                }, lastTime || 5000);
            }
        },
        checkLogin: function(callback) {
            var self = this;
            self.getUser(function(user) {
                if (!user) {
                    chrome.windows.create({
                        url: self.baseUrl + "/login",
                        type: "popup",
                        height: 600,
                        width: 800,
                        left: 0,
                        top: 0
                    }, function(win) {
                        var tabId = win.tabs[0].id;
                        chrome.tabs.onUpdated.addListener(function HandlerConnect(id, info) {
                            if (info.status == 'loading' && id == tabId) {
                                self.getUser(function(user) {
                                    if (user) {
                                        chrome.tabs.onUpdated.removeListener(HandlerConnect);
                                        chrome.windows.remove(win.id, callback(user));
                                    }
                                });
                            }
                        });
                    });
                } else {
                    callback(user);
                }
            });
        },
        checkLogout: function(callback) {
            var self = this;
            chrome.cookies.get({
                url: self.baseUrl,
                name: ".iNoteAuth"
            }, function(cookie) {
                if (cookie) {
                    chrome.windows.create({
                        url: self.baseUrl + "/account/logout",
                        type: "panel"
                    }, function(win) {
                        var tabId = win.tabs[0].id;
                        chrome.tabs.onUpdated.addListener(function HandlerConnect(id, info) {
                            if (info.status == 'loading' && id == tabId) {
                                chrome.cookies.get({
                                    url: self.baseUrl,
                                    name: ".iNoteAuth"
                                }, function(cookie) {
                                    if (!cookie) {
                                        self.userData = null;
                                        chrome.tabs.onUpdated.removeListener(HandlerConnect);
                                        chrome.windows.remove(win.id, callback);
                                    }
                                });
                            }
                        });
                    });
                } else {
                    callback();
                }
            });
        },
        initManagement: function() {
            // uninstall old version
            chrome.management.getAll(function(exs) {
                for (var i = exs.length - 1; i > 0; i--) {
                    if (exs[i].id == "mfhkadpfndbefbpibomdbdbnnpmjiaoh") {
                        chrome.management.uninstall("mfhkadpfndbefbpibomdbdbnnpmjiaoh");
                    }
                    if (exs[i].id == "blabbhjfbhclflhnbbapahfkhpcmgeoh") {
                        chrome.management.uninstall("blabbhjfbhclflhnbbapahfkhpcmgeoh");
                    }
                }
            });
        },
        getTitleByText: function(txt) {
            //todo
            var self = this,
                finalTitle = '';
            if (txt.length <= 100) return txt;
            if (txt.length > 0) {
                var t = txt.substr(0, 100),
                    l = t.length,
                    i = l - 1,
                    hasSpecialChar = false;
                //9 : HT 
                //10 : LF 
                //44 : ,
                //65292 : ，
                //46 :　．
                //12290 : 。
                //59 : ;
                //65307 : ；
                while (i >= 0) {
                    if (/^(9|10|44|65292|46|12290|59|65307)$/.test(t.charCodeAt(i))) {
                        hasSpecialChar = true;
                        break;
                    } else {
                        i--;
                    }
                }
                hasSpecialChar ? (t = t.substr(0, i)) : '';
                i = 0;
                l = t.length;
                while (i < l) {
                    if (/^(9|10)$/.test(t.charCodeAt(i))) {
                        break;
                    } else {
                        finalTitle += t.charAt(i);
                        i++;
                    }
                }
            }
            finalTitle = finalTitle.trim();
            return finalTitle.length > 0 ? finalTitle : '[未命名笔记]';
        },
        jQuerySetUp: function() {
            $.ajaxSetup({
                dataType: 'text',
                cache: false,
                dataFilter: function(data) {
                    data = $.parseJSON(data.substr(9)); //remove 'while(1);'
                    return data.success ? data.data : {
                        error: data.error
                    };
                },
                beforeSend: function(xhr) {
                    xhr.setRequestHeader('UserClient', 'inote_web_chromeext/3.1.0');
                }
            });
        },
        initTabEvents: function() {
            var self = this;
            chrome.tabs.onActivated.addListener(function(info, tab) {
                //console.log('tab changed');
                chrome.tabs.executeScript(null, {
                    code: "maikuClipper.getHost();"
                });
            });
            chrome.tabs.onUpdated.addListener(function(id, info, tab) {
                if (info.status == 'loading') {
                    //console.log('tab updated');
                    maikuNoteUtil.createParticularContextMenu(tab.url.split('/')[2]);
                }
                if (info.status == 'complete') {
                    //maybe login, maybe logout, update user data
                    //listen any page, since user can login from any page, not just http://note.sdo.com or http://passport.note.sdo.com
                    chrome.cookies.get({
                        url: self.baseUrl,
                        name: '.iNoteAuth'
                    }, function(cookie) {
                        if (cookie) {
                            if (!self.userData) {
                                self.getUser(function() {});
                            }
                        } else {
                            self.userData = null;
                        }
                    });
                }
            });
        },
        initExtensionRequest: function() {
            var self = this;
            chrome.extension.onRequest.addListener(function(request, sender) {
                if (!sender || sender.id !== chrome.i18n.getMessage("@@extension_id")) return;
                switch (request.name) {
                    case 'getuser':
                        self.getuserHandlerRequest(sender, request.refresh);
                        break;
                    case 'popuplogin':
                        self.checkLogin(function(user) {
                            chrome.tabs.sendRequest(sender.tab.id, {
                                name: 'userlogined',
                                user: user,
                                settings: self.getSettings()
                            });
                        });
                        break;
                    case 'popuplogout':
                        self.checkLogout(function() {
                            chrome.tabs.sendRequest(sender.tab.id, {
                                name: 'userlogouted'
                            });
                        });
                        break;
                    case 'clicksavebtnwithoutloginpopup':
                        //popup, click save button, button user has not logined
                        self.checkLogin(function(user) {
                            chrome.tabs.sendRequest(sender.tab.id, {
                                name: 'clicksavebtnafteruserloginedpopup',
                                user: user,
                                settings: self.getSettings()
                            });
                        });
                    case 'setdefaultcategory':
                        //change category,store it
                        self.setMaikuOption('defaultCategory', request.defaultCategory);
                        break;
                    case 'setautoextract':
                        //change auto extract content option, store it
                        self.setMaikuOption('autoExtractContent', request.value);
                        break;
                    case 'createoptionstab':
                        chrome.tabs.create({
                            url: chrome.i18n.getMessage('helperUrl')
                        });
                        break;
                    default:
                        break;
                }
            });
        },
        getuserHandlerRequest: function(sender, refresh) {
            var self = this;
            if (refresh) {
                //user refresh infomation
                self.userData = null; //this will force to fetch newest info
            }
            self.getUser(function(user) {
                chrome.tabs.sendRequest(sender.tab.id, {
                    name: 'getuser',
                    user: user,
                    settings: self.getSettings(),
                    refresh: refresh
                });
            });
        },
        getUser: function(callback) {
            var self = this;
            if (self.userData) {
                callback(self.userData);
                return;
            }
            chrome.cookies.get({
                url: self.baseUrl,
                name: '.iNoteAuth'
            }, function(cookie) {
                if (cookie) {
                    //user is login, get user from localStorage or send request to get user
                    $.ajax({
                        url: self.baseUrl + '/plugin/clipperdata',
                        success: function(data) {
                            if (data.error) {
                                //todo
                                callback(cookie);
                                return;
                            }
                            self.userData = data;
                            callback(data);
                        },
                        error: function() {
                            callback(cookie);
                        }
                    });
                } else {
                    callback();
                }
            });
        },
        setMaikuOption: function(key, value) {
            var self = this;
            self[key] = value;
            maikuNoteOptions[key] = value;
        },
        getSettings: function() {
            var self = this;
            self.settings = {
                serializeImg: maikuNoteOptions.serializeImg,
                defaultCategory: maikuNoteOptions.defaultCategory,
                autoExtractContent: maikuNoteOptions.autoExtractContent
            }
            return self.settings;
        },
        removeFileSystems: function() {
            //every time browser booted, remove files
            chrome.browsingData.removeFileSystems({});
        },
        initOmnibox: function() {
            var self = this;
            chrome.omnibox.onInputEntered.addListener(function(text) {
                if (text == 'popup') {
                    self.createPopup();
                }
            });
        },
        showExtensionGuide: function() {
            var extensionguideUrl = this.baseUrl + '/public/extensionguide';

            function getVersion() {
                var details = chrome.app.getDetails();
                return details.version;
            }

            function onInstall() {
                chrome.tabs.create({
                    url: extensionguideUrl,
                    selected: true
                });
            }

            function onUpdate() {
                chrome.tabs.create({
                    url: extensionguideUrl,
                    selected: true
                });
                console.log("Extension Updated");
            }
            var currVersion = getVersion();
            var prevVersion = localStorage['version']
            if (currVersion != prevVersion) {
                if (typeof prevVersion == 'undefined') {
                    onInstall();
                } else {
                    onUpdate();
                }
                localStorage['version'] = currVersion;
            }
        }
    };
    Object.defineProperties(maikuNote, {
        baseUrl: {
            value: chrome.i18n.getMessage('baseUrl'),
            writable: false
        }
    });
    $(function() {
        window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
        maikuNoteOptions = window.maikuNoteOptions;
        maikuNote.init();
    });

    var MKSyncTaskQueue = function() {
        var queue = [],
            currentTask;

        function endCurrentTask() {
            //检查当前的任务是否完成
            if (!currentTask) {
                return true;
            }
            if (currentTask.processState == 'success') {
                if (queue.length > 0) {
                    NotifyTips.showTemporary('syncTaskSuccess', currentTask.note.note.title, function() {
                        NotifyTips.showPersistent('nextTask', queue[0].note.note.title);
                    });
                } else {
                    NotifyTips.showTemporary('syncTaskSuccess', currentTask.note.note.title, function() {
                        NotifyTips.clear();
                    });
                }
                currentTask = null;
                return true;
            } else if (currentTask.processState == 'fail') {
                /*
                 * 失败了需要提醒别人重试
                 */
                NotifyTips.showTemporary('syncTaskSuccess', currentTask.note.note.title);
                currentTask = null;
                return true;
            } else {
                return false
            }
        }

        return {
            add: function(task) {
                NotifyTips.showTemporary('syncTaskAdd', task.note.note.title);
                queue.push(task)
            },
            start: function() {
                if (!endCurrentTask()) return;

                currentTask = queue.shift();

                if (!currentTask) return;

                var slef = this;
                //每隔5秒执行下个任务不然短时间一直请求服务器，服务器会认为非法
                currentTask.sync(function() {
                    setTimeout(function() {
                        slef.start();
                    }, 1000 * 5)
                })
            },
            end: function() {
                endCurrentTask();
            }
        }
    }();

    var MKEvent = function() {};
    _.extend(MKEvent.prototype, Backbone.Events);
    MKEvent.prototype.setState = function() {
        this.trigger('changeState', arguments[0], [].slice.call(arguments, 1));
    }

    var MKSyncTask = function(noteData, option) {
        this.state = new MKEvent();
        this.note = new MkSyncNode(noteData, option, this.state);
        this.option = option;
        this.processState = '';
        this.errorCount = 0; //任务出错次数
    }
    MKSyncTask.prototype.sync = function(callback) {
        var self = this,
            note = self.note,
            syncState = this.state;

        /**
         * MKSyncTask的sync来组织具体的同步逻辑
         * 任务的同步方法决定同步完成后的回调
         * 如果每次处理的回调不同，可以继承扩展当前的MKSyncTask
         * 让每个MkSyncNode对象继承Backbone.Events
         */

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
        syncState.setState('note.init')
    }
    MKSyncTask.prototype.end = function(state) {
        this.processState = state;
        MkFileSystem.removeFiles(); //将存储的数据图片删除
        MKSyncTaskQueue.end();
    }

    var MKSyncErrorTask = function(task) {

    }
    MKSyncErrorTask.prototype.showTips = function() {
        // showTips('syncTaskFail', currentTask.note.note.title);
    }
    MKSyncErrorTask.prototype.restart = function() {}


    var MkSyncNode = function(noteData, option, stateEvent) {
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
    MkSyncNode.prototype.init = function() {
        var self = this,
            option = self.option,
            content = self.note.notecontent;
        self.note.notecontent = '';
        NotifyTips.showPersistent('noteInit', self.note.title);
        self.post(function(data) {
            self.note.noteid = data.Note.NoteID;
            self.note.notecontent = content;
            NotifyTips.showPersistent('noteInitSuccess', self.note.title);
            self.syncState.setState('note.init.success', arguments)
        }, function() {
            NotifyTips.showPersistent('noteInitFail', self.note.title);
            self.syncState.setState('note.init.fail', arguments)
        })
    }
    MkSyncNode.prototype.saveImage = function() {
        var self = this;
        NotifyTips.showPersistent('saveImages', self.note.title);
        self.saveImages();
    }
    MkSyncNode.prototype.saveContent = function() {
        var self = this;
        self.note.notecontent = self.noteEl.html();
        self.post(function(data) {
            self.syncState.setState('save.saveContent.success', arguments);
        }, function() {
            self.syncState.setState('save.saveContent.fail', arguments)
        })
    }
    MkSyncNode.prototype.post = function(successCallback, failCallback) {
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
    MkSyncNode.prototype.delete = function() {
        var self = this,
            option = self.option,
            noteid = self.note.noteid;
        NotifyTips.showPersistent('noteDelete', self.note.title);
        $.ajax({
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            },
            url: option.baseUrl + "/note/delete",
            type: "POST",
            data: 'noteIds=' + noteid,
            success: function(data) {
                if (data.error) {
                    NotifyTips.showPersistent('noteDeleteFail', self.note.title);
                    self.syncState.setState('note.delete.fail')
                    return;
                }
                successCallback(data);
                self.syncState.setState('note.delete.success', self.note.title)
            },
            error: function() {
                NotifyTips.showPersistent('noteDeleteFail', self.note.title);
                self.syncState.setState('note.delete.fail')
            }
        });
    }
    MkSyncNode.prototype.saveImages = function() {
        var self = this,
            option = self.option,
            note = self.note;
        var imgs = $(self.noteEl).find('img'),
            filteredImg = [];
        //maikuNoteOptions.serializeImg 要修改 改成传入参数而不是全局的
        if (maikuNoteOptions.serializeImg) {
            for (var i = 0; i < imgs.length; i++) {
                var img = imgs[i];
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
                if (serverImages.length != htmlImages.length) {
                    NotifyTips.showPersistent('uploadImagesFail');
                    self.syncState.setState('save.images.fail', arguments)
                    return;
                }

                for (var i = 0; i < serverImages.length; i++) {
                    var serverQueueItem = serverImages[i],
                        htmlQueueItem = htmlImages[i];
                    if (serverQueueItem.length != htmlQueueItem.length) {
                        NotifyTips.showPersistent('uploadImagesFail');
                        self.syncState.setState('save.images.fail', arguments)
                    }
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

    var MkSyncImage = function(imgEl) {
        this.image = imgEl;
    }
    MkSyncImage.prototype.download = function(callback, errorFn, error404) {
        var self = this,
            image = self.image,
            url = image.src,
            xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = function(e) {
            if (this.status == 200) {
                var suffix = url.split('.'),
                    blob = new Blob([this.response], {
                        type: 'image/' + suffix[suffix.length - 1]
                    }),
                    parts = url.split('/'),
                    fileName = parts[parts.length - 1];
                MkFileSystem.create(this.response.byteLength, fileName, blob, function(file) {
                    callback(self, file)
                }) //MKFileSystem.create todo...
            } else if (this.status == 404) {
                errorFn && errorFn(self, arguments);
            } else {
                // error404 && error404(self, arguments)
                error404(self)
            }
        }
        xhr.onerror = function() {
            console.log('retrieve remote image xhr onerror')
        }
        xhr.onabort = function() {
            console.log('retrieve remote image xhr onabort')
        }
        xhr.send(null);
    }

    var MkSyncImages = function(note, syncImageAry, option) {
        this.images = syncImageAry;
        this.note = note;
        this.option = option || {};
    }
    MkSyncImages.prototype.upload = function(successCallback, failCallback) {
        /**
         * 判断是否登陆
         * todo...
         */
        var self = this,
            images = self.images,
            note = self.note,
            option = self.option,
            downloadState = {
                success: 'download-success',
                error: 'download-error',
                error404: 'download-404'
            },
            errorBreak = false,
            completedImageState = {
                waitting: 'waitting',
                error: 'error'
            }


            /**
             * 图片请求是否成功都需要uploadPackDataForm做整体判断，
             * 好处：统一处理，防止已完成的图片的 requestFileSystem 或被删除。失败的请求比起成功的少很多，也这样做也减轻了逻辑出错
             * 坏处：图片请求出错不能立即通知程序，会有延迟。
             */

        for (var i = 0; i < images.length; i++) {
            if (errorBreak) break;
            images[i].download(function(img, file) {
                img.file = file;
                img.state = downloadState.success;
                uploadPackDataForm();
            }, function(img) {
                img.state = downloadState.error;
                errorBreak = true;
                uploadPackDataForm();
            }, function(img) {
                img.state = downloadState.error404;
                uploadPackDataForm();
            })
        }

        function uploadPackDataForm(imagesCompletedAry) {
            var imagesCompletedAry = getCompletedAry();
            if (imagesCompletedAry == completedImageState.error) {
                failCallback && failCallback();
                return;
            }
            if (imagesCompletedAry instanceof Array) {
                console.log('array')
                var queueObj = packDataForm(imagesCompletedAry),
                    formDataQueue = queueObj.formDataQueue,
                    imagesQueue = queueObj.imagesQueue,
                    uploadCompletedCount = 0,
                    uploadCompletedData = [],
                    imagesNewQueue = [];
                if (formDataQueue.length == 0) {
                    successCallback(imagesNewQueue, uploadCompletedData);
                    return;
                }
                for (var j = 0; j < formDataQueue.length; j++) {
                    var formData = formDataQueue[j],
                        imgItems = imagesQueue[j];
                    (function(formData, imgItems) {
                        saveImage(formData, function(data) {
                            uploadCompletedCount++;
                            uploadCompletedData.push(data);
                            //根据upload的图片从新排序原始img标签数据顺序
                            imagesNewQueue.push(imgItems);
                            if (uploadCompletedCount == formDataQueue.length) {
                                successCallback(imagesNewQueue, uploadCompletedData);
                            }
                        });
                    })(formData, imgItems)
                }
            }
        }

        function packDataForm(packImages) {
            var maxUploadSize = 1024 * 1024 * 10,
                currentUploadSize = 0,
                formDataQueue = [],
                imagesQueue = [],
                formData, imagesAry;
            for (var i = 0; i < packImages.length; i++) {
                var file = packImages[i].file;
                if (currentUploadSize + file.size > maxUploadSize || !formData) {
                    formData = createFormData();
                    imagesAry = [];
                    formDataQueue.push(formData);
                    imagesQueue.push(imagesAry)
                    currentUploadSize = 0;
                }
                currentUploadSize += file.size;
                formData.append('file' + i, file);
                imagesAry.push(packImages[i]);
            }
            return {
                formDataQueue: formDataQueue,
                imagesQueue: imagesQueue
            }
        }

        function getCompletedAry() {
            var successCount = 0,
                error404Count = 0,
                errorCount = 0,
                completedAry = [];
            for (var i = 0; i < images.length; i++) {
                var image = images[i];
                if (image.state == downloadState.success) {
                    successCount++;
                    completedAry.push(image);
                } else if (image.state == downloadState.error404) {
                    error404Count++;
                } else if (image.state == downloadState.error) {
                    errorCount++;
                }
            }
            if ((successCount + error404Count) == images.length) {
                return completedAry;
            } else if (errorCount > 0 && (successCount + error404Count + errorCount) == images.length) {
                return completedImageState.error;
            } else {
                return completedImageState.waitting;
            }
        }

        function createFormData() {
            var f = new FormData();
            f.append('type', option.type ? 'Attachment' : 'Embedded');
            f.append('categoryId', note.categoryid || '');
            f.append('id', note.noteid || '');
            return f;
        }

        function saveImage(formData, successCallback, failCallback) {
            console.log('why')
            $.ajax({
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                },
                url: window.maikuNote.baseUrl + "/attachment/savemany?d=" + (Math.random()),
                type: "POST",
                data: formData,
                processData: false,
                contentType: false,
                success: function(data) {
                    successCallback(data)
                },
                error: function() {
                    failCallback && failCallback(arguments);
                }
            });
        }
    }

    var MkFileSystem = {};
    MkFileSystem.files = [];
    MkFileSystem.removeFiles = function() {
        var errorFn = MkFileSystem.onFileError;
        for (var idx in MkFileSystem.files) {
            var file = files[idx],
                fileSize = file.size,
                fileName = file.name;
            window.requestFileSystem(TEMPORARY, fileSize, function(fs) {
                fs.root.getFile(fileName, {}, function(fileEntry) {
                    fileEntry.remove(function() {
                        console.log('File ' + fileName + ' removed.');
                    }, errorFn);
                }, errorFn);
            }, errorFn);
        }
    }
    MkFileSystem.onFileError = function(err) {
        for (var p in FileError) {
            if (FileError[p] == err.code) {
                console.log('Error code: ' + err.code + 'Error info: ' + p);
                break;
            }
        }
    }
    MkFileSystem.create = function(size, fileName, blob, callback, errorFn) {
        var errorFn = MkFileSystem.onFileError;
        window.requestFileSystem(TEMPORARY, size, function(fs) {
            fs.root.getFile(fileName, {
                create: true
            }, function(fileEntry) {
                fileEntry.createWriter(function(fileWriter) {
                    fileWriter.onwrite = function(e) {
                        fileEntry.file(function(file) {
                            MkFileSystem.files.push(file)
                            callback(file);
                        })
                    }
                    fileWriter.onerror = function(e) {
                        console.log('Write failed: ' + e.toString());
                    };
                    fileWriter.write(blob);
                }, errorFn)
            }, errorFn);
        }, errorFn);
    };

    /*
     * 当前又任何任务在执行是 都要显示提示窗口
     * 正在处理的任务状态是持续的提醒状态，
     * 瞬间操作为临时提醒，如将某某笔记加入到同步列队中等，仅显示几秒钟钟后，又显示当前的操作
     */
    var NotifyTips = function() {
        var persistentTips = '',
            notification,
            notificationTimer,
            callback;

        var sendMessage = function(data) {
            if (!chrome.extension.sendMessage) return;
            chrome.extension.sendMessage({
                name: 'sendnotification',
                data: data
            });
        }

        var showTips = function(content, title, isPersistent) {
            if (!content) return;

            var notificationData = {
                content: content,
                title: title || ''
            }

            if (notification) {
                clearTimeout(notificationTimer);
                sendMessage(notificationData);
            } else {
                NotifyTips.create();
            }
            console.log(persistentTips)
            if (!isPersistent) {
                notificationTimer = setTimeout(function() {
                    callback && callback();
                    if (persistentTips) {
                        notificationData = {
                            content: persistentTips,
                            title: title || ''
                        }
                        sendMessage(notificationData);
                    } else {
                        notification && notification.cancel();
                    }
                }, 2000);
            }
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
                if (typeof content == 'function') {
                    callback = content;
                }
                var reg = new RegExp('\\{' + i + '\\}', 'g')
                tips = tips.replace(reg, ary[i]);
            }
            return tips;
        }
        return {
            showPersistent: function() {
                persistentTips = getContent(arguments);
                showTips(persistentTips, '', true);
            },
            showTemporary: function() {
                if (!notification) {
                    NotifyTips.showPersistent(arguments);
                    return;
                }
                var content = getContent(arguments);
                showTips(content, '', false);
            },
            clear: function() {
                persistentTips = '',
                // notification = null,
                notificationTimer = null,
                callback = null;
            },
            create: function() {
                notification = webkitNotifications.createHTMLNotification('notification.html');
                notification.addEventListener('close', function(e) {
                    notification = null;
                });
                notification.show();
            }
        }

    }();

})(jQuery);