mod parser;
mod util;

use async_process::{Command, Stdio};
use clap::Parser;
use futures_lite::{future, io::BufReader, prelude::*};
use parser::Item;
use std::fs;
use util::args::Args;
use util::wrapper::{wrap, UTILS};

fn main() {
    let args = Args::parse();
    future::block_on(async {
        for path in args.paths.iter() {
            benchmark(path, &args).await;
        }
    });
}

async fn benchmark(path: &String, args: &Args) {
    let file = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(_) => return error("failed reading", path),
    };

    let mut b = UTILS.to_string();

    for item in parser::parse(&file).unwrap() {
        match item {
            Item::Content(v) => b = format!("{b}{v}"),
            Item::Snippet(v) => b = format!("{b}{}", wrap(v, args.samples, args.iterations)),
        }
    }

    let output_path = get_output_path(path);

    if fs::write(&output_path, b).is_err() {
        return error("failed writing", &output_path);
    }

    let mut node = match Command::new("node")
        .arg("--trace-uncaught")
        .arg(&output_path)
        .stdout(Stdio::piped())
        .spawn()
    {
        Ok(node) => node,
        Err(_) => {
            return {
                remove_file(&output_path, !args.keep);
                error("node failed", &output_path);
            }
        }
    };

    let mut output = BufReader::new(node.stdout.take().unwrap()).lines();

    while let Some(line) = output.next().await {
        println!("{}", line.unwrap_or("".to_string()));
    }

    remove_file(&output_path, !args.keep);
}

fn remove_file(path: &String, when: bool) {
    if when {
        if fs::remove_file(&path).is_err() {
            return error("failed removing", path);
        };
    }
}

fn get_output_path(path: &String) -> String {
    let mut parts = path.split(".").collect::<Vec<_>>();
    let ext = parts.pop().unwrap_or("");

    parts.push("jsbm");
    parts.push(ext);

    parts.join(".")
}

fn error(text: &str, path: &String) {
    println!("\x1b[38;5;204;1mError\x1b[0m: {} at {}", text, path)
}
