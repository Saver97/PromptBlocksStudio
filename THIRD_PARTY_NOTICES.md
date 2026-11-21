# 第三方来源说明

## 随仓库分发的词库

- Physton / sd-webui-prompt-all-in-one：词库整理为 `ui/library.json`。Copyright (c) 2023 Physton，MIT，全文见 `Physton-LICENSE.txt`。
- thisjam / sd-webui-oldsix-prompt：配方整理为 `ui/bundles.json`。Copyright (c) 2023 Six_GodK，MIT，全文见 `ui/catalog-licenses/oldsix-LICENSE.txt`。
- n714 / stable-diffusion-prompt-library-zh_CN：配方整理为 `ui/bundles.json`。Copyright (c) 2023 n714，MIT，全文见 `ui/catalog-licenses/n714-LICENSE.txt`。

上游链接、整理内容与数量见 [README](README.md#词库来源与许可)。这里的许可证仅适用于相应第三方内容，不覆盖本项目自有代码。

## 可选模型

英译中模型 Helsinki-NLP / opus-mt-en-zh，原模型卡标注 Apache-2.0，桌面离线版转换为 CTranslate2 INT8。来源：https://huggingface.co/Helsinki-NLP/opus-mt-en-zh

Helsinki-NLP / opus-mt-zh-en，University of Helsinki Language Technology Research Group，CC BY 4.0。
来源：https://huggingface.co/Helsinki-NLP/opus-mt-zh-en
许可：https://creativecommons.org/licenses/by/4.0/

模型不随此源码仓库分发。离线运行要求另外转换为 CTranslate2 INT8；重新分发转换模型时应保留署名、许可和转换说明。

## 运行与构建依赖

本仓库通过 requirements 文件声明 pywebview、pyperclip、pythonnet、clr-loader、truststore、PyInstaller，以及可选 CTranslate2、SentencePiece、NumPy、PyYAML。依赖由安装工具获取，各自遵循其发行包中的许可证。源码仓库不包含这些第三方运行库的副本。

## 交互参考

Infinite Canvas：https://github.com/basketikun/infinite-canvas

参考分块引用、组合复用的交互思路，未复制其 React 组件或源码。本项目与上述项目无官方隶属关系。
