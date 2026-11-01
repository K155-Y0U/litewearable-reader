import file from '@system.file';
import router from '@system.router';
import storage from '@system.storage';
import { progressKey } from '../../common/progress.js';

var MAX_BOOKS = 80;
var PAGE_SIZE = 150;

export default {
    data: {
        fileList: [],
        recentBooks: [],
        filesScanned: false,
        showDeleteDialog: false,
        deleteTargetIndex: -1,
        deleteTargetName: '',
        deleteError: '',
        deleting: false
    },

    onShow() {
        this.loadRecentBooks();
        this.scanLocalFiles();
    },

    loadRecentBooks() {
        var that = this;
        var keys = ['recent_0', 'recent_1', 'recent_2'];
        var names = [];
        var i = 0;

        function nextSlot() {
            if (i >= keys.length) {
                that.loadRecentProgress(names, 0, []);
                return;
            }
            var key = keys[i];
            i++;
            storage.get({
                key: key,
                success: function(value) {
                    if (value) {
                        names.push(value);
                    }
                    nextSlot();
                },
                fail: function() {
                    nextSlot();
                }
            });
        }

        nextSlot();
    },

    loadRecentProgress(names, index, out) {
        var that = this;
        if (index >= names.length) {
            that.recentBooks = out;
            that.filterRecent();
            return;
        }

        var name = names[index];
        storage.get({
            key: progressKey(name),
            success: function(value) {
                var currentIndex = value ? parseInt(value) : 0;
                var page = Math.floor(currentIndex / PAGE_SIZE) + 1;
                out.push({
                    name: name,
                    label: '第 ' + page + ' 页'
                });
                that.loadRecentProgress(names, index + 1, out);
            },
            fail: function() {
                out.push({
                    name: name,
                    label: '第 1 页'
                });
                that.loadRecentProgress(names, index + 1, out);
            }
        });
    },

    filterRecent() {
        if (!this.filesScanned) {
            return;
        }
        var out = [];
        for (var i = 0; i < this.recentBooks.length; i++) {
            if (this.fileList.indexOf(this.recentBooks[i].name) !== -1) {
                out.push(this.recentBooks[i]);
            }
        }
        this.recentBooks = out;
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
                    that.filesScanned = true;
                    that.filterRecent();
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
        this.openBookByName(this.fileList[index]);
    },

    openRecent(index) {
        if (this.showDeleteDialog || index < 0 || index >= this.recentBooks.length) {
            return;
        }
        var name = this.recentBooks[index].name;
        if (this.fileList.indexOf(name) === -1) {
            return;
        }
        this.openBookByName(name);
    },

    openBookByName(name) {
        router.replace({
            uri: 'pages/read/read',
            params: {
                bookName: name
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

    goToSetting() {
        router.replace({
            uri: 'pages/setting/setting'
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
