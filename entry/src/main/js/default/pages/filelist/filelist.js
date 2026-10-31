import file from '@system.file';
import router from '@system.router';

var COPY_BLOCK_SIZE = 4096;

export default {
    data: {
        targetPackage: '',
        fileNames: [],
        rawNames: [],
        countText: '正在加载...',
        txtCount: 0,
        isLoading: true,
        copying: false
    },

    onInit() {
        if (!this.targetPackage || this.targetPackage === '') {
            this.countText = '未传入目标包名';
            this.isLoading = false;
            return;
        }
        this.scanTargetDir();
    },

    scanTargetDir() {
        var that = this;
        var crossAppDir = 'internal://app/..\\' + this.targetPackage;
        that.isLoading = true;
        that.countText = '正在扫描 ' + this.targetPackage + ' ...';
        file.list({
            uri: crossAppDir,
            success: function(data) {
                var sourceList = [];
                if (data && Array.isArray(data.fileList)) {
                    sourceList = data.fileList;
                } else if (Array.isArray(data)) {
                    sourceList = data;
                }
                var result = that.parseFileNames(sourceList);
                that.fileNames = result.list;
                that.rawNames = result.rawList;
                that.txtCount = result.txtCount;
                that.isLoading = false;
                that.countText = '共 ' + result.total + ' 个文件，其中 txt 文件: ' + result.txtCount + ' 个';
            },
            fail: function(err, code) {
                console.info('跨应用目录列举失败(code=' + code + ')，回退到list.json');
                that.loadFromListJson(crossAppDir);
            }
        });
    },

    loadFromListJson(crossAppDir) {
        var that = this;
        var listPath = crossAppDir + '\\list.json';
        file.readText({
            uri: listPath,
            success: function(data) {
                try {
                    var bookList = JSON.parse(data.text);
                    var result = that.parseFileNames(bookList);
                    that.fileNames = result.list;
                    that.rawNames = result.rawList;
                    that.txtCount = result.txtCount;
                    that.isLoading = false;
                    that.countText = '(来自list.json) 共 ' + result.total + ' 个文件，其中 txt: ' + result.txtCount + ' 个';
                } catch(e) {
                    that.isLoading = false;
                    that.countText = 'list.json解析失败: ' + e.message;
                }
            },
            fail: function() {
                that.isLoading = false;
                that.countText = '无法访问目标包名目录，请确认包名';
            }
        });
    },

    parseFileNames(sourceList) {
        var list = [];
        var rawList = [];
        var txtCount = 0;
        for (var i = 0; i < sourceList.length; i++) {
            var item = sourceList[i];
            var name = '';
            if (typeof item === 'string') {
                name = item;
            } else if (item && item.uri) {
                var p = item.uri;
                var si = p.lastIndexOf('/');
                var bi = p.lastIndexOf('\\');
                var idx = si > bi ? si : bi;
                name = idx !== -1 ? p.substring(idx + 1) : p;
            } else if (item && item.name) {
                name = item.name;
            }
            if (name && name.length > 0) {
                rawList.push(name);
                if (name.length > 4) {
                    var dotIdx = name.toLowerCase().indexOf('.txt');
                    if (dotIdx !== -1 && dotIdx === name.length - 4) {
                        txtCount++;
                        list.push('[txt] ' + name);
                    } else {
                        list.push(name);
                    }
                } else {
                    list.push(name);
                }
            }
        }
        return { list: list, rawList: rawList, total: list.length, txtCount: txtCount };
    },

    openFile(index) {
        if (this.copying || index < 0 || index >= this.rawNames.length) {
            return;
        }
        var fileName = this.rawNames[index];
        var dotIdx = fileName.toLowerCase().indexOf('.txt');
        if (dotIdx === -1 || dotIdx !== fileName.length - 4) {
            return;
        }
        var bookName = 'internal://app/..\\' + this.targetPackage + '\\' + fileName;
        router.replace({
            uri: 'pages/read/read',
            params: {
                bookName: bookName
            }
        });
    },

    goBack() {
        if (this.copying) {
            return;
        }
        router.replace({
            uri: 'pages/trans/trans',
            params: {
                from: 'index'
            }
        });
    },

    collectTxtNames() {
        var names = [];
        for (var i = 0; i < this.rawNames.length; i++) {
            var name = this.rawNames[i];
            if (!name || name.length <= 4) {
                continue;
            }
            var dotIdx = name.toLowerCase().indexOf('.txt');
            if (dotIdx !== -1 && dotIdx === name.length - 4) {
                names.push(name);
            }
        }
        return names;
    },

    copyAll() {
        if (this.copying) {
            return;
        }
        var names = this.collectTxtNames();
        if (names.length === 0) {
            this.countText = '没有可复制的 txt 文件';
            return;
        }
        this.copying = true;
        this.countText = '准备复制 ' + names.length + ' 个 txt 文件...';
        this.copyOne(names, 0, 0);
    },

    copyOne(names, index, successCount) {
        var that = this;
        if (index >= names.length) {
            this.copying = false;
            this.countText = '复制完成：成功 ' + successCount + ' / ' + names.length + ' 个';
            return;
        }

        var fileName = names[index];
        var srcUri = 'internal://app/..\\' + this.targetPackage + '\\' + fileName;
        var dstUri = 'internal://app/' + fileName;
        this.countText = '正在复制 (' + (index + 1) + '/' + names.length + '): ' + fileName;

        file.copy({
            srcUri: srcUri,
            dstUri: dstUri,
            success: function() {
                that.copyOne(names, index + 1, successCount + 1);
            },
            fail: function() {
                that.copyByChunk(srcUri, dstUri, 0, function(ok) {
                    that.copyOne(names, index + 1, successCount + (ok ? 1 : 0));
                });
            }
        });
    },

    copyByChunk(srcUri, dstUri, position, callback) {
        var that = this;
        file.readText({
            uri: srcUri,
            position: position,
            length: COPY_BLOCK_SIZE,
            success: function(data) {
                var text = (data && data.text) ? data.text : '';
                if (text.length === 0) {
                    callback(position === 0 ? false : true);
                    return;
                }
                file.writeText({
                    uri: dstUri,
                    text: text,
                    append: position > 0,
                    success: function() {
                        that.copyByChunk(srcUri, dstUri, position + COPY_BLOCK_SIZE, callback);
                    },
                    fail: function() {
                        callback(false);
                    }
                });
            },
            fail: function() {
                callback(false);
            }
        });
    }
};
