import { useMemo, useState } from "react";
import { ScrollView } from "react-native";
import { Columns3, Download, FileBarChart } from "@tamagui/lucide-icons";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import {
  REPORT_COMPARISON_ROWS,
  type ReportComparisonRow,
} from "lib/yee-demo-data";
import { RoleToggle } from "components/RoleToggle";

type ScoreView = "base" | "weighted";

/**
 * Report tab with base-vs-weighted YEE score visuals.
 */
export default function ReportsScreen() {
  const [scoreView, setScoreView] = useState<ScoreView>(
    "weighted",
  );

  const averageBaseScore = useMemo(() => {
    return calculateAverageScore(REPORT_COMPARISON_ROWS, "base");
  }, []);

  const averageWeightedScore = useMemo(() => {
    return calculateAverageScore(REPORT_COMPARISON_ROWS, "weighted");
  }, []);

  const topWeightedPlace = useMemo(() => {
    return REPORT_COMPARISON_ROWS.reduce((highest, current) => {
      if (current.weightedScore > highest.weightedScore) {
        return current;
      }

      return highest;
    }, REPORT_COMPARISON_ROWS[0]);
  }, []);
  const highestLiftPlace = useMemo(() => {
    return REPORT_COMPARISON_ROWS.reduce((highest, current) => {
      const highestLift = highest.weightedScore - highest.baseScore;
      const currentLift = current.weightedScore - current.baseScore;

      if (currentLift > highestLift) {
        return current;
      }

      return highest;
    }, REPORT_COMPARISON_ROWS[0]);
  }, []);
  const weightedLift = averageWeightedScore - averageBaseScore;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <YStack gap="$4">
        <Text fontSize={28} fontWeight="700">
          YEE Reports
        </Text>
        <Paragraph color="$color10">
          Compare base scoring with weighted scoring from pre-audit priorities.
        </Paragraph>
        <RoleToggle />
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
          <Paragraph color="$color10">Average Weighted Score</Paragraph>
          <Text fontSize={28} fontWeight="700" color="$purple10">
            {averageWeightedScore}%
          </Text>
        </YStack>
      </XStack>

      <YStack borderWidth={1} borderColor="$borderColor" rounded={16} p="$4" bg="$background" gap="$2">
        <Paragraph color="$color10">Weighted lift across visible places</Paragraph>
        <Text fontSize={22} fontWeight="700" color={weightedLift >= 0 ? "$green10" : "$red10"}>
          {weightedLift >= 0 ? "+" : ""}
          {weightedLift} points
        </Text>
      </YStack>

      <XStack gap="$3">
        <YStack
          flex={1}
          borderWidth={1}
          borderColor="$borderColor"
          rounded={16}
          p="$4"
          bg="$background"
          gap="$1"
          shadowColor="$shadowColor"
          shadowOpacity={0.08}
          shadowRadius={8}
          shadowOffset={{ width: 0, height: 3 }}
          elevation={2}
        >
          <Paragraph color="$color10">Top Weighted Place</Paragraph>
          <Text fontWeight="700">{topWeightedPlace.placeName}</Text>
          <Paragraph color="$purple10" fontWeight="700">
            {topWeightedPlace.weightedScore}%
          </Paragraph>
        </YStack>
        <YStack
          flex={1}
          borderWidth={1}
          borderColor="$borderColor"
          rounded={16}
          p="$4"
          bg="$background"
          gap="$1"
          shadowColor="$shadowColor"
          shadowOpacity={0.08}
          shadowRadius={8}
          shadowOffset={{ width: 0, height: 3 }}
          elevation={2}
        >
          <Paragraph color="$color10">Largest Weighted Lift</Paragraph>
          <Text fontWeight="700">{highestLiftPlace.placeName}</Text>
          <Paragraph color="$green10" fontWeight="700">
            +{highestLiftPlace.weightedScore - highestLiftPlace.baseScore} points
          </Paragraph>
        </YStack>
      </XStack>

      <YStack
        borderWidth={1}
        borderColor="$borderColor"
        rounded={16}
        p="$4"
        bg="$background"
        gap="$3"
        shadowColor="$shadowColor"
        shadowOpacity={0.08}
        shadowRadius={8}
        shadowOffset={{ width: 0, height: 3 }}
        elevation={2}
      >
        <XStack justify="space-between" items="center">
          <XStack items="center" gap="$2">
            <Columns3 size={16} color="$blue10" />
            <Text fontSize={19} fontWeight="700">
              Side-by-side comparison
            </Text>
          </XStack>
          <XStack gap="$1.5" borderWidth={1} borderColor="$borderColor" rounded={999} p="$1">
            <Button
              size="$2"
              theme={scoreView === "base" ? "blue" : null}
              rounded={999}
              onPress={() => {
                setScoreView("base");
              }}
            >
              Base
            </Button>
            <Button
              size="$2"
              theme={scoreView === "weighted" ? "purple" : null}
              rounded={999}
              onPress={() => {
                setScoreView("weighted");
              }}
            >
              Weighted
            </Button>
          </XStack>
        </XStack>

        {REPORT_COMPARISON_ROWS.map((row) => {
          const score = scoreView === "base" ? row.baseScore : row.weightedScore;
          const barColor = scoreView === "base" ? "$blue9" : "$purple9";
          const weightedDelta = row.weightedScore - row.baseScore;

          return (
            <YStack key={row.id} gap="$1.5">
              <XStack justify="space-between" items="center">
                <YStack flex={1}>
                  <Paragraph>{row.placeName}</Paragraph>
                  <Paragraph color="$green10" fontSize={12}>
                    Lift +{weightedDelta}
                  </Paragraph>
                </YStack>
                <XStack gap="$2" items="center">
                  <Paragraph color={barColor} fontWeight="700">
                    {score}%
                  </Paragraph>
                  <YStack rounded={999} px="$2" py="$1" bg="$green3">
                    <Paragraph color="$green10" fontWeight="700">
                      +{weightedDelta}
                    </Paragraph>
                  </YStack>
                </XStack>
              </XStack>
              <YStack height={10} rounded={999} bg="$background">
                <YStack
                  height={10}
                  rounded={999}
                  bg={barColor}
                  width={`${score}%`}
                />
              </YStack>
            </YStack>
          );
        })}
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
          Export package includes base score, weighted score, section table, and metadata.
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
 * Calculate average score for the selected score mode.
 *
 * @param rows Report comparison rows.
 * @param scoreView Selected score type.
 * @returns Rounded average score.
 */
function calculateAverageScore(
  rows: readonly ReportComparisonRow[],
  scoreView: ScoreView,
): number {
  if (rows.length === 0) {
    return 0;
  }

  const sum = rows.reduce((currentSum, row) => {
    return currentSum + (scoreView === "base" ? row.baseScore : row.weightedScore);
  }, 0);

  return Math.round(sum / rows.length);
}
