//! cortex CLI — bridge to the running Cortex terminal app.
//! Communicates via Unix socket at ~/.cortex/cortex.sock.
//!
//! Usage:
//!   cortex ask "how do I fix this?"
//!   cortex preview README.md
//!   cortex status
//!   cortex focus

use std::io::{BufRead, BufReader, Write};
use std::os::unix::net::UnixStream;
use std::path::PathBuf;

fn socket_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home).join(".cortex").join("cortex.sock")
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();

    if args.is_empty() {
        print_usage();
        std::process::exit(1);
    }

    let cmd = args[0].as_str();
    let payload = match cmd {
        "ask" => {
            let query = args.get(1).map(|s| s.as_str()).unwrap_or("");
            if query.is_empty() {
                eprintln!("error: missing query. Usage: cortex ask \"your question\"");
                std::process::exit(1);
            }
            serde_json::json!({ "cmd": "ask", "query": query })
        }
        "preview" => {
            let path = args.get(1).map(|s| s.as_str()).unwrap_or("");
            if path.is_empty() {
                eprintln!("error: missing path. Usage: cortex preview file.md");
                std::process::exit(1);
            }
            // Resolve to absolute path
            let abs = if path.starts_with('/') || path.starts_with('~') {
                path.to_string()
            } else {
                let cwd = std::env::current_dir().unwrap_or_default();
                cwd.join(path).to_string_lossy().to_string()
            };
            serde_json::json!({ "cmd": "preview", "path": abs })
        }
        "status" => serde_json::json!({ "cmd": "status" }),
        "focus" => serde_json::json!({ "cmd": "focus" }),
        "help" | "--help" | "-h" => {
            print_usage();
            std::process::exit(0);
        }
        _ => {
            eprintln!("error: unknown command '{cmd}'");
            print_usage();
            std::process::exit(1);
        }
    };

    let path = socket_path();
    let mut stream = match UnixStream::connect(&path) {
        Ok(s) => s,
        Err(_) => {
            eprintln!("error: Cortex is not running (no socket at {})", path.display());
            eprintln!("       Start Cortex first, then try again.");
            std::process::exit(1);
        }
    };

    let msg = format!("{}\n", payload);
    if let Err(e) = stream.write_all(msg.as_bytes()) {
        eprintln!("error: write failed: {e}");
        std::process::exit(1);
    }

    let mut reader = BufReader::new(stream);
    let mut response = String::new();
    if let Err(e) = reader.read_line(&mut response) {
        eprintln!("error: read failed: {e}");
        std::process::exit(1);
    }

    let response = response.trim();
    if response.contains("\"error\"") {
        eprintln!("{response}");
        std::process::exit(1);
    }

    println!("{response}");
}

fn print_usage() {
    eprintln!("cortex — CLI bridge to the Cortex terminal");
    eprintln!();
    eprintln!("USAGE:");
    eprintln!("  cortex ask \"query\"     Send a question to Cortex AI");
    eprintln!("  cortex preview FILE    Open file in markdown sidebar");
    eprintln!("  cortex status          Check if Cortex is running");
    eprintln!("  cortex focus           Bring Cortex window to front");
    eprintln!("  cortex help            Show this help");
}
