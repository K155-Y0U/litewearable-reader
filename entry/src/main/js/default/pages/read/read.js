/**
 * 阅读页逻辑控制器（完全用 old version 基线，不再加花里胡哨的分页器，避免黑屏）
 * 功能：滑动翻页、按 readBlockSize(1000) 流式加载、storage 记忆进度、顶部显示时间电量
 * 改动：只在 showPage 外层包 try/catch；pageSize 从 110 降到 90（保守值，圆形表盘内肯定不超高度）；onInit 空参，params 由 API6 自动注入到 this.bookName
 */
import file from '@system.file';
import router from '@system.router';
import storage from '@system.storage';
import battery from '@system.battery';

var MAX_BG_BYTES = 300 * 1024;

function progressKey(bookName) {
    var hash = 0;
    for (var i = 0; i < bookName.length; i++) {
        hash = (hash * 131 + bookName.charCodeAt(i)) % 2147483647;
    }
    return 'p_' + hash.toString(16);
}

export default {
    data: {
        bookName: '',
        fullText: '',
        textContent: '正在加载中…',
        currentIndex: 0,
        pageSize: 90,
        filePosition: 0,
        readBlockSize: 1000,
        isEndOfFile: false,
        timeText: '00:00',
        batteryLevel: '100',
        progressText: '0%',
        backgroundImage: '/common/read_bg.png',
        timerId: null
    },
    onInit() {
        if (this.bookName) {
            console.info('=== [阅读页] 成功接收到书名: ' + this.bookName);
        } else {
            this.bookName = '未知书籍';
        }
    },
    onShow() {
        this._active = true;
        this.fullText = '';
        this.filePosition = 0;
        this.currentIndex = 0;
        this.isEndOfFile = false;

        this.updateSystemInfo();
        this.startTimeUpdate();
        this.loadBackground();
        this.loadSavedProgress();
    },
    onHide() {
        this._active = false;
        this.saveCurrentProgress();
        this.stopTimeUpdate();
    },
    onDestroy() {
        this._active = false;
        this.saveCurrentProgress();
        this.stopTimeUpdate();
        this.fullText = '';
    },
    startTimeUpdate() {
        var that = this;
        if (this.timerId) {
            return;
        }
        that.timerId = setInterval(function() {
            that.updateSystemInfo();
        }, 30000);
    },
    stopTimeUpdate() {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
    },
    updateSystemInfo() {
        var that = this;
        var date = new Date();
        that.timeText = (date.getHours() < 10 ? '0' : '') + date.getHours() + ':' +
        (date.getMinutes() < 10 ? '0' : '') + date.getMinutes();

        try {
            battery.getStatus({
                success: function(data) {
                    if (!that._active) {
                        return;
                    }
                    that.batteryLevel = Math.floor(data.level <= 1 ? data.level * 100 : data.level).toString();
                    if (that.fullText.length > 0) {
                        that.showPage();
                    }
                }
            });
        } catch (e) {
            console.error(e.message);
        }
    },
    loadBackground() {
        var that = this;
        storage.get({
            key: 'bg_path',
            success: function(path) {
                if (!that._active || !path) {
                    that.backgroundImage = '/common/read_bg.png';
                    return;
                }
                that.checkBackground(path);
            },
            fail: function() {
                that.backgroundImage = '/common/read_bg.png';
            }
        });
    },

    checkBackground(path) {
        var that = this;
        file.get({
            uri: path,
            success: function(data) {
                if (!that._active) {
                    return;
                }
                if (data && data.length > 0 && data.length <= MAX_BG_BYTES) {
                    that.backgroundImage = path;
                } else {
                    that.backgroundImage = '/common/read_bg.png';
                }
            },
            fail: function() {
                that.backgroundImage = '/common/read_bg.png';
            }
        });
    },

    loadSavedProgress() {
        var that = this;
        storage.get({
            key: progressKey(that.bookName),
            success: function(data) {
                that.currentIndex = data ? parseInt(data) : 0;
                that.loadNextBlock();
            },
            fail: function() {
                that.currentIndex = 0;
                that.loadNextBlock();
            }
        });
    },
    saveCurrentProgress() {
        storage.set({
            key: progressKey(this.bookName),
            value: this.currentIndex.toString()
        });
    },
    loadNextBlock() {
        if (this.isEndOfFile) return;

        var that = this;
        var fileUri = 'internal://app/' + that.bookName;

        file.readText({
            uri: fileUri,
            position: that.filePosition,
            length: that.readBlockSize,
            success: function(data) {
                var newText = data.text || '';
                if (newText.length === 0) {
                    that.isEndOfFile = true;
                    return;
                }

                that.fullText += newText;
                that.filePosition += that.readBlockSize;

                if (that.fullText.length <= that.currentIndex && !that.isEndOfFile) {
                    that.loadNextBlock();
                } else {
                    that.showPage();
                }
            },
            fail: function() {
                that.isEndOfFile = true;
                that.textContent = '读取失败或文件不存在';
            }
        });
    },
    showPage() {
        try {
            if (this.currentIndex >= this.fullText.length && this.isEndOfFile) {
                this.textContent = "--- 本书已读完 ---";
                return;
            }

            if (!this.isEndOfFile && (this.fullText.length - this.currentIndex) < (this.pageSize * 2)) {
                this.loadNextBlock();
            }

            var end = this.currentIndex + this.pageSize;
            if (end > this.fullText.length) end = this.fullText.length;
            var pageText = this.fullText.substring(this.currentIndex, end);
            this.textContent = "[" + this.timeText + "  电量:" + this.batteryLevel + "%]\n\n" + pageText;
        } catch (e) {
            this.textContent = "[阅读错误]\n" + e.message;
        }
    },
    handleSwipe(e) {
        if (e.direction === 'right') {
            this.saveCurrentProgress();
            this.stopTimeUpdate();
            router.replace({ uri: 'pages/index/index' });
        } else if (e.direction === 'down' || e.direction === 'left') {
            this.currentIndex += this.pageSize;
            this.showPage();
            this.saveCurrentProgress();
        } else if (e.direction === 'up') {
            this.currentIndex = Math.max(0, this.currentIndex - this.pageSize);
            this.showPage();
            this.saveCurrentProgress();
        }
    }
}
