const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

const PROJECT_ROOT_MARKER = "# Fix Expo pod PROJECT_ROOT capture from external shells/workspaces.";
const FMT_MARKER = "# Fix fmt 11.0.2 consteval compilation error with Xcode 26.4+";
const POST_INTEGRATE_TAG = "custom-podfile-post-integrate-fix";

function buildProjectRootPatch() {
    return [
        `    ${PROJECT_ROOT_MARKER}`,
        "    sanitize_project_root_capture = lambda do |content|",
        "      next content if content.nil?",
        "",
        "      content",
        "        .gsub(/PROJECT_ROOT=.*? \\$PODS_TARGET_SRCROOT/, '$PODS_TARGET_SRCROOT')",
        "        .gsub(/export PROJECT_ROOT=.*?\\\\n/, '')",
        "        .gsub(/export PROJECT_ROOT=.*?\\n/, '')",
        "        .gsub('bash -l -c \\\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\\"', 'bash -l -c \\\"unset PROJECT_ROOT && $PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\\"')",
        "        .gsub('bash -l -c \\\"$PODS_TARGET_SRCROOT/../scripts/create-updates-resources-ios.sh\\\"', 'bash -l -c \\\"unset PROJECT_ROOT && $PODS_TARGET_SRCROOT/../scripts/create-updates-resources-ios.sh\\\"')",
        "        .gsub('bash -l -c \"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\"', 'bash -l -c \"unset PROJECT_ROOT && $PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\"')",
        "        .gsub('bash -l -c \"$PODS_TARGET_SRCROOT/../scripts/create-updates-resources-ios.sh\"', 'bash -l -c \"unset PROJECT_ROOT && $PODS_TARGET_SRCROOT/../scripts/create-updates-resources-ios.sh\"')",
        "    end",
        "",
        "    generated_podspec_files = [",
        '      File.join(__dir__, "Pods", "Local Podspecs", "EXConstants.podspec.json"),',
        '      File.join(__dir__, "Pods", "Local Podspecs", "EXUpdates.podspec.json")',
        "    ]",
        "    generated_podspec_files.each do |generated_podspec_file|",
        "      next unless File.exist?(generated_podspec_file)",
        "",
        "      original_content = File.read(generated_podspec_file)",
        "      patched_content = sanitize_project_root_capture.call(original_content)",
        "",
        "      next if patched_content == original_content",
        "",
        "      File.chmod(0o644, generated_podspec_file)",
        "      File.write(generated_podspec_file, patched_content)",
        "    end",
        "",
        "    installer.pods_project.targets.each do |target|",
        '      next unless ["EXConstants", "EXUpdates"].include?(target.name)',
        "",
        "      target.shell_script_build_phases.each do |phase|",
        "        next unless [",
        '          "Generate app.config for prebuilt Constants.manifest",',
        '          "Generate updates resources for expo-updates"',
        "        ].include?(phase.name)",
        "",
        "        phase.shell_script = sanitize_project_root_capture.call(phase.shell_script)",
        "      end",
        "    end",
    ].join("\n");
}

function buildFmtPatch() {
    return [
        `    ${FMT_MARKER}`,
        "    fmt_base = File.join(installer.sandbox.pod_dir('fmt'), 'include', 'fmt', 'base.h')",
        "    if File.exist?(fmt_base)",
        "      content = File.read(fmt_base)",
        "      patched = content.gsub(/FMT_USE_CONSTEVAL 1/, 'FMT_USE_CONSTEVAL 0')",
        "",
        "      if patched != content",
        "        File.chmod(0o644, fmt_base)",
        "        File.write(fmt_base, patched)",
        "      end",
        "    end",
    ].join("\n");
}

function buildPostIntegrateHook() {
    return [
        "# Patch generated Pods Xcode project after CocoaPods integration.",
        "post_integrate do |_installer|",
        '  generated_pods_project_file = File.join(__dir__, "Pods", "Pods.xcodeproj", "project.pbxproj")',
        "  next unless File.exist?(generated_pods_project_file)",
        "",
        "  original_content = File.read(generated_pods_project_file)",
        "  patched_content = original_content",
        "    .gsub(/PROJECT_ROOT=.*? \\$PODS_TARGET_SRCROOT/, '$PODS_TARGET_SRCROOT')",
        "    .gsub(/export PROJECT_ROOT=.*?\\\\n/, '')",
        "    .gsub(/export PROJECT_ROOT=.*?\\n/, '')",
        "    .gsub('bash -l -c \\\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\\"', 'bash -l -c \\\"unset PROJECT_ROOT && $PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\\"')",
        "    .gsub('bash -l -c \\\"$PODS_TARGET_SRCROOT/../scripts/create-updates-resources-ios.sh\\\"', 'bash -l -c \\\"unset PROJECT_ROOT && $PODS_TARGET_SRCROOT/../scripts/create-updates-resources-ios.sh\\\"')",
        "    .gsub('bash -l -c \"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\"', 'bash -l -c \"unset PROJECT_ROOT && $PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\"')",
        "    .gsub('bash -l -c \"$PODS_TARGET_SRCROOT/../scripts/create-updates-resources-ios.sh\"', 'bash -l -c \"unset PROJECT_ROOT && $PODS_TARGET_SRCROOT/../scripts/create-updates-resources-ios.sh\"')",
        "",
        "  next if patched_content == original_content",
        "",
        "  File.chmod(0o644, generated_pods_project_file)",
        "  File.write(generated_pods_project_file, patched_content)",
        "end",
    ].join("\n");
}

function removeTaggedAppend(src, tag) {
    const pattern = new RegExp(
        `\\n?# @generated begin ${tag}[\\s\\S]*?# @generated end ${tag}\\n?`,
        "g",
    );
    return src.replace(pattern, "\n").replace(/\n{3,}/g, "\n\n");
}

function ensurePostIntegrate(src) {
    const begin = `# @generated begin ${POST_INTEGRATE_TAG}`;
    if (src.includes(begin)) return src;

    return `${src.trimEnd()}\n\n${begin}\n${buildPostIntegrateHook()}\n# @generated end ${POST_INTEGRATE_TAG}\n`;
}

function patchPostInstallBody(src) {
    const projectRootPatch = buildProjectRootPatch();
    const fmtPatch = buildFmtPatch();

    let contents = src;

    const reactNativePostInstallCallRegex = /(\s*react_native_post_install\(\n(?:.*\n)*?\s*\)\n)/m;

    const match = contents.match(reactNativePostInstallCallRegex);
    if (!match) {
        throw new Error("Unable to find react_native_post_install(...) block in ios/Podfile.");
    }

    if (contents.includes(PROJECT_ROOT_MARKER) && contents.includes(FMT_MARKER)) {
        return contents;
    }

    const originalCall = match[1];
    const replacement = `${originalCall}\n${projectRootPatch}\n\n${fmtPatch}\n`;

    contents = contents.replace(originalCall, replacement);

    return contents.replace(/\n{3,}/g, "\n\n");
}

function patchPodfileContents(src) {
    let contents = src;

    contents = removeTaggedAppend(contents, POST_INTEGRATE_TAG);

    contents = patchPostInstallBody(contents);
    contents = ensurePostIntegrate(contents);

    return contents;
}

function withCustomPodfilePatches(config) {
    return withDangerousMod(config, [
        "ios",
        async (modConfig) => {
            if (modConfig.modRequest.introspect) {
                return modConfig;
            }

            const podfilePath = path.join(modConfig.modRequest.platformProjectRoot, "Podfile");

            if (!fs.existsSync(podfilePath)) {
                return modConfig;
            }

            const original = fs.readFileSync(podfilePath, "utf8");
            const patched = patchPodfileContents(original);

            if (patched !== original) {
                fs.writeFileSync(podfilePath, patched);
            }

            return modConfig;
        },
    ]);
}

module.exports = withCustomPodfilePatches;
