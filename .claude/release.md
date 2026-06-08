# Release Checklist

Before tagging a new release, update the version number in ALL of these files:

| File | Field | Example |
|------|-------|---------|
| `desktop/src-tauri/Cargo.toml` | `version = "x.y.z"` | line 3 |
| `desktop/package.json` | `"version": "x.y.z"` | line 3 |

## Steps

1. Run pylint and fix all errors: `python -m pylint backend/ --errors-only`
2. Update both version files above to the new version
3. Commit everything: `git commit -m "Bump desktop version to x.y.z"`
4. Tag: `git tag vx.y.z`
5. Push: `git push origin vx.y.z && git push origin main`

## Notes

- `tauri.conf.json` does NOT contain a version — Tauri reads it from `Cargo.toml`
- The CI artifact step looks for `Rabadon_{version}_x64-setup.exe`, so the Cargo version must match the tag exactly
- `frontend/package.json` and the root `package.json` do not affect the build artifact name
