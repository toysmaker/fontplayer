//! 骨架提取模块
//!
//! 从二值位图中提取骨架（1像素宽），然后追踪为折线段(polylines)。
//! 算法流程：
//! 1. 读取图片 → 缩放至1000x1000 → 灰度化 → 二值化
//! 2. skeletonize::thin_image_edges → Zhang-Suen 细化
//! 3. 自定义追踪算法 → Vec<Vec<(f64, f64)>>

use image::{DynamicImage, GenericImageView, GrayImage, Luma, imageops};
use std::path::Path;

/// 折线点坐标
type Point = (f64, f64);
/// 一条折线 = 一组连续点
type Polyline = Vec<Point>;
/// 骨架追踪结果 = 多条折线
type Polylines = Vec<Polyline>;

/// 从图片文件提取骨架，返回折线段集合（JSON格式）
pub fn extract_skeleton_from_image(image_path: &str) -> Result<Polylines, Box<dyn std::error::Error>> {
    let img = image::open(Path::new(image_path))?;
    let (w, h) = img.dimensions();
    let img = if w != 1000 || h != 1000 {
        DynamicImage::ImageLuma8(imageops::resize(
            &img.to_luma8(),
            1000,
            1000,
            imageops::FilterType::Lanczos3,
        ))
    } else {
        img
    };
    let gray = img.to_luma8();
    let binary = binarize(&gray);
    let skeleton = thin_image(&binary)?;
    let polylines = trace_skeleton(&skeleton);
    Ok(polylines)
}

/// 从已有的二值 GrayImage 数据提取骨架（用于 Tauri command）
/// 输入已经是二值图像（0=前景/ink, 255=背景/paper）
pub fn extract_skeleton_from_image_data(
    binary: &GrayImage,
) -> Result<Polylines, Box<dyn std::error::Error>> {
    // 直接细化并追踪（数据已经是二值化的）
    let skeleton = thin_image(binary)?;
    let polylines = trace_skeleton(&skeleton);
    Ok(polylines)
}

/// OTSU 二值化
fn binarize(gray: &GrayImage) -> GrayImage {
    let (w, h) = gray.dimensions();
    let mut img = GrayImage::new(w, h);

    // 计算 OTSU 阈值
    let mut histogram = [0u64; 256];
    for pixel in gray.pixels() {
        histogram[pixel[0] as usize] += 1;
    }
    let total = (w * h) as f64;
    let threshold = otsu_threshold(&histogram, total);

    for (x, y, pixel) in gray.enumerate_pixels() {
        let val = if pixel[0] > threshold { 0 } else { 255 };
        img.put_pixel(x, y, Luma([val]));
    }
    img
}

/// OTSU 自动阈值计算
fn otsu_threshold(histogram: &[u64; 256], total: f64) -> u8 {
    let mut sum_b = 0.0f64;
    let mut w_b = 0.0f64;
    let sum_total: f64 = histogram.iter().enumerate()
        .map(|(i, &c)| i as f64 * c as f64)
        .sum();

    let mut max_var = 0.0f64;
    let mut threshold = 128u8;

    for t in 0..256 {
        w_b += histogram[t] as f64;
        if w_b == 0.0 { continue; }
        let w_f = total - w_b;
        if w_f == 0.0 { break; }

        sum_b += (t as f64) * histogram[t] as f64;
        let m_b = sum_b / w_b;
        let m_f = (sum_total - sum_b) / w_f;
        let var_between = w_b * w_f * (m_b - m_f).powi(2);

        if var_between > max_var {
            max_var = var_between;
            threshold = t as u8;
        }
    }
    threshold
}

/// 图像细化（委托给 skeletonize crate）
/// skeletonize 需要 &mut DynamicImage 作为输入
fn thin_image(binary: &GrayImage) -> Result<GrayImage, Box<dyn std::error::Error>> {
    // 将 GrayImage 转为 DynamicImage
    let mut dyn_img = DynamicImage::ImageLuma8(binary.clone());

    // 调用 skeletonize 细化（前景为黑色 = 0，背景为白色 = 255）
    skeletonize::thin_image_edges::<skeletonize::foreground::Black>(
        &mut dyn_img,
        skeletonize::MarkingMethod::Modified,
        None,
    )?;

    // 转回 GrayImage
    Ok(dyn_img.to_luma8())
}

// ============================================================
// 骨架追踪算法
// ============================================================

/// 8邻域方向偏移（上、右上、右、右下、下、左下、左、左上）
const NEIGHBORS8: [(i32, i32); 8] = [
    (0, -1), (1, -1), (1, 0), (1, 1),
    (0, 1), (-1, 1), (-1, 0), (-1, -1),
];

/// 判断像素是前景（骨架像素，值为0即黑色）
fn is_foreground(pixel: u8) -> bool {
    pixel == 0
}

/// 计算8邻域中前景像素的数量
fn count_neighbors(pixels: &Vec<Vec<u8>>, x: i32, y: i32, w: i32, h: i32) -> u8 {
    let mut count = 0;
    for (dx, dy) in &NEIGHBORS8 {
        let nx = x + dx;
        let ny = y + dy;
        if nx >= 0 && nx < w && ny >= 0 && ny < h && is_foreground(pixels[ny as usize][nx as usize]) {
            count += 1;
        }
    }
    count
}

/// 查找所有交叉点（8邻域有3个及以上前景像素的点）
fn find_junctions(pixels: &Vec<Vec<u8>>, w: i32, h: i32) -> Vec<(i32, i32)> {
    let mut junctions = Vec::new();
    for y in 0..h {
        for x in 0..w {
            if is_foreground(pixels[y as usize][x as usize]) {
                if count_neighbors(pixels, x, y, w, h) >= 3 {
                    junctions.push((x, y));
                }
            }
        }
    }
    junctions
}

/// 查找所有端点（8邻域只有1个前景像素的点）
fn find_endpoints(pixels: &Vec<Vec<u8>>, w: i32, h: i32) -> Vec<(i32, i32)> {
    let mut endpoints = Vec::new();
    for y in 0..h {
        for x in 0..w {
            if is_foreground(pixels[y as usize][x as usize]) {
                if count_neighbors(pixels, x, y, w, h) == 1 {
                    endpoints.push((x, y));
                }
            }
        }
    }
    endpoints
}

/// 计算某像素的邻居数
fn neighbor_count(pixels: &Vec<Vec<u8>>, x: i32, y: i32, w: i32, h: i32) -> u8 {
    count_neighbors(pixels, x, y, w, h)
}

/// 从指定点追踪一条路径，直到遇到端点或交叉点
/// 关键：交叉点像素不标记为 visited，允许多条路径共享同一交叉点坐标
fn trace_from(
    pixels: &Vec<Vec<u8>>,
    start: (i32, i32),
    visited: &mut Vec<Vec<bool>>,
    junctions: &[(i32, i32)],
    w: i32,
    h: i32,
) -> Polyline {
    let mut polyline = Vec::new();
    let (mut cx, mut cy) = start;
    polyline.push((cx as f64, cy as f64));

    // 起点如果是普通像素（2邻居）或端点（1邻居），标记 visited
    // 交叉点（3+邻居）不标记
    if neighbor_count(pixels, cx, cy, w, h) < 3 {
        visited[cy as usize][cx as usize] = true;
    }

    loop {
        // 是否到达交叉点（且不是起点）
        let is_junction = junctions.contains(&(cx, cy));
        if is_junction && polyline.len() > 1 {
            break;
        }

        // 寻找下一个未访问的前景像素
        let mut next: Option<(i32, i32)> = None;
        for (dx, dy) in &NEIGHBORS8 {
            let nx = cx + dx;
            let ny = cy + dy;
            if nx >= 0 && nx < w && ny >= 0 && ny < h
                && is_foreground(pixels[ny as usize][nx as usize])
                && !visited[ny as usize][nx as usize]
            {
                next = Some((nx, ny));
                break;
            }
        }

        match next {
            Some((nx, ny)) => {
                cx = nx;
                cy = ny;
                polyline.push((cx as f64, cy as f64));

                // 只标记普通像素（2邻居）和端点（1邻居）为 visited
                // 交叉点（3+邻居）不标记，等待所有出边追踪完毕
                let nc = neighbor_count(pixels, cx, cy, w, h);
                if nc < 3 {
                    visited[cy as usize][cx as usize] = true;
                }
                // 到达端点或交叉点 → 停止当前路径
                if nc == 1 || nc >= 3 {
                    break;
                }
            }
            None => break,
        }
    }

    polyline
}

/// 追踪闭环（没有端点的情况）
fn trace_loop(
    pixels: &Vec<Vec<u8>>,
    start: (i32, i32),
    visited: &mut Vec<Vec<bool>>,
    w: i32,
    h: i32,
) -> Polyline {
    let mut polyline = Vec::new();
    let (mut cx, mut cy) = start;
    let (sx, sy) = start;

    loop {
        visited[cy as usize][cx as usize] = true;
        polyline.push((cx as f64, cy as f64));

        let mut next: Option<(i32, i32)> = None;
        for (dx, dy) in &NEIGHBORS8 {
            let nx = cx + dx;
            let ny = cy + dy;
            if nx >= 0 && nx < w && ny >= 0 && ny < h
                && is_foreground(pixels[ny as usize][nx as usize])
            {
                if nx == sx && ny == sy && polyline.len() > 2 {
                    // 回到起点，闭环完成
                    polyline.push((sx as f64, sy as f64));
                    return polyline;
                }
                if !visited[ny as usize][nx as usize] {
                    next = Some((nx, ny));
                    break;
                }
            }
        }

        match next {
            Some((nx, ny)) => {
                cx = nx;
                cy = ny;
            }
            None => break,
        }
    }

    polyline
}

/// 骨架追踪主函数
/// 将细化后的骨架图像追踪为一组折线段
fn trace_skeleton(binary: &GrayImage) -> Polylines {
    let (w, h) = binary.dimensions();
    let w_i32 = w as i32;
    let h_i32 = h as i32;

    // 转换为 Vec<Vec<u8>> 方便索引
    let pixels: Vec<Vec<u8>> = (0..h)
        .map(|y| (0..w).map(|x| binary.get_pixel(x, y)[0]).collect())
        .collect();

    let mut visited: Vec<Vec<bool>> = vec![vec![false; w as usize]; h as usize];
    let mut polylines: Polylines = Vec::new();

    let junctions = find_junctions(&pixels, w_i32, h_i32);

    // 1. 从所有端点开始追踪
    let endpoints = find_endpoints(&pixels, w_i32, h_i32);
    for &(ex, ey) in &endpoints {
        if visited[ey as usize][ex as usize] {
            continue;
        }
        let polyline = trace_from(&pixels, (ex, ey), &mut visited, &junctions, w_i32, h_i32);
        if polyline.len() >= 8 {
            polylines.push(polyline);
        }
    }

    // 2. 处理未访问的交叉点 → 从交叉点出发，为每个未访问的出边追踪
    for &(jx, jy) in &junctions {
        // 收集从此交叉点出发的未访问方向
        for (dx, dy) in &NEIGHBORS8 {
            let nx = jx + dx;
            let ny = jy + dy;
            if nx >= 0 && nx < w_i32 && ny >= 0 && ny < h_i32
                && is_foreground(pixels[ny as usize][nx as usize])
                && !visited[ny as usize][nx as usize]
            {
                let mut polyline = Vec::new();
                polyline.push((jx as f64, jy as f64));
                let rest = trace_from(&pixels, (nx, ny), &mut visited, &junctions, w_i32, h_i32);
                polyline.extend(rest);
                if polyline.len() >= 8 {
                    polylines.push(polyline);
                }
            }
        }
        visited[jy as usize][jx as usize] = true;
    }

    // 3. 处理闭环（没有端点也没有交叉点的独立环）
    for y in 0..h_i32 {
        for x in 0..w_i32 {
            if is_foreground(pixels[y as usize][x as usize])
                && !visited[y as usize][x as usize]
            {
                let polyline = trace_loop(&pixels, (x, y), &mut visited, w_i32, h_i32);
                if polyline.len() >= 8 {
                    polylines.push(polyline);
                }
            }
        }
    }

    // 过滤掉过短的折线（< 3 个像素的噪声）
    // 过滤噪声碎片（< 8 像素的折线）
    polylines.retain(|p| p.len() >= 8);

    polylines
}
