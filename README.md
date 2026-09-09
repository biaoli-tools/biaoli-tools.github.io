# 表理工具

面向中文用户的 Excel 与 CSV 本地整理工具站。所有文件默认只在浏览器中处理，不依赖后端。

## 首发工具

- CSV / Excel 互转
- Excel / CSV 去重
- Excel 多文件合并
- Excel 按列拆分
- 表格差异对比

站点还包含“关于与反馈”、隐私政策、使用条款、开源许可和 404 页面。

## 本地预览

需要 Node.js 20 或更高版本，以及 Python 3：

```bash
npm run build
npm test
npm run serve
```

然后访问 `http://localhost:4173/`。不要直接双击 HTML 文件，因为站点使用根路径资源和 JavaScript 模块。

## 目录

- `src/`：样式、工具逻辑、内置依赖和测试样例
- `scripts/build.mjs`：生成全部静态页面、SEO 文件与 `_site`
- `tests/`：不依赖外部 npm 包的数据与页面规则测试
- `.github/workflows/`：GitHub Pages 构建和发布流程
- `_site/`：运行 `npm run build` 后生成的部署产物

## 部署到 GitHub Pages

1. 将整个目录内容上传到 `biaoli-tools/biaoli-tools.github.io` 仓库的 `main` 分支。
2. 在仓库 `Settings > Pages` 中将来源设为 `GitHub Actions`。
3. 推送后等待 `Deploy GitHub Pages` 工作流完成。
4. 打开 `https://biaoli-tools.github.io/`，检查首页、五个工具和下载样例。

这是组织根站，代码中的 canonical、站点地图和资源路径均按根路径 `/` 配置。若以后换域名，需要在 `scripts/build.mjs` 修改 `site` 常量，并按实际域名增加 `CNAME`。

## 上线检查

- [ ] 五个工具可载入样例、生成预览并下载结果
- [ ] CSV 中文编码、前导 0、引号和换行已抽查
- [ ] 去重的保留首条/末条与审计表正确
- [ ] 合并顺序、不同表头和多工作表模式正确
- [ ] 拆分文件名、空值组和 ZIP 下载正确
- [ ] 对比的新增、删除、修改、未变化分类正确
- [ ] 手机与桌面布局无横向溢出，键盘可操作
- [ ] `robots.txt`、`sitemap.xml`、canonical 与线上域名一致
- [ ] 隐私、条款和开源许可页面可访问
- [ ] 未配置真实 ID 前，不启用统计或广告脚本

## 已实现的安全与兼容规则

- 单个文件超过 20 MB 时显示性能提醒，超过 50 MB 时拒绝处理。
- 多文件任务一次最多处理 50 个文件，累计不能超过 200 MB。
- 五个工具都可选择 UTF-8、GBK / GB18030 或 Big5 来读取 CSV 和 TSV。
- CSV 默认将以 `=`、`+`、`-`、`@` 开头的内容按文本导出，降低表格公式注入风险。
- XLSX 日期统一输出为 `YYYY-MM-DD` 或带秒的日期时间，并兼容 1900、1904 两种日期系统；公式保留为公式文本。
- 对比工具发现重复关键值时会停止处理并提示数据行，避免静默遗漏记录。
- XLSX 只读取每个工作簿的第一张表；旧版 `.xls` 需先另存为 `.xlsx`。
- 不保留宏、图表、数据透视表、外部链接、数字格式和复杂样式。

运行 `npm run check` 会重新构建站点并执行数据规则、SEO 输出、本地链接和 XLSX 结构测试。真实浏览器上传、下载与手机布局仍应在上线前人工走查。

## 依赖与许可

- JSZip 3.10.1，MIT 或 GPL-3.0-or-later；本站按 MIT License 使用

完整许可文本位于 `LICENSES/`。第三方脚本随站点托管，不从公共 CDN 动态加载。XLSX 基础读写由项目内的轻量模块完成，首版不支持旧版 `.xls` 文件，也不保证复杂格式和公式保真。
