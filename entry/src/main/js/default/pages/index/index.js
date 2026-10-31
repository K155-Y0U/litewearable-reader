import file from '@system.file';
import router from '@system.router';

var MAX_BOOKS = 80;

export default {
    data: {
        fileList: [],
        showDeleteDialog: false,
        deleteTargetIndex: -1,
        deleteTargetName: '',
        deleteError: '',
        deleting: false
    },

    onShow() {
        this.scanLocalFiles();
    },

    scanLocalFiles() {
        var that = this;
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
                        if (txtFiles.length >= MAX_BOOKS) {
                            break;
                        }
                        var item = sourceList[i];
                        var fileName = '';
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
                                fileName = maxIdx !== -1 ? fullPath.substring(maxIdx + 1) : fullPath;
                            }
                        }
                        if (fileName && fileName.length > 4) {
                            var idx = fileName.toLowerCase().indexOf('.txt');
                            if (idx !== -1 && idx === fileName.length - 4) {
                                txtFiles.push(fileName);
                            }
                        }
                    }
                    that.fileList = txtFiles;
                },
                fail: function(err, code) {
                    console.error('扫描失败: ' + code);
                }
            });
        } catch (e) {
            console.error('扫描异常: ' + e.message);
        }
    },

    openBook(index) {
        if (this.showDeleteDialog || index < 0 || index >= this.fileList.length) {
            return;
        }
        router.replace({
            uri: 'pages/read/read',
            params: {
                bookName: this.fileList[index]
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
    },

    confirmDeleteBook(index) {
        if (index < 0 || index >= this.fileList.length) {
            return;
        }
        this.deleteTargetIndex = index;
        this.deleteTargetName = this.fileList[index];
        this.deleteError = '';
        this.deleting = false;
        this.showDeleteDialog = true;
    },

    cancelDeleteBook() {
        if (this.deleting) {
            return;
        }
        this.closeDeleteDialog();
    },

    closeDeleteDialog() {
        this.showDeleteDialog = false;
        this.deleteTargetIndex = -1;
        this.deleteTargetName = '';
        this.deleteError = '';
        this.deleting = false;
    },

    doDeleteBook() {
        if (this.deleting || !this.deleteTargetName) {
            return;
        }
        var that = this;
        var target = this.deleteTargetName;
        this.deleting = true;
        this.deleteError = '';

        try {
            file.delete({
                uri: 'internal://app/' + target,
                success: function() {
                    that.closeDeleteDialog();
                    that.scanLocalFiles();
                },
                fail: function(err, code) {
                    that.deleting = false;
                    that.deleteError = '删除失败 (' + code + ')';
                }
            });
        } catch (e) {
            this.deleting = false;
            this.deleteError = '删除异常: ' + e.message;
        }
    }
};
