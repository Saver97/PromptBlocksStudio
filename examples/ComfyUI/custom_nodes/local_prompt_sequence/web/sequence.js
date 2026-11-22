import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

const separator = "\n---\n";
const dividerLine = /^[ \t]*---[ \t]*$/m;

function splitBlocks(value) {
    // Retain the text inside each block, including intentional blank lines.
    return String(value ?? "").replace(/\r\n?/g, "\n").split(dividerLine).map((part, i, all) => {
        if (i && part.startsWith("\n")) part = part.slice(1);
        if (i + 1 < all.length && part.endsWith("\n")) part = part.slice(0, -1);
        return part;
    });
}

function element(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
}

function button(label, action) {
    const el = element("button", "", label);
    el.type = "button";
    el.addEventListener("click", action);
    return el;
}

function makeEditor(node, name, spec) {
    const panel = element("section", "sequence-editor");
    const toolbar = element("header", "sequence-toolbar");
    const count = element("span", "sequence-count");
    const list = element("div", "sequence-block-list");
    const getValue = () => Array.from(list.querySelectorAll("textarea"), field => field.value).join(separator);
    let widget;

    function renumber() {
        const cards = Array.from(list.children);
        count.textContent = `共 ${cards.length} 组`;
        cards.forEach((card, i) => {
            const label = `第 ${i + 1} 组`;
            card.querySelector("strong").textContent = label;
            card.querySelector("textarea").setAttribute("aria-label", label + "提示词");
            const [up, down, remove] = card.querySelectorAll("button");
            up.disabled = i === 0;
            down.disabled = i === cards.length - 1;
            remove.disabled = cards.length === 1;
        });
    }

    function changed() {
        widget?.callback?.(getValue());
        node.graph?.change();
    }

    function edit(action) {
        node.graph?.beforeChange(node);
        action();
        renumber();
        changed();
        node.graph?.afterChange(node);
    }

    function createCard(text) {
        const card = element("article", "sequence-block");
        const header = element("header");
        const field = element("textarea");
        field.value = text;
        field.rows = 3;
        field.spellcheck = false;
        field.placeholder = "填写这一组的正向提示词";
        header.append(element("strong"),
            button("上移", () => edit(() => card.previousElementSibling?.before(card))),
            button("下移", () => edit(() => card.nextElementSibling?.after(card))),
            button("删除", () => edit(() => { if (list.childElementCount > 1) card.remove(); })));
        field.addEventListener("input", () => {
            const parts = splitBlocks(field.value);
            if (parts.length === 1) { changed(); return; }
            // A paste from the previous single-box editor becomes separate cards.
            field.value = parts[0];
            const added = parts.slice(1).map(createCard);
            card.after(...added);
            renumber();
            added.at(-1).querySelector("textarea").focus();
            changed();
        });
        card.append(header, field);
        return card;
    }

    function restore(value) {
        if (list.firstChild && value === getValue()) return;
        list.replaceChildren(...splitBlocks(value).map(createCard));
        renumber();
    }

    toolbar.append(button("＋ 加组", () => edit(() => {
        const card = createCard("");
        list.append(card);
        card.querySelector("textarea").focus();
    })), count);
    panel.append(toolbar, list);
    restore(spec[1]?.default);
    widget = node.addDOMWidget(name, "sequence-editor", panel, {
        getValue, setValue: restore, getMinHeight: () => 230, hideOnZoom: false,
    });
    return { widget, minWidth: 360, minHeight: 265 };
}

function makeGallery(node) {
    const panel = element("section", "sequence-gallery");
    const title = element("strong", "sequence-summary");
    const grid = element("div", "sequence-grid");
    panel.append(title, grid);
    const widget = node.addDOMWidget("sequence_gallery", "sequence-gallery", panel, {
        serialize: false, hideOnZoom: false, getMinHeight: () => 220,
    });
    widget.serialize = false;
    function render(output) {
        const groups = new Map();
        (output?.images ?? []).forEach((file, index) => {
            const number = output.sequence_groups?.[index] ?? index + 1;
            if (!groups.has(number)) groups.set(number, []);
            groups.get(number).push({file, prompt: output.sequence_prompts?.[index] ?? ""});
        });
        title.textContent = groups.size ? `本次结果 · ${groups.size} 组 · ${output.images.length} 张` : "运行完成后，此处按组号显示图片";
        const cards = [];
        for (const [number, entries] of [...groups].sort(([a], [b]) => a - b)) {
            const card = element("article", "sequence-result");
            card.append(element("strong", "", `第 ${number} 组`));
            for (const {file, prompt} of entries) {
                const link = element("a");
                link.href = api.apiURL("/view?" + new URLSearchParams({
                    filename: file.filename, subfolder: file.subfolder || "", type: file.type || "output",
                }));
                link.target = "_blank";
                link.rel = "noopener";
                const image = element("img");
                image.alt = `第 ${number} 组`;
                image.title = prompt;
                image.src = link.href;
                link.append(image);
                card.append(link);
            }
            cards.push(card);
        }
        grid.replaceChildren(...cards);
        grid.scrollTop = 0;
    }
    render();
    return render;
}

app.registerExtension({
    name: "local.prompt.sequence",
    init() {
        const style = document.createElement("link");
        style.rel = "stylesheet";
        style.href = new URL("./sequence.css?v=blocks", import.meta.url).href;
        document.head.append(style);
    },
    getCustomWidgets() { return { LOCAL_SEQUENCE_EDITOR: makeEditor }; },
    beforeRegisterNodeDef(type, definition) {
        if (definition.name !== "LocalSequenceGallery") return;
        const created = type.prototype.onNodeCreated;
        type.prototype.onNodeCreated = function (...args) {
            created?.apply(this, args);
            this.renderSequenceGallery = makeGallery(this);
        };
        const executed = type.prototype.onExecuted;
        type.prototype.onExecuted = function (output, ...args) {
            executed?.call(this, output, ...args);
            this.renderSequenceGallery?.(output);
            this.sequenceDisplayedImages = output?.images;
        };
        // The gallery owns this node's preview area. Also restore cached tab/history results.
        type.prototype.onDrawBackground = function () {
            const output = app.nodeOutputs?.[this.id];
            if (output?.images && output.images !== this.sequenceDisplayedImages) {
                this.renderSequenceGallery?.(output);
                this.sequenceDisplayedImages = output.images;
            }
        };
    },
});
