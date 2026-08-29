Rule: No milestone is considered complete until every item in this checklist has been verified.

# Release Checklist

Use this checklist before every milestone release (v0.3.0, v0.4.0, etc.).

---

## 1. Feature Complete

- [ ] Milestone implementation is complete.
- [ ] PRD requirements have been satisfied.
- [ ] No placeholder functionality remains for this milestone.
- [ ] Documentation has been updated.

---

## 2. Code Review

- [ ] Review all modified files.
- [ ] Remove temporary debugging code.
- [ ] Remove commented-out code.
- [ ] Delete accidental files (logs, duplicate lockfiles, etc.).
- [ ] Confirm dependency changes are intentional.

---

## 3. Quality Checks

Run:

```bash
npm run lint
```

- [ ] Lint passes.

Run:

```bash
npm run build
```

- [ ] Production build passes.

Run:

```bash
npm run dev
```

- [ ] Development server starts successfully.
- [ ] Homepage loads.
- [ ] Application loads.
- [ ] New milestone functionality works as expected.

---

## 4. Git Review

Run:

```bash
git status
```

- [ ] Review modified files.
- [ ] Review new files.
- [ ] Ensure no temporary files are included.

---

## 5. Commit

```bash
git add .
git commit -m "vX.X.X - Milestone name"
```

- [ ] Commit created successfully.

---

## 6. Tag Release

```bash
git tag vX.X.X
```

- [ ] Version tag created.

---

## 7. Push

```bash
git push
git push origin vX.X.X
```

- [ ] Commit pushed.
- [ ] Tag pushed.

---

## 8. Release Complete

- [ ] Repository is clean (`git status`).
- [ ] Milestone is complete.
- [ ] Begin planning the next milestone.