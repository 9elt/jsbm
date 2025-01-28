const original = new Array<number>(2048).fill(0);

/**
 * Place the tag before a block or statement
 * @jsbm map
 */
{
    const arr = original.map((_, i) => i);
}

/**
 * Place the tag before a function declaration
 * @jsbm push
 */
function push() {
    const arr: number[] = [];
    for (let i = 0; i < original.length; i++) {
        arr.push(i);
    }
    return arr;
}

/**
 * Pass parameters to the function
 * @jsbm prealloc(original)
 * @jsbm prealloc(new Array(256).fill(0)) prealloc-256
 * @jsbm prealloc(new Array(65536).fill(0)) prealloc-65536
 */
function prealloc(from: number[]) {
    const arr = new Array<number>(from.length);
    for (let i = 0; i < from.length; i++) {
        arr[i] = i;
    }
    return arr;
}
