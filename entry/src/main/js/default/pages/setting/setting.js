import router from '@system.router';
import file from '@system.file';
import storage from '@system.storage';
import { validateLiteBin } from '../../common/litebin.js';

export default {
    data: {
        backgroundText: '内置背景',
        backgroundHint: '当前使用内置背景',
        previewImage: '/common/read_bg.png',
        hasCustom: false,
        statusText: '',
        bgPath: ''
    },

    onShow() {
        this._active = true;
        this.statusText = '';
        this.loadBackgroundState();
    },

    onHide() {
        this._active = false;
    },

    onDestroy() {
        this._active = false;
    },

    loadBackgroundState() {
        var that = this;
        storage.get({
            key: 'bg_path',
            success: function(path) {
                if (!that._active) {
                    return;
                }
                if (!path) {
                    that.setDefaultState();
                    return;
                }
                validateLiteBin(path, function(valid) {
                    if (!that._active) {
                        return;
                    }
                    if (valid) {
                        that.bgPath = path;
                        that.hasCustom = true;
                        that.backgroundText = '自定义背景';
                        that.backgroundHint = '已启用 custom_bg.bin';
                        that.previewImage = path;
                    } else {
                        that.setDefaultState();
                    }
                });
            },
            fail: function() {
                that.setDefaultState();
            }
        });
    },

    setDefaultState() {
        this.bgPath = '';
        this.hasCustom = false;
        this.backgroundText = '内置背景';
        this.backgroundHint = '当前使用内置背景';
        this.previewImage = '/common/read_bg.png';
    },

    resetBackground() {
        var that = this;
        if (!this.bgPath) {
            this.setDefaultState();
            this.statusText = '当前已是内置背景';
            return;
        }
        try {
            file.delete({
                uri: this.bgPath,
                success: function() {
                    if (!that._active) {
                        return;
                    }
                    try {
                        storage.set({
                            key: 'bg_path',
                            value: ''
                        });
                    } catch (e) {
                        console.error('clear bg_path error: ' + e.message);
                    }
                    that.setDefaultState();
                    that.statusText = '已恢复内置背景';
                },
                fail: function() {
                    if (that._active) {
                        that.statusText = '删除失败，请重试';
                    }
                }
            });
        } catch (e) {
            this.statusText = '删除异常: ' + e.message;
        }
    },

    goToTrans() {
        router.replace({ uri: 'pages/trans/trans' });
    },

    goBack() {
        router.replace({ uri: 'pages/index/index' });
    }
};
