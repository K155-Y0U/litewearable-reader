import router from '@system.router';

export default {
    data: {
        fromPage: "",
        fromPageData:null,
        letters: "",
        words: "　　　　",
        inputWords: "",
        sindex: 0,
        mode: "cn",
        caps: -1,
        keyboardLetters: "QWERTYUIOPASDFGHJKLZXCVBNM",
    },
    //键盘页切换时记录index
    changeSwiper(e) {
        var that = this;
        that.sindex = e.index;
    },
    changeToSymbol() {
        var that = this;
        that.keyboardLetters = "1234567890,.;:\"'!@#$%&*()";
        that.mode = "sy";
        that.letters = "";
        that.words = that.inputWords.substring(that.inputWords.length - 8)
    },
    changeToEn() {
        var that = this;
        that.letters = "";
        if (that.caps == 1) {
            that.keyboardLetters = "qwertyuiopasdfghjklzxcvbnm";
        } else {
            that.keyboardLetters = "QWERTYUIOPASDFGHJKLZXCVBNM";
        }
        that.mode = "en";
        that.caps *= -1;
        that.words = that.inputWords.substring(that.inputWords.length - 8)
    },
    changeToCn() {
        var that = this;
        that.keyboardLetters = "QWERTYUIOPASDFGHJKLZXCVBNM";
        that.mode = "cn";
        that.letters = ""
        that.words = that.inputWords.substring(that.inputWords.length - 8)
    },
    input(index) {
        var that = this;
        var symbol = this.keyboardLetters.charAt(index);
        if (!symbol) {
            return;
        }
        if (this.mode == "cn") {
            that.letters += symbol;
        } else {
            that.inputWords += symbol;
        }
        that.words = that.inputWords.substring(that.inputWords.length - 8)
    },
    directInput(symbol) {
        var that = this;
        that.inputWords += symbol;
        that.letters = "";
        that.words = that.inputWords.substring(that.inputWords.length - 8)
    },
    backspace() {
        var that = this;
        if (this.mode == "cn") {
            if(that.letters.length==0){
                this.wordsBackspace();
                that.words = that.inputWords.substring(that.inputWords.length - 8)
            }else if (that.letters.length <= 1) {
                that.letters = "";
            } else {
                that.letters = that.letters.substring(0, that.letters.length - 1);
                console.log(that.letters);
            }
        }else{
            this.wordsBackspace();
            that.words = that.inputWords.substring(that.inputWords.length - 8)
        }
    },
    wordsBackspace() {
        var that = this;
        if (that.inputWords.length <= 1) {
            that.inputWords = "";
        } else {
            that.inputWords = that.inputWords.substring(0, that.inputWords.length - 1);
        }
    },
    jumpToCandidate() {
        if (!this.letters) {
            return;
        }
        var that = this;
        router.replace({
            uri: 'pages/pinyincandidate/pinyincandidate',
            params: {
                pinyinFromPage: that.fromPage,
                inputWords: that.inputWords,
                sindex: that.sindex,
                letters: that.letters,
            },
        });
    },
    finishInput(){
        var that = this;
        router.replace({
            uri: that.fromPage || 'pages/index/index',
            params: {
                fromPageData:that.fromPageData,
                inputWords:that.inputWords,
            },
        });
    },
    cancelInput(){
        var that = this;
        router.replace({
            uri: that.fromPage || 'pages/index/index',
            params: {
                fromPageData:that.fromPageData,
            },
        });
    },
    touchMove(e) { // swipe处理事件
        if (e.direction == "right") { // 右滑退出
            this.cancelInput()
        }
    }
}
