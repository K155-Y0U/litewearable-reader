// Lite Wearable image .bin validation.
// Format produced by ace-loader/lite-image2bin.js:
//   uint32 LE magic = 256
//   uint32 LE dimensions = width | (height << 16)
//   BGRA pixels, 4 bytes per pixel
// Total size = 8 + width * height * 4.

import file from '@system.file';

var LITE_BIN_MAGIC = 256;
var MAX_BG_SIDE = 512;

function validateLiteBin(uri, callback) {
    file.get({
        uri: uri,
        success: function(info) {
            var fileLength = info && info.length ? parseInt(info.length) : 0;
            file.readArrayBuffer({
                uri: uri,
                position: 0,
                length: 8,
                success: function(data) {
                    var buffer = data && data.buffer ? data.buffer : null;
                    if (!buffer) {
                        callback(false);
                        return;
                    }
                    if (typeof buffer.length !== 'number') {
                        buffer = new Uint8Array(buffer);
                    }
                    if (buffer.length < 8) {
                        callback(false);
                        return;
                    }
                    var magic = (buffer[0] |
                        (buffer[1] << 8) |
                        (buffer[2] << 16) |
                        (buffer[3] << 24)) >>> 0;
                    var dimensions = (buffer[4] |
                        (buffer[5] << 8) |
                        (buffer[6] << 16) |
                        (buffer[7] << 24)) >>> 0;
                    var width = dimensions & 0xFFFF;
                    var height = (dimensions >>> 16) & 0xFFFF;
                    var expectedLength = 8 + width * height * 4;

                    if (magic !== LITE_BIN_MAGIC ||
                        width <= 0 || height <= 0 ||
                        width > MAX_BG_SIDE || height > MAX_BG_SIDE ||
                        fileLength !== expectedLength) {
                        callback(false);
                        return;
                    }
                    callback(true);
                },
                fail: function() {
                    callback(false);
                }
            });
        },
        fail: function() {
            callback(false);
        }
    });
}

export { validateLiteBin, MAX_BG_SIDE };
