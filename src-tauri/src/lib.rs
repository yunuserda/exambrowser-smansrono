use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri::{Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // Register shortcut Shift+S untuk keluar
            let quit_shortcut: Shortcut = "Shift+S".parse().expect("Format shortcut tidak valid");

            app.global_shortcut().on_shortcut(quit_shortcut, |app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    let _ = app.cleanup_before_exit();
                    std::process::exit(0);
                }
            })?;

            if let Some(window) = app.get_webview_window("main") {
                // Kunci Fullscreen dan Always On Top
                let _ = window.set_fullscreen(true);
                let _ = window.set_always_on_top(true);
                let _ = window.set_focus();

                // Listen event saat window kehilangan fokus di level Native/OS
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::Focused(focused) = event {
                        if !focused {
                            // Paksa window kembali fokus jika pengguna mencoba Cmd+Tab / Alt+Tab
                            let _ = window_clone.set_focus();
                            let _ = window_clone.set_always_on_top(true);
                        }
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}