import file from '@system.file';
import router from '@system.router';

export default {
    data: {
        fileList: []
    },
    onInit() {
        this.scanLocalFiles();
    },
    scanLocalFiles() {
        var that = this;
        console.info('开始扫描');
        try {
            file.list({
                uri: 'internal://app',
                success: function(data) {
                    var sourceList = [];
                    if (data && Array.isArray(data.fileList)) {
                        sourceList = data.fileList;
                    } else if (Array.isArray(data)) {
                        sourceList = data;
                    }
                    var txtFiles = [];
                    for (var i = 0; i < sourceList.length; i++) {
                        var item = sourceList[i];
                        var fileName = "";
                        if (typeof item === 'string') {
                            fileName = item;
                        } else if (item && typeof item === 'object') {
                            if (item.name) {
                                fileName = item.name;
                            } else if (item.uri) {
                                var fullPath = item.uri;
                                var lastSlash = fullPath.lastIndexOf('/');
                                var lastBackSlash = fullPath.lastIndexOf('\\');
                                var maxIdx = lastSlash > lastBackSlash ? lastSlash : lastBackSlash;
                                if (maxIdx !== -1) {
                                    fileName = fullPath.substring(maxIdx + 1);
                                } else {
                                    fileName = fullPath;
                                }
                            }
                        }
                        if (fileName && fileName.length > 4) {
                            var idx = fileName.toLowerCase().indexOf('.txt');
                            if (idx !== -1 && idx === (fileName.length - 4)) {
                                console.info('【成功】 ' + fileName);
                                txtFiles.push(fileName);
                            }
                        }
                    }
                    that.fileList = txtFiles;
                },
                fail: function(err, code) {
                    console.error('扫描失败' + code);
                }
            });
        } catch (e) {
            console.error('运行时异常: ' + e.message);
        }
    },
    openBook(index) {
        if (index < 0 || index >= this.fileList.length) {
            return;
        }
        var targetFileName = this.fileList[index];
        router.replace({
            uri: 'pages/read/read',
            params: {
                bookName: targetFileName
            }
        });
    },
    goToTransPage() {
        router.replace({
            uri: 'pages/trans/trans',
            params: {
                from: 'index'
            }
        });
    }
}