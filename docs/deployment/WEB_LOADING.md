# Web 启动加载界面

2026-10-31：Web HTML壳使用深青绿、暖白、黄褐色，程序矢量山路和方格终点线；沿用游戏的平面印刷风格，无新增图片/字体依赖。

首页资源条按封面解码与readiness检查两项完成计数，不阻止用户点击驾驶。游戏壳在引擎JS到达前已显示，随后用户点击进入赛道才下载WASM/PCK。百分比来自Godot已读取的字节数，分母使用导出config.fileSizes的完整资源总量，防止首个文件下载完就误显示100%。MiB明确为解压后读取量，不冒充实际网络流量或下载速度。资源完成后改为无百分比的引擎准备阶段；startGame成功后立即交给游戏画面。

20秒没有进展时提示慢连接并显示重新加载入口；错误保留返回/重试操作，迟到进度不能覆盖失败；减少动态效果关闭扫描动画。不会人为计时填充进度，也不承诺缩短首次下载时间。

后续Godot导出自动使用web-shell/index.html。为更新既有游戏包的外壳，可在托管服务指定GAME_SHELL=/app/web-shell/index.html；服务器从manifest列出的既有导出HTML读取配置，用新壳返回no-cache HTML，WASM/PCK/存档origin与旧版本资源不变。未设置该变量时继续服务原导出HTML。模板/导出格式不匹配会安全返回500，不回退到猜测配置。容器包含web-shell目录。

验证：npm run web:check（44项）；node scripts/web/check-shell.mjs（总量、阶段、失败、模板及HTTP）；Chrome真实启动到车牌设置页。仅HTML/CSS/JS壳修改，无Godot运行资源改变，无需重新导入桌面游戏资源。
