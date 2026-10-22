# 这一场

手机优先的演员私人试演本。React + TypeScript + Vite，原生 IndexedDB 保存文字与视频 Blob；没有业务后台、AI 自动解读、统计追踪或上传接口。

## 手机网页

这是 H5 网页，不是需要下载安装的原生 App。

- 手机网页地址：<https://zhanyina1205-ai.github.io/one-scene/>
- 公开源码：<https://github.com/zhanyina1205-ai/one-scene>
- iPhone：用 Safari 打开，点“分享 → 添加到主屏幕”。
- Android：用 Chrome 打开，可在浏览器菜单选择“添加到主屏幕”；具体菜单随浏览器版本不同。
- 配置了独立窗口展示、主屏图标和手机视口，但没有离线缓存；添加到主屏幕不代表备份或离线可用。主屏模式仍需真机验证。

GitHub 仓库和 Pages 程序是公开的，首次提供的只有虚构演示。你输入的剧本、笔记和视频不会随 GitHub 提交或 Pages 发布上传。原私有托管站点与 GitHub Pages 是不同来源，数据不会自动迁移，请固定使用一个入口。

## 运行

需要 Node.js 22.12+ 或 24+。

```sh
git clone https://github.com/zhanyina1205-ai/one-scene.git
cd one-scene
npm ci
npm run dev
```

电脑打开 `http://localhost:5188/`。手机与电脑同一局域网时，打开终端输出的 Network 地址。电脑需保持运行且防火墙允许访问。

手机局域网 **HTTP 只能录入、导入和回放，不能保证网页摄录**。手机直接录制请用 HTTPS 手机网页，在正常模式的 Safari / Chrome 中打开。不要把手机自己的 localhost 当作电脑地址。原私有托管入口仍需网站所有者账号。

```sh
npm test
npm run build
npm run preview
```

生产输出在 `dist/`，可部署到 HTTPS 静态托管。所有业务数据仍留在访问网站的浏览器内；本地、线上、不同浏览器和不同设备之间不会同步。

## GitHub 同步与发布

推送到 `main` 会执行 `.github/workflows/pages.yml`：安装锁定依赖、运行测试、构建、发布 `dist/` 到 GitHub Pages。拉取请求只做测试构建，不发布。也可以在 Actions 中手动运行该工作流。

```sh
git add .
git commit -m "Update mobile web app"
git push origin main
```

发布前检查暂存文件，勿提交真实剧本、视频、个人笔记或密钥。视频、数据库、备份目录和 `.env` 默认忽略。浏览器里的 IndexedDB 不在源码目录中，GitHub 同步的是代码，不是用户数据。

Vite 使用相对资源路径；根域名与 `/one-scene/` 子路径都能部署，主页图标和 manifest 也使用相对路径。没有配置云端数据同步或自动双向合并源码。

## 已实现

- 四页：今日、戏前卡、试演台、我的处理；支持空白项目与场次新增、编辑、删除。
- 前情、角色已知 / 误以为知道 / 待确认信息，分别记录原文依据或本人确认。无依据且未本人确认时仍展示为待确认。
- 原文手动粘贴，按明确的“我：”“对手：”“动作：”标记拆分练习段落，支持遮住本人台词。
- 戏前卡直接携带场次进入试演台；A/B 出发点、试后感受、摄录或视频导入、原片下载、预览与重新录制。
- 切换 A/B 对照；播放另一条视频时暂停之前的视频，避免叠音。
- 保存 A、B 或保留两版，个人理由准确回写；历史保留完整的场次、版本、两版想法、媒体引用、笔记与时间快照。
- 草稿自动保存与手动重试；导航前等待保存，摄录和未处理片段阻止误离开。页面关闭由浏览器提供未保存提示，不承诺拦住系统强杀。
- 更新原文、处境或版本后提醒复查旧处理，不自动套用新版本。旧草稿可明确替换为当前版本的新草稿。
- IndexedDB 跨文字与媒体的事务保存，失败不更新“已保存”状态；空间不足、授权拒绝、缺少摄录能力、文件无法解码均提供提示。
- 视频保存失败时暂留本页，可重试、先下载或主动放弃；文字仍需用户在失败页重试，不能关闭页面后找回未保存输入。
- 删除前明确确认，媒体仅在不再被任何历史或草稿引用后回收。历史视频按需读取，不在所有折叠记录中预加载。
- 首次只提供《渡桥》/ 沈知微的三场虚构演示，无真实演员资料。

## 数据与隐私

数据库：`one-scene-private-v1`。`workspace` 储存项目 / 场次 / 草稿 / 历史 / 笔记；`media` 储存视频 Blob。没有视频 localStorage，没有默认网络上传。

本地存储不是云备份，也不是加密保险箱。清理网站数据、无痕模式、系统回收空间或更换网址 / 浏览器，都可能导致内容无法恢复。重要视频请下载原片。MVP 没有整库备份、跨设备迁移、离线缓存或云同步；请避免多个标签页同时修改同一份数据。

## 验证

详见 `QA.md`：区分实际浏览器操作、自动化模拟和尚未验证的真机项目。不能把开发机上的导入验证等同于 iPhone / Android 真机摄录验证。

浏览器 API 约束参考：[getUserMedia 安全上下文](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)、[MediaRecorder 格式支持](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static)、[IndexedDB 事务](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)。
