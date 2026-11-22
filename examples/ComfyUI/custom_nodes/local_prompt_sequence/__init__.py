import re

from nodes import SaveImage


def split_groups(text):
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    return [part.strip() for part in re.split(r"(?m)^[ \t]*---[ \t]*$", text)]


class PromptGroups:
    CATEGORY = "text/提示词组"
    RETURN_TYPES = ("STRING", "INT")
    RETURN_NAMES = ("提示词", "组号")
    OUTPUT_IS_LIST = (True, True)
    FUNCTION = "read_groups"

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"groups": ("LOCAL_SEQUENCE_EDITOR", {"default": ""})}}

    @classmethod
    def VALIDATE_INPUTS(cls, groups):
        for index, prompt in enumerate(split_groups(groups), start=1):
            if not prompt:
                return f"第 {index} 组为空，请填写提示词或删除这一组。"
        return True

    def read_groups(self, groups):
        prompts = split_groups(groups)
        return (prompts, list(range(1, len(prompts) + 1)))


class SequenceGallery(SaveImage):
    CATEGORY = "image/提示词组"
    FUNCTION = "save_group"
    RETURN_TYPES = ()
    RETURN_NAMES = ()

    @classmethod
    def INPUT_TYPES(cls):
        inputs = super().INPUT_TYPES()
        inputs["required"]["group_prompt"] = ("STRING", {"forceInput": True})
        inputs["required"]["group_number"] = ("INT", {"forceInput": True})
        return inputs

    def save_group(self, images, filename_prefix, group_prompt, group_number, prompt=None, extra_pnginfo=None):
        metadata = dict(extra_pnginfo or {}, sequence_prompt=group_prompt, sequence_group=group_number)
        ui = self.save_images(images, filename_prefix, prompt, metadata)["ui"]
        ui["sequence_prompts"] = [group_prompt] * len(ui["images"])
        ui["sequence_groups"] = [group_number] * len(ui["images"])
        return {"ui": ui, "result": ()}


NODE_CLASS_MAPPINGS = {
    "LocalSequencePromptGroups": PromptGroups,
    "LocalSequenceGallery": SequenceGallery,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "LocalSequencePromptGroups": "提示词组 · 单框编辑",
    "LocalSequenceGallery": "本次图册 · 按序保存",
}
WEB_DIRECTORY = "./web"
