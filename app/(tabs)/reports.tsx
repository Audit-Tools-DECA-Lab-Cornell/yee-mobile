import { useMemo } from "react";
import { ScrollView } from "react-native";
import { Download, FileBarChart, TriangleAlert } from "@tamagui/lucide-icons";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import { REPORT_COMPARISON_ROWS, type ReportComparisonRow } from "lib/yee-demo-data";

/**
 * Scoring tab with base-score focused visuals for auditor workflows.
 */
export default function ReportsScreen() {
    const averageBaseScore = useMemo(() => {
        return calculateAverageBaseScore(REPORT_COMPARISON_ROWS);
    }, []);
    const topBasePlace = useMemo(() => {
        return getTopBasePlace(REPORT_COMPARISON_ROWS);
    }, []);
    const topBasePlaceLabel = topBasePlace?.placeName ?? "No data";
    const topBasePlaceScore = topBasePlace?.baseScore ?? 0;

    return (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            <YStack gap="$4">
                <Text fontSize={28} fontWeight="700">
                    Scoring Summary
                </Text>
                <Paragraph color="$color10">
                    Base scoring snapshots for your assigned field audits.
                </Paragraph>
            </YStack>

            <XStack gap="$3">
                <YStack
                    flex={1}
                    borderWidth={1}
                    borderColor="$borderColor"
                    rounded={16}
                    p="$4"
                    bg="$background"
                    gap="$2"
                >
                    <Paragraph color="$color10">Average Base Score</Paragraph>
                    <Text fontSize={28} fontWeight="700" color="$blue10">
                        {averageBaseScore}%
                    </Text>
                </YStack>
                <YStack
                    flex={1}
                    borderWidth={1}
                    borderColor="$borderColor"
                    rounded={16}
                    p="$4"
                    bg="$background"
                    gap="$2"
                >
                    <Paragraph color="$color10">Top Place Score</Paragraph>
                    <Text fontSize={28} fontWeight="700" color="$green10">
                        {topBasePlaceScore}%
                    </Text>
                    <Paragraph color="$color10">{topBasePlaceLabel}</Paragraph>
                </YStack>
            </XStack>

            <YStack
                borderWidth={1}
                borderColor="$borderColor"
                rounded={16}
                p="$4"
                bg="$background"
                gap="$2"
            >
                <Paragraph color="$color10">Base score by place</Paragraph>
                {REPORT_COMPARISON_ROWS.map((row) => {
                    return (
                        <YStack key={row.id} gap="$1.5">
                            <XStack justify="space-between" items="center">
                                <YStack flex={1}>
                                    <Paragraph>{row.placeName}</Paragraph>
                                    <Paragraph color="$color10" fontSize={12}>
                                        Ready for export
                                    </Paragraph>
                                </YStack>
                                <Paragraph color="$blue10" fontWeight="700">
                                    {row.baseScore}%
                                </Paragraph>
                            </XStack>
                            <YStack height={10} rounded={999} bg="$background">
                                <YStack
                                    height={10}
                                    rounded={999}
                                    bg="$blue9"
                                    width={`${row.baseScore}%`}
                                />
                            </YStack>
                        </YStack>
                    );
                })}
            </YStack>

            <YStack
                borderWidth={1}
                borderColor="$orange7"
                rounded={16}
                bg="$orange3"
                p="$4"
                gap="$2"
            >
                <XStack items="center" gap="$2">
                    <TriangleAlert size={16} color="$orange10" />
                    <Text color="$orange10" fontWeight="700">
                        Weighted scoring is planned for a future release.
                    </Text>
                </XStack>
                <Paragraph color="$orange10">
                    The current mobile form does not yet include pre-audit weighting questions.
                </Paragraph>
            </YStack>

            <YStack
                borderWidth={1}
                borderColor="$borderColor"
                rounded={16}
                bg="$background"
                p="$4"
                gap="$3"
            >
                <XStack items="center" gap="$2">
                    <FileBarChart size={16} color="$purple10" />
                    <Text fontSize={19} fontWeight="700">
                        Export preview
                    </Text>
                </XStack>
                <Paragraph color="$color10">
                    Export package includes base score, section table, and metadata.
                </Paragraph>
                <XStack gap="$2">
                    <Button flex={1} size="$3">
                        <XStack items="center" gap="$2">
                            <Download size={14} />
                            <Text>Export PDF</Text>
                        </XStack>
                    </Button>
                    <Button flex={1} size="$3" theme="purple">
                        <XStack items="center" gap="$2">
                            <Download size={14} />
                            <Text>Export CSV</Text>
                        </XStack>
                    </Button>
                </XStack>
            </YStack>
        </ScrollView>
    );
}

/**
 * Calculate average base score for the visible rows.
 *
 * @param rows Report comparison rows.
 * @returns Rounded average score.
 */
function calculateAverageBaseScore(rows: readonly ReportComparisonRow[]): number {
    if (rows.length === 0) {
        return 0;
    }

    const sum = rows.reduce((currentSum, row) => {
        return currentSum + row.baseScore;
    }, 0);

    return Math.round(sum / rows.length);
}

/**
 * Resolve the row with the highest base score.
 *
 * @param rows Report comparison rows.
 * @returns Best base score row or null for empty data.
 */
function getTopBasePlace(rows: readonly ReportComparisonRow[]): ReportComparisonRow | null {
    const [firstRow, ...remainingRows] = rows;
    if (firstRow === undefined) {
        return null;
    }

    return remainingRows.reduce((highest, current) => {
        if (current.baseScore > highest.baseScore) {
            return current;
        }

        return highest;
    }, firstRow);
}
