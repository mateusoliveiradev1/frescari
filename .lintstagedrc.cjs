module.exports = {
  "*.{js,jsx,ts,tsx}": [
    "pnpm exec eslint --fix --max-warnings 0",
    "pnpm exec prettier --write",
  ],
};
