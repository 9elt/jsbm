# JSBM

A CLI to benchmark JavaScript (and TypeScript) on the spot,
using JSDoc comments

## Usage

Insert a JSDoc comment with a `@jsbm` tag above a block,
statement or function

<sub>_example.js_</sub>

```js
const original = new Array(2056).fill(0);

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
    const arr = [];
    for (let i = 0; i < original.length; i++) {
        arr.push(i);
    }
    return arr;
}

/**
 * Pass parameters to the function
 * @jsbm prealloc(original)
 */
function prealloc(renamedArray) {
    const arr = new Array(renamedArray.length);
    for (let i = 0; i < renamedArray.length; i++) {
        arr[i] = i;
    }
    return arr;
}
```

```
$ jsbm example.js
>example.js bun@1.1.42 iter:1000 samples:1000
map | 3.67ms ±426μs :0%
push | 7.90ms ±264μs :14%
prealloc | 3.03ms ±467μs :1%
```

## Installation

```
npm install -g @9elt/jsbm
```

## CLI Usage

```
jsbm [runtime...] file... [options]
runtimes:
    bun, deno, node
options:
    --version, -V    print version
    --help, -h       print help
    --keep           keep generated file(s)
    --code           print measured code
    --md             print results as markdown
    --sample         number of samples (default: 1000)
    --iter           measure the code over a number of iterations (default: 1)
```
