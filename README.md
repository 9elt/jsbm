# jsbm

A CLI tool to benchmark javascript files

## example

*main.js*

```javascript
let obj = {
    foo: "bar"
}

// @jsbm { for key }
let values = []

for (const key in obj) {
    values.push(obj[key])
}

// @jsbm { object values }
let values = Object.values(obj)
```

usage

```
$ jsbm main.js

for key | 6μs (std. 0μs o. 8%)
object values | 4μs (std. 1μs o. 5%)
```

## CLI usage
```
jsbm [options] [paths]...
```

options:

`-i, --iterations` Measure snippets over *x* iterations *(defaults to 100)*

`-s, --samples` Repeat *x* measurements *(defaults to 1000)*

`--keep` Keep the benchmark file

## installation

```
cargo install --git https://github.com/9elt/jsbm
```

see: 
[**installing binaries with cargo install**](https://doc.rust-lang.org/book/ch14-04-installing-binaries.html), [**install rust and cargo**](https://doc.rust-lang.org/cargo/getting-started/installation.html)