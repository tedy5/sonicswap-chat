import { Config } from "prettier";

const config: Config = {
  semi: true,
  trailingComma: "es5",
  singleQuote: true,
  tabWidth: 2,
  printWidth: 240,
  bracketSpacing: true,
  arrowParens: "always",
  singleAttributePerLine: true,
  plugins: ["@ianvs/prettier-plugin-sort-imports", "prettier-plugin-tailwindcss"],
  importOrder: ["^react$", "^react/(.*)$", "^next$", "^next/(.*)$", "<THIRD_PARTY_MODULES>", "^@/(.*)$", "^[./]"],
};

export default config;
