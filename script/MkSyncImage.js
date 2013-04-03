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
            } else if (this.status != 404) {
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
                var queueObj = packDataForm(imagesCompletedAry),
                    formDataQueue = queueObj.formDataQueue,
                    imagesQueue = queueObj.imagesQueue,
                    uploadCompletedCount = 0,
                    uploadCompletedData = [],
                    imagesNewQueue = [];
                console.log('formDataQueue.length:' +formDataQueue.length)
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