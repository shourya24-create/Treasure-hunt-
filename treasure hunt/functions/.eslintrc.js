module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "/generated/**/*", // Ignore generated files.
  ],
  plugins: [
    "@typescript-eslint",
    "import",
  ],
  rules: {
    "quotes": ["error", "double"],
    "import/no-unresolved": 0,
    // The rules below align the stock Firebase/google template with the style
    // this codebase is actually written in.
    "indent": ["error", 2, { SwitchCase: 1 }],
    "object-curly-spacing": ["error", "always"],
    "max-len": ["error", {
      code: 110,
      ignoreComments: true,
      ignoreUrls: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
      ignoreRegExpLiterals: true,
    }],
    // Working copies are CRLF on Windows and LF elsewhere (git autocrlf).
    "linebreak-style": "off",
    // Deprecated rules; doc comments here are prose, without @param/@returns.
    "valid-jsdoc": "off",
    "require-jsdoc": "off",
    // Multi-line ternaries put `?` and `:` at the start of the line.
    "operator-linebreak": ["error", "after", {
      overrides: { "?": "before", ":": "before" },
    }],
    // The barrel file (src/index.ts) column-aligns its `export { x } from`.
    "no-multi-spaces": ["error", {
      exceptions: { Property: true, ExportNamedDeclaration: true },
    }],
  },
  overrides: [
    {
      // Tests assert on documents they have just seeded, so `!` is safe there.
      files: ["test/**/*.ts"],
      rules: {
        "@typescript-eslint/no-non-null-assertion": "off",
      },
    },
    {
      // Content placeholders are annotated with their wide type on purpose:
      // without `: string` the constant would be typed as its TODO_ literal.
      files: ["src/content/**/*.ts"],
      rules: {
        "@typescript-eslint/no-inferrable-types": "off",
      },
    },
  ],
};
