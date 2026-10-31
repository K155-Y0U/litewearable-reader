// pages/read/read.js
// Lite Wearable TXT reader.
// The reader keeps only one small window of text in memory and seeks by byte
// offset for each page. It never accumulates the whole book into a string.

import file from '@system.file';
import router from '@system.router';
import storage from '@system.storage';
import battery from '@system.battery';

var PAGE_SIZE = 110;
var READ_BLOCK_SIZE = 2048;
var BACK_BLOCK_SIZE = 1024;
var TIME_UPDATE_INTERVAL = 30000;

function utf8Length(text) {
    var total = 0;
    for (var i = 0; i < text.length; i++) {
        var code = text.charCodeAt(i);
        if (code < 0x80) {
            total += 1;
        } else if (code < 0x800) {
            total += 2;
        } else if (code >= 0xD800 && code <= 0xDBFF && i + 1 < text.length) {
            var next = text.charCodeAt(i + 1);
            if (next >= 0xDC00 && next <= 0xDFFF) {
                total += 4;
                i++;
            } else {
                total += 3;
            }
        } else {
            total += 3;
        }
    }
    return total;
}

function progressKey(bookName) {
    var hash = 0;
    for (var i = 0; i < bookName.length; i++) {
        hash = (hash * 131 + bookName.charCodeAt(i)) % 2147483647;
    }
    return 'p2_' + hash.toString(16);
}

export default {
    data: {
        bookName: '',
        textContent: '正在加载中...',
        statusText: '00:00  电量:100%',
        pageNo: 1,
        fileSize: 0
    },

    onInit() {
        this._windowStart = 0;
        this._windowText = '';
        this._pageStart = 0;
        this._pageByte = 0;
        this._timerId = null;
        this._isActive = false;
        this._isLoading = false;
        this._reachedEnd = false;
        this._timeText = '00:00';
        this._batteryLevel = 100;
    },

    onShow() {
        if (this._isActive) {
            return;
        }
        if (!this.bookName) {
            this.textContent = '未指定书籍';
            return;
        }

        this._isActive = true;
        this._windowStart = 0;
        this._windowText = '';
        this._pageStart = 0;
        this._pageByte = 0;
        this._isLoading = false;
        this._reachedEnd = false;
        this._timeText = '00:00';
        this._batteryLevel = 100;
        this.pageNo = 1;
        this.fileSize = 0;
        this.textContent = '正在加载中...';

        this.updateSystemInfo();
        this.startTimeUpdate();
        this.loadFileSize();
        this.loadSavedProgress();
    },

    onHide() {
        this._isActive = false;
        this.saveCurrentProgress();
        this.stopTimeUpdate();
    },

    onDestroy() {
        this._isActive = false;
        this.saveCurrentProgress();
        this.stopTimeUpdate();
        this._windowText = '';
        this.textContent = '';
        this.statusText = '';
    },

    bookPath() {
        if (this.bookName.indexOf('internal://') === 0) {
            return this.bookName;
        }
        return 'internal://app/' + this.bookName;
    },

    isCrossAppBook() {
        return this.bookName.indexOf('..\\') !== -1;
    },

    startTimeUpdate() {
        var that = this;
        if (this._timerId) {
            return;
        }
        this._timerId = setInterval(function() {
            that.updateSystemInfo();
        }, TIME_UPDATE_INTERVAL);
    },

    stopTimeUpdate() {
        if (this._timerId) {
            clearInterval(this._timerId);
            this._timerId = null;
        }
    },

    updateSystemInfo() {
        var that = this;
        var date = new Date();
        this._timeText = (date.getHours() < 10 ? '0' : '') + date.getHours() + ':' +
            (date.getMinutes() < 10 ? '0' : '') + date.getMinutes();

        try {
            battery.getStatus({
                success: function(data) {
                    if (!that._isActive || !data) {
                        return;
                    }
                    that._batteryLevel = Math.floor(data.level <= 1 ? data.level * 100 : data.level);
                    that.updateStatus();
                },
                fail: function() {
                    if (that._isActive) {
                        that.updateStatus();
                    }
                }
            });
        } catch (e) {
            console.error('battery error: ' + e.message);
        }
    },

    updateStatus() {
        var text = this._timeText;
        if (this._batteryLevel === undefined || this._batteryLevel === null) {
            text += '  电量:--';
        } else {
            text += '  电量:' + this._batteryLevel + '%';
        }
        if (this.fileSize > 0) {
            var percent = Math.floor(this._pageByte * 100 / this.fileSize);
            if (percent < 0) {
                percent = 0;
            }
            if (percent > 100) {
                percent = 100;
            }
            text += '  ' + percent + '%';
        }
        text += '  第' + this.pageNo + '页';
        this.statusText = text;
    },

    loadFileSize() {
        var that = this;
        try {
            file.get({
                uri: this.bookPath(),
                success: function(data) {
                    if (!that._isActive) {
                        return;
                    }
                    that.fileSize = (data && data.length) ? data.length : 0;
                    that.updateStatus();
                },
                fail: function() {
                    if (that._isActive) {
                        that.updateStatus();
                    }
                }
            });
        } catch (e) {
            console.error('file.get error: ' + e.message);
        }
    },

    loadSavedProgress() {
        var that = this;
        storage.get({
            key: progressKey(this.bookName),
            success: function(data) {
                if (!that._isActive) {
                    return;
                }
                var byteOffset = 0;
                var pageNo = 1;
                if (data) {
                    var parts = data.split(',');
                    var parsedByte = parseInt(parts[0]);
                    var parsedPage = parseInt(parts[1]);
                    if (!isNaN(parsedByte) && parsedByte >= 0) {
                        byteOffset = parsedByte;
                    }
                    if (!isNaN(parsedPage) && parsedPage > 0) {
                        pageNo = parsedPage;
                    }
                }
                that.pageNo = pageNo;
                that._pageByte = byteOffset;
                that.readPageAt(byteOffset);
            },
            fail: function() {
                if (!that._isActive) {
                    return;
                }
                that.pageNo = 1;
                that._pageByte = 0;
                that.readPageAt(0);
            }
        });
    },

    saveCurrentProgress() {
        if (!this.bookName || !this._windowText) {
            return;
        }
        storage.set({
            key: progressKey(this.bookName),
            value: this._pageByte + ',' + this.pageNo
        });
    },

    readPageAt(byteOffset) {
        var that = this;
        if (this._isLoading) {
            return;
        }
        this._isLoading = true;

        file.readText({
            uri: this.bookPath(),
            position: byteOffset,
            length: READ_BLOCK_SIZE,
            success: function(data) {
                if (!that._isActive) {
                    return;
                }
                that._isLoading = false;
                var text = (data && data.text) ? data.text : '';
                if (text.length === 0) {
                    that._pageByte = byteOffset;
                    that._reachedEnd = byteOffset > 0;
                    that.textContent = byteOffset > 0 ? '--- 本书已读完 ---' : '本书为空或无法读取';
                    that.updateStatus();
                    return;
                }

                that._windowStart = byteOffset;
                that._windowText = text;
                that._pageStart = 0;
                that._pageByte = byteOffset;
                that._reachedEnd = false;
                that.renderPage();
            },
            fail: function(err, code) {
                if (!that._isActive) {
                    return;
                }
                that._isLoading = false;
                that.textContent = '读取失败 (' + code + ')';
            }
        });
    },

    renderPage() {
        if (!this._windowText) {
            return;
        }
        var end = this._pageStart + PAGE_SIZE;
        if (end > this._windowText.length) {
            end = this._windowText.length;
        }
        var pageText = this._windowText.substring(this._pageStart, end);
        if (!pageText) {
            this._reachedEnd = true;
            this.textContent = '--- 本书已读完 ---';
        } else {
            this.textContent = pageText;
        }
        this.updateStatus();
        this.saveCurrentProgress();
    },

    nextPage() {
        if (this._isLoading || this._reachedEnd || !this._windowText) {
            return;
        }

        var end = this._pageStart + PAGE_SIZE;
        if (end > this._windowText.length) {
            end = this._windowText.length;
        }
        var currentPageText = this._windowText.substring(this._pageStart, end);
        if (!currentPageText) {
            this._reachedEnd = true;
            this.textContent = '--- 本书已读完 ---';
            this.updateStatus();
            return;
        }

        var nextByte = this._pageByte + utf8Length(currentPageText);

        if (this.fileSize > 0 && nextByte >= this.fileSize) {
            this._pageByte = nextByte;
            this.pageNo++;
            this._reachedEnd = true;
            this.textContent = '--- 本书已读完 ---';
            this.updateStatus();
            this.saveCurrentProgress();
            return;
        }

        this.pageNo++;
        this._pageByte = nextByte;
        this.readPageAt(nextByte);
    },

    prevPage() {
        var that = this;
        if (this._isLoading || !this._windowText) {
            return;
        }

        var pageByte = this._pageByte;
        if (pageByte <= 0) {
            this.pageNo = 1;
            this._pageByte = 0;
            this.readPageAt(0);
            return;
        }

        var backStart = Math.max(0, pageByte - BACK_BLOCK_SIZE);
        var backLength = pageByte - backStart;
        if (backLength <= 0) {
            this.pageNo = 1;
            this._pageByte = 0;
            this.readPageAt(0);
            return;
        }

        this._isLoading = true;
        file.readText({
            uri: this.bookPath(),
            position: backStart,
            length: backLength,
            success: function(data) {
                that._isLoading = false;
                if (!that._isActive) {
                    return;
                }
                var text = (data && data.text) ? data.text : '';
                if (text.length === 0) {
                    that.pageNo = 1;
                    that._pageByte = 0;
                    that.readPageAt(0);
                    return;
                }
                var start = Math.max(0, text.length - PAGE_SIZE);
                var prevPageText = text.substring(start);
                var prevByte = pageByte - utf8Length(prevPageText);
                if (prevByte < 0) {
                    prevByte = 0;
                }
                that._windowStart = backStart;
                that._windowText = text;
                that._pageStart = start;
                that._pageByte = prevByte;
                if (that.pageNo > 1) {
                    that.pageNo--;
                }
                that._reachedEnd = false;
                that.renderPage();
            },
            fail: function() {
                that._isLoading = false;
                that.pageNo = 1;
                that._pageByte = 0;
                that.readPageAt(0);
            }
        });
    },

    handleSwipe(e) {
        if (e.direction === 'right') {
            this.saveCurrentProgress();
            this.stopTimeUpdate();
            if (this.isCrossAppBook()) {
                router.replace({ uri: 'pages/trans/trans' });
            } else {
                router.replace({ uri: 'pages/index/index' });
            }
        } else if (e.direction === 'down' || e.direction === 'left') {
            this.nextPage();
        } else if (e.direction === 'up') {
            this.prevPage();
        }
    }
};
