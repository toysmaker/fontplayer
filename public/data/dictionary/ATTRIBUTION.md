# 字义数据来源与许可说明

本目录中的汉字读音/释义数据基于以下来源，并经修改（中文翻译）：

## 原始来源
- **Unicode Unihan 数据库**（kDefinition 等字段），经 **Make Me a Hanzi**
  （makemeahanzi, github.com/skishore/makemeahanzi）整理收录于其
  `dictionary.txt`；
- 数据适用 **Unicode License**（见 LICENSE.UNICODE.txt）：
  允许免费使用、复制、修改、发布与销售，条件是保留版权与许可声明、
  在文档中附上声明、并对修改过的数据作明确标记。

## 修改内容
- 为每条英文释义新增中文字段 `definitionZh`（人工翻译）；
- 精简字段：仅保留 `character`、`pinyin`、`definitionZh`，并按 Unicode
  码点重建索引。

## 许可文件
- LICENSE.UNICODE.txt — Unicode 数据文件许可全文
- LICENSE.APL.txt — Arphic Public License（makemeahanzi 仓库附带的图形数据许可；
  本数据仅使用其文字释义部分，不包含字形图形）
