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
$ jsbm -i 1000 test.js
for key | 28μs (std. 0μs o. 24%)
object values | 19μs (std. 9μs o. 2%)
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