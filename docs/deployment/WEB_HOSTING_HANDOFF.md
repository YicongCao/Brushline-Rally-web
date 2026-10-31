# Brushline Rally Web · 运维部署手册

更新：2026-10-31。本文对应独立仓库 **[YicongCao/Brushline-Rally-web](https://github.com/YicongCao/Brushline-Rally-web)**，替代先前仅有接口设想的交接报告。浏览器验证结果及未验收项见 [验证记录](../validation/web/VALIDATION.md)。

## 部署边界

Node.js 托管首页、Godot 导出资源及健康接口。物理、渲染、音频和存档均在玩家浏览器执行。服务器不运行 Godot、不需要 GPU，也没有账号、数据库或云存档接口。首次部署先使用预发布域名；Chrome 启动成功不等于全部浏览器和全部赛道验收完成。

本仓库保留源项目 Git 历史，分叉基线为 `5d5c2c695c9bd1dca41f92d701f97e4752f18814`。GitHub 不允许同一账号原生 fork 自己的仓库，因此它是独立仓库而非 GitHub fork network 成员。`origin` 指向 Web 仓库，`upstream` 指向桌面仓库；不向桌面工程合并 Web 修改。

## 已提供的交付物

- `web-host/server.mjs`：Express 5 静态服务，锁定依赖于 `package-lock.json`。
- `web-host/site/`：独立首页；只发布此目录及清单允许的游戏资源，不发布仓库根目录。
- `export_presets.cfg` 中的 `Web`：Godot 4.7.2、Compatibility / WebGL 2、单线程、禁用 PWA。
- `web-shell/index.html`：点击启动、加载进度、失败重试、全屏及返回网页。
- `scripts/web/build.mjs`：匹配引擎版本、拒绝默认脏构建、导入与导出日志、预压缩、SHA-256 清单、完整包原子落盘。
- `scripts/web/activate.mjs`：逐文件校验并原子切换当前版本；同一命令切回旧版本。
- `scripts/web/check.mjs`：HTTP 合约与发布回滚检查，不模拟游戏性能。
- `web-host/Dockerfile`、`web-host/compose.yaml`：非 root 容器与只读挂载示例。本机 Docker daemon 未运行且 Compose 子命令不可用，容器尚未实测。

`builds/` 被 Git 忽略，源码克隆不包含游戏二进制。部署时必须先构建或接收完整构建目录；仅 `npm start` 可以上线首页，但 `/readyz` 会返回 503。

## 本地构建

构建机安装 `.godot-version` 指定的 Godot **4.7.2**、Node.js **26.x**、Python 3（安装模板用）。Node 服务也允许 24.x / 25.x；本轮验证使用 26.1.0。生产使用受支持的最新补丁版并另行记录。

```bash
git clone git@github.com:YicongCao/Brushline-Rally-web.git
cd Brushline-Rally-web
npm ci
python3 scripts/web/install_templates.py
npm run web:check
npm run web:build
```

模板安装器仅从 Godot 官方 GitHub release 按 HTTP Range 提取匹配版本的两个单线程 Web ZIP，并验证 ZIP 完整性；不关闭 TLS 校验。已安装模板会跳过。需要覆盖路径时设置 `GODOT_TEMPLATE_DIR`；引擎命令通过 `GODOT_BIN` 指定。

正常发布必须使用干净提交。`npm run web:build -- --allow-dirty` 仅用于开发，清单将标记 `source_dirty=true`。运维不应激活这种包到生产。导入和导出日志保存在 `logs/web-import.log`、`logs/web-export.log`；非零退出或引擎错误均使构建失败。

输出为 `builds/web/<build-id>/`。构建 ID 默认包含源码提交和 UTC 时间，禁止覆盖已有 ID；不要改名导出的 JS/WASM/PCK。`build-manifest.json` 记录源码提交、引擎、线程模式、渲染器、文件大小及 SHA-256。每个目录必须整体传输，包括 worklet JS、图标和压缩副本。不要把 `.staging-*` 临时目录作为发布包。

```bash
npm run web:activate -- <build-id>
HOST=127.0.0.1 PORT=3080 npm start
curl -fsS http://127.0.0.1:3080/healthz
curl -fsS http://127.0.0.1:3080/readyz
```

浏览器打开 `http://127.0.0.1:3080/`，点击“开始驾驶”再“进入赛道”。非本地用户访问必须由 HTTPS 反向代理提供入口，确保音频工作线程等浏览器能力可用。

## 环境变量与目录

- `HOST`：默认 `127.0.0.1`。容器内使用 `0.0.0.0`，宿主端口只绑定 loopback。
- `PORT`：默认 `3000`，示例使用 `3080`。
- `SITE_ROOT`：默认项目内 `web-host/site`。
- `GAME_RELEASE_ROOT`：默认项目内 `builds/web`。
- `CURRENT_MANIFEST`：默认 `builds/web-state/current.json`，内容为 `{"build_id":"...","activated_at":"..."}`。
- `BUILD_ID`：构建时可指定，限安全字母数字、点、下划线和短横线，最长 96 字符。

生产建议 `/srv/brushline-web/releases/<build-id>/` 和 `/srv/brushline-web/state/current.json`，服务账户仅需读取。发布账户需要写入版本目录及 state 父目录；激活脚本用同目录临时文件 + rename，state 必须挂载目录而非单个 JSON 文件。临时指针为 0600，发布与服务应使用同一 UID，或者在受控权限下授予服务账户读取，避免容器读取不到指针。

不要将 `SITE_ROOT` 设为仓库根目录，也不要把 `user://` 数据同步到公开路径。该服务没有上传或管理 HTTP API。

## Docker 路径（可选，待目标机验证）

先构建 Web 游戏，再构建 Node 镜像。镜像不包含 Godot 或大游戏资源：

```bash
docker compose -f web-host/compose.yaml build
docker compose -f web-host/compose.yaml run --rm \
  --volume "$PWD/builds/web-state:/srv/state:rw" web \
  node scripts/web/activate.mjs <build-id>
docker compose -f web-host/compose.yaml up -d
```

运行容器为 UID 1000。Linux 部署前由运维创建并设置 state 目录归属及版本目录读取权限；应以 UID 1000 的一次性发布容器激活。若 Docker Compose 同一挂载目标的覆盖行为不兼容，使用下面明确的 `docker run`，不要把长期服务的挂载改为可写：

```bash
docker build -f web-host/Dockerfile -t brushline-rally-web:local .
docker run --rm \
  -v "$PWD/builds/web:/srv/releases:ro" \
  -v "$PWD/builds/web-state:/srv/state:rw" \
  brushline-rally-web:local node scripts/web/activate.mjs <build-id>
```

Compose 只向宿主 `127.0.0.1:3080` 暴露服务。根文件系统只读、移除 capabilities，`/tmp` 是有限大小临时内存目录。镜像健康检查检查 `/healthz`；发布流水线还必须检查 `/readyz` 和真实浏览器。

## HTTPS 反向代理

在现有 HTTPS 站点添加独立虚拟主机，代理整个站点到 `http://127.0.0.1:3080`。不要覆盖已有站点，不额外开放 Node 端口到公网。保留浏览器请求的 `Accept-Encoding`、`Range` 及响应的 `Content-Type`、`Content-Encoding`、`Cache-Control`、`Vary`。

Nginx 的核心 location 示例（TLS 与域名使用运维现有配置）：

```nginx
location / {
    proxy_pass http://127.0.0.1:3080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 120s;
    proxy_intercept_errors off;
}
```

不做 SPA fallback，不对 `.wasm`/`.pck` 返回首页，不强制将所有文件设为 `text/html`，不对预压缩资源再次压缩。若 CDN 单文件限制小于 PCK，请调整缓存策略或直接代理；不要拆坏导出文件。缓存规则以完整 build ID URL 为键，不忽略版本路径；`/play/`、健康接口和 HTML 不强制长缓存。

服务的游戏资源 MIME 为：WASM `application/wasm`，PCK `application/octet-stream`，JS `text/javascript`。支持 Brotli / gzip 协商，附带 `Vary: Accept-Encoding`；Range 在允许 identity 时返回原始文件。缺失资源 404，非法方法 405。首页静态资源短缓存，版本资源一年 immutable，HTML `no-cache`。

当前为单线程，不要求 COOP/COEP。未来启用线程必须重新导出并将清单 `threads` 正确设为 true；服务会为该版本发送 COOP `same-origin` 与 COEP `require-corp`。不能仅编辑清单来“开启线程”，也不要让代理删除这些头。首版没有 Service Worker/PWA，减少旧资源驻留问题。

## 激活、回滚与下线

1. 上传完整版本目录到暂存目录，完成后在同一文件系统 rename 到 `<build-id>`。
2. 在发布账户运行 `web:activate`，它检查每个文件的大小及 SHA-256，失败不会改当前指针。
3. `/readyz` 应返回预期 build ID，`/play/` 应 302 到该版本。
4. 用新浏览器页面验证资源、声音、进入驾驶、暂停/恢复和存档，再对外公告。
5. 回滚运行相同命令，传入上一个已验收 ID；不覆盖文件、不重建老包、不重启服务。

旧版本资源需要保留，已经打开的旧页面仍会请求它们。仅在无使用者且保留期结束后清理。下线玩法时移走当前指针可让新 `/play/` 请求返回 503，首页仍在；这不会强制结束已打开的旧版本。真正紧急下线需由代理禁用 `/play/*`，并明确影响正在运行的玩家。

`/readyz` 的 `ready` 仅表示清单完整且文件存在/大小正确，并非实时哈希或 GPU/驾驶检查。`game_verified` 默认为 false；本实现不自动伪造浏览器验收结果，详细结果看验证文档。生产验收流程可关联外部验收记录，切勿仅修改标志来充当验证。

## 浏览器行为与待补验收

- 渲染采用 Compatibility，离屏画面限制在 1280×720 范围，默认简化植被并关闭镜头光斑；保留 120 Hz 车辆物理，未降低物理步频冒充帧率提升。
- Web 使用单独存档目录，不迁移桌面文件。浏览器 IndexedDB 保存进度，不同浏览器/域名之间不共享；清除站点数据会丢失进度。应保持发布 origin 和项目存档路径稳定。
- 首次点击允许游戏启动；若浏览器拦截音频，需要在游戏里再次交互。切后台时静音、暂停驾驶及 Demo，回来后由玩家主动继续。
- 遥测导出在浏览器触发一个 ZIP 下载，内含 CSV 和 JSON；其他相册数据目前仍留在浏览器档案中。
- 全量内容保留，不将它描述为已完成的轻量单赛道体验。首包、3 个场景同时驻留的 Demo 和软沙物理仍需性能实测。
- 上线门槛：Chrome / Firefox / Safari，键鼠与实体手柄，720p / 1080p，首次与缓存启动，存档跨刷新/版本、声音、长时间驾驶、Demo、后台恢复、WebGL 丢失提示。尚未完成项见验证文档。

参考：[Godot Web 导出](https://docs.godotengine.org/en/4.7/tutorials/export/exporting_for_web.html)、[自定义 HTML shell](https://docs.godotengine.org/en/4.7/tutorials/platform/web/customizing_html5_shell.html)、[音频设置](https://docs.godotengine.org/en/4.7/classes/class_projectsettings.html#class-projectsettings-property-audio-general-default-playback-type-web)。
