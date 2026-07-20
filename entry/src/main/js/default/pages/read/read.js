// pages/read/read.js
import file from '@system.file';
import router from '@system.router';
import storage from '@system.storage';
import battery from '@system.battery';

export default {
    data: {
        bookName: '',
        fullText: '',
        textContent: '正在加载中...',
        currentIndex: 0,
        pageSize: 110,
        filePosition: 0,
        readBlockSize: 1000,
        isEndOfFile: false,
        timeText: '00:00',
        batteryLevel: '100',
        progressText: '0%',
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
        // 重置状态，确保每次进入页面重新加载
        this.fullText = '';
        this.filePosition = 0;
        this.currentIndex = 0;
        this.isEndOfFile = false;

        this.updateSystemInfo();
        this.startTimeUpdate();
        this.loadSavedProgress();
    },
    onHide() {
        this.stopTimeUpdate();
    },
    startTimeUpdate() {
        var that = this;
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
    loadSavedProgress() {
        var that = this;
        storage.get({
            key: 'progress_' + that.bookName,
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
            key: 'progress_' + this.bookName,
            value: this.currentIndex.toString()
        });
    },
    loadNextBlock() {
        if (this.isEndOfFile) return;

        var that = this;
        // 核心整合：判断是否为穿透路径，选择不同的基准目录
        var fileUri = (that.bookName.indexOf('..\\') !== -1) ? that.bookName : ('internal://app/' + that.bookName);

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

                // 递归读取直到满足当前显示位置
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
        if (this.currentIndex >= this.fullText.length && this.isEndOfFile) {
            this.textContent = "--- 本书已读完 ---";
            return;
        }

        // 自动加载更多块
        if (!this.isEndOfFile && (this.fullText.length - this.currentIndex) < (this.pageSize * 2)) {
            this.loadNextBlock();
        }

        var pageText = this.fullText.substring(this.currentIndex, this.currentIndex + this.pageSize);
        this.textContent = "[" + this.timeText + "  电量:" + this.batteryLevel + "%]\n\n" + pageText;
    },
    handleSwipe(e) {
        if (e.direction === 'right') {
            this.saveCurrentProgress();
            this.stopTimeUpdate();
            // 整合返回逻辑：跨应用书返回转接页，普通书返回首页
            if (this.bookName.indexOf('..\\') !== -1) {
                router.replace({ uri: 'pages/trans/trans' });
            } else {
                router.replace({ uri: 'pages/index/index' });
            }
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
