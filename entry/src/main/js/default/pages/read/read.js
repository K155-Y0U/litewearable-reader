/**
 * 阅读页：swiper 三页垂直循环翻页
 * - swiper loop + vertical，固定尺寸（对齐已真机验证的测试页）
 * - 三页槽位：当前页 / 下一页 / 上一页，按 swiper 索引动态映射
 * - 文本按 readBlockSize(1000) 分块读取，按需预读
 * - 保留进度记忆、时间电量、自定义背景
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
        page0: '正在加载中…',
        page1: '',
        page2: '',
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
        this.fullText = '';
        this.filePosition = 0;
        this.currentIndex = 0;
        this.visibleIndex = 0;
        this.progressLoaded = false;
        this.isEndOfFile = false;
        this._reading = false;
        this._pendingEnd = 0;
        this._pendingDone = null;
        this.page0 = '正在加载中…';
        this.page1 = '';
        this.page2 = '';
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
            that.renderAll();
            that.markRecent();
        });
    },

    /**
     * 顺序读取文件，直到 fullText 覆盖 neededEnd 或到达文件尾
     */
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
                that.page0 = '读取失败或文件不存在';
                var cb = that._pendingDone;
                that._pendingDone = null;
                that._pendingEnd = 0;
                if (cb) {
                    cb();
                }
            }
        });
    },

    /**
     * swiper 三个槽位按当前可见索引映射：
     *   visible=0: page0=当前, page1=下一页, page2=上一页
     *   visible=1: page0=上一页, page1=当前, page2=下一页
     *   visible=2: page0=下一页, page1=上一页, page2=当前
     */
    renderAll() {
        if (!this._active) {
            return;
        }
        var cur = this.getPageAt(this.currentIndex);
        var next = this.getPageAt(this.currentIndex + this.pageSize);
        var prev = this.getPageAt(this.currentIndex - this.pageSize);
        var vi = this.visibleIndex;

        if (vi === 0) {
            this.page0 = cur;
            this.page1 = next;
            this.page2 = prev;
        } else if (vi === 1) {
            this.page0 = prev;
            this.page1 = cur;
            this.page2 = next;
        } else {
            this.page0 = next;
            this.page1 = prev;
            this.page2 = cur;
        }
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

    onSwiperChange(e) {
        if (!this._active) {
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
            this.currentIndex += this.pageSize;
            this.saveCurrentProgress();
            var that = this;
            this.ensureText(this.currentIndex + this.pageSize * 2, function() {
                that.renderAll();
            });
        } else if (delta === 2) {
            this.currentIndex = Math.max(0, this.currentIndex - this.pageSize);
            this.saveCurrentProgress();
            this.renderAll();
        }
    },

    goBack() {
        this.saveCurrentProgress();
        this.stopTimeUpdate();
        router.replace({ uri: 'pages/index/index' });
    }
};
