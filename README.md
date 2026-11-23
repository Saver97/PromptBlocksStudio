# PromptBlocksStudio · 提示词积木

面向 ComfyUI 等生图工具的 Windows 提示词桌面工作台。用标签块、自然语言块和可复用组合组织正负面提示词，最后复制到自己的生图工作流。

应用独立运行，不需要启动 ComfyUI。标签组装、方案管理和导入导出可以离线使用；中文翻译可选本地模型，中文润色使用自行配置的 LLM 接口。

Windows 用户可在 [GitHub Releases](https://github.com/Saver97/PromptBlocksStudio/releases/latest) 下载便携包，完整解压后运行 `PromptBlocksStudio.exe`。包内 `examples/` 提供可导入的工作区、提示词模板和 ComfyUI 工作流。

## 2026.11.23 更新

在素材库点击「新增自定义词条」可保存常用词，并随工作区备份。顶部「配色」新增四种主题，「教程」可分章节查阅使用方法。

在「菜单 → 导入备份」选择 [11 月 23 日增量工作区](examples/PromptBlocks-additions-2026.11.23.json)，使用「合并到当前工作区」即可加入 3 个方案、方案内的 18 个内容块以及 2 个自定义词条。方案含成人内容。

## 能做什么

- **分块组装**：角色、服装、场景、光照、画师串、负面约束等分类；整块启停、调权重、复制和排序。点块内「搜索」可高亮匹配文字并查看命中数。
- **标签选择**：中英文搜索、分类筛选、收藏，点一次加入，再点取消。每个块也可以直接输入词库中没有的提示词。按住词条文字拖到同栏其他词条的左半边或右半边，按插入线调整顺序。拖到另一个标签块，即可将它移到目标块对应正面或负面列表的末尾。
- **整组配方**：从词库配方中选一整组加入当前块；保留原有权重，加入后可逐词编辑。
- **方案与组合**：保存多套完整方案，将常用内容存为组合；支持 JSON 备份与导入。初次运行时有一个空白方案。内置角色模板出现在组合列表中，可按需添加到方案。
- **Agent 模板导入**：复制固定格式模板给其他 Agent，粘贴其 JSON 输出后预览并导入为新方案；标签、自然语言、角色和参数按字段分开，全程本地解析。
- **角色占位符**：从按作品分组的常用角色中选取预设，或在角色定义中手动设置 `A`、`B`，自然语言使用 `{{A}}`、`{{B}}`；复制时展开角色姓名和可选身份、外貌介绍。
- **翻译与润色**：中英文对照、角色指代提醒、替换标记、返回结果预览及停止请求。结果未通过检查时也能查看返回内容，自行决定是否采用。
- **方案种子**：在右侧「配方参数 → 编辑」中每行输入一个种子并保存，点击种子旁的「复制」即可单独复制。
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

## 从参考图提取构图，再换成自己的角色

1. **用 WD14 反推标签。** 找一张姿势或构图符合预期的参考图，把图片交给 WD14 Tagger，只复制它根据画面识别出的 tag。跳过 PNG 元数据里的原始提示词。原图可能使用其他模型，同一组词在 REED 上的表现可能不同。
2. **先用原标签生成一张。** 把 WD14 的标签原样贴入 [REED 基础工作流](examples/ComfyUI/workflows/REED_Anima_v1.4_Basic_UI.json)的正向提示词节点，生成一张基准图。先看姿势、取景和人物位置能还原多少，留着这张图供后面比较。
3. **把可复用的词整理成块。** 回到提示词积木，在组装区把刚验证的词贴进标签块。保留动作、表情、镜头和场景，删去属于原角色的姓名、外貌、发型、发色、瞳色、服装和标志性配件。例如原图里有 `blue hair, looking back, over shoulder`，换角色时可保留后两个构图与动作标签。
4. **加入目标角色组合。** 在左侧「组合」页签按用途选「角色」，再按 IP 出处筛选，将预设角色组合加入当前方案。需要精确描述谁在做什么时，再加一个自然语言块，写法见下方示例。
5. **多轮出图，逐块删改。** 将组装后的正负面提示词复制回同一工作流，先沿用基准图的种子和采样参数。每轮只改一块，例如先调动作，再调镜头，观察哪次改动改善了画面。
6. **保存结果。** 得到满意的图后，保存图片和最终方案。下次复用同一构图时，保留动作、镜头与场景块，替换角色组合即可。

### 自然语言里的角色占位符

在「角色定义」里给每位角色分配代号，例如选择丰川祥子作为 `A`、长崎素世作为 `B`。在自然语言块里点输入框上方的角色按钮，即可插入 `{{A}}` 或 `{{B}}`。同一个代号可以反复使用，适合描述站位、视线、左右手和物品交接。

| 填写位置 | 同一段动作的写法 |
| --- | --- |
| 中文描述 | `{{A}} 站在窗边，把一封信递给 {{B}}。{{B}} 用双手接过信。` |
| 对应英文 | `{{A}} stands by the window and hands a letter to {{B}}. {{B}} takes it with both hands.` |

用内置翻译，或自行填写英文。中英文要保留相同的角色代号和出现次数。复制最终提示词时，工具会把动作里的代号展开为已定义的角色名，例如 `Togawa Sakiko stands by the window and hands a letter to Nagasaki Soyo.` 开启自动角色介绍后，正面输出还会加入已填写的外貌介绍。之后想让另一位角色递信，只需更换 `A` 的定义，并同步替换组装区中对应的角色组合，动作句可以继续使用。

## 让其他 Agent 生成分块提示词

中间组装区点击 **按模板导入 → 复制给 Agent 的模板**，将模板及需求交给其他 Agent。把返回的完整 JSON 粘贴回来，查看预览后点 **导入为新方案**。需要让 Agent 修改现有内容时，可用弹窗里的 **复制当前方案模板**。

模板不依赖本工具的 API 设置。结构规范及可直接复制的文件见 [模板导入说明](docs/模板导入说明.md)、[Agent 提示词模板](docs/Agent提示词模板.txt) 和 [JSON 示例](docs/prompt-blocks-template.example.json)。

### 使用步骤

1. 在工作台中点击 **按模板导入**，再点 **复制给 Agent 的模板**。把复制内容发送给其他 Agent，在末尾补充人物、服装、动作、镜头和画风需求。
2. 要求 Agent **只返回一个完整 JSON 代码块**。如需修改现有配方，改用 **复制当前方案模板**，再描述要修改的部分。
3. 将 Agent 返回的 JSON（可以连同外层 `json` 代码围栏）粘贴到左侧输入框。右侧会预览每个块的正负面内容、角色、参数与模型名称。
4. 格式错误会指出具体字段，如 `blocks[2].positive`；修正后点击 **导入为新方案**。同名方案自动加后缀，不会覆盖现有方案；可以撤销、重做。
5. 在新方案中继续选词、调权重、编辑角色与动作，最后复制右侧正负面文本到生图工作流。

整个导入过程只做本地 JSON 解析与校验，不调用 LLM、不自动翻译，也不会根据句意猜测分块。词库没有的标签仍然保留。只有中文的自然语言也能导入，但会标记英文待完成。

### 可直接粘贴的完整模板

下面的示例可直接导入，也可以交给其他 Agent 按同样结构改写。人物和动作仅用于展示格式。

```json
{
  "format": "prompt-blocks-template",
  "version": 1,
  "name": "双人看书 · 模板示例",
  "characters": [
    {
      "alias": "A",
      "name": "Alice",
      "gender": "female",
      "identityTags": [],
      "description": {"zh": "成年女性，黑色短发、棕色眼睛", "en": "an adult woman with short black hair and brown eyes"}
    },
    {
      "alias": "B",
      "name": "Betty",
      "gender": "female",
      "identityTags": [],
      "description": {"zh": "成年女性，棕色长发、蓝色眼睛", "en": "an adult woman with long brown hair and blue eyes"}
    }
  ],
  "blocks": [
    {
      "type": "tags", "name": "公共画质与构图", "role": "公共基础",
      "positive": ["best quality", "2girls", "upper body"], "negative": []
    },
    {
      "type": "tags", "name": "服装与场景", "role": "场景",
      "positive": ["casual clothes", "library", {"text": "soft lighting", "label": "柔光", "weight": 1.1}], "negative": []
    },
    {
      "type": "prose", "name": "双人动作", "role": "自由补充",
      "positive": {
        "zh": "{{A}} 站在左边，{{B}} 站在右边。{{B}} 双手捧着一本打开的书，{{A}} 用右手食指指向书页。",
        "en": "{{A}} stands on the left, and {{B}} stands on the right. {{B}} holds an open book with both hands. {{A}} points to the page with her right index finger."
      },
      "negative": {"zh": "", "en": ""}
    },
    {
      "type": "tags", "name": "负面约束", "role": "负面约束",
      "positive": [], "negative": ["low quality", "bad anatomy", "extra fingers", "watermark"]
    }
  ],
  "parameters": {},
  "models": {},
  "notes": "未指定的参数与模型留空。"
}
```

- `tags` 的正负面是数组，每项代表一个完整标签；权重写在对象的 `weight` 中，不在字符串里嵌套 SD/NAI 权重语法。
- `prose` 的正负面是 `zh` / `en` 对照对象，整段保留。角色代号必须先定义，中英文占位符及其出现次数需要一致。
- `role` 可选：自由补充、公共基础、角色、服装、场景、光照、画师串、负面约束、完整组合。
- `parameters` 可填 `width`、`height`、`steps`、`cfg`、`seed`、`extra_seeds`（附加种子数组）、`denoise`、`sampler_name`、`scheduler`；`models` 可填 `unet_name`、`clip_name`、`vae_name`。未知字段省略，不猜数值。
- 大于 `9007199254740991` 的种子使用十进制字符串，例如 `"18446744073709551615"`，避免精度丢失。

## API 设置

使用 **Responses 格式**。填写供应商给出的 Base URL、模型 ID 和自己的 Key；也可以点击获取模型列表。若供应商没有 `/models`，直接手动填写模型 ID。

- `https://example.com` → 请求 `https://example.com/responses`。
- `https://example.com/v1` → 请求 `https://example.com/v1/responses`。
- 已填写完整 `/responses` 地址时不重复添加路径；程序不会擅自插入 `/v1`。
- 当前请求使用 `reasoning.effort=low`、`stream=false`、`store=false`；供应商需要支持这些字段及 Responses 响应结构。
- “停止”会取消本地请求并尝试关闭连接；服务端是否停止计算由供应商实现决定。

仅在主动执行接口翻译、润色或获取模型列表时访问所配置的服务。润色会发送当前文本及当前方案的角色定义。API Key 使用 Windows DPAPI 加密保存在本机，不包含在仓库中；换 Windows 用户或设备时应重新填写。

## 可选：本地离线翻译

离线模块使用 **OPUS-MT 中英双向翻译 + CTranslate2 INT8 CPU 推理**，不占用生图显存。它是翻译模型，不负责 LLM 中文润色；复杂动作与代词仍需人工检查。

仓库不包含模型权重，也不会在启动时自动下载。安装依赖：

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-offline.txt
```

标签块点「翻译词条」会补全正负面词条的中文显示名。已有中文的词条会跳过，可撤销整次操作。自然语言编辑框可从右侧英文翻译到左侧中文，核对后保存。

英译中使用 [Helsinki-NLP/opus-mt-en-zh](https://huggingface.co/Helsinki-NLP/opus-mt-en-zh)，按同样方式转换到 `models/opus-mt-en-zh-int8/`，推理时使用简体中文目标标记 `>>cmn_Hans<<`。

中译英模型来源：[Helsinki-NLP/opus-mt-zh-en](https://huggingface.co/Helsinki-NLP/opus-mt-zh-en)，许可 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。需要将原模型转换为 CTranslate2 INT8，转换方式参见 [CTranslate2 Transformers 文档](https://opennmt.net/CTranslate2/guides/transformers.html)。准备后的目录为：

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

2026.11.22 归档版的示例工作区包含 43 个方案和 110 个组合块，可用「导入备份」打开。导入时可选择合并，也可用「替换」完整载入快照。组合块可同时按用途和 IP 筛选。部分词条、方案和组合块含成人内容。

[独立提示词模板](examples/templates)可逐个导入。[角色极简词与实测](docs/角色极简提示词_20261122.md)包含 29 位角色的词表、出图及镜流双版本对照。[ComfyUI 示例](examples/ComfyUI)另含两份批量 UI 工作流及单框顺序图册使用的自定义节点。多组工作流使用 Impact Pack 的列表节点。

## 提示词组的 REED 测试基准

本项目所有提示词组的测试均以 **REED Anima XXX v1.4** 和这份[基础 UI 工作流](examples/ComfyUI/workflows/REED_Anima_v1.4_Basic_UI.json)为准。工作流取自青衣实测原图，使用 9 个 ComfyUI 原生节点。已有逐图结果可在[角色实测图册](examples/角色实测/角色极简词实测.html)查阅，席德在图册中标记为复核跳过。

| 模型用途 | 工作流中选择的文件 | 放入目录（相对于 ComfyUI） | 下载 |
| --- | --- | --- | --- |
| 主模型 | `REED_Anima_XXX_v1.4.safetensors` | `models/diffusion_models/` | [Civitai · 选择 v1.4](https://civitai.com/models/2671685/reedanimaxxx) |
| 文本编码器 | `qwen_3_06b_base.safetensors` | `models/text_encoders/` | [CircleStone Labs · Qwen 3 0.6B](https://huggingface.co/circlestone-labs/Anima/blob/main/split_files/text_encoders/qwen_3_06b_base.safetensors) |
| VAE | `qwen_image_vae.safetensors` | `models/vae/` | [CircleStone Labs · Qwen Image VAE](https://huggingface.co/circlestone-labs/Anima/blob/main/split_files/vae/qwen_image_vae.safetensors) |

1. 将三个模型放到表中目录，打开支持 Anima 的 ComfyUI，并刷新模型列表。
2. 将 `REED_Anima_v1.4_Basic_UI.json` 拖入画布，确认三个加载节点选中了对应文件。直接运行可生成青衣示例。
3. 测自己的方案时，从提示词积木复制正向、负向提示词，分别粘到工作流对应节点，再点「运行」。

角色首轮对照统一使用 **832 × 1216、单张、30 步、CFG 4、Euler、simple、降噪 1.0、固定种子 20261118114**。图册中另有两张复核图使用种子 `20261118115`。工作流已保存这些首轮参数，复现时只需替换提示词。

## 词库来源与许可

感谢以下项目。数量指本仓库整理后的条目/配方数，不代表上游最新版本总量。

| 来源 | 本项目采用内容 | 许可证 | 本仓库许可文件 |
| --- | --- | --- | --- |
| [Physton/sd-webui-prompt-all-in-one](https://github.com/Physton/sd-webui-prompt-all-in-one) | `ui/library.json` 的 3,982 个分类词条，整理为中英文搜索数据 | MIT | [Physton-LICENSE.txt](Physton-LICENSE.txt) |
| [thisjam/sd-webui-oldsix-prompt](https://github.com/thisjam/sd-webui-oldsix-prompt) | `ui/bundles.json` 中标为“老六词库”的 273 组配方 | MIT | [oldsix-LICENSE.txt](ui/catalog-licenses/oldsix-LICENSE.txt) |
| [n714/stable-diffusion-prompt-library-zh_CN](https://github.com/n714/stable-diffusion-prompt-library-zh_CN) | `ui/bundles.json` 中标为“n714 中文词库”的 105 组配方 | MIT | [n714-LICENSE.txt](ui/catalog-licenses/n714-LICENSE.txt) |

共 **483 组配方**，其中第三方来源 378 组，本地词库 105 组。整理保留原始配方 `raw`、来源、分类和可追溯文件名；将兼容的文本解析为可编辑标签，不兼容的语法保留为原文整体词条。另收录本地常用搭配 15 项及 NSFW 中英文对照 1,575 项，词条合计 5,572 项。

Physton 分类词条来自其 `group_tags/zh_CN.yaml`，空中文释义以英文标签代替。该上游文件另鸣谢“路过银河（知乎）、未知作者（Google Drive）、互联网”等整合来源，此处一并保留致谢。老六与 n714 的本地来源快照信息见 [sources.json](ui/catalog-licenses/sources.json)。

分块与组合复用的交互思路参考 [basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas)，未复制其 React 组件或源码。本项目是独立桌面实现，不是以上项目的官方发行版。

更多依赖说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。第三方许可证分别适用于对应内容，不代表整个仓库统一使用这些许可证；本项目自有代码暂未另行指定开源许可证。

## 构建与验证

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-build.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -p '*_test.py'
node tests/core.cjs
node tests/bundles.cjs
node tests/agent-template.cjs
.\.venv\Scripts\python.exe -m PyInstaller --noconfirm PromptBlocksStudio.spec
.\dist\PromptBlocksStudio\PromptBlocksStudio.exe --smoke-test
```

输出为 `dist/PromptBlocksStudio/`，需要保留整个文件夹。默认无需离线模型即可打包；若已安装离线依赖并放好模型目录，构建会一起收集。`requirements-lock.txt` 另保留桌面开发环境的依赖版本参考。

`--smoke-test` 使用独立的 `smoke-data/`，启动后自动关闭，生成 `native-validation.json`。普通测试使用临时目录与本机模拟接口，不发送真实 API 请求。构建产物、测试运行数据与模型均不进入版本控制。
