import router from '@system.router';
import file from '@system.file';
import storage from '@system.storage';
import { P2pClient } from '../wearengine.js';

var MAX_BG_BYTES = 300 * 1024;

/**
 * WearEngine transfer page.
 *
 * The phone app sends .txt files to this watch app through WearEngine.
 * Files may land in internal://cache/ on older firmware, so the receiver
 * checks both internal://app/ and internal://cache/ and moves the file
 * into internal://app/ where the bookshelf can find it.
 *
 * The watch must stay on this page while transferring. Leaving the page
 * unregisters the receiver to release the WearEngine callback and memory.
 */
export default {
    data: {
        statusText: '等待连接…',
        messageLog: [],
        client: null,
        peerPkgName: 'lite.wearable.reader',
        peerFingerPrint: 'lite.wearable.reader_MDRlZDYxYTA2NDNjNjYwYTBjYzMyN2E3MzEwODgyYjYyYjgxZThmZjYyMTRjYTI0NGY2ZDIzZjRhZmMxODVmZGVjMTFjMGM4MGMxMmNjZGE3NDhmNmUxMTlhMTM4MzM3MTJmZmEyYzhlMDYwZDIwY2MwMWUzNGRjNDljODVmNjY2MA=='
    },

    onInit() {
        this._active = false;
        this.appendLog('传输页初始化');
    },

    onShow() {
        this._active = true;
        this.initWearEngine();
    },

    onHide() {
        this._active = false;
        this.destroyWearEngine();
    },

    onDestroy() {
        this._active = false;
        this.destroyWearEngine();
        this.messageLog = [];
    },

    initWearEngine() {
        if (this.client) {
            return;
        }

        var that = this;
        this.setStatus('正在连接手机…');

        try {
            var p2p = new P2pClient();
            this.client = p2p;
            p2p.whenReady(function() {
                if (!that._active) {
                    return;
                }
                p2p.setPeerPkgName(that.peerPkgName);
                p2p.setPeerFingerPrint(that.peerFingerPrint.trim());
                p2p.registerReceiver({
                    onSuccess: function() {
                        if (!that._active) {
                            return;
                        }
                        that.setStatus('已连接，等待传输');
                        that.appendLog('接收器注册成功');
                    },
                    onFailure: function() {
                        if (!that._active) {
                            return;
                        }
                        that.setStatus('连接失败');
                        that.appendLog('接收器注册失败');
                    },
                    onReceiveMessage: function(message) {
                        that.handleReceiveMessage(message);
                    }
                });
            });
            this.setStatus('正在注册接收器…');
        } catch (e) {
            console.error('initWearEngine error: ' + e.message);
            this.setStatus('初始化失败');
            this.appendLog('WearEngine异常: ' + e.message);
        }
    },

    destroyWearEngine() {
        if (!this.client) {
            return;
        }
        try {
            if (this.client._versionReady) {
                this.client.unregisterReceiver({
                    onSuccess: function() {
                        console.info('unregisterReceiver ok');
                    }
                });
            }
        } catch (e) {
            console.error('unregister error: ' + e.message);
        }
        this.client = null;
    },

    setStatus(text) {
        this.statusText = text;
    },

    appendLog(text) {
        var now = this.formatTime();
        var log = '[' + now + '] ' + text;
        var newLog = this.messageLog.slice();
        newLog.push(log);
        if (newLog.length > 40) {
            newLog.splice(0, newLog.length - 40);
        }
        this.messageLog = newLog;
    },

    formatTime() {
        var d = new Date();
        var h = d.getHours() < 10 ? '0' + d.getHours() : '' + d.getHours();
        var m = d.getMinutes() < 10 ? '0' + d.getMinutes() : '' + d.getMinutes();
        var s = d.getSeconds() < 10 ? '0' + d.getSeconds() : '' + d.getSeconds();
        return h + ':' + m + ':' + s;
    },

    handleReceiveMessage(message) {
        if (!message) {
            return;
        }
        if (message.isFileType === true && message.name) {
            var fileName = this.getBaseName(message.name);
            var ext = this.getExtName(fileName).toLowerCase();
            this.appendLog('收到文件: ' + fileName);
            if (ext === '.txt') {
                this.receiveNovel(fileName);
            } else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.bmp') {
                this.receiveBackground(fileName);
            } else {
                this.appendLog('忽略不支持的文件: ' + fileName);
            }
        } else if (typeof message === 'string') {
            this.appendLog('文本消息: ' + message);
        }
    },

    receiveNovel(fileName) {
        var that = this;
        this.setStatus('接收: ' + fileName);
        this.ensureFileInAppDir(fileName, function(success) {
            if (success) {
                that.appendLog('小说已保存: ' + fileName);
                that.setStatus('已收到 ' + fileName);
            } else {
                that.appendLog('保存失败: ' + fileName);
                that.setStatus('文件保存失败');
            }
        });
    },

    receiveBackground(fileName) {
        var that = this;
        var ext = this.getExtName(fileName).toLowerCase();
        if (ext === '.jpeg') {
            ext = '.jpg';
        }
        var targetName = 'custom_bg' + ext;
        var targetUri = 'internal://app/' + targetName;

        this.setStatus('接收背景: ' + fileName);
        this.locateReceivedFile(fileName, function(srcUri) {
            if (!srcUri) {
                that.appendLog('背景图不存在: ' + fileName);
                that.setStatus('背景图保存失败');
                return;
            }

            file.get({
                uri: srcUri,
                success: function(data) {
                    if (data && data.length > MAX_BG_BYTES) {
                        that.appendLog('背景图过大，已忽略: ' + fileName);
                        that.setStatus('背景图请控制在 300KB 内');
                        that.removeFileIfExists(srcUri, function() {});
                        return;
                    }
                    that.installBackground(srcUri, targetUri, function(success) {
                        if (success) {
                            that.appendLog('背景图已更新: ' + targetName);
                            that.setStatus('背景图已更新');
                        } else {
                            that.appendLog('背景图保存失败: ' + fileName);
                            that.setStatus('背景图保存失败');
                        }
                    });
                },
                fail: function() {
                    that.appendLog('无法检查背景图大小: ' + fileName);
                    that.setStatus('背景图保存失败');
                }
            });
        });
    },

    locateReceivedFile(fileName, callback) {
        var that = this;
        var appUri = 'internal://app/' + fileName;
        var cacheUri = 'internal://cache/' + fileName;
        this.checkUriExists(appUri, function(existsInApp) {
            if (existsInApp) {
                callback(appUri);
                return;
            }
            that.checkUriExists(cacheUri, function(existsInCache) {
                callback(existsInCache ? cacheUri : '');
            });
        });
    },

    installBackground(srcUri, targetUri, callback) {
        var that = this;
        if (srcUri === targetUri) {
            this.activateBackground(targetUri, function() {
                callback(true);
            });
            return;
        }

        this.removeFileIfExists(targetUri, function() {
            try {
                file.move({
                    srcUri: srcUri,
                    dstUri: targetUri,
                    success: function() {
                        that.activateBackground(targetUri, function() {
                            callback(true);
                        });
                    },
                    fail: function() {
                        try {
                            file.copy({
                                srcUri: srcUri,
                                dstUri: targetUri,
                                success: function() {
                                    that.removeFileIfExists(srcUri, function() {
                                        that.activateBackground(targetUri, function() {
                                            callback(true);
                                        });
                                    });
                                },
                                fail: function() {
                                    callback(false);
                                }
                            });
                        } catch (e) {
                            callback(false);
                        }
                    }
                });
            } catch (e) {
                callback(false);
            }
        });
    },

    removeFileIfExists(uri, callback) {
        try {
            file.delete({
                uri: uri,
                success: function() {
                    callback();
                },
                fail: function() {
                    callback();
                }
            });
        } catch (e) {
            callback();
        }
    },

    activateBackground(newUri, callback) {
        var that = this;
        storage.get({
            key: 'bg_path',
            success: function(oldUri) {
                var applyNewPath = function() {
                    that.saveBackgroundPath(newUri);
                    callback();
                };
                if (oldUri && oldUri !== newUri) {
                    that.removeFileIfExists(oldUri, applyNewPath);
                } else {
                    applyNewPath();
                }
            },
            fail: function() {
                that.saveBackgroundPath(newUri);
                callback();
            }
        });
    },

    saveBackgroundPath(uri) {
        try {
            storage.set({
                key: 'bg_path',
                value: uri
            });
        } catch (e) {
            console.error('save bg_path error: ' + e.message);
        }
    },

    ensureFileInAppDir(fileName, callback) {
        var that = this;
        var appUri = 'internal://app/' + fileName;
        var cacheUri = 'internal://cache/' + fileName;

        this.checkUriExists(appUri, function(existsInApp) {
            if (existsInApp) {
                callback(true);
                return;
            }
            that.checkUriExists(cacheUri, function(existsInCache) {
                if (!existsInCache) {
                    callback(false);
                    return;
                }
                that.migrateFromCache(cacheUri, appUri, callback);
            });
        });
    },

    checkUriExists(uri, callback) {
        var that = this;
        try {
            file.list({
                uri: this.getDirFromUri(uri),
                success: function(data) {
                    var list = [];
                    if (data && Array.isArray(data.fileList)) {
                        list = data.fileList;
                    } else if (Array.isArray(data)) {
                        list = data;
                    }
                    var targetName = that.getBaseName(uri);
                    for (var i = 0; i < list.length; i++) {
                        var item = list[i];
                        var name = '';
                        if (typeof item === 'string') {
                            name = item;
                        } else if (item) {
                            if (item.name) {
                                name = item.name;
                            } else if (item.uri) {
                                name = that.getBaseName(item.uri);
                            }
                        }
                        if (name === targetName) {
                            callback(true);
                            return;
                        }
                    }
                    callback(false);
                },
                fail: function() {
                    callback(false);
                }
            });
        } catch (e) {
            callback(false);
        }
    },

    getDirFromUri(uri) {
        var idx = uri.lastIndexOf('/');
        if (idx === -1) {
            return uri;
        }
        return uri.substring(0, idx + 1);
    },

    migrateFromCache(srcUri, dstUri, callback) {
        var that = this;
        try {
            file.move({
                srcUri: srcUri,
                dstUri: dstUri,
                success: function() {
                    that.appendLog('文件已迁移到 internal://app');
                    callback(true);
                },
                fail: function() {
                    try {
                        file.copy({
                            srcUri: srcUri,
                            dstUri: dstUri,
                            success: function() {
                                that.appendLog('文件已复制到 internal://app');
                                callback(true);
                            },
                            fail: function() {
                                callback(false);
                            }
                        });
                    } catch (e) {
                        callback(false);
                    }
                }
            });
        } catch (e) {
            callback(false);
        }
    },

    getBaseName(path) {
        if (!path) {
            return '';
        }
        var idx = path.lastIndexOf('/');
        var idx2 = path.lastIndexOf('\\');
        var maxIdx = idx > idx2 ? idx : idx2;
        if (maxIdx === -1) {
            return path;
        }
        return path.substring(maxIdx + 1);
    },

    getExtName(fileName) {
        if (!fileName) {
            return '';
        }
        var idx = fileName.lastIndexOf('.');
        if (idx === -1) {
            return '';
        }
        return fileName.substring(idx);
    },

    resetBackground() {
        var that = this;
        storage.get({
            key: 'bg_path',
            success: function(path) {
                var finish = function() {
                    try {
                        storage.set({
                            key: 'bg_path',
                            value: ''
                        });
                    } catch (e) {
                        console.error('clear bg_path error: ' + e.message);
                    }
                    that.setStatus('已恢复默认背景');
                    that.appendLog('已恢复默认背景');
                };
                if (path) {
                    that.removeFileIfExists(path, finish);
                } else {
                    finish();
                }
            },
            fail: function() {
                that.setStatus('已恢复默认背景');
                that.appendLog('已恢复默认背景');
            }
        });
    },

    onSwipe(e) {
        if (e.direction === 'right') {
            this.goBack();
        }
    },

    goBack() {
        router.replace({ uri: 'pages/index/index' });
    }
};
