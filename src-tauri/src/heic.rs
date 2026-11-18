// macOS 动态壁纸 .heic 导出
//
// 通过 ImageIO 框架（CGImageDestination + CGImageMetadata）写入 HEIC 容器，
// 并附带 apple_desktop 命名空间的动态壁纸元数据：
//   - 文件级：apple_desktop:apr = "true"（随外观切换）；可选 apple_desktop:solar / h24（太阳方位角）
//   - 图片级：apple_desktop:ap = "0"（深色）/ "1"（浅色）、apple_desktop:si = 图片索引
//
// 仅 macOS 可用；其他平台命令直接返回错误（前端也会隐藏该选项）。

use serde::{Deserialize, Serialize};

#[cfg(target_os = "macos")]
pub(crate) mod imp {
    use std::ffi::{c_void, CString};
    use std::ptr;

    // ---- CoreFoundation / ImageIO 类型 ----
    type CFTypeRef = *const c_void;
    type CFStringRef = *const c_void;
    type CFDataRef = *const c_void;
    type CFURLRef = *const c_void;
    type CFErrorRef = *mut c_void;
    type CGImageSourceRef = *mut c_void;
    type CGImageRef = *mut c_void;
    type CGImageDestinationRef = *mut c_void;
    type CGImageMetadataRef = *mut c_void;
    type CGImageMetadataTagRef = *mut c_void;

    const K_CF_STRING_ENCODING_UTF8: u32 = 0x0800_0100;
    // CGImageMetadataType
    const K_CG_IMAGE_METADATA_TYPE_STRING: i32 = 1;

    #[link(name = "ImageIO", kind = "framework")]
    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        // CF
        fn CFRelease(cf: CFTypeRef);
        fn CFStringCreateWithBytes(
            alloc: *const c_void,
            bytes: *const u8,
            num_bytes: isize,
            encoding: u32,
            is_external_representation: bool,
        ) -> CFStringRef;
        fn CFDataCreate(
            alloc: *const c_void,
            bytes: *const u8,
            length: isize,
        ) -> CFDataRef;
        fn CFURLCreateWithBytes(
            alloc: *const c_void,
            url_bytes: *const u8,
            length: isize,
            encoding: u32,
            base_url: CFURLRef,
        ) -> CFURLRef;

        // ImageIO
        fn CGImageSourceCreateWithData(data: CFDataRef, options: *const c_void) -> CGImageSourceRef;
        fn CGImageSourceCreateImageAtIndex(
            source: CGImageSourceRef,
            index: usize,
            options: *const c_void,
        ) -> CGImageRef;
        fn CGImageDestinationCreateWithURL(
            url: CFURLRef,
            dst_type: CFStringRef,
            count: usize,
            options: *const c_void,
        ) -> CGImageDestinationRef;
        fn CGImageDestinationAddImageAndMetadata(
            dst: CGImageDestinationRef,
            image: CGImageRef,
            metadata: CGImageMetadataRef,
            options: *const c_void,
        );
        fn CGImageDestinationFinalize(dst: CGImageDestinationRef) -> bool;
        fn CGImageMetadataCreateMutable() -> CGImageMetadataRef;
        fn CGImageMetadataRegisterNamespaceForPrefix(
            metadata: CGImageMetadataRef,
            xmlns: CFStringRef,
            prefix: CFStringRef,
            error: *mut CFErrorRef,
        ) -> bool;
        fn CGImageMetadataTagCreate(
            xmlns: CFStringRef,
            prefix: CFStringRef,
            name: CFStringRef,
            tag_type: i32,
            value: CFTypeRef,
            tag_out: *mut CGImageMetadataTagRef,
        ) -> bool;
        fn CGImageMetadataSetTagWithPath(
            metadata: CGImageMetadataRef,
            parent: CGImageMetadataTagRef,
            path: CFStringRef,
            tag: CGImageMetadataTagRef,
        );
    }

    fn cf_string(s: &str) -> CFStringRef {
        unsafe {
            CFStringCreateWithBytes(
                ptr::null(),
                s.as_ptr(),
                s.len() as isize,
                K_CF_STRING_ENCODING_UTF8,
                false,
            )
        }
    }

    fn release_cf_string(s: CFStringRef) {
        unsafe { CFRelease(s) }
    }

    pub(crate) struct FrameData {
        pub data: Vec<u8>,
        pub is_light: bool,
        pub is_primary: bool,
        pub solar: Option<f64>,
        pub azimuth: Option<f64>,
    }

    fn decode_image(frame: &FrameData) -> Result<CGImageRef, String> {
        unsafe {
            let data = CFDataCreate(ptr::null(), frame.data.as_ptr(), frame.data.len() as isize);
            if data.is_null() {
                return Err("CFDataCreate failed".into());
            }
            let source = CGImageSourceCreateWithData(data, ptr::null());
            CFRelease(data);
            if source.is_null() {
                return Err("CGImageSourceCreateWithData failed (invalid image data?)".into());
            }
            let image = CGImageSourceCreateImageAtIndex(source, 0, ptr::null());
            CFRelease(source);
            if image.is_null() {
                return Err("CGImageSourceCreateImageAtIndex failed".into());
            }
            Ok(image)
        }
    }

    fn build_item_metadata(
        frame: &FrameData,
        index: usize,
        xmlns: CFStringRef,
        prefix: CFStringRef,
    ) -> Result<CGImageMetadataRef, String> {
        unsafe {
            let metadata = CGImageMetadataCreateMutable();
            if metadata.is_null() {
                return Err("CGImageMetadataCreateMutable failed".into());
            }
            if !CGImageMetadataRegisterNamespaceForPrefix(metadata, xmlns, prefix, ptr::null_mut()) {
                CFRelease(metadata);
                return Err("register apple_desktop namespace failed".into());
            }

            let add_tag = |name: &str, value: &str| -> Result<(), String> {
                let name_cf = cf_string(name);
                let value_cf = cf_string(value);
                let mut tag: CGImageMetadataTagRef = ptr::null_mut();
                let ok = CGImageMetadataTagCreate(
                    xmlns,
                    prefix,
                    name_cf,
                    K_CG_IMAGE_METADATA_TYPE_STRING,
                    value_cf,
                    &mut tag,
                );
                release_cf_string(name_cf);
                release_cf_string(value_cf);
                if !ok || tag.is_null() {
                    return Err(format!("create metadata tag {name} failed"));
                }
                let path = cf_string(&format!("apple_desktop:{name}"));
                CGImageMetadataSetTagWithPath(metadata, ptr::null_mut(), path, tag);
                release_cf_string(path);
                Ok(())
            };

            add_tag("ap", if frame.is_light { "1" } else { "0" })?;
            add_tag("si", &index.to_string())?;
            if frame.is_primary {
                add_tag("apr", "true")?;
                if let Some(solar) = frame.solar {
                    add_tag("solar", &format!("{:.2}", solar))?;
                }
                if let Some(azimuth) = frame.azimuth {
                    add_tag("h24", &format!("{:.2}", azimuth))?;
                }
            }
            Ok(metadata)
        }
    }

    pub fn export_dynamic_wallpaper(path: &str, frames: &[FrameData]) -> Result<(), String> {
        let xmlns = cf_string("http://ns.apple.com/namespace/1.0/");
        let prefix = cf_string("apple_desktop");

        unsafe {
            let c_path = CString::new(path).map_err(|_| "invalid path".to_string())?;
            let url = CFURLCreateWithBytes(
                ptr::null(),
                c_path.as_ptr() as *const u8,
                c_path.as_bytes().len() as isize,
                K_CF_STRING_ENCODING_UTF8,
                ptr::null(),
            );
            if url.is_null() {
                release_cf_string(xmlns);
                release_cf_string(prefix);
                return Err("CFURLCreateWithBytes failed".into());
            }

            // 不使用 kUTTypeHEIC 常量（链接问题），直接传 UTType 字符串
            let heic_type = cf_string("public.heic");
            let dst = CGImageDestinationCreateWithURL(url, heic_type, frames.len(), ptr::null());
            release_cf_string(heic_type);
            CFRelease(url);
            if dst.is_null() {
                release_cf_string(xmlns);
                release_cf_string(prefix);
                return Err("CGImageDestinationCreateWithURL failed (HEIC not supported?)".into());
            }

            let mut result = Ok(());
            for (i, frame) in frames.iter().enumerate() {
                match decode_image(frame) {
                    Ok(image) => {
                        let metadata = match build_item_metadata(frame, i, xmlns, prefix) {
                            Ok(m) => m,
                            Err(e) => {
                                CFRelease(image);
                                result = Err(e);
                                break;
                            }
                        };
                        CGImageDestinationAddImageAndMetadata(dst, image, metadata, ptr::null());
                        CFRelease(metadata);
                        CFRelease(image);
                    }
                    Err(e) => {
                        result = Err(e);
                        break;
                    }
                }
            }

            if result.is_ok() {
                if !CGImageDestinationFinalize(dst) {
                    result = Err("CGImageDestinationFinalize failed".into());
                }
            }
            CFRelease(dst);
            release_cf_string(xmlns);
            release_cf_string(prefix);
            result
        }
    }
}

/// 单帧输入（前端传 PNG/JPEG 字节）
#[derive(Deserialize, Serialize)]
pub struct WallpaperFrame {
    /// 编码后的图片字节（PNG/JPEG）
    pub data: Vec<u8>,
    /// true = 浅色外观帧（apple_desktop:ap = 1），false = 深色帧（ap = 0）
    pub is_light: bool,
    /// 主帧（承载文件级元数据 apr/solar/h24）
    pub is_primary: bool,
    /// 太阳仰角（solar 模式可选）
    pub solar: Option<f64>,
    /// 太阳方位角（h24，可选）
    pub azimuth: Option<f64>,
}

#[tauri::command]
pub fn export_dynamic_wallpaper_heic(path: String, frames: Vec<WallpaperFrame>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if frames.is_empty() {
            return Err("frames is empty".into());
        }
        let inner: Vec<imp::FrameData> = frames
            .into_iter()
            .map(|f| imp::FrameData {
                data: f.data,
                is_light: f.is_light,
                is_primary: f.is_primary,
                solar: f.solar,
                azimuth: f.azimuth,
            })
            .collect();
        imp::export_dynamic_wallpaper(&path, &inner)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (path, frames);
        Err("macOS dynamic wallpaper export is only available on macOS".into())
    }
}
