# jsbm

A CLI tool to benchmark javascript

## example

inside *main.js*

```javascript
let obj = {
    foo: "bar"
}

// @jsbm {for key}
let values = []

for (const key in obj) {
    v1.push(obj[key])
}

// @jsbm {object values}
let values = Object.values(obj)
```

usage

```
$ jsbm main.js

for key | 6μs (std. 0μs o. 8%)
object values | 4μs (std. 1μs o. 5%)

```

## CLI usage
`jsbm [options] [paths]...`

options:

`-i, --iterations` Number of times snippets are measured on *(defaults to 100)*

`-s, --samples` Number of times measurement is repeated *(defaults to 1000)*

`--keep` Keep the generated benchmark file
