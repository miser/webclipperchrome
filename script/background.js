﻿//@huntbao @mknote
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
                if(!chrome.extension.sendMessage) {
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
            if(!chrome.extension.sendMessage) {
                return;
            }
            if(self.isCreatingContextMenus) return;
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
                                            if(data.error) {
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
            if(self.userData) {
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
            if(!title && !notecontent) {
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
                    if(data.error) {
                        if(data.error == 'notlogin') {
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
                    for(var i = 0, l = imgs.length; i < l; i++) {
                        content += '<img src="' + imgs[i] + '" title="' + titles[i] + '" alt="' + titles[i] + '"><br />';
                    }
                    self.saveNote(msg.title, msg.sourceurl, content, msg.tags);
                }
            if(maikuNoteOptions.serializeImg) {
                //retrieve remote images
                self.notifyHTML(chrome.i18n.getMessage('isRetrievingRemoteImgTip'), false);
                var totalImgNum = imgs.length,
                    serializeSucceedImgNum = 0,
                    serializeFailedImgNum = 0,
                    serializeSucceedImgIndex = [],
                    serializeSucceedImgIndexByOrder = {},
                    files = {},
                    removeFiles = function() {
                        for(var idx in files) {
                            self.removeFile(files[idx].name, files[idx].size);
                        }
                    },
                    checkComplete = function() {
                        if(serializeSucceedImgNum + serializeFailedImgNum == totalImgNum) {
                            if(serializeFailedImgNum == totalImgNum) {
                                //all images retrieve failed
                                if(failCallback) {
                                    //is replace images in page content
                                    failCallback(true);
                                } else {
                                    self.notifyHTML(chrome.i18n.getMessage('RetrieveImagesFailed'));
                                    saveNormalNote();
                                }
                                return false;
                            }
                            for(var i = 0, l = serializeSucceedImgIndex.length; i < l; i++) {
                                serializeSucceedImgIndexByOrder[serializeSucceedImgIndex[i]] = i.toString();
                            }
                            self.notifyHTML(chrome.i18n.getMessage('isUploadingImagesTip'), false);

                            var currentCompletedCount = 0;
                            for(var itemIndex in formDataQueue) {
                                var formDataItem = formDataQueue[itemIndex];
                                (function(index) {
                                    $.ajax({
                                        url: self.baseUrl + "/attachment/savemany/",
                                        type: "POST",
                                        data: formDataItem,
                                        processData: false,
                                        contentType: false,
                                        success: function(data) {
                                            if(data.error) {
                                                //todo: server error, pending note...
                                                console.log('Internal error: ');
                                                console.log(data.error);
                                                if(failCallback) {
                                                    failCallback(true);
                                                }
                                                removeFiles();
                                                return;
                                            }
                                            if(successCallback) {
                                                //is replace images in page content
                                                successCallback(data, needReplaceImgsQueue[index], data[0].NoteID, ++currentCompletedCount >= formDataQueue.length);
                                            } else {
                                                var d, noteId = data[0].NoteID,
                                                    realIndex;
                                                for(var i = 0, l = totalImgNum; i < l; i++) {
                                                    realIndex = serializeSucceedImgIndexByOrder[i];
                                                    if(realIndex) {
                                                        d = data[realIndex];
                                                        content += '<img src="' + d.Url + '" title="' + titles[i] + '" alt="' + titles[i] + '"><br />';
                                                        delete serializeSucceedImgIndexByOrder[i];
                                                    } else {
                                                        content += '<img src="' + imgs[i] + '" title="' + titles[i] + '" alt="' + titles[i] + '"><br />';
                                                    }
                                                }
                                                if(++currentCompletedCount >= formDataQueue.length) {
                                                    self.saveNote(msg.title, msg.sourceurl, content, msg.tags, '', noteId);
                                                }
                                            }
                                            if(currentCompletedCount >= formDataQueue.length) {
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
                for(var i = 0, l = totalImgNum; i < l; i++) {
                    self.downloadImage(imgs[i], i, function(file, idx) {
                        serializeSucceedImgNum++;
                        // serializeSucceedImgIndex.push(idx);
                        if(currentUploadSize + file.size > maxUploadSize || !formData || !needReplaceImgsAry) {
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
                switch(port.name) {
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
            port.onMessage.addListener(function(msg) {
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
                for(var i = 0, l = links.length, link; i < l; i++) {
                    link = links[i];
                    content += '<a href="' + link.linkUrl + '" title="' + link.title + '">' + link.text + '</a><br />';
                }
                self.saveNote(msg.title, msg.sourceurl, content);
            });
        },
        getpagecontentConnect: function(port) {
            var self = this;
            port.onMessage.addListener(function(msg) {
                if(maikuNoteOptions.serializeImg) {
                    var content = $('<div></div>').append(msg.content),
                        imgs = content.find('img'),
                        needReplaceImgs = [],
                        filteredImg = {},
                        filteredImgTitles = [],
                        isToSave = function(url) {
                            var suffix = url.substr(url.length - 4);
                            return /^\.(gif|jpg|png)$/.test(suffix);
                        }
                    if(imgs.length === 0) {
                        self.saveNote(msg.title, msg.sourceurl, msg.content);
                        return;
                    }
                    for(var i = 0, img, l = imgs.length, src; i < l; i++) {
                        img = imgs[i];
                        src = img.src;
                        if(!isToSave(src)) continue;
                        if(filteredImg[src]) continue;
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
                        for(var i = 0, l = needReplaceImgs.length; i < l; i++) {
                            realIndex = serializeSucceedImgIndexByOrder[i];
                            if(realIndex) {
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
            for(var p in FileError) {
                if(FileError[p] == err.code) {
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
                if(this.status == 200) {
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
            if(!content) return;
            title = title || '';
            icon = icon || '../images/icons/48x48.png';
            if(self.notification) self.notification.cancel();
            self.notification = webkitNotifications.createNotification(
            icon, title, content);
            self.notification.show();
            if(lastTime !== false) {
                setTimeout(function() {
                    self.notification.cancel();
                }, lastTime || 5000);
            }
        },
        notifyHTML: function(content, lastTime, title) {
            if(!content) return;
            var self = this;
            self.notificationData = {
                content: content,
                title: title || ''
            }
            if(self.notification) {
                clearTimeout(self.notificationTimer);
                //chrome version below 20 has no such method
                if(chrome.extension.sendMessage) {
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
            if(lastTime !== false) {
                self.notificationTimer = setTimeout(function() {
                    self.notification && self.notification.cancel();
                }, lastTime || 5000);
            }
        },
        checkLogin: function(callback) {
            var self = this;
            self.getUser(function(user) {
                if(!user) {
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
                            if(info.status == 'loading' && id == tabId) {
                                self.getUser(function(user) {
                                    if(user) {
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
                if(cookie) {
                    chrome.windows.create({
                        url: self.baseUrl + "/account/logout",
                        type: "panel"
                    }, function(win) {
                        var tabId = win.tabs[0].id;
                        chrome.tabs.onUpdated.addListener(function HandlerConnect(id, info) {
                            if(info.status == 'loading' && id == tabId) {
                                chrome.cookies.get({
                                    url: self.baseUrl,
                                    name: ".iNoteAuth"
                                }, function(cookie) {
                                    if(!cookie) {
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
                for(var i = exs.length - 1; i > 0; i--) {
                    if(exs[i].id == "mfhkadpfndbefbpibomdbdbnnpmjiaoh") {
                        chrome.management.uninstall("mfhkadpfndbefbpibomdbdbnnpmjiaoh");
                    }
                    if(exs[i].id == "blabbhjfbhclflhnbbapahfkhpcmgeoh") {
                        chrome.management.uninstall("blabbhjfbhclflhnbbapahfkhpcmgeoh");
                    }
                }
            });
        },
        getTitleByText: function(txt) {
            //todo
            var self = this,
                finalTitle = '';
            if(txt.length <= 100) return txt;
            if(txt.length > 0) {
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
                while(i >= 0) {
                    if(/^(9|10|44|65292|46|12290|59|65307)$/.test(t.charCodeAt(i))) {
                        hasSpecialChar = true;
                        break;
                    } else {
                        i--;
                    }
                }
                hasSpecialChar ? (t = t.substr(0, i)) : '';
                i = 0;
                l = t.length;
                while(i < l) {
                    if(/^(9|10)$/.test(t.charCodeAt(i))) {
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
                if(info.status == 'loading') {
                    //console.log('tab updated');
                    maikuNoteUtil.createParticularContextMenu(tab.url.split('/')[2]);
                }
                if(info.status == 'complete') {
                    //maybe login, maybe logout, update user data
                    //listen any page, since user can login from any page, not just http://note.sdo.com or http://passport.note.sdo.com
                    chrome.cookies.get({
                        url: self.baseUrl,
                        name: '.iNoteAuth'
                    }, function(cookie) {
                        if(cookie) {
                            if(!self.userData) {
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
                if(!sender || sender.id !== chrome.i18n.getMessage("@@extension_id")) return;
                switch(request.name) {
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
            if(refresh) {
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
            if(self.userData) {
                callback(self.userData);
                return;
            }
            chrome.cookies.get({
                url: self.baseUrl,
                name: '.iNoteAuth'
            }, function(cookie) {
                if(cookie) {
                    //user is login, get user from localStorage or send request to get user
                    $.ajax({
                        url: self.baseUrl + '/plugin/clipperdata',
                        success: function(data) {
                            if(data.error) {
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
                if(text == 'popup') {
                    self.createPopup();
                }
            });
        },
        showExtensionGuide: function() {
            var extensionguideUrl = 'http://notetest.sdo.com/public/extensionguide';

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
            if(currVersion != prevVersion) {
                if(typeof prevVersion == 'undefined') {
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

    function createTask() {
        var tasks = [];
        //
        //1.每个任务以一篇笔记为单位
        //2.每个任务有一个笔记ID
        //3.每个任务有一个标题
        //4.每个
        //
    }
    var MKSyncTaskQueue = function() {
            var queue = [],
                currentTask;

            return {
                add: function(task) {
                    queue.push(task)
                },
                start: function() {
                    currentTask = queue.shift();

                    if(!currentTask) return;

                    //每隔5秒执行下个任务不然短时间一直请求服务器，服务器会认为非法
                    currentTask.sync(function() {
                        setTimeout(function() {
                            arguments.callee();
                        }, 1000 * 5)
                    })
                }
            }
        }();

    var MKSyncTask = function(noteData) {
            this.note = new MkSyncNode(noteData);
            this.images = [];
        }
    MKSyncTask.prototype.sync = function(isAutoImage) {
        var self = this,
            note = self.note;


        var ep = EventProxy.create("note.init", function(n) {
            var imgs = note.content.find('img'),
                imgsObj = [];
            if(imgs.length && isAutoImage) {
                for(var i = 0; i < imgs.length; i++) {
                    var img = img[i];
                    if(img in imgsObj) continue;
                    this.images.push(img: img);
                }
            } else {

            }

            /*
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
*/
        });
        ep.fail(function(err) {
            if(err == 'notlogin') {
                self.notifyHTML(chrome.i18n.getMessage('NotLogin'));
            } else {
                self.notifyHTML(chrome.i18n.getMessage('SaveNoteFailed'));
            }
        })

        function init(note, failCallback) {
            // var noteid = note
            $.ajax({
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                },
                type: 'POST',
                url: self.baseUrl + '/note/save',
                data: JSON.stringify(dataObj),
                success: function(data) {
                    if(data.error) {
                        ep.emit('error', data.error);
                        return;
                    }
                    /**
                     * 提示用户笔记初始化完成
                     * to do...
                     */

                    note.noteid = data.Note.NoteID;
                    ep.emit('note.init', note)
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    ep.emit('error');
                }
            });
        }
        /**
            保存笔记的标题获得笔记id
            if(含有img){
                把所有图片find出，放入一个列队里
                将所有图片下载到本地文件系统中
                将下载成功的图片替换掉找出来的img
                将笔记正文upload
            } else {
                将笔记正文upload
            }
        */
    }
    var MkSyncNode = function(noteData) {
            var defaultData = {
                title: '[未命名笔记]',
                sourceurl: '',
                notecontent: '',
                tags: '',
                categoryid: '',
                noteid: '',
                importance: 0,
                /**
                 * noCreated:未创建,init:初始化,downloadImg:下载图片,upload:上传笔记
                 */
                processState: 'noCreate'
            }
            this.note = noteData || {};
            $.extend(this.note, defaultData);
            this.note.content = $('<div></div>').append(this.note.content);
        }
    MkSyncNode.prototype.init = function() {

    }
    MkSyncNode.prototype.save = function() {

    }
    MkSyncNode.prototype.delete = function() {

    }
    MkSyncNode.prototype.downloadImages = function() {

    }
    var MkSyncImage = function(imgEl) {
            this.image = imgEl;
        }
    MkSyncImage.prototype.download = function(callback, errorFn) {
        var self = this,
            image = self.image,
            url = image.scr,
            xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = function(e) {
            if(this.status == 200) {
                var suffix = url.split('.'),
                    blob = new Blob([this.response], {
                        type: 'image/' + suffix[suffix.length - 1]
                    }),
                    parts = url.split('/'),
                    fileName = parts[parts.length - 1];
                MkFileSystem(this.response.byteLength, fileName, blob, function(file) {
                    //todo... 成功
                }, function() {
                    //todo... 失败
                })
            }
        }
        xhr.onerror = function() {
            console.log('retrieve remote image xhr onerror')
            // errorCallback && errorCallback(imgIndex);
        }
        xhr.onabort = function() {
            console.log('retrieve remote image xhr onabort')
            // errorCallback && errorCallback(imgIndex);
        }
        xhr.send(null);
        /*
        downloadImage: function(url, imgIndex, successCallback, errorCallback) {
            var self = this;
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = function(e) {
                if(this.status == 200) {
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

    */


        /*
        var self = this,
                content = '',
                imgs = msg.imgs,
                titles = msg.imgTitles,
                saveNormalNote = function() {
                    for(var i = 0, l = imgs.length; i < l; i++) {
                        content += '<img src="' + imgs[i] + '" title="' + titles[i] + '" alt="' + titles[i] + '"><br />';
                    }
                    self.saveNote(msg.title, msg.sourceurl, content, msg.tags);
                }
            if(maikuNoteOptions.serializeImg) {
                //retrieve remote images
                self.notifyHTML(chrome.i18n.getMessage('isRetrievingRemoteImgTip'), false);
                var totalImgNum = imgs.length,
                    serializeSucceedImgNum = 0,
                    serializeFailedImgNum = 0,
                    serializeSucceedImgIndex = [],
                    serializeSucceedImgIndexByOrder = {},
                    files = {},
                    removeFiles = function() {
                        for(var idx in files) {
                            self.removeFile(files[idx].name, files[idx].size);
                        }
                    },
                    checkComplete = function() {
                        if(serializeSucceedImgNum + serializeFailedImgNum == totalImgNum) {
                            if(serializeFailedImgNum == totalImgNum) {
                                //all images retrieve failed
                                if(failCallback) {
                                    //is replace images in page content
                                    failCallback(true);
                                } else {
                                    self.notifyHTML(chrome.i18n.getMessage('RetrieveImagesFailed'));
                                    saveNormalNote();
                                }
                                return false;
                            }
                            for(var i = 0, l = serializeSucceedImgIndex.length; i < l; i++) {
                                serializeSucceedImgIndexByOrder[serializeSucceedImgIndex[i]] = i.toString();
                            }
                            self.notifyHTML(chrome.i18n.getMessage('isUploadingImagesTip'), false);

                            var currentCompletedCount = 0;
                            for(var itemIndex in formDataQueue) {
                                var formDataItem = formDataQueue[itemIndex];
                                (function(index) {
                                    $.ajax({
                                        url: self.baseUrl + "/attachment/savemany/",
                                        type: "POST",
                                        data: formDataItem,
                                        processData: false,
                                        contentType: false,
                                        success: function(data) {
                                            if(data.error) {
                                                //todo: server error, pending note...
                                                console.log('Internal error: ');
                                                console.log(data.error);
                                                if(failCallback) {
                                                    failCallback(true);
                                                }
                                                removeFiles();
                                                return;
                                            }
                                            if(successCallback) {
                                                //is replace images in page content
                                                successCallback(data, needReplaceImgsQueue[index], data[0].NoteID, ++currentCompletedCount >= formDataQueue.length);
                                            } else {
                                                var d, noteId = data[0].NoteID,
                                                    realIndex;
                                                for(var i = 0, l = totalImgNum; i < l; i++) {
                                                    realIndex = serializeSucceedImgIndexByOrder[i];
                                                    if(realIndex) {
                                                        d = data[realIndex];
                                                        content += '<img src="' + d.Url + '" title="' + titles[i] + '" alt="' + titles[i] + '"><br />';
                                                        delete serializeSucceedImgIndexByOrder[i];
                                                    } else {
                                                        content += '<img src="' + imgs[i] + '" title="' + titles[i] + '" alt="' + titles[i] + '"><br />';
                                                    }
                                                }
                                                if(++currentCompletedCount >= formDataQueue.length) {
                                                    self.saveNote(msg.title, msg.sourceurl, content, msg.tags, '', noteId);
                                                }
                                            }
                                            if(currentCompletedCount >= formDataQueue.length) {
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
                for(var i = 0, l = totalImgNum; i < l; i++) {
                    self.downloadImage(imgs[i], i, function(file, idx) {
                        serializeSucceedImgNum++;
                        // serializeSucceedImgIndex.push(idx);
                        if(currentUploadSize + file.size > maxUploadSize || !formData || !needReplaceImgsAry) {
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
        */
    }

    var MkSyncImages = function(note, imgs, option) {
            this.images = imgs;
            this.note = note;
            this.option = option || {};
        }
    MkSyncImage.prototype.download = function() {
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
                error: 'download-error'
            }


        for(var i = 0; i < images.length; i++) {
            images[i].download(function(file) {
                this.file = file;
                this.state = downloadState.success;
                var imagesCompletedAry = getCompletedAry();
                if(imagesCompletedAry) {
                    var dataformQueue = packDataForm(imagesCompletedAry);
                    self.upload(dataformQueue);
                }
            }, function() {
                this.state = downloadState.error;
            })
        }

        function packDataForm(packImages) {
            var maxUploadSize = 1024 * 1024 * 10,
                currentUploadSize = 0,
                formDataQueue = [],
                formData;
            for(var i = 0; i < packImages.length; i++) {
                var file = packImages[i].file;
                if(currentUploadSize + file.size > maxUploadSize || !formData) {
                    formData = createFormData();
                    formDataQueue.push(formData);
                    currentUploadSize = 0;
                }
                currentUploadSize += file.size;
                formData.append('file' + index, file);
            }
            return formDataQueue;
        }

        function getCompletedAry() {
            var successCount = 0,
                errorCount = 0,
                completedAry = [];
            for(var i = 0; i < images.length; i++) {
                var image = images[i];
                if(image.state == downloadState.success) {
                    successCount++;
                    completedAry.push(image);
                } else if(image.state == downloadState.error) {
                    errorCount++;
                } else {
                    return;
                }
            }
            if(errorCount == images.length) {
                //todo... 如果都是错误
                return;
            }
            return completedAry;
        }

        function createFormData() {
            var f = new FormData();
            f.append('type', option.type ? 'Attachment' : 'Embedded');
            f.append('categoryId', note.categoryid || '');
            f.append('id', note.noteid || '');
            return f;
        },
    }
    MkSyncImage.prototype.upload = function(formDataQueue, successCallback) {
        var self = this,
            images = self.images,
            note = self.note,
            option = self.option;
        for(var itemIndex in formDataQueue) {
            var formDataItem = formDataQueue[itemIndex];
            (function(index) {
                $.ajax({
                    url: self.baseUrl + "/attachment/savemany/",
                    type: "POST",
                    data: formDataItem,
                    processData: false,
                    contentType: false,
                    success: function(data) {
                        if(data.error) {
                            // if(failCallback) {
                            //     failCallback(true);
                            // }
                            // removeFiles();
                            return;
                        }
                        if(successCallback) {
                            //is replace images in page content
                            successCallback(data, needReplaceImgsQueue[index], data[0].NoteID, ++currentCompletedCount >= formDataQueue.length);
                        } else {
                            var item, noteId = data[0].NoteID,
                                realIndex;
                            for(var i = 0, l = formDataItem.length; i < l; i++) {
                                var image = formDataItem[i];
                                if(image) {
                                    item = data[realIndex];
                                    content += '<img src="' + item.Url + '" title="" alt=""><br />';
                                    delete serializeSucceedImgIndexByOrder[i];
                                } else {
                                    content += '<img src="' + imgs[i] + '" title="' + titles[i] + '" alt="' + titles[i] + '"><br />';
                                }
                            }
                            if(++currentCompletedCount >= formDataQueue.length) {
                                self.saveNote(msg.title, msg.sourceurl, content, msg.tags, '', noteId);
                            }
                        }
                        if(currentCompletedCount >= formDataQueue.length) {
                            removeFiles();
                        }
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        // console.log('xhr error: ')
                        // console.log(textStatus)
                        // removeFiles();
                        // self.notifyHTML(chrome.i18n.getMessage('UploadImagesFailed'));
                    }
                });
            })(itemIndex);
        }
    }
    var MkFileSystem = {};
    MkFileSystem.files = [];
    MkFileSystem.create(function(size, fileName, blob, callback, errorFn) {
        window.requestFileSystem(TEMPORARY, size, function(fs) {
            fs.root.getFile(fileName, {
                create: true
            }, function(fileEntry) {
                fileEntry.createWriter(function(fileWriter) {
                    fileWriter.onwrite = function(e) {
                        fileEntry.file(file) {
                            MkFileSystem.files.push(file)
                            callback(file);
                        }
                        fileWriter.write(blob);
                    }
                }, function() {
                    /**
                     * 文件写入出错
                     * to do...
                     */
                })
            }, function() {
                /**
                 * 文件创建出错
                 * to do...
                 */
            });
        }, function() {
            /**
             * 文件写入出错
             * to do...
             */
        });
    });

})(jQuery);