import router from '@system.router';
import storage from '@system.storage';
import { progressKey } from '../../common/progress.js';

var PAGE_SIZE = 150;

export default {
    data: {
        lastBookName: '',
        lastPage: 1,
        lastReadLabel: '暂无记录'
    },

    onShow() {
        this.loadLastRead();
    },

    loadLastRead() {
        var that = this;
        storage.get({
            key: 'recent_0',
            success: function(name) {
                if (!name) {
                    that.lastBookName = '';
                    that.lastPage = 1;
                    that.lastReadLabel = '暂无记录';
                    return;
                }
                storage.get({
                    key: progressKey(name),
                    success: function(value) {
                        var currentIndex = value ? parseInt(value) : 0;
                        var page = Math.floor(currentIndex / PAGE_SIZE) + 1;
                        var displayName = name.length > 10 ? name.substring(0, 10) + '…' : name;
                        that.lastBookName = name;
                        that.lastPage = page;
                        that.lastReadLabel = displayName + ' · 第' + page + '页';
                    },
                    fail: function() {
                        that.lastBookName = name;
                        that.lastPage = 1;
                        that.lastReadLabel = name + ' · 第1页';
                    }
                });
            },
            fail: function() {
                that.lastBookName = '';
                that.lastPage = 1;
                that.lastReadLabel = '暂无记录';
            }
        });
    },

    openLastBook() {
        if (!this.lastBookName) {
            return;
        }
        router.replace({
            uri: 'pages/read/read',
            params: {
                bookName: this.lastBookName
            }
        });
    },

    goToBooks() {
        router.replace({ uri: 'pages/books/books' });
    },

    goToSetting() {
        router.replace({ uri: 'pages/setting/setting' });
    },

    goToTransPage() {
        router.replace({
            uri: 'pages/trans/trans',
            params: {
                from: 'index'
            }
        });
    }
};
