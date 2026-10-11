# CurseForge

Celestial Launcher 的内容源插件（id：`curseforge`）。

CurseForge 的模组、光影、资源包与整合包。需要 API Key 才能使用，搜索与安装走 CurseForge 官方 API，文件从 CurseForge CDN 下载。

## 提供的内容

- 模组（`mod`）
- 整合包（`modpack`）
- 资源包（`resourcepack`）
- 光影（`shader`）
- 数据包（`datapack`）

## 构建

```bash
pnpm install
pnpm build      # 产出 dist/index.js
pnpm typecheck  # 类型检查
```

## 类型

`types/content-source.d.ts` 是启动器内容源接口的**副本**，权威版本在
[Celestial-Plugin-Store](https://github.com/Wemsur/Celestial-Plugin-Store) 的 `sdk/` 下。
它只提供类型，没有运行时代码——构建产物里不含任何对它引用。

## 需要访问的域名

插件通过启动器的网络代理发请求，只能访问 `manifest.json` 里声明过的域名：

- `api.curseforge.com`
- `edge.forgecdn.net`
- `mediafilez.forgecdn.net`
- `www.curseforge.com`
- `mod.mcimirror.top`

## 发布

打一个 `x.x.x` 或 `vx.x.x` 的 tag 并推送即可。工作流会构建、校验 tag 与
`manifest.json` 的版本一致、打包成 **`curseforge.zip`**（不带版本号）挂到 Release。

商店索引里的下载地址指向 `releases/latest/download/curseforge.zip`，所以**发布新版不需要
改商店**——启动器通过该链接所在的 Release 自动获得新版本。
