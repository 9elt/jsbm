# JSBM

A CLI to benchmark JavaScript (and TypeScript) on the spot,
using JSDoc comments

## Usage

Insert a JSDoc comment with a `@jsbm` tag above a block,
statement or function

<sub>_example.js_</sub>

```js
const original = new Array(2048).fill(0);

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
 * @jsbm prealloc(new Array(256).fill(0)) prealloc-256
 * @jsbm prealloc(new Array(65536).fill(0)) prealloc-65536
 */
function prealloc(from) {
    const arr = new Array(from.length);
    for (let i = 0; i < from.length; i++) {
        arr[i] = i;
    }
    return arr;
}
```

```
$ jsbm example.js
>example.js bun@1.1.42 iter:1 sample:1000
map | 12.97μs ±2.89μs :7%
push | 16.61μs ±7.08μs :1%
prealloc | 4.30μs ±1.88μs :4%
prealloc-256 | 1.35μs ±0.91μs :4%
prealloc-65536 | 128.00μs ±5.21μs :16%
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
