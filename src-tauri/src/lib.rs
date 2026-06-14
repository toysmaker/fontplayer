// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::sync::Mutex;
use std::fs;
use std::path::PathBuf;
use tauri::menu::{Menu, MenuItemBuilder, MenuItemKind, Submenu};
use tauri::{AppHandle, Emitter, Manager, State};

// 语言状态管理
struct LanguageState {
    current: String,
}

// 菜单文本定义
struct MenuTexts {
    app: &'static str,
    about: &'static str,
    file: FileMenuTexts,
    edit: EditMenuTexts,
    import: ImportMenuTexts,
    export: ExportMenuTexts,
    char: CharMenuTexts,
    settings: SettingsMenuTexts,
    templates: TemplatesMenuTexts,
    tools: ToolsMenuTexts,
}

struct FileMenuTexts {
    file: &'static str,
    new: &'static str,
    open: &'static str,
    save: &'static str,
    saveas: &'static str,
}

struct EditMenuTexts {
    edit: &'static str,
    undo: &'static str,
    redo: &'static str,
    cut: &'static str,
    copy: &'static str,
    paste: &'static str,
    delete: &'static str,
}

struct ImportMenuTexts {
    import: &'static str,
    font: &'static str,
    glyph: &'static str,
    picture: &'static str,
    svg: &'static str,
}

struct ExportMenuTexts {
    export: &'static str,
    font: &'static str,
    var_font: &'static str,
    color_font: &'static str,
    glyph: &'static str,
    jpeg: &'static str,
    png: &'static str,
    svg: &'static str,
    metrics_ref: &'static str,
}

struct CharMenuTexts {
    char: &'static str,
    character: &'static str,
    icon: &'static str,
}

struct SettingsMenuTexts {
    settings: &'static str,
    font: &'static str,
    preference: &'static str,
    language: &'static str,
}

struct TemplatesMenuTexts {
    templates: &'static str,
    test2: &'static str,
    test3: &'static str,
    test5: &'static str,
    test6: &'static str,
    test7: &'static str,
    test8: &'static str,
    digits: &'static str,
    letters: &'static str,
    symbols: &'static str,
    test: &'static str,
}

struct ToolsMenuTexts {
    tools: &'static str,
    remove_overlap: &'static str,
    format_all_characters: &'static str,
    format_current_character: &'static str,
}

fn get_menu_texts(lang: &str) -> MenuTexts {
    match lang {
        "en" => MenuTexts {
            app: "FontPlayer",
            about: "About",
            file: FileMenuTexts {
                file: "File",
                new: "New File",
                open: "Open File",
                save: "Save",
                saveas: "Save As",
            },
            edit: EditMenuTexts {
                edit: "Edit",
                undo: "Undo",
                redo: "Redo",
                cut: "Cut",
                copy: "Copy",
                paste: "Paste",
                delete: "Delete",
            },
            import: ImportMenuTexts {
                import: "Import",
                font: "Import Font",
                glyph: "Import Glyph",
                picture: "Import From Picture",
                svg: "Import SVG",
            },
            export: ExportMenuTexts {
                export: "Export",
                font: "Export Font",
                var_font: "Export Variable Font",
                color_font: "Export Color Font",
                glyph: "Export Glyph",
                jpeg: "Export JPEG",
                png: "Export PNG",
                svg: "Export SVG",
                metrics_ref: "Export Metrics Reference",
            },
            char: CharMenuTexts {
                char: "Char",
                character: "Add Character",
                icon: "Add Icon",
            },
            settings: SettingsMenuTexts {
                settings: "Settings",
                font: "Font Settings",
                preference: "Preference",
                language: "Language",
            },
            templates: TemplatesMenuTexts {
                templates: "Templates",
                test2: "template 2",
                test3: "template 3",
                test5: "template 5",
                test6: "template 6",
                test7: "template 7",
                test8: "template 8",
                digits: "Digits Template",
                letters: "Letters Template",
                symbols: "Symbols Template",
                test: "Test Template",
            },
            tools: ToolsMenuTexts {
                tools: "Tools",
                remove_overlap: "remove_overlap",
                format_all_characters: "Format All Characters",
                format_current_character: "Format Current Character",
            },
        },
        _ => MenuTexts {
            app: "字玩",
            about: "关于",
            file: FileMenuTexts {
                file: "文件",
                new: "新建工程",
                open: "打开工程",
                save: "保存工程",
                saveas: "另存为",
            },
            edit: EditMenuTexts {
                edit: "编辑",
                undo: "撤销",
                redo: "重做",
                cut: "剪切",
                copy: "复制",
                paste: "粘贴",
                delete: "删除",
            },
            import: ImportMenuTexts {
                import: "导入",
                font: "导入字体库",
                glyph: "导入字形",
                picture: "识别图片",
                svg: "导入SVG",
            },
            export: ExportMenuTexts {
                export: "导出",
                font: "导出字体库",
                var_font: "导出可变字体",
                color_font: "导出彩色字体",
                glyph: "导出字形",
                jpeg: "导出JPEG",
                png: "导出PNG",
                svg: "导出SVG",
                metrics_ref: "导出度量参考图",
            },
            char: CharMenuTexts {
                char: "字符",
                character: "添加字符",
                icon: "添加图标",
            },
            settings: SettingsMenuTexts {
                settings: "设置",
                font: "字体设置",
                preference: "偏好设置",
                language: "语言设置",
            },
            templates: TemplatesMenuTexts {
                templates: "模板",
                test2: "字玩标准黑体（仅笔画）",
                test3: "测试手绘模板（仅笔画）",
                test5: "字玩标准宋体（仅笔画）",
                test6: "字玩标准仿宋（仅笔画）",
                test7: "字玩标准楷体（仅笔画）",
                test8: "字玩标准隶书（仅笔画）",
                digits: "数字模板",
                letters: "字母模板",
                symbols: "符号模板",
                test: "测试模板",
            },
            tools: ToolsMenuTexts {
                tools: "工具",
                remove_overlap: "去除重叠",
                format_all_characters: "一键格式化所有字符",
                format_current_character: "一键格式化当前字符",
            },
        },
    }
}

// 菜单命令函数
#[tauri::command]
fn create_file(app: AppHandle) {
    app.emit("create-file", ()).unwrap();
}

#[tauri::command]
fn open_file(app: AppHandle) {
    app.emit("open-file", ()).unwrap();
}

#[tauri::command]
fn save_file(app: AppHandle) {
    app.emit("save-file", ()).unwrap();
}

#[tauri::command]
fn save_as(app: AppHandle) {
    app.emit("save-as", ()).unwrap();
}

#[tauri::command]
fn clear_cache(app: AppHandle) {
    app.emit("clear-cache", ()).unwrap();
}

#[tauri::command]
fn export_project(app: AppHandle) {
    app.emit("save-as-json", ()).unwrap();
}

#[tauri::command]
fn sync_data(app: AppHandle) {
    app.emit("sync-data", ()).unwrap();
}

#[tauri::command]
fn undo(app: AppHandle) {
    app.emit("undo", ()).unwrap();
}

#[tauri::command]
fn redo(app: AppHandle) {
    app.emit("redo", ()).unwrap();
}

#[tauri::command]
fn cut(app: AppHandle) {
    app.emit("cut", ()).unwrap();
}

#[tauri::command]
fn copy(app: AppHandle) {
    app.emit("copy", ()).unwrap();
}

#[tauri::command]
fn paste(app: AppHandle) {
    app.emit("paste", ()).unwrap();
}

#[tauri::command]
fn delete(app: AppHandle) {
    app.emit("delete", ()).unwrap();
}

#[tauri::command]
fn import_font_file(app: AppHandle) {
    app.emit("import-font-file", ()).unwrap();
}

#[tauri::command]
fn import_glyphs(app: AppHandle) {
    app.emit("import-glyphs", ()).unwrap();
}

#[tauri::command]
fn import_pic(app: AppHandle) {
    app.emit("import-pic", ()).unwrap();
}

#[tauri::command]
fn import_svg(app: AppHandle) {
    app.emit("import-svg", ()).unwrap();
}

#[tauri::command]
fn export_font_file(app: AppHandle) {
    app.emit("export-font-file", ()).unwrap();
}

#[tauri::command]
fn export_var_font_file(app: AppHandle) {
    app.emit("export-var-font-file", ()).unwrap();
}

#[tauri::command]
fn export_color_font(app: AppHandle) {
    app.emit("export-color-font", ()).unwrap();
}

#[tauri::command]
fn export_glyphs(app: AppHandle) {
    app.emit("export-glyphs", ()).unwrap();
}

#[tauri::command]
fn export_jpeg(app: AppHandle) {
    app.emit("export-jpeg", ()).unwrap();
}

#[tauri::command]
fn export_png(app: AppHandle) {
    app.emit("export-png", ()).unwrap();
}

#[tauri::command]
fn export_svg(app: AppHandle) {
    app.emit("export-svg", ()).unwrap();
}

#[tauri::command]
fn export_metrics_ref(app: AppHandle) {
    app.emit("export-metrics-ref", ()).unwrap();
}

#[tauri::command]
fn add_character(app: AppHandle) {
    app.emit("add-character", ()).unwrap();
}

#[tauri::command]
fn add_icon(app: AppHandle) {
    app.emit("add-icon", ()).unwrap();
}

#[tauri::command]
fn font_settings(app: AppHandle) {
    app.emit("font-settings", ()).unwrap();
}

#[tauri::command]
fn preference_settings(app: AppHandle) {
    app.emit("preference-settings", ()).unwrap();
}

#[tauri::command]
fn language_settings(app: AppHandle) {
    app.emit("language-settings", ()).unwrap();
}

#[tauri::command]
fn import_template2(app: AppHandle) {
    app.emit("template-2", ()).unwrap();
}

#[tauri::command]
fn import_template3(app: AppHandle) {
    app.emit("template-3", ()).unwrap();
}

#[tauri::command]
fn import_template5(app: AppHandle) {
    app.emit("template-5", ()).unwrap();
}

#[tauri::command]
fn import_template6(app: AppHandle) {
    app.emit("template-6", ()).unwrap();
}

#[tauri::command]
fn import_template7(app: AppHandle) {
    app.emit("template-7", ()).unwrap();
}

#[tauri::command]
fn import_template8(app: AppHandle) {
    app.emit("template-8", ()).unwrap();
}

#[tauri::command]
fn import_template_digits(app: AppHandle) {
    app.emit("template-digits", ()).unwrap();
}

#[tauri::command]
fn import_template_letters(app: AppHandle) {
    app.emit("template-letters", ()).unwrap();
}

#[tauri::command]
fn import_template_symbols(app: AppHandle) {
    app.emit("template-symbols", ()).unwrap();
}

#[tauri::command]
fn import_template_test(app: AppHandle) {
    app.emit("template-test", ()).unwrap();
}

#[tauri::command]
fn remove_overlap(app: AppHandle) {
    app.emit("remove_overlap", ()).unwrap();
}

#[tauri::command]
fn format_all_characters(app: AppHandle) {
    app.emit("format-all-characters", ()).unwrap();
}

#[tauri::command]
fn format_current_character(app: AppHandle) {
    app.emit("format-current-character", ()).unwrap();
}

// 菜单启用/禁用逻辑
fn enable(_edit_status: &str) -> bool {
    true
}

fn enable_at_edit(edit_status: &str) -> bool {
    matches!(edit_status, "edit" | "glyph")
}

fn enable_at_character_edit(edit_status: &str) -> bool {
    edit_status == "edit"
}

fn enable_at_list(edit_status: &str) -> bool {
    !matches!(edit_status, "edit" | "glyph" | "pic")
}

/// 与前端 export-glyphs 一致：仅字形类列表，不含字符列表
fn enable_at_glyph_list_only(edit_status: &str) -> bool {
    matches!(
        edit_status,
        "glyphlist" | "strokeglyphlist" | "radicalglyphlist" | "compglyphlist"
    )
}

fn template_enable(edit_status: &str) -> bool {
    !matches!(edit_status, "edit" | "glyph" | "pic")
}

// 构建菜单启用/禁用映射
fn build_menu_enabled_map() -> HashMap<String, Box<dyn Fn(&str) -> bool>> {
    let mut map: HashMap<String, Box<dyn Fn(&str) -> bool>> = HashMap::new();
    map.insert("about".to_string(), Box::new(enable));
    map.insert("create-file".to_string(), Box::new(enable_at_list));
    map.insert("open-file".to_string(), Box::new(enable_at_list));
    map.insert("save-file".to_string(), Box::new(enable));
    map.insert("save-as".to_string(), Box::new(enable));
    map.insert("undo".to_string(), Box::new(enable_at_edit));
    map.insert("redo".to_string(), Box::new(enable_at_edit));
    map.insert("cut".to_string(), Box::new(enable_at_edit));
    map.insert("copy".to_string(), Box::new(enable_at_edit));
    map.insert("paste".to_string(), Box::new(enable_at_edit));
    map.insert("delete".to_string(), Box::new(enable_at_edit));
    map.insert("import-font-file".to_string(), Box::new(enable_at_list));
    map.insert("import-glyphs".to_string(), Box::new(enable_at_list));
    map.insert("import-pic".to_string(), Box::new(enable_at_edit));
    map.insert("import-svg".to_string(), Box::new(enable_at_edit));
    map.insert("export-font-file".to_string(), Box::new(enable));
    map.insert("export-glyphs".to_string(), Box::new(enable_at_glyph_list_only));
    map.insert("export-jpeg".to_string(), Box::new(enable_at_edit));
    map.insert("export-png".to_string(), Box::new(enable_at_edit));
    map.insert("export-svg".to_string(), Box::new(enable_at_edit));
    map.insert("export-metrics-ref".to_string(), Box::new(enable_at_edit));
    map.insert("export-var-font-file".to_string(), Box::new(enable));
    map.insert("export-color-font".to_string(), Box::new(enable));
    map.insert("add-character".to_string(), Box::new(enable_at_list));
    map.insert("add-icon".to_string(), Box::new(enable_at_list));
    map.insert("font-settings".to_string(), Box::new(enable));
    map.insert("preference-settings".to_string(), Box::new(enable));
    map.insert("language-settings".to_string(), Box::new(enable));
    map.insert("template-2".to_string(), Box::new(template_enable));
    map.insert("template-3".to_string(), Box::new(template_enable));
    map.insert("template-5".to_string(), Box::new(template_enable));
    map.insert("template-6".to_string(), Box::new(template_enable));
    map.insert("template-7".to_string(), Box::new(template_enable));
    map.insert("template-8".to_string(), Box::new(template_enable));
    map.insert("template-digits".to_string(), Box::new(template_enable));
    map.insert("template-letters".to_string(), Box::new(template_enable));
    map.insert("template-symbols".to_string(), Box::new(template_enable));
    map.insert("template-test".to_string(), Box::new(template_enable));
    map.insert("remove-overlap".to_string(), Box::new(enable_at_character_edit));
    map.insert("remove_overlap".to_string(), Box::new(enable_at_character_edit));
    map.insert("format-all-characters".to_string(), Box::new(enable_at_list));
    map.insert("format-current-character".to_string(), Box::new(enable_at_character_edit));
    map
}

// 保存工程：由前端负责弹出对话框并传入路径，Rust 侧只负责写入文件
// 对话框必须在前端（JS 侧）通过 tauri-plugin-dialog 显示，
// 不能在 Tauri command（后台线程）中调用原生对话框，否则在 macOS 上会崩溃。
#[tauri::command]
fn save_project(data: String, path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    fs::write(&target, data).map_err(|e| e.to_string())
}

// 流式写入工程文件的单个 chunk
// append=false 时截断并从头写（第一块），append=true 时追加写（后续块）
// 使用 write_all 保证整个 chunk 都被写入，不会出现部分写入导致 JSON 损坏的问题
#[tauri::command]
fn write_file_chunk(path: String, chunk: String, append: bool) -> Result<(), String> {
    use std::io::Write;
    let target = PathBuf::from(&path);
    let mut file = if append {
        std::fs::OpenOptions::new()
            .write(true)
            .append(true)
            .open(&target)
            .map_err(|e| format!("open for append: {}", e))?
    } else {
        std::fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&target)
            .map_err(|e| format!("open for write: {}", e))?
    };
    file.write_all(chunk.as_bytes()).map_err(|e| format!("write_all: {}", e))
}

// 更新菜单启用/禁用状态
#[tauri::command]
fn toggle_menu_disabled(app: AppHandle, edit_status: String) {
    let map = build_menu_enabled_map();
    let window = app.get_webview_window("main").unwrap();
    if let Some(menu) = window.menu() {
        for submenu in menu.items().unwrap() {
            match submenu {
                MenuItemKind::Submenu(submenu) => {
                    for item in submenu.items().unwrap() {
                        match item {
                            MenuItemKind::MenuItem(item) => {
                                let id: String = item.id().0.clone();
                                if let Some(enabled_fn) = map.get(&id) {
                                    let enabled: bool = enabled_fn(&edit_status);
                                    item.set_enabled(enabled).unwrap_or_default();
                                }
                            }
                            _ => {}
                        }
                    }
                }
                _ => {}
            }
        }
    }
}

// 根据是否有工程打开，覆盖 open-file 菜单项的启用状态
// 在 toggle_menu_disabled 之后调用，确保工程状态优先级最高
#[tauri::command]
fn update_menu_project_status(app: AppHandle, has_project: bool) {
    let window = match app.get_webview_window("main") {
        Some(w) => w,
        None => return,
    };
    if let Some(menu) = window.menu() {
        for submenu in menu.items().unwrap_or_default() {
            if let MenuItemKind::Submenu(submenu) = submenu {
                for item in submenu.items().unwrap_or_default() {
                    if let MenuItemKind::MenuItem(item) = item {
                        let id: String = item.id().0.clone();
                        if id == "open-file" {
                            // 有工程打开时禁用，否则不干预（由 toggle_menu_disabled 决定）
                            if has_project {
                                item.set_enabled(false).unwrap_or_default();
                            }
                        }
                    }
                }
            }
        }
    }
}

// 菜单项 ID 到文本的映射函数
fn get_menu_item_text<'a>(id: &str, texts: &'a MenuTexts) -> Option<&'a str> {
    match id {
        "about" => Some(texts.about),
        "create-file" => Some(texts.file.new),
        "open-file" => Some(texts.file.open),
        "save-file" => Some(texts.file.save),
        "save-as" => Some(texts.file.saveas),
        "undo" => Some(texts.edit.undo),
        "redo" => Some(texts.edit.redo),
        "cut" => Some(texts.edit.cut),
        "copy" => Some(texts.edit.copy),
        "paste" => Some(texts.edit.paste),
        "delete" => Some(texts.edit.delete),
        "import-font-file" => Some(texts.import.font),
        "import-glyphs" => Some(texts.import.glyph),
        "import-pic" => Some(texts.import.picture),
        "import-svg" => Some(texts.import.svg),
        "export-font-file" => Some(texts.export.font),
        "export-var-font-file" => Some(texts.export.var_font),
        "export-color-font" => Some(texts.export.color_font),
        "export-glyphs" => Some(texts.export.glyph),
        "export-jpeg" => Some(texts.export.jpeg),
        "export-png" => Some(texts.export.png),
        "export-svg" => Some(texts.export.svg),
        "export-metrics-ref" => Some(texts.export.metrics_ref),
        "add-character" => Some(texts.char.character),
        "add-icon" => Some(texts.char.icon),
        "font-settings" => Some(texts.settings.font),
        "preference-settings" => Some(texts.settings.preference),
        "language-settings" => Some(texts.settings.language),
        "template-2" => Some(texts.templates.test2),
        "template-3" => Some(texts.templates.test3),
        "template-5" => Some(texts.templates.test5),
        "template-6" => Some(texts.templates.test6),
        "template-7" => Some(texts.templates.test7),
        "template-8" => Some(texts.templates.test8),
        "template-digits" => Some(texts.templates.digits),
        "template-letters" => Some(texts.templates.letters),
        "template-symbols" => Some(texts.templates.symbols),
        "template-test" => Some(texts.templates.test),
        "remove-overlap" | "remove_overlap" => Some(texts.tools.remove_overlap),
        "format-all-characters" => Some(texts.tools.format_all_characters),
        "format-current-character" => Some(texts.tools.format_current_character),
        _ => None,
    }
}

// 子菜单 ID 到文本的映射函数
fn get_submenu_text<'a>(index: usize, texts: &'a MenuTexts) -> Option<&'a str> {
    match index {
        0 => Some(texts.app),
        1 => Some(texts.file.file),
        2 => Some(texts.edit.edit),
        3 => Some(texts.import.import),
        4 => Some(texts.export.export),
        5 => Some(texts.char.char),
        6 => Some(texts.settings.settings),
        7 => Some(texts.templates.templates),
        8 => Some(texts.tools.tools),
        _ => None,
    }
}

// 更新菜单语言
#[tauri::command]
fn update_menu_language<R: tauri::Runtime>(
    app: AppHandle<R>,
    language: String,
    language_state: State<'_, Mutex<LanguageState>>,
) -> Result<(), String> {
    println!("update_menu_language called with language: {}", language);
    
    // 更新语言状态
    {
        let mut state = language_state.lock().unwrap();
        state.current = language.clone();
    }

    // 获取新语言的文本
    let texts = get_menu_texts(&language);
    
    // 获取窗口和菜单
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    let menu = window.menu().ok_or("Menu not found")?;
    
    println!("Updating menu items with language: {}", language);
    
    // 遍历所有子菜单，直接更新菜单项文本
    let items = menu.items().map_err(|e| format!("Failed to get menu items: {}", e))?;
    for (submenu_index, submenu_item) in items.iter().enumerate() {
        match submenu_item {
            MenuItemKind::Submenu(submenu) => {
                // 更新子菜单标题（如果支持）
                if let Some(submenu_text) = get_submenu_text(submenu_index, &texts) {
                    println!("Updating submenu {} to: {}", submenu_index, submenu_text);
                    // 尝试更新子菜单标题
                    if let Err(e) = submenu.set_text(submenu_text) {
                        println!("Warning: Failed to update submenu title: {}", e);
                    }
                }
                
                // 更新子菜单中的菜单项文本
                let submenu_items = submenu.items().map_err(|e| format!("Failed to get submenu items: {}", e))?;
                for item in submenu_items.iter() {
                    match item {
                        MenuItemKind::MenuItem(menu_item) => {
                            let id: String = menu_item.id().0.clone();
                            if let Some(item_text) = get_menu_item_text(&id, &texts) {
                                println!("Updating menu item {} to: {}", id, item_text);
                                // 使用 set_text 方法直接更新菜单项文本
                                if let Err(e) = menu_item.set_text(item_text) {
                                    println!("Warning: Failed to update menu item {}: {}", id, e);
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
            _ => {}
        }
    }
    
    println!("Menu language updated successfully");
    Ok(())
}

// 构建菜单
fn build_menu<R: tauri::Runtime>(app: &AppHandle<R>, texts: &MenuTexts) -> Result<Menu<R>, tauri::Error> {
    Menu::with_items(
        app,
        &[
            &Submenu::with_items(
                app,
                texts.app,
                true,
                &[&MenuItemBuilder::with_id("about", texts.about)
                    .build(app)?],
            )?,
            &Submenu::with_items(
                app,
                texts.file.file,
                true,
                &[
                    &MenuItemBuilder::with_id("create-file", texts.file.new)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("open-file", texts.file.open)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("save-file", texts.file.save)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("save-as", texts.file.saveas)
                        .build(app)
                        ?,
                ],
            )
            ?,
            &Submenu::with_items(
                app,
                texts.edit.edit,
                true,
                &[
                    &MenuItemBuilder::with_id("undo", texts.edit.undo)
                        .enabled(false)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("redo", texts.edit.redo)
                        .enabled(false)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("cut", texts.edit.cut)
                        .enabled(false)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("copy", texts.edit.copy)
                        .enabled(false)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("paste", texts.edit.paste)
                        .enabled(false)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("delete", texts.edit.delete)
                        .enabled(false)
                        .build(app)
                        ?,
                ],
            )
            ?,
            &Submenu::with_items(
                app,
                texts.import.import,
                true,
                &[
                    &MenuItemBuilder::with_id("import-font-file", texts.import.font)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("import-glyphs", texts.import.glyph)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("import-pic", texts.import.picture)
                        .enabled(false)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("import-svg", texts.import.svg)
                        .enabled(false)
                        .build(app)
                        ?,
                ],
            )
            ?,
            &Submenu::with_items(
                app,
                texts.export.export,
                true,
                &[
                    &MenuItemBuilder::with_id("export-font-file", texts.export.font)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("export-var-font-file", texts.export.var_font)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("export-color-font", texts.export.color_font)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("export-glyphs", texts.export.glyph)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("export-jpeg", texts.export.jpeg)
                        .enabled(false)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("export-png", texts.export.png)
                        .enabled(false)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("export-svg", texts.export.svg)
                        .enabled(false)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("export-metrics-ref", texts.export.metrics_ref)
                        .enabled(false)
                        .build(app)
                        ?,
                ],
            )
            ?,
            &Submenu::with_items(
                app,
                texts.char.char,
                true,
                &[
                    &MenuItemBuilder::with_id("add-character", texts.char.character)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("add-icon", texts.char.icon)
                        .build(app)
                        ?,
                ],
            )
            ?,
            &Submenu::with_items(
                app,
                texts.settings.settings,
                true,
                &[
                    &MenuItemBuilder::with_id("font-settings", texts.settings.font)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("preference-settings", texts.settings.preference)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("language-settings", texts.settings.language)
                        .build(app)
                        ?,
                ],
            )
            ?,
            &Submenu::with_items(
                app,
                texts.templates.templates,
                true,
                &[
                    &MenuItemBuilder::with_id("template-2", texts.templates.test2)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("template-3", texts.templates.test3)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("template-5", texts.templates.test5)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("template-6", texts.templates.test6)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("template-7", texts.templates.test7)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("template-8", texts.templates.test8)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("template-digits", texts.templates.digits)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("template-letters", texts.templates.letters)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("template-symbols", texts.templates.symbols)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("template-test", texts.templates.test)
                        .build(app)
                        ?,
                ],
            )
            ?,
            &Submenu::with_items(
                app,
                texts.tools.tools,
                true,
                &[
                    &MenuItemBuilder::with_id("remove-overlap", texts.tools.remove_overlap)
                        .enabled(false)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("format-all-characters", texts.tools.format_all_characters)
                        .enabled(false)
                        .build(app)
                        ?,
                    &MenuItemBuilder::with_id("format-current-character", texts.tools.format_current_character)
                        .enabled(false)
                        .build(app)
                        ?,
                ],
            )
            ?,
        ],
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(Mutex::new(LanguageState {
            current: "zh".to_string(),
        }))
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            // macOS: 声明后台活动，防止 App Nap 挂起 WKWebView 进程导致白屏
            #[cfg(target_os = "macos")]
            {
                use objc2_foundation::{NSProcessInfo, NSActivityOptions, NSString};
                let reason = NSString::from_str("Prevent webview suspension");
                let activity = NSProcessInfo::processInfo().beginActivityWithOptions_reason(
                    NSActivityOptions::Background | NSActivityOptions::IdleSystemSleepDisabled,
                    &reason,
                );
                std::mem::forget(activity);
            }

            // 窗口恢复时检测 webview 是否存活，分层恢复
            let handle = app.handle().clone();
            if let Some(window) = app.get_webview_window("main") {
                let w = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(true) = event {
                        if w.eval("true").is_ok() {
                            // JS 引擎存活 → 让前端自行检测合成器并决定是否刷新（不丢状态）
                            let _ = handle.emit("window-focus-restored", ());
                        }
                        // eval 失败 = 进程已死 → 不做任何事，保留白屏让用户感知异常
                    }
                });
            }

            // 设置菜单事件处理
            app.on_menu_event(move |app, event| {
                let id = event.id();
                match id.as_ref() {
                    "about" => {
                        // TODO: 显示关于对话框
                    }
                    "create-file" => create_file(app.app_handle().clone()),
                    "open-file" => open_file(app.app_handle().clone()),
                    "save-file" => save_file(app.app_handle().clone()),
                    "save-as" => save_as(app.app_handle().clone()),
                    "clear-cache" => clear_cache(app.app_handle().clone()),
                    "save-as-json" => export_project(app.app_handle().clone()),
                    "sync-data" => sync_data(app.app_handle().clone()),
                    "undo" => undo(app.app_handle().clone()),
                    "redo" => redo(app.app_handle().clone()),
                    "cut" => cut(app.app_handle().clone()),
                    "copy" => copy(app.app_handle().clone()),
                    "paste" => paste(app.app_handle().clone()),
                    "delete" => delete(app.app_handle().clone()),
                    "import-font-file" => import_font_file(app.app_handle().clone()),
                    "import-glyphs" => import_glyphs(app.app_handle().clone()),
                    "import-pic" => import_pic(app.app_handle().clone()),
                    "import-svg" => import_svg(app.app_handle().clone()),
                    "export-font-file" => export_font_file(app.app_handle().clone()),
                    "export-var-font-file" => export_var_font_file(app.app_handle().clone()),
                    "export-color-font" => export_color_font(app.app_handle().clone()),
                    "export-glyphs" => export_glyphs(app.app_handle().clone()),
                    "export-jpeg" => export_jpeg(app.app_handle().clone()),
                    "export-png" => export_png(app.app_handle().clone()),
                    "export-svg" => export_svg(app.app_handle().clone()),
                    "export-metrics-ref" => export_metrics_ref(app.app_handle().clone()),
                    "add-character" => add_character(app.app_handle().clone()),
                    "add-icon" => add_icon(app.app_handle().clone()),
                    "font-settings" => font_settings(app.app_handle().clone()),
                    "preference-settings" => preference_settings(app.app_handle().clone()),
                    "language-settings" => language_settings(app.app_handle().clone()),
                    "template-2" => import_template2(app.app_handle().clone()),
                    "template-3" => import_template3(app.app_handle().clone()),
                    "template-5" => import_template5(app.app_handle().clone()),
                    "template-6" => import_template6(app.app_handle().clone()),
                    "template-7" => import_template7(app.app_handle().clone()),
                    "template-8" => import_template8(app.app_handle().clone()),
                    "template-digits" => import_template_digits(app.app_handle().clone()),
                    "template-letters" => import_template_letters(app.app_handle().clone()),
                    "template-symbols" => import_template_symbols(app.app_handle().clone()),
                    "template-test" => import_template_test(app.app_handle().clone()),
                    "remove-overlap" | "remove_overlap" => remove_overlap(app.app_handle().clone()),
                    "format-all-characters" => format_all_characters(app.app_handle().clone()),
                    "format-current-character" => format_current_character(app.app_handle().clone()),
                    _ => {}
                }
            });

            Ok(())
        })
        .menu(|handle| {
            // 构建初始菜单（中文）
            let texts = get_menu_texts("zh");
            build_menu(handle, &texts)
        })
        .invoke_handler(tauri::generate_handler![
            toggle_menu_disabled,
            update_menu_project_status,
            update_menu_language,
            save_project,
            write_file_chunk
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
