var MkFileSystem = {};
MkFileSystem.files = [];
MkFileSystem.removeFiles = function() {
    var errorFn = MkFileSystem.onFileError;
    for (var i = 0; i < MkFileSystem.files.length; i++) {
        var file = MkFileSystem.files.shift(),
            fileSize = file.size,
            fileName = file.name;
        (function(fileName, fileSize) {
            window.requestFileSystem(TEMPORARY, fileSize, function(fs) {
                fs.root.getFile(fileName, {}, function(fileEntry) {
                    fileEntry.remove(function() {
                        console.log('File ' + fileName + ' removed.');
                    }, errorFn);
                }, errorFn);
            }, errorFn);
        })(fileName, fileSize);
    }
}
MkFileSystem.onFileError = function(err) {
    for (var p in FileError) {
        if (FileError[p] == err.code) {
            console.log(arguments);
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
                    console.log('Write completed.');
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