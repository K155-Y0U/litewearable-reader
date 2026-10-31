import router from '@system.router';
import storage from '@system.storage';

/**
 * Cross-app entry page.
 *
 * The user enters the package name of another app with the built-in pinyin
 * keyboard, then opens that app's sandbox directory in pages/filelist.
 * This is an experimental Lite Wearable capability and must be verified on
 * the target firmware.
 */
export default {
    data: {
        inputWords: '',
        targetPackage: '',
        fromPageData: null,
        tipText: '当前目标: 未输入',
        btn2Text: '返回本应用书架',
        showButtons: true,
        from: ''
    },

    onInit() {
        var that = this;

        if (this.inputWords && this.inputWords !== '' &&
            this.inputWords !== '无文本' && this.inputWords !== '    ') {
            this.targetPackage = this.inputWords;
            this.tipText = '当前目标: ' + this.targetPackage;
            this.saveTargetPackage(this.targetPackage);
            return;
        }

        if (!this.fromPageData && this.from !== 'index') {
            router.replace({ uri: 'pages/index/index' });
            return;
        }

        storage.get({
            key: 'saved_target_package',
            success: function(data) {
                if (data && data !== '' && data !== '未输入') {
                    that.targetPackage = data;
                    that.tipText = '当前目标: ' + data;
                }
            },
            fail: function() {
                that.targetPackage = '';
            }
        });
    },

    saveTargetPackage(packageName) {
        try {
            storage.set({
                key: 'saved_target_package',
                value: packageName
            });
        } catch (e) {
            console.error('保存目标包名失败: ' + e.message);
        }
    },

    goToChangePackage() {
        router.replace({
            uri: 'pages/pinyin/pinyin',
            params: {
                fromPage: 'pages/trans/trans',
                fromPageData: {
                    from: this.from
                }
            }
        });
    },

    goToFileList() {
        if (!this.targetPackage) {
            this.tipText = '请先输入目标包名';
            return;
        }
        router.replace({
            uri: 'pages/filelist/filelist',
            params: {
                targetPackage: this.targetPackage
            }
        });
    },

    onBtn2Click() {
        router.replace({ uri: 'pages/index/index' });
    }
};
