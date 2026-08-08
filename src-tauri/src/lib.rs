use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, RunEvent,
};

/// State: the running Python renderer process, if any.
struct RendererProcess(Mutex<Option<Child>>);

#[tauri::command]
fn get_renderer_status(state: tauri::State<RendererProcess>) -> String {
    let guard = state.0.lock().unwrap();
    match &*guard {
        Some(_) => "running".to_string(),
        None => "stopped".to_string(),
    }
}

fn start_renderer(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<RendererProcess>();
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;

    if guard.is_some() {
        return Err("渲染器已在运行中".to_string());
    }

    // Get the renderer directory relative to the executable
    let renderer_dir = std::env::current_dir()
        .unwrap_or_default()
        .join("renderer");

    let child = Command::new("python")
        .arg("server.py")
        .current_dir(&renderer_dir)
        .spawn()
        .map_err(|e| format!("无法启动渲染器: {}", e))?;

    *guard = Some(child);
    Ok(())
}

fn stop_renderer(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<RendererProcess>();
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;

    if let Some(mut child) = guard.take() {
        child.kill().map_err(|e| format!("无法停止渲染器: {}", e))?;
        child.wait().ok();
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .manage(RendererProcess(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![get_renderer_status])
        .setup(|app| {
            // Build tray menu
            let start_item = MenuItemBuilder::with_id("start", "启动渲染器").build(app)?;
            let stop_item = MenuItemBuilder::with_id("stop", "停止渲染器").build(app)?;
            let status_item = MenuItemBuilder::with_id("status", "状态: 已停止").build(app)?;
            let separator = MenuItemBuilder::separator().build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "退出").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&status_item)
                .item(&start_item)
                .item(&stop_item)
                .item(&separator)
                .item(&quit_item)
                .build()?;

            // Build tray icon
            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Mathiverse Renderer")
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "start" => {
                            match start_renderer(app) {
                                Ok(()) => {
                                    let _ = app
                                        .tray_by_id("main-tray")
                                        .unwrap()
                                        .set_tooltip(Some("Mathiverse Renderer — 运行中"));
                                }
                                Err(e) => {
                                    eprintln!("Failed to start: {}", e);
                                }
                            }
                        }
                        "stop" => {
                            match stop_renderer(app) {
                                Ok(()) => {
                                    let _ = app
                                        .tray_by_id("main-tray")
                                        .unwrap()
                                        .set_tooltip(Some("Mathiverse Renderer — 已停止"));
                                }
                                Err(e) => {
                                    eprintln!("Failed to stop: {}", e);
                                }
                            }
                        }
                        "quit" => {
                            let _ = stop_renderer(app);
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        // Toggle renderer on left click
                        let app = tray.app_handle();
                        let state = app.state::<RendererProcess>();
                        let guard = state.0.lock().unwrap();
                        if guard.is_some() {
                            drop(guard);
                            let _ = stop_renderer(app);
                        } else {
                            drop(guard);
                            let _ = start_renderer(app);
                        }
                    }
                })
                .build(app)?;

            // Auto-start renderer
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(2));
                let _ = start_renderer(&app_handle);
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            if let RunEvent::ExitRequested { .. } = event {
                // Stop renderer on exit
                let _ = stop_renderer(_app);
            }
        });
}
