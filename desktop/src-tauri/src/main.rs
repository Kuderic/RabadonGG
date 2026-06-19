// Rabadon.GG desktop shell
//
// Responsibilities:
//   1. Read the League Client lockfile (LCU) to get the running client's
//      port + password, then proxy a champ-select session query back to
//      the frontend via the `get_lcu_session` Tauri command.
//   2. All scoring and data fetching go to the EC2 backend at www.rabadon.gg.
//      Nothing is spawned locally.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::sync::Mutex as StdMutex;
use base64::Engine as _;
use serde_json::{json, Value};
use tokio::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, ShortcutState};

// ---------------------------------------------------------------------------
// App state — champion id→name map cached for the process lifetime
// ---------------------------------------------------------------------------

struct AppState {
    champion_map: Mutex<Option<HashMap<u64, String>>>,
    overlay_shortcut: StdMutex<Option<String>>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Return the path of the first lockfile that exists on disk, respecting the
/// `LCU_LOCKFILE` environment variable override.
fn find_lockfile() -> Option<std::path::PathBuf> {
    let candidates: Vec<std::path::PathBuf> = {
        let mut v: Vec<std::path::PathBuf> = Vec::new();
        if let Ok(env_path) = std::env::var("LCU_LOCKFILE") {
            v.push(env_path.into());
        }
        v.push(r"C:\Riot Games\League of Legends\lockfile".into());
        v.push(r"D:\Riot Games\League of Legends\lockfile".into());
        v.push(r"C:\Program Files\Riot Games\League of Legends\lockfile".into());
        v
    };

    candidates.into_iter().find(|p| p.exists())
}

/// Parse `LeagueClient:{pid}:{port}:{password}:https` from the lockfile text.
/// Returns `(port, password)` on success.
fn parse_lockfile(contents: &str) -> Option<(u16, String)> {
    let parts: Vec<&str> = contents.trim().split(':').collect();
    // Format: LeagueClient : pid : port : password : https  → 5 parts
    if parts.len() < 5 {
        return None;
    }
    let port: u16 = parts[2].parse().ok()?;
    let password = parts[3].to_string();
    Some((port, password))
}

/// Map an LCU position string to the app's role identifier.
fn map_position(pos: &str) -> &'static str {
    match pos.to_lowercase().as_str() {
        "top"     => "top",
        "jungle"  => "jungle",
        "middle"  => "mid",
        "bottom"  => "adc",
        "utility" => "support",
        _         => "fill",
    }
}

/// Fetch and build the champion id (u64) → display name (String) map from
/// DDragon.  Uses the latest patch returned by the versions endpoint.
async fn fetch_champion_map() -> Result<HashMap<u64, String>, String> {
    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| e.to_string())?;

    // 1. Latest version
    let versions: Vec<String> = client
        .get("https://ddragon.leagueoflegends.com/api/versions.json")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let version = versions.into_iter().next().ok_or("versions list empty")?;

    // 2. Champion data
    let url = format!(
        "https://ddragon.leagueoflegends.com/cdn/{}/data/en_US/champion.json",
        version
    );
    let body: Value = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    // 3. Build map  { key_int → name }
    let data = body["data"].as_object().ok_or("missing data field")?;
    let mut map = HashMap::new();
    for champ in data.values() {
        let key_str = champ["key"].as_str().unwrap_or("");
        let name    = champ["name"].as_str().unwrap_or("").to_string();
        if let Ok(id) = key_str.parse::<u64>() {
            map.insert(id, name);
        }
    }
    Ok(map)
}

// ---------------------------------------------------------------------------
// Tauri command
// ---------------------------------------------------------------------------

#[tauri::command]
fn open_url(url: String) {
    let _ = open::that(url);
}

#[tauri::command]
async fn get_lcu_session(
    state: tauri::State<'_, AppState>,
) -> Result<Value, String> {
    // 1. Locate lockfile
    let Some(lockfile_path) = find_lockfile() else {
        return Ok(json!({ "connected": false, "session": null }));
    };

    // 2. Read + parse lockfile
    let contents = tokio::fs::read_to_string(&lockfile_path)
        .await
        .map_err(|e| e.to_string())?;

    let Ok((port, password)) = parse_lockfile(&contents).ok_or("bad lockfile format") else {
        return Ok(json!({ "connected": false, "session": null }));
    };

    // 3. Build a client that accepts the LCU's self-signed cert
    let lcu_client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| e.to_string())?;

    let auth = base64::engine::general_purpose::STANDARD
        .encode(format!("riot:{}", password));

    let session_url = format!(
        "https://127.0.0.1:{}/lol-champ-select/v1/session",
        port
    );

    let resp = lcu_client
        .get(&session_url)
        .header("Authorization", format!("Basic {}", auth))
        .send()
        .await
        .map_err(|_| "LCU unreachable")?;

    // 4. 404 → client running but not in champ select
    if resp.status().as_u16() == 404 {
        return Ok(json!({ "connected": true, "session": null }));
    }

    if !resp.status().is_success() {
        return Ok(json!({ "connected": true, "session": null }));
    }

    let session: Value = resp.json().await.map_err(|e| e.to_string())?;

    // 5. Ensure champion map is loaded
    {
        let mut guard = state.champion_map.lock().await;
        if guard.is_none() {
            let map = fetch_champion_map().await.unwrap_or_default();
            *guard = Some(map);
        }
    }
    let guard = state.champion_map.lock().await;
    let champ_map = guard.as_ref().unwrap();

    // 6. Parse the session
    let phase = session["timer"]["phase"]
        .as_str()
        .unwrap_or("UNKNOWN")
        .to_string();

    let local_cell_id = session["localPlayerCellId"].as_i64().unwrap_or(-1);

    // Spectate mode: LCU sets isSpectating=true, and localPlayerCellId is -1
    // (no local player exists in the session). Either signal is sufficient.
    let is_spectating = session["isSpectating"].as_bool().unwrap_or(false)
        || local_cell_id == -1;

    let mut allies: Vec<Value> = Vec::new();
    let mut enemies: Vec<Value> = Vec::new();

    // myTeam
    if let Some(my_team) = session["myTeam"].as_array() {
        for member in my_team {
            let cell_id = member["cellId"].as_i64().unwrap_or(-2);
            let position = member["assignedPosition"]
                .as_str()
                .unwrap_or("");

            if cell_id == local_cell_id {
                // This is the local player — skip adding to allies, but we
                // use their position to populate my_role below.
                continue;
            }

            let champ_id = member["championId"].as_u64().unwrap_or(0);
            let pick_intent = member["championPickIntent"].as_u64().unwrap_or(0);

            let (effective_id, is_intent) = if champ_id > 0 {
                (champ_id, false)
            } else if pick_intent > 0 {
                (pick_intent, true)
            } else {
                continue; // nothing to show
            };

            let champ_name = champ_map.get(&effective_id).cloned().unwrap_or_default();
            if !champ_name.is_empty() {
                allies.push(json!({
                    "champion": champ_name,
                    "role": map_position(position),
                    "is_intent": is_intent,
                }));
            }
        }
    }

    // Determine local player's role
    let my_role = session["myTeam"]
        .as_array()
        .and_then(|arr| {
            arr.iter().find(|m| m["cellId"].as_i64() == Some(local_cell_id))
        })
        .and_then(|m| m["assignedPosition"].as_str())
        .map(map_position)
        .unwrap_or("fill")
        .to_string();

    // theirTeam — assignedPosition is unreliable for enemies; role assignment
    // is handled by champPrimaryRole on the frontend.
    if let Some(their_team) = session["theirTeam"].as_array() {
        for member in their_team {
            let champ_id = member["championId"].as_u64().unwrap_or(0);
            let champ_name = champ_map
                .get(&champ_id)
                .cloned()
                .unwrap_or_default();

            if !champ_name.is_empty() {
                enemies.push(json!({ "champion": champ_name }));
            }
        }
    }

    // Extract the local player's pick intent (what they're hovering before lock-in)
    let intent_champ_name: Option<String> = session["myTeam"]
        .as_array()
        .and_then(|arr| arr.iter().find(|m| m["cellId"].as_i64() == Some(local_cell_id)))
        .and_then(|m| {
            let champ_id = m["championId"].as_u64().unwrap_or(0);
            let intent_id = m["championPickIntent"].as_u64().unwrap_or(0);
            let effective_id = if champ_id > 0 { champ_id } else { intent_id };
            if effective_id > 0 { champ_map.get(&effective_id).cloned() } else { None }
        });

    Ok(json!({
        "connected": true,
        "session": {
            "phase":        phase,
            "my_role":      my_role,
            "allies":       allies,
            "enemies":      enemies,
            "intent_champ": intent_champ_name,
            "spectating":   is_spectating,
        }
    }))
}

/// Show or hide the overlay window.
#[tauri::command]
async fn control_overlay(app: tauri::AppHandle, action: String) -> Result<(), String> {
    let Some(overlay) = app.get_webview_window("overlay") else {
        return Err("overlay window not found".into());
    };
    match action.as_str() {
        "show" => {
            let _ = overlay.show();
            let _ = overlay.set_always_on_top(true);
        }
        "hide" => {
            let _ = overlay.hide();
        }
        _ => {}
    }
    Ok(())
}

/// Show and focus the main window (called from the overlay when a pick is clicked).
#[tauri::command]
async fn focus_main(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    }
    Ok(())
}

/// Resize the overlay window (called when the user changes overlay size setting).
#[tauri::command]
async fn resize_overlay(app: tauri::AppHandle, width: u32, height: u32) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("overlay") {
        let _ = w.set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: width as f64,
            height: height as f64,
        }));
    }
    Ok(())
}

/// Register (or re-register) the global shortcut that toggles the overlay.
/// Called from the frontend on startup and whenever the user changes the hotkey.
#[tauri::command]
fn set_overlay_shortcut(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    shortcut: String,
) -> Result<(), String> {
    let mut current = state.overlay_shortcut.lock().unwrap();
    // Unregister previous shortcut if one was set
    if let Some(old) = current.as_deref() {
        let _ = app.global_shortcut().unregister(old);
    }
    if shortcut.is_empty() {
        *current = None;
        return Ok(());
    }
    app.global_shortcut()
        .register(shortcut.as_str())
        .map_err(|e| e.to_string())?;
    *current = Some(shortcut);
    Ok(())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // -----------------------------------------------------------------------
    // parse_lockfile
    // -----------------------------------------------------------------------

    #[test]
    fn test_parse_lockfile_valid() {
        let result = parse_lockfile("LeagueClient:12345:54321:abc123:https");
        assert_eq!(result, Some((54321u16, "abc123".to_string())));
    }

    #[test]
    fn test_parse_lockfile_trailing_newline() {
        let result = parse_lockfile("LeagueClient:12345:54321:abc123:https\n");
        assert_eq!(result, Some((54321u16, "abc123".to_string())));
    }

    #[test]
    fn test_parse_lockfile_too_few_parts() {
        let result = parse_lockfile("LeagueClient:12345:54321:abc123");
        assert!(result.is_none());
    }

    #[test]
    fn test_parse_lockfile_empty() {
        assert!(parse_lockfile("").is_none());
    }

    #[test]
    fn test_parse_lockfile_non_numeric_port() {
        let result = parse_lockfile("LeagueClient:12345:notaport:abc:https");
        assert!(result.is_none());
    }

    #[test]
    fn test_parse_lockfile_port_zero() {
        let result = parse_lockfile("LeagueClient:12345:0:abc123:https");
        assert_eq!(result, Some((0u16, "abc123".to_string())));
    }

    #[test]
    fn test_parse_lockfile_port_max_valid() {
        let result = parse_lockfile("LeagueClient:12345:65535:abc123:https");
        assert_eq!(result, Some((65535u16, "abc123".to_string())));
    }

    #[test]
    fn test_parse_lockfile_port_overflow() {
        let result = parse_lockfile("LeagueClient:12345:65536:abc123:https");
        assert!(result.is_none());
    }

    #[test]
    fn test_parse_lockfile_realistic() {
        let result = parse_lockfile("LeagueClient:99271:52195:Qjw8xKmP4nRs2vLt:https");
        assert_eq!(result, Some((52195u16, "Qjw8xKmP4nRs2vLt".to_string())));
    }

    // -----------------------------------------------------------------------
    // map_position
    // -----------------------------------------------------------------------

    #[test]
    fn test_map_position_top() {
        assert_eq!(map_position("top"), "top");
    }

    #[test]
    fn test_map_position_jungle() {
        assert_eq!(map_position("jungle"), "jungle");
    }

    #[test]
    fn test_map_position_middle() {
        assert_eq!(map_position("middle"), "mid");
    }

    #[test]
    fn test_map_position_bottom() {
        assert_eq!(map_position("bottom"), "adc");
    }

    #[test]
    fn test_map_position_utility() {
        assert_eq!(map_position("utility"), "support");
    }

    #[test]
    fn test_map_position_case_middle_upper() {
        assert_eq!(map_position("MIDDLE"), "mid");
    }

    #[test]
    fn test_map_position_case_top_upper() {
        assert_eq!(map_position("TOP"), "top");
    }

    #[test]
    fn test_map_position_case_bottom_mixed() {
        assert_eq!(map_position("Bottom"), "adc");
    }

    #[test]
    fn test_map_position_empty_string() {
        assert_eq!(map_position(""), "fill");
    }

    #[test]
    fn test_map_position_fill_passthrough() {
        assert_eq!(map_position("fill"), "fill");
    }

    #[test]
    fn test_map_position_unknown_role() {
        assert_eq!(map_position("unknown_role"), "fill");
    }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .manage(AppState {
            champion_map: Mutex::new(None),
            overlay_shortcut: StdMutex::new(None),
        })
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() != ShortcutState::Pressed { return; }
                    // Ctrl+ArrowUp → show/focus main window
                    if shortcut.mods().contains(Modifiers::CONTROL)
                        && shortcut.key() == Code::ArrowUp
                    {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                        return;
                    }
                    // All other registered shortcuts → toggle overlay
                    if let Some(overlay) = app.get_webview_window("overlay") {
                        if overlay.is_visible().unwrap_or(false) {
                            let _ = overlay.hide();
                        } else {
                            let _ = overlay.show();
                            let _ = overlay.set_always_on_top(true);
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "Open Rabadon.GG", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Rabadon.GG")
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Ctrl+ArrowUp — always-on focus-main shortcut (fixed, not user-configurable)
            let _ = app.global_shortcut().register("Ctrl+ArrowUp");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_lcu_session, open_url, control_overlay, set_overlay_shortcut, focus_main, resize_overlay])
        .run(tauri::generate_context!())
        .expect("error while running Rabadon desktop");
}
