// Conventional Commits: <type>(<optional scope>): <summary>. See CONTRIBUTING.md.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [1, 'always', ['ui', 'icons', 'tokens', 'brand', 'docs', 'ci', 'deps', 'release']],
  },
};
