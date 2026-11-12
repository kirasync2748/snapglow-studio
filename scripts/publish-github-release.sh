#!/usr/bin/env bash
set -euo pipefail

shopt -s nullglob
packages=(artifacts/*.vsix)
if ((${#packages[@]} == 0)) || [[ ! -f artifacts/SHA256SUMS ]]; then
  echo 'Release package or checksum file is missing.' >&2
  exit 1
fi

temp_dir=$(mktemp -d)
trap 'rm -rf "$temp_dir"' EXIT
release_args=("$RELEASE_TAG" --repo "$GITHUB_REPOSITORY")

if ! gh release view "${release_args[@]}" --json isDraft,isPrerelease,assets > "$temp_dir/release.json"; then
  gh release create "${release_args[@]}" --verify-tag --generate-notes
  gh release view "${release_args[@]}" --json isDraft,isPrerelease,assets > "$temp_dir/release.json"
fi

if ! jq -e '.isDraft == false and .isPrerelease == false and (.assets | type == "array")' "$temp_dir/release.json" > /dev/null; then
  echo 'The existing release must be published and must not be a prerelease.' >&2
  exit 1
fi
jq -r '.assets[].name' "$temp_dir/release.json" > "$temp_dir/asset-names"

missing=()
for asset in "${packages[@]}" artifacts/SHA256SUMS; do
  name=${asset##*/}
  if grep -Fxq -- "$name" "$temp_dir/asset-names"; then
    gh release download "${release_args[@]}" --pattern "$name" --dir "$temp_dir"
    if ! cmp -s "$asset" "$temp_dir/$name"; then
      echo "Existing release asset $name differs from the verified build; refusing to replace it." >&2
      exit 1
    fi
  else
    missing+=("$asset")
  fi
done

if ((${#missing[@]})); then
  gh release upload "${release_args[@]}" "${missing[@]}"
fi
