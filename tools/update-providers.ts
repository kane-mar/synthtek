/**
 * Update provider files to use buildProviderConfig
 */
import { readFileSync, writeFileSync } from "node:fs";

const providers = [
  { file: "src/providers/gemini/provider.ts", name: "gemini" },
  { file: "src/providers/mistral/provider.ts", name: "mistral" },
  { file: "src/providers/openrouter/provider.ts", name: "openrouter" },
  { file: "src/providers/qwen/provider.ts", name: "qwen" },
  { file: "src/providers/lmstudio/provider.ts", name: "lmstudio" },
  { file: "src/providers/vllm/provider.ts", name: "vllm" },
  { file: "src/providers/anthropic/provider.ts", name: "anthropic" },
  { file: "src/providers/azure/provider.ts", name: "azure" },
];

for (const { file, name } of providers) {
  let content = readFileSync(file, "utf-8");

  // Skip if already updated
  if (content.includes("buildProviderConfig")) {
    console.log(name + ": already done");
    continue;
  }

  // 1. Add import after last type import
  content = content.replace(
    /} from "\.\.\/types\.js";/,
    `} from "../types.js";\nimport { buildProviderConfig } from "../base-provider.js";`,
  );

  // 2. Remove LLMProvider from type imports
  content = content.replace(/LLMProvider,\s*/g, "");
  content = content.replace(/,\s*LLMProvider/g, "");
  content = content.replace(/import type \{(\s*)\}/g, "");

  // 3. Remove ' implements LLMProvider'
  content = content.replace(/ implements LLMProvider/g, "");

  // 4. Replace the constructor config block
  const lines = content.split("\n");
  let configStart = -1;
  let configEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("this.config = {")) {
      configStart = i;
    }
    if (configStart >= 0 && lines[i].trimEnd() === "};" && i > configStart) {
      configEnd = i;
      // Check if next line has getConfig or listModels
      const nextLine = configEnd + 1 < lines.length ? lines[configEnd + 1] : "";
      if (nextLine.includes("getConfig") || nextLine.includes("listModels") || nextLine.includes("promptCaching") || nextLine.includes("deployment")) {
        break;
      }
    }
  }

  if (configStart >= 0 && configEnd > configStart) {
    const indent = lines[configStart].match(/^\s*/)?.[0] ?? "\t";
    const newLines = [
      `${indent}this.config = buildProviderConfig(config, DEFAULT_CONFIG, "${name}");`,
    ];
    lines.splice(configStart, configEnd - configStart + 1, ...newLines);
    content = lines.join("\n");
    console.log(name + ": config block replaced");
  } else {
    console.log(name + ": could not find config block (start=" + configStart + ", end=" + configEnd + ")");
  }

  writeFileSync(file, content);
}
