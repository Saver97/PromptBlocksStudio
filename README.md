# PromptBlocksStudio · 提示词积木

面向 ComfyUI 等生图工具的 Windows 提示词桌面工作台。用标签块、自然语言块和可复用组合组织正负面提示词，最后复制到自己的生图工作流。

应用独立运行，不需要启动 ComfyUI。标签组装、方案管理和导入导出可以离线使用；中文翻译可选本地模型，中文润色使用自行配置的 LLM 接口。

## 能做什么

- **分块组装**：角色、服装、场景、光照、画师串、负面约束等分类；整块启停、调权重、复制和排序。
- **标签选择**：中英文搜索、分类筛选、收藏，点一次加入，再点取消。每个块也可以直接输入词库中没有的提示词。
- **整组配方**：从词库配方中选一整组加入当前块；保留原有权重，加入后可逐词编辑。
- **方案与组合**：保存多套完整方案，将常用内容存为组合；支持 JSON 备份与导入。初次运行是一个空白方案，不含个人方案、收藏或自建组合。
- **角色占位符**：在角色定义中设置 `A`、`B`，自然语言使用 `{{A}}`、`{{B}}`；复制时展开角色姓名和可选身份、外貌介绍。
- **翻译与润色**：中英文对照、角色指代提醒、替换标记、返回结果预览及停止请求。结果未通过检查时也能查看返回内容，自行决定是否采用。
- **输出检查**：支持 ComfyUI、NAI 和纯文本格式；相同文本与权重去重，权重冲突及正负重复会提示。
- **桌面体验**：六套配色、撤销/重做、原生剪贴板、文件导入导出。

内容块用于组织文本，不提供人物区域绑定、姿势控制或种子一致性保证。记录的模型与采样参数用于查阅和复制，不会自动提交生成任务。

## 从源码启动

开发验证环境为 Windows x64、Python 3.10。需要安装 [Microsoft .NET 8 Desktop Runtime](https://dotnet.microsoft.com/download/dotnet/8.0) 和 [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)。

在项目根目录运行 PowerShell：

```powershell
py -3.10 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe desktop.py
```

前端为原生 HTML/CSS/JavaScript，无需 Node.js 构建。Node.js 仅用于运行前端逻辑测试。

## 基本操作

1. 选中中间的内容块，从左侧词库添加标签，或直接在块底部输入提示词。`Enter` 加入，`Shift+Enter` 换行。
2. 左侧切换到“词库配方”，可以预览并把整组词加进当前块；再次点击会撤销该次整组添加。
3. 用“另存为方案”保存完整方案；用“整套存入组合库”保存可以复用的组合。两者用途不同。
4. 如需中文动作描述，先打开“角色定义”，再添加“自然语言”块。用输入框上方的按钮插入 `{{A}}`、`{{B}}`。
5. 在翻译设置中配置离线翻译或 API。润色结果先预览，再决定是否采用；修改中文后需重新更新英文。
6. 在右侧复制正面或负面提示词，粘贴到生图工具。`Ctrl+K` 搜索，`Ctrl+Z` 撤销，`Ctrl+Shift+Z` 重做。

## API 设置

使用 **Responses 格式**。填写供应商给出的 Base URL、模型 ID 和自己的 Key；也可以点击获取模型列表。若供应商没有 `/models`，直接手动填写模型 ID。

- `https://example.com` → 请求 `https://example.com/responses`。
- `https://example.com/v1` → 请求 `https://example.com/v1/responses`。
- 已填写完整 `/responses` 地址时不重复添加路径；程序不会擅自插入 `/v1`。
- 当前请求使用 `reasoning.effort=low`、`stream=false`、`store=false`；供应商需要支持这些字段及 Responses 响应结构。
- “停止”会取消本地请求并尝试关闭连接；服务端是否停止计算由供应商实现决定。

仅在主动执行接口翻译、润色或获取模型列表时访问所配置的服务。润色会发送当前文本及当前方案的角色定义。API Key 使用 Windows DPAPI 加密保存在本机，不包含在仓库中；换 Windows 用户或设备时应重新填写。

## 可选：本地离线翻译

离线模块使用 **OPUS-MT 中译英 + CTranslate2 INT8 CPU 推理**，不占用生图显存。它是翻译模型，不负责 LLM 中文润色；复杂动作与代词仍需人工检查。

仓库不包含模型权重，也不会在启动时自动下载。安装依赖：

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-offline.txt
```

模型来源：[Helsinki-NLP/opus-mt-zh-en](https://huggingface.co/Helsinki-NLP/opus-mt-zh-en)，许可 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。需要将原模型转换为 CTranslate2 INT8，转换方式参见 [CTranslate2 Transformers 文档](https://opennmt.net/CTranslate2/guides/transformers.html)。准备后的目录为：

```text
models/opus-mt-zh-en-int8/
  model.bin
  config.json
  shared_vocabulary.json
  source.spm
  target.spm
```

请保留原模型说明和许可，并注明 INT8 转换。仅下载 Hugging Face 原始权重后改名不等于完成转换。源码运行时该目录位于项目根目录；打包后由 PyInstaller 放在 `_internal/models/opus-mt-zh-en-int8/`。没有模型时仍可使用词库及 API 功能。

## 数据与升级

源码运行时数据在项目下 `data/`；打包版在 EXE 同级的 `data/`：

| 文件 | 内容 |
| --- | --- |
| `workspace.json` | 方案、内容块、组合、角色、收藏及配色 |
| `workspace.previous.json` | 上一次保存的工作区备份 |
| `translation.json` | 翻译设置与 DPAPI 加密的 Key |
| `desktop.log`、`webview/` | 日志与桌面 WebView 状态 |

这些目录已被 Git 忽略。更新或重新打包前备份 `data/`，不要用空目录覆盖它。退出前请先保存编辑弹窗中的草稿；工作区保存不等于弹窗草稿保存。

公开版本从独立发布副本制作，仅包含代码、通用示例和第三方词库；不包含开发者使用时保存的方案、内容块、API 配置、迁移快照、测试截图或模型文件。

## 词库来源与许可

感谢以下项目。数量指本仓库整理后的条目/配方数，不代表上游最新版本总量。

| 来源 | 本项目采用内容 | 许可证 | 本仓库许可文件 |
| --- | --- | --- | --- |
| [Physton/sd-webui-prompt-all-in-one](https://github.com/Physton/sd-webui-prompt-all-in-one) | `ui/library.json` 的 3,982 个分类词条，整理为中英文搜索数据 | MIT | [Physton-LICENSE.txt](Physton-LICENSE.txt) |
| [thisjam/sd-webui-oldsix-prompt](https://github.com/thisjam/sd-webui-oldsix-prompt) | `ui/bundles.json` 中标为“老六词库”的 273 组配方 | MIT | [oldsix-LICENSE.txt](ui/catalog-licenses/oldsix-LICENSE.txt) |
| [n714/stable-diffusion-prompt-library-zh_CN](https://github.com/n714/stable-diffusion-prompt-library-zh_CN) | `ui/bundles.json` 中标为“n714 中文词库”的 105 组配方 | MIT | [n714-LICENSE.txt](ui/catalog-licenses/n714-LICENSE.txt) |

共 **378 组来源配方**。整理保留原始配方 `raw`、来源、分类和可追溯文件名；将兼容的文本解析为可编辑标签，不兼容的语法保留为原文整体词条。来源词库内容未按题材删改；公开副本移除了本地个人补充内容。

Physton 分类词条来自其 `group_tags/zh_CN.yaml`，空中文释义以英文标签代替。该上游文件另鸣谢“路过银河（知乎）、未知作者（Google Drive）、互联网”等整合来源，此处一并保留致谢。老六与 n714 的本地来源快照信息见 [sources.json](ui/catalog-licenses/sources.json)。

分块与组合复用的交互思路参考 [basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas)，未复制其 React 组件或源码。本项目是独立桌面实现，不是以上项目的官方发行版。

更多依赖说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。第三方许可证分别适用于对应内容，不代表整个仓库统一使用这些许可证；本项目自有代码暂未另行指定开源许可证。

## 构建与验证

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-build.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -p '*_test.py'
node tests/core.cjs
node tests/bundles.cjs
.\.venv\Scripts\python.exe -m PyInstaller --noconfirm PromptBlocksStudio.spec
.\dist\PromptBlocksStudio\PromptBlocksStudio.exe --smoke-test
```

输出为 `dist/PromptBlocksStudio/`，需要保留整个文件夹。默认无需离线模型即可打包；若已安装离线依赖并放好模型目录，构建会一起收集。`requirements-lock.txt` 另保留桌面开发环境的依赖版本参考。

`--smoke-test` 使用独立的 `smoke-data/`，启动后自动关闭，生成 `native-validation.json`。普通测试使用临时目录与本机模拟接口，不发送真实 API 请求。构建产物、测试运行数据与模型均不进入版本控制。
