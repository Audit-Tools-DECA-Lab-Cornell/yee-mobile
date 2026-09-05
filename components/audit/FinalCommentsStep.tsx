import { memo } from "react";
import { useAuditSessionStore } from "stores/yee-audit-session-store";
import { useSurveyPalette } from "./survey-theme";
import { CommentField, SurveyCard } from "./primitives";

/** Step 9 - overall comments before review and submission. */
export const FinalCommentsStep = memo(function FinalCommentsStep() {
    const value = useAuditSessionStore((state) => state.draft?.comments ?? "");
    const setComments = useAuditSessionStore((state) => state.setComments);
    const readOnly = useAuditSessionStore((state) => state.readOnly);
    const commentPrompt = useAuditSessionStore(
        (state) => state.instrument?.finalCommentsPrompt ?? "",
    );
    const palette = useSurveyPalette();
    return (
        <SurveyCard
            title="Final comments"
            description="Add any overall comments you want included before review and submission."
        >
            <CommentField
                label={commentPrompt || "Overall survey comments"}
                value={value}
                onCommit={setComments}
                palette={palette}
                disabled={readOnly}
            />
        </SurveyCard>
    );
});
