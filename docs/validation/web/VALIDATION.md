# Web 版验证记录

日期：2026-10-31。独立仓库：`YicongCao/Brushline-Rally-web`。本轮为可部署原型验收，不是桌面版全功能或全浏览器发行认证。

## 已通过

- Node.js 26.1.0 / Express 5.3.0：`npm run web:check`，44 项检查通过。覆盖首页/试玩 readiness、302 版本入口、WASM MIME、gzip/Brotli 协商、Range/HEAD、缺失资源、非法路径、符号链接限制、哈希校验失败、激活及回滚、旧资源仍可访问。
- `npm audit --omit=dev`：0 个已报告依赖漏洞。
- Godot 4.7.2 官方单线程 Web 模板：实际导入、导出成功；输出真实 WASM/PCK/JS/worklet 等资源，逐文件大小和 SHA-256 检查通过。
- 原生 Jolt 冒烟：`tests/smoke_test.gd`，6 项通过；保持 120 Hz。
- 原生设置检查：`tests/settings_test.gd`，12 项通过。
- 原生 Compatibility / CoreAudio 音频：`tests/first_playable_audio_check.gd`，29 项通过，包含音乐、领航语音、暂停、回放及静音。**这不等价于 Web 输出声音质量已测量。**
- Chrome 实际浏览器：从 Node 首页点击启动，填写 `WEBTEST` 测试车牌，进入主菜单、四赛道页与选车页，松岭 / R200 场景加载并响应油门，HUD 观测到 13 km/h；暂停菜单可用。新 build ID 页面恢复先前车牌，未重新要求注册车牌。
- 浏览器的开发者控制台确认 `WebGL 2.0 / Compatibility`、`single-threaded, no GDExtension support`。

## 实测发现并修正

首次 Web 运行暴露重复 `stream_paused=false` 的问题：Web Sample 音频重复分配长循环音频缓冲区，出现 `createBuffer(2, 1462857, 48000) failed` 并卡住。音频导演、车辆反馈及 Demo 音频改为状态变化时才更新。新页面重新加载后可以操作及驾驶；该次驾驶控制台没有上述错误，Chrome 标签页显示约 661 MB。该数字是一次 UI 观测，**不是内存峰值或无泄漏证明**。

桌面天空材质依赖 half-resolution sky pass，浏览器场景出现黑色天空。新增 Web 单 pass 材质，复用原有天空配色和云图集。最终构建的画面复核结果补录于下。

## 交付包与限制

- 构建清单位于 `builds/web/<build-id>/build-manifest.json`，构建目录被 Git 忽略。
- 资源预压缩采用 Brotli 与 gzip；开发包 WASM 约 38 MiB / Brotli 约 7.9 MiB，PCK 约 58 MiB / Brotli 约 55 MiB。全量首包仍偏大，后续优先按赛道/车辆拆包。
- `game_verified` 保持 false。`/readyz` 只表示文件完整可供服务，不能充当全功能、性能或音频验收。
- 未部署公网域名；未改动任何现有线上站点、端口或 Tunnel。
- Docker CLI 存在，但 daemon 不可用、Compose 子命令未安装；Docker/Compose 示例没有运行验收。
- 尚未测量真实 Web 音频输出、长时间内存、帧时间、完整比赛和 75 秒 Demo；Firefox / Safari / 移动端 / 实体手柄均未验收。不要宣称稳定 60 FPS 或全平台可玩。
- 相册浏览保留，照片目前仍在浏览器档案内；遥测 ZIP 的浏览器下载实现尚未完成点击下载验收。
- 原桌面工作树与常用目录保留原提交，Web 修改仅在新的常用工程目录内。

## 复验

```bash
npm ci
npm run web:check
npm run web:build
npm run web:activate -- <build-id>
PORT=3080 npm start
```

浏览器使用 `http://127.0.0.1:3080/`，通过实际键鼠完成“首页 → 点击启动 → 主菜单 → 自由练习 → 松岭 → R200 → 驾驶 → 暂停 → 继续 → 切走标签页 → 返回后主动继续”。再刷新页面验证车牌保留；生产使用相同 HTTPS origin 跨版本验证存档。
