import router from '@system.router';

export default {
    data: {
        currentIndex: 0,
        changeCount: 0
    },

    onChange(e) {
        this.currentIndex = e.index;
        this.changeCount++;
    },

    goBack() {
        router.replace({ uri: 'pages/setting/setting' });
    }
};
