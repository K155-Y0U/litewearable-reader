import file from '@system.file';
import router from '@system.router';

export default {
    data: {
        targetPackage: '',
        fileNames: [],
        rawNames: [],
        countText: '正在加载...',
        txtCount: 0,
        isLoading: true
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
        if (index < 0 || index >= this.rawNames.length) {
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
        router.replace({
            uri: 'pages/trans/trans',
            params: {
                from: 'index'
            }
        });
    },
    copyAll() {
        router.replace({
            uri: 'pages/trans/trans',
            params: {
                from: 'index',
                inputWords: this.targetPackage
            }
        });
    }
}
