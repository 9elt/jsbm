use crate::parser::Snippet;

pub fn wrap(snippet: Snippet, samples: u32, iterations: u32) -> String {
    let name = snippet.name;
    let code = snippet.code;

    format!("
try {{
const _results = Array({samples});
for (let _sample = 0; _sample < {samples}; _sample++) {{
const _start = performance.now();
for (let _iteration = 0; _iteration < {iterations}; _iteration++) {{
{code}
}};
_results[_sample] = performance.now() - _start;
}}
_jsbm_log('{name}', _jsbm_snd(_results));
}} catch (error) {{
_jsbm_log('{name}', error);
}};")
}

pub fn heading(iterations: u32, samples: u32) -> String {
    format!("/*
auto generated using jsbm CLI
https://github.com/9elt/jsbm

samples: {samples}
iterations: {iterations}
*/")
}

pub const UTILS: &str = "/*
auto generated using jsbm CLI
https://github.com/9elt/jsbm

samples: 1000
iterations: 1
*/
const _jsbm_snd = (samples) => {
samples.sort((a, b) => a - b);
let fq = samples.length / 4;
let t = Math.ceil(fq * 3);
let b = Math.floor(fq);
let mqr = (samples[t] - samples[b]) * 1.5;
let arr = [];
samples.forEach((v) => {
if (v <= samples[t] + mqr && v >= samples[b] - mqr) {
arr.push(v);
};});
let mean = 0;
arr.forEach(v => { mean += v });
mean = mean / arr.length;
let std = 0;
arr.forEach(v => { std += (v - mean) ** 2 });
return {
mean: Math.round(mean * 1000),
std: Math.round(Math.sqrt(std / arr.length) * 1000),
outliers: Math.round(100 - (arr.length * 100 / samples.length)),
};};
const _jsbm_ansi = (text, color) => {
switch(color) {
case 'red': return `\\x1b[38;5;204;1m${text}\\x1b[0m`;
case 'blue': return `\\x1b[38;5;39;1m${text}\\x1b[0m`;
default: return `\\x1b[1m${text}\\x1b[0m`;
}}
const _jsbm_unit = (micros) => {
if (micros < 1_000) {
return micros.toFixed(0) + 'μs';
} else if (micros < 1_000_000) {
return (micros/1_000).toFixed(2) + 'ms';
} else {
return (micros/1_000_000).toFixed(2) + 's';
}};
const _jsbm_fmt_res = (res) => {
return _jsbm_ansi(_jsbm_unit(res.mean)) +
` (std. ${_jsbm_unit(res.std)} o. ${res.outliers}%)`
}
const _jsbm_log = (name, res) => {
if ('std' in res) {
console.log(_jsbm_ansi(name, 'blue') + ' | ' + _jsbm_fmt_res(res))
} else {
console.log(_jsbm_ansi(name, 'red') + ' |\\n', res)
}};
";
