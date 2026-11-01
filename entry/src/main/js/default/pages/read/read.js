/**
 * 阅读页：swiper 负责手势/页面层，正文用 swiper 外层的单个 text 渲染。
 * 这样绕开 Lite swiper 子 text 不显示的问题。
 */
import file from '@system.file';
import router from '@system.router';
import storage from '@system.storage';
import battery from '@system.battery';
import { validateLiteBin } from '../../common/litebin.js';
import { progressKey } from '../../common/progress.js';

export default {
    data: {
        bookName: '',
        fullText: '',
        pageText: '正在加载中…',
        currentIndex: 0,
        visibleIndex: 0,
        progressLoaded: false,
        pageSize: 150,
        filePosition: 0,
        readBlockSize: 1000,
        isEndOfFile: false,
        timeText: '00:00',
        batteryLevel: '100',
        clockInfo: '00:00  100%',
        backgroundImage: '/common/read_bg.png',
        timerId: null
    },

    onInit() {
        if (this.bookName) {
            console.info('=== [阅读页] 成功接收到书籍: ' + this.bookName);
        } else {
            this.bookName = '未知书籍';
        }
    },

    onShow() {
        this._active = true;
        this._lastManual = 0;
        this.fullText = '';
        this.filePosition = 0;
        this.currentIndex = 0;
        this.visibleIndex = 0;
        this.progressLoaded = false;
        this.isEndOfFile = false;
        this._reading = false;
        this._pendingEnd = 0;
        this._pendingDone = null;
        this.pageText = '正在加载中…';
        this.clockInfo = this.timeText + '  ' + this.batteryLevel + '%';

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
        this._pendingDone = null;
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
        that.clockInfo = that.timeText + '  ' + that.batteryLevel + '%';

        try {
            battery.getStatus({
                success: function(data) {
                    if (!that._active) {
                        return;
                    }
                    that.batteryLevel = Math.floor(data.level <= 1 ? data.level * 100 : data.level).toString();
                    that.clockInfo = that.timeText + '  ' + that.batteryLevel + '%';
                    that.saveCurrentProgress();
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
        validateLiteBin(path, function(valid) {
            if (!that._active) {
                return;
            }
            that.backgroundImage = valid ? path : '/common/read_bg.png';
        });
    },

    loadSavedProgress() {
        var that = this;
        storage.get({
            key: progressKey(that.bookName),
            success: function(data) {
                that.currentIndex = data ? parseInt(data) : 0;
                that.progressLoaded = true;
                that.startReading();
            },
            fail: function() {
                that.currentIndex = 0;
                that.progressLoaded = true;
                that.startReading();
            }
        });
    },

    saveCurrentProgress() {
        if (!this.progressLoaded || !this.bookName) {
            return;
        }
        storage.set({
            key: progressKey(this.bookName),
            value: this.currentIndex.toString()
        });
    },

    markRecent() {
        if (!this.bookName) {
            return;
        }
        storage.set({
            key: 'recent_0',
            value: this.bookName
        });
    },

    startReading() {
        var that = this;
        this.ensureText(this.currentIndex + this.pageSize * 2, function() {
            that.renderCurrent();
            that.markRecent();
        });
    },

    ensureText(neededEnd, done) {
        var that = this;
        if (this.fullText.length >= neededEnd || this.isEndOfFile) {
            done();
            return;
        }
        if (this._reading) {
            if (neededEnd > this._pendingEnd) {
                this._pendingEnd = neededEnd;
                this._pendingDone = done;
            }
            return;
        }
        this._reading = true;
        this._pendingEnd = neededEnd;
        this._pendingDone = done;
        this._readNextBlock();
    },

    _readNextBlock() {
        var that = this;
        if (!this._active) {
            this._reading = false;
            return;
        }

        file.readText({
            uri: 'internal://app/' + that.bookName,
            position: that.filePosition,
            length: that.readBlockSize,
            success: function(data) {
                var newText = data.text || '';
                if (newText.length === 0) {
                    that.isEndOfFile = true;
                } else {
                    that.fullText += newText;
                    that.filePosition += that.readBlockSize;
                }

                if (!that.isEndOfFile && that.fullText.length < that._pendingEnd) {
                    that._readNextBlock();
                    return;
                }

                that._reading = false;
                var cb = that._pendingDone;
                that._pendingDone = null;
                that._pendingEnd = 0;
                if (cb) {
                    cb();
                }
            },
            fail: function() {
                that.isEndOfFile = true;
                that._reading = false;
                that.pageText = '读取失败或文件不存在';
                var cb = that._pendingDone;
                that._pendingDone = null;
                that._pendingEnd = 0;
                if (cb) {
                    cb();
                }
            }
        });
    },

    renderCurrent() {
        if (!this._active) {
            return;
        }
        this.pageText = this.getPageAt(this.currentIndex);
    },

    getPageAt(offset) {
        if (offset < 0) {
            return '已经是第一页';
        }
        if (offset >= this.fullText.length) {
            if (this.isEndOfFile) {
                return '--- 本书已读完 ---';
            }
            return '正在加载…';
        }
        var end = offset + this.pageSize;
        if (end > this.fullText.length) {
            end = this.fullText.length;
        }
        return this.fullText.substring(offset, end);
    },

    turnForward() {
        this.currentIndex += this.pageSize;
        this.saveCurrentProgress();
        var that = this;
        this.ensureText(this.currentIndex + this.pageSize * 2, function() {
            that.renderCurrent();
        });
    },

    turnBackward() {
        this.currentIndex = Math.max(0, this.currentIndex - this.pageSize);
        this.saveCurrentProgress();
        this.renderCurrent();
    },

    onTextSwipe(e) {
        if (!this._active) {
            return;
        }
        if (e.direction === 'up' || e.direction === 'left') {
            this._lastManual = Date.now();
            this.turnForward();
        } else if (e.direction === 'down' || e.direction === 'right') {
            this._lastManual = Date.now();
            this.turnBackward();
        }
    },

    onSwiperChange(e) {
        if (!this._active) {
            return;
        }
        if (Date.now() - this._lastManual < 400) {
            return;
        }
        var oldIndex = this.visibleIndex;
        var newIndex = e.index;
        if (newIndex === oldIndex) {
            return;
        }
        var delta = (newIndex - oldIndex + 3) % 3;
        this.visibleIndex = newIndex;
        if (delta === 1) {
            this.turnForward();
        } else if (delta === 2) {
            this.turnBackward();
        }
    },

    goBack() {
        this.saveCurrentProgress();
        this.stopTimeUpdate();
        router.replace({ uri: 'pages/index/index' });
    }
};
