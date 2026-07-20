import router from '@system.router';
import file from '@system.file';
import storage from '@system.storage';

var tempRawText = "";

export default {
    data: {
        inputWords: '',
        targetPackage: '未输入',
        isLocalMode: false,
        fromPageData: null,

        tipText: '当前目标: 未输入',
        btn1Text: '输入目标包名',
        btn2Text: '返回本应用书架',
        showButtons: true,

        uri: '',
        doing: '',
        from: ''
    },
    onInit() {
        tempRawText = "";
        var that = this;

        console.info('[沙箱穿透调试] 收到输入法或主页参数: inputWords=' + this.inputWords + ', from=' + this.from);

        if (this.inputWords && this.inputWords !== '' && this.inputWords !== '无文本' && this.inputWords !== '    ') {
            this.targetPackage = this.inputWords;
            this.tipText = "当前目标: " + this.targetPackage;
            this.btn1Text = "跨应用开始读取";

            try {
                storage.set({
                    key: 'saved_target_package',
                    value: this.targetPackage
                });
                console.info('[沙箱穿透调试] 包名已成功存入本地本地存储: ' + this.targetPackage);
            } catch(e) {
                console.error('存储失败: ' + e.message);
            }
        }
        else if (!this.fromPageData && this.from !== 'index') {
            console.info('[路由死锁防御] 检测到系统启动残留，正在强行重定向至主页index...');
            router.replace({
                uri: 'pages/index/index'
            });
            return;
        }
        else {
            try {
                storage.get({
                    key: 'saved_target_package',
                    success: function(data) {
                        if (data && data !== '' && data !== '未输入') {
                            that.targetPackage = data;
                            that.tipText = "当前目标: " + data;
                            that.btn1Text = "跨应用开始读取";
                            console.info('[沙箱穿透调试] 成功读取到本地历史包名: ' + data);
                        }
                    }
                });
            } catch(e) {}
        }

        if (this.fromPageData) {
            this.uri = this.fromPageData.uri || this.uri;
            this.doing = this.fromPageData.doing || this.doing;
            this.from = this.fromPageData.from || this.from;
        }
    },
    onShow() {
        tempRawText = "";
    },
    onBtn1Click() {
        if (this.btn1Text === "输入目标包名") {
            router.replace({
                uri: 'pages/pinyin/pinyin',
                params: {
                    fromPage: 'pages/trans/trans',
                    fromPageData: { uri: this.uri, doing: this.doing, from: this.from }
                }
            });
        } else {
            this.isLocalMode = false;
            this.changeToLoadingState();
        }
    },
    goToChangePackage() {
        router.replace({
            uri: 'pages/pinyin/pinyin',
            params: {
                fromPage: 'pages/trans/trans',
                fromPageData: { uri: this.uri, doing: this.doing, from: this.from }
            }
        });
    },
    onBtn2Click() {
        router.replace({
            uri: 'pages/index/index'
        });
    },
    goToFileList() {
        if (!this.targetPackage || this.targetPackage === '未输入') {
            this.tipText = '请先输入目标包名';
            return;
        }
        router.replace({
            uri: 'pages/filelist/filelist',
            params: {
                targetPackage: this.targetPackage
            }
        });
    },
    changeToLoadingState() {
        this.showButtons = false;
        this.tipText = "正在加载文件列表...";
        this.startReadProcess();
    },
    startReadProcess() {
        var that = this;
        file.get({
            uri: 'internal://app/list.json',
            success: function (data) {
                var totalBlocks = Math.ceil(data.length / 4096);
                that.readBlockRecursive(0, totalBlocks, 4096, function() {
                    that.processAndNavigate();
                });
            },
            fail: function() {
                that.fallbackRedirect();
            }
        });
    },
    readBlockRecursive(currentBlock, totalBlocks, blockSize, callback) {
        var that = this;
        if (currentBlock >= totalBlocks) {
            callback();
            return;
        }
        file.readText({
            uri: 'internal://app/list.json',
            position: currentBlock * blockSize,
            length: blockSize,
            success: function (data) {
                var chunk = (data && data.text) ? data.text : (typeof data === 'string' ? data : "");
                tempRawText += chunk;
                that.readBlockRecursive(currentBlock + 1, totalBlocks, blockSize, callback);
            },
            fail: function() {
                that.readBlockRecursive(currentBlock + 1, totalBlocks, blockSize, callback);
            }
        });
    },
    processAndNavigate() {
        var that = this;
        var computedFileUri = '';
        var targetFileName = this.uri;

        try {
            var bookList = JSON.parse(tempRawText);
            var currentIndex = bookList.indexOf(this.uri);

            if (this.doing === 'next') {
                currentIndex = currentIndex + 1;
            } else if (this.doing === 'back') {
                currentIndex = currentIndex - 1;
            }

            if (currentIndex < 0 || currentIndex >= bookList.length) {
                targetFileName = bookList[0];
            } else {
                targetFileName = bookList[currentIndex];
            }
        } catch (e) {}

        if (!targetFileName || targetFileName === '') {
            targetFileName = 'hhh.txt';
        }

        computedFileUri = 'internal://app/..\\' + this.targetPackage + '\\' + targetFileName;

        setTimeout(() => {
            router.replace({
                uri: 'pages/read/read',
                params: {
                    bookName: computedFileUri
                }
            });
        }, 100);
    },

    fallbackRedirect() {
        var targetFileName = this.uri ? this.uri : 'hhh.txt';
        var computedFileUri = 'internal://app/..\\' + this.targetPackage + '\\' + targetFileName;
        router.replace({
            uri: 'pages/read/read',
            params: {
                bookName: computedFileUri
            }
        });
    },

    copyAllTxt() {
        var that = this;
        if (!this.targetPackage || this.targetPackage === '未输入') {
            this.tipText = '请先输入目标包名';
            return;
        }
        this.showButtons = false;
        this.tipText = '正在列举目标包名下的txt文件...';
        var crossAppDir = 'internal://app/..\\' + this.targetPackage;
        file.list({
            uri: crossAppDir,
            success: function(data) {
                var sourceList = [];
                if (data && Array.isArray(data.fileList)) {
                    sourceList = data.fileList;
                } else if (Array.isArray(data)) {
                    sourceList = data;
                }
                var txtNames = [];
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
                    if (name && name.length > 4) {
                        var dotIdx = name.toLowerCase().indexOf('.txt');
                        if (dotIdx !== -1 && dotIdx === name.length - 4) {
                            txtNames.push(name);
                        }
                    }
                }
                if (txtNames.length === 0) {
                    that.tipText = '目标目录下未找到txt文件，尝试从list.json获取...';
                    that.copyTxtFromListJson(crossAppDir);
                } else {
                    that.tipText = '找到 ' + txtNames.length + ' 个txt文件，正在复制...';
                    that.copyFilesRecursive(crossAppDir, txtNames, 0);
                }
            },
            fail: function(err, code) {
                console.info('跨应用目录列举失败(code=' + code + ')，回退到list.json方式');
                that.tipText = '目录列举失败，尝试从list.json获取...';
                that.copyTxtFromListJson(crossAppDir);
            }
        });
    },
    copyTxtFromListJson(crossAppDir) {
        var that = this;
        var listPath = crossAppDir + '\\list.json';
        file.readText({
            uri: listPath,
            success: function(data) {
                try {
                    var bookList = JSON.parse(data.text);
                    var txtNames = [];
                    for (var i = 0; i < bookList.length; i++) {
                        var name = bookList[i];
                        if (name && name.length > 4) {
                            var dotIdx = name.toLowerCase().indexOf('.txt');
                            if (dotIdx !== -1 && dotIdx === name.length - 4) {
                                txtNames.push(name);
                            }
                        }
                    }
                    if (txtNames.length === 0) {
                        that.tipText = 'list.json中也没有txt文件';
                        that.showButtons = true;
                    } else {
                        that.tipText = '从list.json找到 ' + txtNames.length + ' 个txt，正在复制...';
                        that.copyFilesRecursive(crossAppDir, txtNames, 0);
                    }
                } catch(e) {
                    that.tipText = 'list.json解析失败: ' + e.message;
                    that.showButtons = true;
                }
            },
            fail: function() {
                that.tipText = '无法读取目标包名的list.json，请确认包名正确';
                that.showButtons = true;
            }
        });
    },
    copyFilesRecursive(crossAppDir, txtNames, index) {
        var that = this;
        if (index >= txtNames.length) {
            that.tipText = '复制完成！共复制 ' + txtNames.length + ' 个txt文件到本地';
            that.showButtons = true;
            return;
        }
        var fileName = txtNames[index];
        var srcPath = crossAppDir + '\\' + fileName;
        that.tipText = '正在复制 (' + (index + 1) + '/' + txtNames.length + '): ' + fileName;
        file.readText({
            uri: srcPath,
            success: function(data) {
                file.writeText({
                    uri: 'internal://app/' + fileName,
                    text: data.text,
                    success: function() {
                        console.info('复制成功: ' + fileName);
                        that.copyFilesRecursive(crossAppDir, txtNames, index + 1);
                    },
                    fail: function(err, code) {
                        console.error('写入本地失败: ' + fileName + ', code=' + code);
                        that.copyFilesRecursive(crossAppDir, txtNames, index + 1);
                    }
                });
            },
            fail: function(err, code) {
                console.error('读取跨应用文件失败: ' + fileName + ', code=' + code);
                that.copyFilesRecursive(crossAppDir, txtNames, index + 1);
            }
        });
    }
}
