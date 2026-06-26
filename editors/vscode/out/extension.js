"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
function loadSymbolTable(docPath) {
    try {
        return JSON.parse(fs.readFileSync(`${docPath}.symbols.json`, "utf8"));
    }
    catch {
        return undefined;
    }
}
/**
 * Infers the type of `identifier` by scanning the raw document text for typed
 * declarations: globals from the symbol table, then `identifier: TypeName`
 * patterns in function param lists and variable declarations.
 */
function inferType(identifier, docText, st) {
    const global = st.globals[identifier];
    if (global)
        return global.type;
    // Match `identifier: TypeName` (array form `TypeName[]` included)
    const re = new RegExp(`\\b${identifier}\\s*:\\s*([\\w]+(?:\\[\\])?)`, "g");
    let m;
    while ((m = re.exec(docText)) !== null) {
        const t = m[1].replace("[]", "");
        if (st.types[t] || st.builtins[t] || st.enums[t])
            return t;
    }
    return undefined;
}
function memberCompletions(typeName, st) {
    const items = [];
    const typeEntry = st.types[typeName];
    if (typeEntry) {
        for (const prop of typeEntry.properties) {
            const item = new vscode.CompletionItem(prop, vscode.CompletionItemKind.Property);
            item.detail = `(property) ${typeName}.${prop}`;
            items.push(item);
        }
    }
    const builtin = st.builtins[typeName];
    if (builtin) {
        for (const method of builtin.methods) {
            const item = new vscode.CompletionItem(method.name, vscode.CompletionItemKind.Method);
            const sig = method.params.map((p) => `${p.name}: ${p.type}`).join(", ");
            item.detail = `(method) ${typeName}.${method.name}(${sig}): ${method.returnType}`;
            item.insertText = new vscode.SnippetString(`${method.name}($1)`);
            items.push(item);
        }
        for (const prop of builtin.properties) {
            const item = new vscode.CompletionItem(prop, vscode.CompletionItemKind.Property);
            item.detail = `(property) ${typeName}.${prop}`;
            items.push(item);
        }
    }
    return items;
}
const BUILTIN_SCALAR_TYPES = ["String", "Bool", "Number", "Unspecified", "Unknown"];
function buildHover(word, textBeforeWord, docText, st) {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    // Method / property access: `identifier.word`
    const memberMatch = textBeforeWord.match(/(\w+)\.\s*$/);
    if (memberMatch) {
        const identifier = memberMatch[1];
        const typeName = inferType(identifier, docText, st);
        if (!typeName)
            return undefined;
        const builtin = st.builtins[typeName];
        if (builtin) {
            const method = builtin.methods.find((m) => m.name === word);
            if (method) {
                const sig = method.params.map((p) => `${p.name}: ${p.type}`).join(", ");
                md.appendCodeblock(`(method) ${typeName}.${word}(${sig}): ${method.returnType}`, "typescript");
                if (method.documentation)
                    md.appendMarkdown(`\n\n${method.documentation}`);
                return new vscode.Hover(md);
            }
            if (builtin.properties.includes(word)) {
                md.appendCodeblock(`(property) ${typeName}.${word}`, "typescript");
                return new vscode.Hover(md);
            }
        }
        const typeEntry = st.types[typeName];
        if (typeEntry?.properties.includes(word)) {
            md.appendCodeblock(`(property) ${typeName}.${word}`, "typescript");
            return new vscode.Hover(md);
        }
        return undefined;
    }
    // Builtin type / constructor (e.g. `Agent` in `Agent(CLAUDE_OPUS)` or a type annotation)
    const builtin = st.builtins[word];
    if (builtin) {
        if (builtin.constructor) {
            const sig = builtin.constructor.params.map((p) => `${p.name}: ${p.type}`).join(", ");
            md.appendCodeblock(`(builtin) ${word}(${sig})`, "typescript");
        }
        else {
            md.appendCodeblock(`(builtin) ${word}`, "typescript");
        }
        if (builtin.documentation)
            md.appendMarkdown(`\n\n${builtin.documentation}`);
        return new vscode.Hover(md);
    }
    // User-defined function
    const fn = st.functions[word];
    if (fn) {
        const sig = fn.params.map((p) => `${p.name}: ${p.type}`).join(", ");
        const ret = fn.returnType ? ` -> ${fn.returnType}` : "";
        md.appendCodeblock(`function ${word}(${sig})${ret}`, "typescript");
        return new vscode.Hover(md);
    }
    // Global variable
    const global = st.globals[word];
    if (global) {
        md.appendCodeblock(`(global) ${word}: ${global.type}`, "typescript");
        return new vscode.Hover(md);
    }
    // User-defined type
    const typeEntry = st.types[word];
    if (typeEntry) {
        const props = typeEntry.properties.length > 0
            ? ` { ${typeEntry.properties.join(", ")} }`
            : "";
        md.appendCodeblock(`type ${word}${props}`, "typescript");
        return new vscode.Hover(md);
    }
    // Enum
    const enumEntry = st.enums[word];
    if (enumEntry) {
        md.appendCodeblock(`enum ${word} = ${enumEntry.members.join(" | ")}`, "typescript");
        return new vscode.Hover(md);
    }
    // Enum member
    for (const [enumName, e] of Object.entries(st.enums)) {
        if (e.members.includes(word)) {
            md.appendCodeblock(`(member) ${enumName}.${word}`, "typescript");
            return new vscode.Hover(md);
        }
    }
    return undefined;
}
function activate(context) {
    const hoverProvider = vscode.languages.registerHoverProvider({ language: "aisl" }, {
        provideHover(document, position) {
            const st = loadSymbolTable(document.fileName);
            if (!st)
                return;
            const wordRange = document.getWordRangeAtPosition(position, /\w+/);
            if (!wordRange)
                return;
            const word = document.getText(wordRange);
            const lineText = document.lineAt(position).text;
            const textBeforeWord = lineText.slice(0, wordRange.start.character);
            return buildHover(word, textBeforeWord, document.getText(), st);
        },
    });
    const provider = vscode.languages.registerCompletionItemProvider({ language: "aisl" }, {
        provideCompletionItems(document, position) {
            const st = loadSymbolTable(document.fileName);
            if (!st)
                return [];
            const lineText = document.lineAt(position).text;
            const textBefore = lineText.slice(0, position.character);
            // Member access: `identifier.`
            const memberMatch = textBefore.match(/(\w+)\.\s*$/);
            if (memberMatch) {
                const identifier = memberMatch[1];
                const typeName = inferType(identifier, document.getText(), st);
                if (typeName)
                    return memberCompletions(typeName, st);
                // Unknown type — offer all known properties/methods as a fallback.
                const allProps = new Set();
                for (const t of Object.values(st.types))
                    t.properties.forEach((p) => allProps.add(p));
                for (const b of Object.values(st.builtins)) {
                    b.methods.forEach((m) => allProps.add(m.name));
                    b.properties.forEach((p) => allProps.add(p));
                }
                return [...allProps].map((p) => new vscode.CompletionItem(p, vscode.CompletionItemKind.Property));
            }
            // Type annotation context: after `:`, `->`, or `as`
            if (/(?::|->\s*|(?:^|\s)as\s+)[\w\[]*$/.test(textBefore)) {
                const items = [];
                for (const name of Object.keys(st.types)) {
                    items.push(new vscode.CompletionItem(name, vscode.CompletionItemKind.Class));
                }
                for (const name of Object.keys(st.enums)) {
                    items.push(new vscode.CompletionItem(name, vscode.CompletionItemKind.Enum));
                }
                for (const name of Object.keys(st.builtins)) {
                    const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Class);
                    item.detail = "(builtin)";
                    items.push(item);
                }
                for (const name of BUILTIN_SCALAR_TYPES) {
                    const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Keyword);
                    item.detail = "(builtin type)";
                    items.push(item);
                }
                return items;
            }
            // General identifier completion
            const items = [];
            for (const [name, fn] of Object.entries(st.functions)) {
                const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
                const sig = fn.params.map((p) => `${p.name}: ${p.type}`).join(", ");
                item.detail = `(function) ${name}(${sig})${fn.returnType ? ` -> ${fn.returnType}` : ""}`;
                item.insertText = new vscode.SnippetString(`${name}($1)`);
                items.push(item);
            }
            for (const [name, g] of Object.entries(st.globals)) {
                const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable);
                item.detail = `(global) ${name}: ${g.type}`;
                items.push(item);
            }
            for (const [enumName, e] of Object.entries(st.enums)) {
                const enumItem = new vscode.CompletionItem(enumName, vscode.CompletionItemKind.Enum);
                enumItem.detail = `(enum) ${enumName}`;
                items.push(enumItem);
                for (const member of e.members) {
                    const item = new vscode.CompletionItem(member, vscode.CompletionItemKind.EnumMember);
                    item.detail = `(member) ${enumName}.${member}`;
                    items.push(item);
                }
            }
            for (const name of Object.keys(st.types)) {
                const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Class);
                item.detail = `(type) ${name}`;
                items.push(item);
            }
            for (const [name, b] of Object.entries(st.builtins)) {
                if (b.constructor) {
                    const sig = b.constructor.params.map((p) => `${p.name}: ${p.type}`).join(", ");
                    const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Constructor);
                    item.detail = `(builtin) ${name}(${sig})`;
                    item.insertText = new vscode.SnippetString(`${name}($1)`);
                    items.push(item);
                }
            }
            return items;
        },
    }, ".");
    context.subscriptions.push(hoverProvider, provider);
}
function deactivate() { }
