import { InlineLoader, LoadingScreen } from "./LoadingScreen";

export interface LoadingStateProps {
    /** Optional caption rendered with the loader. */
    readonly label?: string;
    /** Fill the available space and center vertically. Defaults to `true`. */
    readonly fullScreen?: boolean;
}

/**
 * Centered loading indicator used while async screen data resolves.
 *
 * Thin compatibility wrapper over the branded loaders: full-screen use renders
 * the {@link LoadingScreen} (YEE mark in a pulsing brand ring) and inline use
 * renders the {@link InlineLoader} (small brand spinner with caption).
 *
 * @param props Loading-state props including an optional `label`.
 * @returns The branded loader for the requested layout.
 */
export function LoadingState({ label, fullScreen = true }: LoadingStateProps) {
    if (fullScreen) {
        return <LoadingScreen {...(label === undefined ? {} : { message: label })} />;
    }
    return <InlineLoader {...(label === undefined ? {} : { message: label })} />;
}
