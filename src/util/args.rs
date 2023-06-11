use clap::Parser;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
pub struct Args {
    /// Measure snippets over x iterations
    #[arg(short, long, default_value_t = 100)]
    pub iterations: u32,

    /// Repeat x measurements
    #[arg(short, long, default_value_t = 1000)]
    pub samples: u32,

    /// Keep generated files
    #[arg(long)]
    pub keep: bool,

    /// Path to file
    pub file_paths: Vec<String>,
}
