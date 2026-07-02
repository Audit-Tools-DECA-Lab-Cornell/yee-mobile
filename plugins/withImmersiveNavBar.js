const { withMainActivity, WarningAggregator } = require("@expo/config-plugins");

/**
 * Keep the hidden Android navigation bar sticky-immersive.
 *
 * `expo-navigation-bar` hides the navigation bar (via `setVisibilityAsync` and
 * the `{ hidden: true }` plugin) but never sets the system-bar behavior, so the
 * window keeps Android's default `BEHAVIOR_DEFAULT`: any *touch* re-reveals the
 * bar and it comes back as an inset bar, which under edge-to-edge grows the
 * bottom safe-area inset and pushes screen content upward. `setBehaviorAsync`
 * is a documented no-op once edge-to-edge is enabled, so the behavior can only
 * be changed natively.
 *
 * This plugin sets `BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE` once in
 * `MainActivity.onCreate`. The bar then stays hidden on touch and is only
 * revealed transiently by a swipe, as an overlay that does not inset content.
 * The behavior is a window-level property, so a single call survives the
 * later `controller.hide(...)` calls that `expo-navigation-bar` issues.
 */

const IMPORT_LINE = "import androidx.core.view.WindowInsetsControllerCompat";
const BEHAVIOR_SYMBOL = "BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE";
const BEHAVIOR_SNIPPET = [
    "    // Sticky-immersive navigation bar: a touch no longer reveals the hidden",
    "    // bar (which would inset and push content up); only a swipe reveals it",
    "    // transiently as an overlay. See plugins/withImmersiveNavBar.js.",
    "    WindowInsetsControllerCompat(window, window.decorView).systemBarsBehavior =",
    "      WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE",
].join("\n");

function withImmersiveNavBar(config) {
    return withMainActivity(config, (mod) => {
        if (mod.modResults.language !== "kt") {
            WarningAggregator.addWarningAndroid(
                "withImmersiveNavBar",
                "MainActivity is not Kotlin; skipping sticky-immersive navigation bar patch.",
            );
            return mod;
        }

        mod.modResults.contents = applyKotlinPatch(mod.modResults.contents);
        return mod;
    });
}

function applyKotlinPatch(contents) {
    if (contents.includes(BEHAVIOR_SYMBOL)) {
        return contents;
    }

    let patched = contents;

    if (!patched.includes(IMPORT_LINE)) {
        patched = patched.replace(/^(package .*\n)/m, `$1\n${IMPORT_LINE}\n`);
    }

    // Insert the behavior call immediately after the first super.onCreate(...)
    // inside onCreate so it runs as the activity comes up.
    const onCreateRegex = /([ \t]*super\.onCreate\([^)]*\)[ \t]*\n)/;
    if (onCreateRegex.test(patched)) {
        patched = patched.replace(onCreateRegex, `$1\n${BEHAVIOR_SNIPPET}\n`);
    } else {
        WarningAggregator.addWarningAndroid(
            "withImmersiveNavBar",
            "Could not find super.onCreate(...) in MainActivity; sticky-immersive navigation bar patch not applied.",
        );
    }

    return patched;
}

module.exports = withImmersiveNavBar;
// Exported for unit testing of the Kotlin source transformation.
module.exports.applyKotlinPatch = applyKotlinPatch;
