# jsbm

A CLI tool to benchmark javascript files

## example

*main.js*

```javascript
let arr_1 = new Array(256);
let arr_2 = new Array(256);

// @jsbm { concat }
arr_1.concat(arr_2);

// @jsbm { spread }
[...arr_1, ...arr_2];
```

usage

```
$ jsbm -i 1000 main.js
concat | 485μs (std. 6μs o. 39%)
spread | 1.42ms (std. 12μs o. 10%)
```

## CLI usage
```
jsbm [options] [paths]...
```

options:

`-i, --iterations` Measure snippets over *x* iterations *(defaults to 1)*

`-s, --samples` Repeat *x* measurements *(defaults to 1000)*

`--keep` Keep generated files

## installation

```
cargo install --git https://github.com/9elt/jsbm
```

see: 
[**installing binaries with cargo install**](https://doc.rust-lang.org/book/ch14-04-installing-binaries.html), [**install rust and cargo**](https://doc.rust-lang.org/cargo/getting-started/installation.html)
