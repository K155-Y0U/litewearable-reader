/**
 * 阅读页逻辑控制器（swiper 三页循环，无缝上下滑动）
 * 功能：
 *   - 使用 swiper loop+vertical 实现连续翻页
 *   - 三页缓存（前/当前/后），滑到边缘时自动加载并重置索引
 *   - 按 readBlockSize(1000) 流式加载文本
 *   - storage 记忆进度，顶部显示时间电量
 */
import file from '@system.file';
import router from '@system.router';
import storage from '@system.storage';
import battery from '@system.battery';
import { validateLiteBin } from '../../common/litebin.js';

function progressKey(bookName) {
    var hash = 0;
    for (var i = 0; i < bookName.length; i++) {
        hash = (hash * 131 + bookName.charCodeAt(i)) % 2147483647;
    }
    return 'p_' + hash.toString(16);
}

function prefix(fullText, timeText, batteryLevel) {
    return '[' + timeText + '  电量:' + batteryLevel + '%]';
}

export default {
    data: {
        bookName: '',
        fullText: '',
        swiperIndex: 1,
        page0: '正在加载中…',
        page1: '',
        page2: '',
        currentIndex: 0,   // 当前显示页起始字符偏移
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
        this.isEndOfFile = false;
        this.page0 = '';
        this.page1 = '正在加载中…';
        this.page2 = '';

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
                that.startReading();
            },
            fail: function() {
                that.currentIndex = 0;
                that.startReading();
            }
        });
    },

    saveCurrentProgress() {
        storage.set({
            key: progressKey(this.bookName),
            value: this.currentIndex.toString()
        });
    },

    /**
     * 流式加载文本，直到覆盖三个页面所需的字符数
     */
    loadAhead() {
        var that = this;
        // 需要覆盖：currentIndex ~ currentIndex + pageSize*3
        var neededEnd = this.currentIndex + this.pageSize * 3;
        if (this.fullText.length >= neededEnd && !this.isEndOfFile) {
            return;
        }
        if (this.isEndOfFile) {
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
                    that.renderPages();
                    return;
                }
                that.fullText += newText;
                that.filePosition += that.readBlockSize;
                that.renderPages();
            },
            fail: function() {
                that.isEndOfFile = true;
                that.page1 = '读取失败或文件不存在';
            }
        });
    },

    /**
     * 将 fullText 按 pageIndex 切片渲染到 page0/page1/page2
     */
    renderPages() {
        if (!this._active) return;
        var p = this.pageSize;
        this.page0 = this.getPageAt(this.currentIndex - p);
        this.page1 = this.getPageAt(this.currentIndex);
        this.page2 = this.getPageAt(this.currentIndex + p);
    },

    getPageAt(startOffset) {
        var p = this.pageSize;
        var end = startOffset + p;

        if (startOffset >= this.fullText.length) {
            if (this.isEndOfFile) {
                return '--- 本书已读完 ---';
            }
            return '';
        }
        end = Math.min(end, this.fullText.length);
        return prefix(this.fullText, this.timeText, this.batteryLevel) + '\n\n' +
            this.fullText.substring(startOffset, end);
    },

    /**
     * swiper change 回调
     * index=2 表示用户滑到了下一页，index=0 表示滑回了上一页
     */
    onSwiperChange(e) {
        if (!this._active) return;
        var newIndex = e.index;

        if (newIndex === 2) {
            // 向前滑动：当前页变成前一页，加载下一页
            this.currentIndex += this.pageSize;
            this.saveCurrentProgress();
            this.page0 = this.page1;
            this.page1 = this.page2;
            this.loadAhead();
            this.swiperIndex = 1; // 重置回中间页，内容已更新
        } else if (newIndex === 0) {
            // 向后滑动：当前页变成后一页，加载上一页
            this.currentIndex = Math.max(0, this.currentIndex - this.pageSize);
            this.saveCurrentProgress();
            this.page2 = this.page1;
            this.page1 = this.page0;
            this.loadAhead();
            this.swiperIndex = 1;
        }
    },

    goBack() {
        this.saveCurrentProgress();
        this.stopTimeUpdate();
        router.replace({ uri: 'pages/index/index' });
    }
};
