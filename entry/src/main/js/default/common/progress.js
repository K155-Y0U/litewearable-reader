/**
 * Shared reading-progress key for a book file name.
 * Must stay identical between the reader and the bookshelf.
 */
export function progressKey(bookName) {
    var hash = 0;
    for (var i = 0; i < bookName.length; i++) {
        hash = (hash * 131 + bookName.charCodeAt(i)) % 2147483647;
    }
    return 'p_' + hash.toString(16);
}
