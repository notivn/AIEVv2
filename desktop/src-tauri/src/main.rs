// AIEV Desktop — vỏ Tauri mỏng gói nguyên hệ thống AIEVv2.
//
// Vai trò (và CHỈ vậy — UI/backend/engines là của repo, không đổi gì):
//   1. Tìm repo (AIEV_ROOT → đi lên từ exe → "../../" cho dev).
//   2. Bootstrap: doctor --fix --yes → npm install nếu thiếu → build nếu stale
//      (build-stamp) → tạo .env. Tái dùng y các script của start/ để không lệch
//      với start.bat.
//   3. Quản lý port 6868/6869 như start.ps1: probe 127.0.0.1, so stamp
//      .aiev/run.json, kill listener sai bản (bắt cả case "npm run dev" chiếm cổng).
//   4. Spawn 2 process con: server (dist/index.js) + web (next start :6868).
//   5. Drain stdout/stderr liên tục → .aiev/logs/*.log — KHÔNG drain là process
//      Node con chết EPIPE (bug thật đã gặp ở bản sidecar trước).
//   6. Health-gate GET 127.0.0.1:6868/api/health rồi mới điều hướng webview tới
//      http://localhost:6868. Auth của AIEVv2 dựa trên loopback origin nên webview
//      PHẢI navigate tới URL thật — serve UI từ tauri:// sẽ gãy CORS/cookie.
//   7. Watchdog: process con chết → probe health (update flow từ web UI có thể
//      vừa dựng lại stack) → không thì tự restart 1 lần → chết nữa thì trang lỗi.
//   8. Đóng cửa sổ = ẩn vào tray (render chạy tiếp); Thoát trên tray = tree-kill.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, RunEvent, WindowEvent};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const WEB_PORT: u16 = 6868;
const API_PORT: u16 = 6869;
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

struct AppState {
    /// URL trang loading (tauri://localhost/index.html hay http://tauri.localhost/...)
    /// — bắt lại LÚC SETUP, trước khi webview đi đâu cả; quay lại đây khi lỗi/restart.
    loading_url: Mutex<String>,
    root: Mutex<Option<PathBuf>>,
    /// Process con [server, web] của MÌNH (trống nếu đang nhận lại stack bên ngoài).
    stack: Mutex<Vec<Child>>,
    /// Watchdog chỉ được tự restart MỘT lần — chết lần nữa thì báo lỗi, tránh
    /// vòng lặp crash vô hạn.
    restart_used: AtomicBool,
    /// Đang thoát app — watchdog/exit bỏ qua mọi thứ còn lại.
    stopping: AtomicBool,
}

// ---------------------------------------------------------------- helpers ---

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Command với CREATE_NO_WINDOW trên Windows — app không console, spawn process
/// console mà không cờ này thì nháy một cửa sổ cmd đen mỗi lần gọi.
fn new_command(program: &str) -> Command {
    let mut c = Command::new(program);
    #[cfg(windows)]
    c.creation_flags(CREATE_NO_WINDOW);
    c
}

fn node_prog() -> &'static str {
    if cfg!(windows) { "node.exe" } else { "node" }
}
fn npm_prog() -> &'static str {
    if cfg!(windows) { "npm.cmd" } else { "npm" }
}

fn find_repo_root() -> Option<PathBuf> {
    let valid = |p: &Path| {
        p.join("apps/server").is_dir() && p.join("apps/web").is_dir() && p.join("CLAUDE.md").is_file()
    };
    // Bản đóng gói: AIEV_ROOT trỏ tới thư mục repo (xem desktop/README.md).
    if let Ok(root) = std::env::var("AIEV_ROOT") {
        let p = PathBuf::from(root);
        if valid(&p) {
            return Some(p);
        }
    }
    // Đi lên từ exe: đặt exe trong repo hoặc cạnh repo đều tìm thấy.
    if let Ok(exe) = std::env::current_exe() {
        let mut dir = exe.parent().map(|p| p.to_path_buf());
        while let Some(d) = dir {
            if valid(&d) {
                return Some(d);
            }
            dir = d.parent().map(|p| p.to_path_buf());
        }
    }
    // dev: cargo chạy từ desktop/src-tauri → repo 2 cấp trên
    let dev = PathBuf::from("../../");
    if valid(&dev) {
        return Some(dev.canonicalize().unwrap_or(dev));
    }
    None
}

fn node_major() -> Option<u32> {
    let out = new_command(node_prog()).arg("--version").output().ok()?;
    let s = String::from_utf8_lossy(&out.stdout);
    s.trim().trim_start_matches('v').split('.').next()?.parse().ok()
}

/// Ghi thêm 1 dòng vào file log (append, tạo thư mục nếu thiếu).
fn append_log(log: &Path, line: &str) {
    if let Some(parent) = log.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(log) {
        let _ = writeln!(f, "{}", line.trim_end());
    }
}

/// Chạy 1 bước bootstrap, hút stdout+stderr vào file log (append).
/// Return true nếu exit code = 0.
fn run_logged(program: &str, args: &[&str], cwd: &Path, log: &Path, label: &str) -> bool {
    append_log(log, &format!("--- {} {} ---", label, now_secs()));
    let mut cmd = new_command(program);
    cmd.args(args)
        .current_dir(cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            append_log(log, &format!("[shell] không spawn được {program}: {e}"));
            return false;
        }
    };
    let mut drains = Vec::new();
    if let Some(so) = child.stdout.take() {
        let path = log.to_path_buf();
        drains.push(thread::spawn(move || drain_to_log(so, path)));
    }
    if let Some(se) = child.stderr.take() {
        let path = log.to_path_buf();
        drains.push(thread::spawn(move || drain_to_log(se, path)));
    }
    let ok = child.wait().map(|s| s.success()).unwrap_or(false);
    for h in drains {
        let _ = h.join();
    }
    ok
}

fn drain_to_log<R: Read + Send + 'static>(stream: R, log: PathBuf) {
    if let Some(parent) = log.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(&log) else {
        return; // bỏ nội dung, chỉ giữ pipe sống — không hút là Node chết EPIPE
    };
    let mut reader = BufReader::new(stream);
    let mut line = String::new();
    loop {
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) | Err(_) => break,
            Ok(_) => {
                let _ = file.write_all(line.as_bytes());
            }
        }
    }
}

/// Chạy lệnh ngắn, bắt stdout (drain sẵn qua .output()). None = lỗi hoặc exit != 0.
fn run_capture(program: &str, args: &[&str], cwd: &Path) -> Option<String> {
    let out = new_command(program)
        .args(args)
        .current_dir(cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

/// GET HTTP/1.0 thô không cần thư viện — đủ cho healthcheck loopback.
fn http_probe(port: u16, path: &str, timeout: Duration) -> bool {
    let addr = match ("127.0.0.1", port).to_socket_addrs() {
        Ok(mut it) => match it.next() {
            Some(a) => a,
            None => return false,
        },
        Err(_) => return false,
    };
    let Ok(mut stream) = TcpStream::connect_timeout(&addr, timeout) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(timeout));
    let req = format!("GET {path} HTTP/1.0\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n");
    if stream.write_all(req.as_bytes()).is_err() {
        return false;
    }
    let mut buf = [0u8; 512];
    let mut got = 0usize;
    for _ in 0..3 {
        match stream.read(&mut buf[got..]) {
            Ok(0) | Err(_) => break,
            Ok(n) => {
                got += n;
                if got >= buf.len() {
                    break;
                }
            }
        }
    }
    let head = String::from_utf8_lossy(&buf[..got]);
    head.starts_with("HTTP/") && (head.contains(" 200 ") || head.contains(" 204 "))
}

/// PID các process đang LISTEN trên port (parse netstat -ano).
fn listening_pids(port: u16) -> Vec<u32> {
    let out = match new_command("netstat").args(["-ano", "-p", "tcp"]).output() {
        Ok(o) => o,
        Err(_) => return vec![],
    };
    let text = String::from_utf8_lossy(&out.stdout);
    let suffix = format!(":{port}");
    let mut pids = Vec::new();
    for line in text.lines() {
        let cols: Vec<&str> = line.split_whitespace().collect();
        if cols.len() >= 5 && cols[3].eq_ignore_ascii_case("LISTENING") && cols[1].ends_with(&suffix) {
            if let Ok(pid) = cols[cols.len() - 1].parse::<u32>() {
                if !pids.contains(&pid) {
                    pids.push(pid);
                }
            }
        }
    }
    pids
}

/// Tree-kill (diệt kèm ffmpeg/Remotion/Chrome do Node con spawn ra).
fn kill_pid_tree(pid: u32) {
    #[cfg(windows)]
    {
        let _ = new_command("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .output();
    }
    #[cfg(not(windows))]
    {
        let _ = new_command("kill").args(["-9", &pid.to_string()]).output();
    }
}

/// doctor cài ffmpeg/chrome qua winget ghi PATH vào registry chứ không vào
/// process đang chạy (đúng cảnh báo của start.ps1) — nạp lại cho process con.
fn refresh_path_from_registry() {
    if !cfg!(windows) {
        return;
    }
    let ps = "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')";
    if let Ok(out) = new_command("powershell.exe")
        .args(["-NoProfile", "-Command", ps])
        .output()
    {
        let p = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if !p.is_empty() {
            std::env::set_var("PATH", p);
        }
    }
}

fn url_encode(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

fn js_str(s: &str) -> String {
    let mut out = String::from("\"");
    for c in s.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

fn run_stamp_of(root: &Path) -> Option<String> {
    let s = std::fs::read_to_string(root.join(".aiev").join("run.json")).ok()?;
    let key = "\"stamp\":\"";
    let i = s.find(key)? + key.len();
    let rest = &s[i..];
    let j = rest.find('"')?;
    Some(rest[..j].to_string())
}

// ------------------------------------------------------- webview messaging ---

fn eval_js(app: &AppHandle, js: &str) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.eval(js);
    }
}

fn status(app: &AppHandle, text: &str) {
    eval_js(
        app,
        &format!("window.__aievStatus&&window.__aievStatus({})", js_str(text)),
    );
}

fn navigate_loading(app: &AppHandle) {
    let url = app.state::<AppState>().loading_url.lock().unwrap().clone();
    eval_js(app, &format!("location.replace('{}')", url));
}

/// Navigate về trang loading kèm ?err=... — index.html tự hiện hộp lỗi.
fn show_error(app: &AppHandle, msg: &str) {
    let url = app.state::<AppState>().loading_url.lock().unwrap().clone();
    eval_js(
        app,
        &format!(
            "location.replace('{}?err={}')",
            url,
            url_encode(msg)
        ),
    );
}

fn navigate_to_app(app: &AppHandle) {
    // localhost (không phải 127.0.0.1) — WEB_ORIGINS của server chấp nhận cả
    // hai, dùng localhost cho khớp link trong dashboard.
    eval_js(app, "location.replace('http://localhost:6868')");
}

// ------------------------------------------------------------------ stack ---

fn stop_stack(app: &AppHandle) {
    let state = app.state::<AppState>();
    let mut stack = state.stack.lock().unwrap();
    for child in stack.iter_mut() {
        kill_pid_tree(child.id());
        let _ = child.wait(); // reap
    }
    stack.clear();
}

fn shutdown_all(app: &AppHandle) {
    let state = app.state::<AppState>();
    if state.stopping.swap(true, Ordering::SeqCst) {
        return; // idempotent
    }
    stop_stack(app);
    let root = { state.root.lock().unwrap().clone() };
    if let Some(root) = root {
        let _ = std::fs::remove_file(root.join(".aiev").join("run.json"));
    }
}

/// Spawn server + web, hút output vào .aiev/logs/. Return true nếu spawn OK.
fn spawn_stack(app: &AppHandle, root: &Path) -> bool {
    let logs = root.join(".aiev").join("logs");
    let state = app.state::<AppState>();
    let mut stack = state.stack.lock().unwrap();
    stack.clear();

    // Server: "npm run start -w apps/server" = node dist/index.js với cwd apps/server
    let server = new_command(node_prog())
        .arg("dist/index.js")
        .current_dir(root.join("apps/server"))
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn();
    let mut server = match server {
        Ok(c) => c,
        Err(e) => {
            append_log(&logs.join("server.log"), &format!("[shell] spawn server lỗi: {e}"));
            return false;
        }
    };
    let so = server.stdout.take();
    let se = server.stderr.take();
    let slog = logs.join("server.log");
    if let Some(s) = so {
        let p = slog.clone();
        thread::spawn(move || drain_to_log(s, p));
    }
    if let Some(s) = se {
        let p = slog;
        thread::spawn(move || drain_to_log(s, p));
    }

    // Web: next start -p 6868 -H 0.0.0.0 với cwd apps/web. npm workspaces HOIST
    // next lên node_modules gốc — apps/web/node_modules/next thường KHÔNG tồn tại
    // (MODULE_NOT_FOUND thật) → resolve root trước, local sau.
    let next_bin = if root.join("node_modules/next/dist/bin/next").is_file() {
        root.join("node_modules/next/dist/bin/next")
    } else {
        root.join("apps/web/node_modules/next/dist/bin/next")
    };
    let web = new_command(node_prog())
        .arg(&next_bin)
        .args(["start", "-p", "6868", "-H", "0.0.0.0"])
        .current_dir(root.join("apps/web"))
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn();
    let mut web = match web {
        Ok(c) => c,
        Err(e) => {
            append_log(&logs.join("web.log"), &format!("[shell] spawn web lỗi: {e}"));
            kill_pid_tree(server.id());
            let _ = server.wait();
            return false;
        }
    };
    let so = web.stdout.take();
    let se = web.stderr.take();
    let wlog = logs.join("web.log");
    if let Some(s) = so {
        let p = wlog.clone();
        thread::spawn(move || drain_to_log(s, p));
    }
    if let Some(s) = se {
        let p = wlog;
        thread::spawn(move || drain_to_log(s, p));
    }

    stack.push(server);
    stack.push(web);
    true
}

fn health_gate(app: &AppHandle, max_secs: u64) -> bool {
    for i in 0..max_secs {
        if app.state::<AppState>().stopping.load(Ordering::SeqCst) {
            return false;
        }
        if i > 0 && i % 10 == 0 {
            status(app, &format!("Đang đợi hệ thống sẵn sàng… ({i}s)"));
        }
        if http_probe(WEB_PORT, "/api/health", Duration::from_secs(2)) {
            return true;
        }
        thread::sleep(Duration::from_secs(1));
    }
    false
}

// -------------------------------------------------------------- bootstrap ---

fn ensure_deps(root: &Path, app: &AppHandle) -> bool {
    // Kiểm tra package.json của GÓI THẬT như start.ps1 — node_modules dở dang
    // vẫn còn .bin shims mà mất gói (đã gặp thật).
    let tools = ["typescript", "next", "tsx", "@remotion/cli", "concurrently"];
    let missing = tools
        .iter()
        .any(|t| !root.join("node_modules").join(t).join("package.json").is_file());
    if !missing {
        return true;
    }
    status(app, "Đang cài dependencies (vài phút)…");
    run_logged(
        npm_prog(),
        &["install", "--include=dev", "--no-audit", "--no-fund"],
        root,
        &root.join(".aiev/logs/npm-install.log"),
        "npm install",
    )
}

fn build_if_stale(root: &Path, app: &AppHandle) -> bool {
    status(app, "Đang kiểm tra bản dựng…");
    let stamp_log = root.join(".aiev/logs/bootstrap.log");
    let fresh = run_capture(node_prog(), &["start/build-stamp.mjs", "--check"], root).is_some();
    let have_server = root.join("apps/server/dist").is_dir();
    let have_web = root.join("apps/web/.next").is_dir();
    if fresh && have_server && have_web {
        return true;
    }
    if !have_server || !fresh {
        status(app, "Đang build backend…");
        if !run_logged(
            npm_prog(),
            &["run", "build", "-w", "apps/server"],
            root,
            &stamp_log,
            "build server",
        ) {
            show_error(app, "Build backend thất bại — xem .aiev/logs/bootstrap.log");
            return false;
        }
    }
    if !have_web || !fresh {
        status(app, "Đang build web UI (vài phút, chỉ khi mã nguồn vừa đổi)…");
        if !run_logged(
            npm_prog(),
            &["run", "build", "-w", "apps/web"],
            root,
            &stamp_log,
            "build web",
        ) {
            show_error(app, "Build web thất bại — xem .aiev/logs/bootstrap.log");
            return false;
        }
    }
    // Ghi stamp SAU khi build xong — build hỏng giữa chừng thì lần sau vẫn build lại.
    let _ = run_capture(node_prog(), &["start/build-stamp.mjs", "--save"], root);
    true
}

/// Toàn bộ chuỗi khởi động. first_boot = lần đầu app mở (đi kèm thông điệp mềm hơn).
fn full_start(app: AppHandle, first_boot: bool) {
    let state = app.state::<AppState>();
    state.restart_used.store(false, Ordering::SeqCst);
    state.stopping.store(false, Ordering::SeqCst);
    navigate_loading(&app);

    let root = match find_repo_root() {
        Some(r) => r,
        None => {
            show_error(&app, "Không tìm thấy repo AIEVv2 (thiếu apps/server + apps/web + CLAUDE.md).\nĐặt biến môi trường AIEV_ROOT trỏ tới thư mục repo rồi mở lại app.\nXem desktop/README.md.");
            return;
        }
    };
    *state.root.lock().unwrap() = Some(root.clone());
    let logs = root.join(".aiev").join("logs");
    let boot_log = logs.join("bootstrap.log");

    status(&app, "Đang kiểm tra Node.js…");
    if node_major().map(|m| m < 22).unwrap_or(true) {
        show_error(&app, "Chưa cài Node.js 22 trở lên (tải tại nodejs.org) rồi mở lại app.");
        return;
    }

    // Dừng stack cũ của mình (restart từ tray) trước khi kiểm tra môi trường.
    stop_stack(&app);

    // 1. Doctor — dùng chung start/doctor.mjs, --yes để không hỏi (process nền
    //    không ai trả lời được). Lần sau chạy nhanh vì mọi thứ đã cài.
    status(
        &app,
        if first_boot {
            "Lần đầu chạy — đang kiểm tra & cài môi trường (FFmpeg/Chrome, có thể mất vài phút)…"
        } else {
            "Đang kiểm tra môi trường (doctor)…"
        },
    );
    run_logged(
        node_prog(),
        &["start/doctor.mjs", "--fix", "--yes"],
        &root,
        &boot_log,
        "doctor",
    );
    refresh_path_from_registry();

    // 2. Dependencies + build
    if !ensure_deps(&root, &app) {
        show_error(&app, "npm install thất bại — xem .aiev/logs/npm-install.log");
        return;
    }
    if !build_if_stale(&root, &app) {
        return; // show_error đã gọi bên trong
    }

    // 3. Tạo .env nếu chưa có
    if !root.join(".env").is_file() {
        let _ = std::fs::copy(root.join(".env.example"), root.join(".env"));
    }

    // 4. Port: đang chạy sẵn & đúng bản → nhận lại; sai bản / dev server chiếm cổng → dừng.
    status(&app, "Đang kiểm tra cổng 6868/6869…");
    let web_up = http_probe(WEB_PORT, "/", Duration::from_secs(2));
    let api_up = http_probe(API_PORT, "/api/health", Duration::from_secs(3));
    let stamp = run_capture(node_prog(), &["start/build-stamp.mjs", "--print"], &root)
        .unwrap_or_default();
    let mut reuse = false;
    if web_up || api_up {
        if web_up && api_up && !stamp.is_empty() && run_stamp_of(&root).as_deref() == Some(&stamp) {
            reuse = true; // hệ thống đang chạy sẵn đúng bản mới nhất
        } else {
            status(&app, "Cổng 6868/6869 bị chiếm — đang dừng tiến trình cũ…");
            for port in [WEB_PORT, API_PORT] {
                for pid in listening_pids(port) {
                    kill_pid_tree(pid);
                }
            }
            let _ = std::fs::remove_file(root.join(".aiev").join("run.json"));
            thread::sleep(Duration::from_secs(1));
        }
    }

    if reuse {
        append_log(&boot_log, "[shell] nhận lại stack đang chạy (đúng bản)");
        navigate_to_app(&app);
        return; // không watchdog — stack không phải con của mình
    }

    // 5. Spawn + health gate + ghi run.json (để start.bat lần sau nhận ra bản đang chạy)
    status(&app, "Đang khởi động server (6869) + web (6868)…");
    if !spawn_stack(&app, &root) {
        show_error(&app, "Không spawn được Node — đảm bảo Node.js đã cài trong PATH.");
        return;
    }
    if !health_gate(&app, 120) {
        show_error(&app, "Hệ thống không lên sau 120s — xem .aiev/logs/server.log và web.log.\nCửa sổ cmd của start.bat đang mở cũng có thể là nguyên nhân.");
        stop_stack(&app);
        return;
    }
    let _ = std::fs::create_dir_all(root.join(".aiev"));
    let _ = std::fs::write(
        root.join(".aiev").join("run.json"),
        format!("{{\"stamp\":\"{stamp}\",\"at\":{}}}", now_secs()),
    );
    navigate_to_app(&app);
    start_watchdog(app.clone());
}

// --------------------------------------------------------------- watchdog ---

fn start_watchdog(app: AppHandle) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(3));
        let state = app.state::<AppState>();
        if state.stopping.load(Ordering::SeqCst) {
            break;
        }
        let mut died = false;
        {
            let mut stack = state.stack.lock().unwrap();
            if stack.is_empty() {
                break;
            }
            for child in stack.iter_mut() {
                match child.try_wait() {
                    Ok(Some(_)) | Err(_) => died = true,
                    Ok(None) => {}
                }
            }
        }
        if died {
            handle_stack_death(app.clone());
            break;
        }
    });
}

fn handle_stack_death(app: AppHandle) {
    let state = app.state::<AppState>();
    if state.stopping.load(Ordering::SeqCst) {
        return;
    }
    status(&app, "Hệ thống vừa dừng — đang kiểm tra…");
    thread::sleep(Duration::from_secs(2));

    // Update flow (web UI) kill/restart stack theo thiết kế: nếu nó đã dựng lại
    // stack (health OK) thì mình chỉ nhận lại, KHÔNG spawn nữa (tránh double).
    if http_probe(WEB_PORT, "/api/health", Duration::from_secs(3)) {
        state.stack.lock().unwrap().clear();
        status(&app, "Đã nhận lại hệ thống sau cập nhật.");
        navigate_to_app(&app);
        return;
    }

    // Tự restart đúng MỘT lần.
    if !state.restart_used.swap(true, Ordering::SeqCst) {
        status(&app, "Đang khởi động lại hệ thống…");
        stop_stack(&app);
        let root = state.root.lock().unwrap().clone();
        if let Some(root) = root {
            if build_if_stale(&root, &app) && spawn_stack(&app, &root) {
                if health_gate(&app, 60) {
                    navigate_to_app(&app);
                    start_watchdog(app.clone());
                    return;
                }
            }
        }
        stop_stack(&app);
    }
    show_error(
        &app,
        "Hệ thống đã dừng đột ngột. Xem .aiev\\logs\\server.log và web.log trong thư mục repo.\nDùng biểu tượng khay hệ thống → “Khởi động lại” để chạy lại.",
    );
}

// ------------------------------------------------------------------- tray ---

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Mở AIEV", true, None::<&str>)?;
    let restart = MenuItem::with_id(app, "restart", "Khởi động lại", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Thoát (tắt hẳn)", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &restart, &quit])?;

    TrayIconBuilder::with_id("aiev-tray")
        .icon(app.default_window_icon().expect("có icon").clone())
        .tooltip("AIEV Desktop")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "restart" => {
                let a = app.clone();
                thread::spawn(move || full_start(a, false));
            }
            "quit" => {
                shutdown_all(app);
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Some(w) = tray.app_handle().get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
        })
        .build(app)?;
    Ok(())
}

// -------------------------------------------------------------------- main ---

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            let win = app
                .get_webview_window("main")
                .expect("cửa sổ main từ config");
            let loading_url = win
                .url()
                .map(|u| u.to_string())
                .unwrap_or_else(|_| "http://tauri.localhost/index.html".to_string());

            app.manage(AppState {
                loading_url: Mutex::new(loading_url),
                root: Mutex::new(None),
                stack: Mutex::new(Vec::new()),
                restart_used: AtomicBool::new(false),
                stopping: AtomicBool::new(false),
            });
            build_tray(&handle)?;

            // Bootstrap nền — cửa sổ hiện loading page ngay lập tức.
            thread::spawn(move || full_start(handle.clone(), true));
            Ok(())
        })
        .on_window_event(|window, event| match event {
            // Đóng cửa sổ = ẩn vào tray: render/agent chạy tiếp nền.
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = window.hide();
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("lỗi build tauri")
        .run(|app, event| match event {
            RunEvent::ExitRequested { .. } | RunEvent::Exit => shutdown_all(app),
            _ => {}
        });
}
