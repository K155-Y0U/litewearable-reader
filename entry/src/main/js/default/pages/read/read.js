/**
 * 阅读页测试：swiper 最小化验证
 * 只测试 swiper 能否显示，不带文件加载逻辑
 */
import router from '@system.router';

export default {
    data: {
        bookName: '',
        swiperIndex: 1,
        changeCount: 0
    },

    onInit() {
        if (this.bookName) {
            console.info('=== [阅读页] 书籍: ' + this.bookName);
        } else {
            this.bookName = '未知书籍';
        }
    },

    onShow() {
        this._active = true;
    },

    onHide() {
        this._active = false;
    },

    onDestroy() {
        this._active = false;
    },

    onSwiperChange(e) {
        if (!this._active) return;
        var newIndex = e.index;
        this.swiperIndex = newIndex;
        this.changeCount++;
    },

    goBack() {
        router.replace({ uri: 'pages/index/index' });
    }
};
