import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/theme';
import { fetchAgentRuns, type AgentRun } from '@/services/admin';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Stack } from 'expo-router';

type ViewMode = 'chronological' | 'grouped';

export default function AgentsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('chronological');

  const loadRuns = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    const data = await fetchAgentRuns();
    setRuns(data);

    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadRuns();
  }, []);

  const extractionRuns = runs.filter((r) => r.agent_type === 'extraction');
  const discoveryRuns = runs.filter((r) => r.agent_type === 'discovery');

  const getStatusColor = (status: AgentRun['status']) => {
    switch (status) {
      case 'completed':
        return { bg: Colors.green[100], text: Colors.green[700] };
      case 'failed':
        return { bg: Colors.red[100], text: Colors.red[700] };
      case 'running':
        return { bg: Colors.yellow[100], text: Colors.yellow[700] };
    }
  };

  const renderRun = (run: AgentRun) => {
    const statusColors = getStatusColor(run.status);
    const duration = run.duration_seconds
      ? `${Math.floor(run.duration_seconds / 60)}m ${run.duration_seconds % 60}s`
      : 'In progress';

    return (
      <TouchableOpacity
        key={run.id}
        style={[styles.runCard, { backgroundColor: colors.card }]}
        onPress={() => router.push(`/admin/agents/${run.id}`)}
      >
        <View style={styles.runHeader}>
          <View style={styles.runTitle}>
            <IconSymbol
              name={run.agent_type === 'extraction' ? 'wand.and.stars' : 'magnifyingglass.circle.fill'}
              size={20}
              color={Colors.magenta[500]}
            />
            <Text style={[styles.runType, { color: colors.text }]}>
              {run.agent_type === 'extraction' ? 'Extraction' : 'Discovery'} Agent
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.text }]}>{run.status}</Text>
          </View>
        </View>

        {run.summary && (
          <Text style={[styles.runSummary, { color: colors.subtext }]} numberOfLines={2}>
            {run.summary}
          </Text>
        )}

        <View style={styles.runMeta}>
          <View style={styles.metaItem}>
            <IconSymbol name="clock" size={14} color={colors.subtext} />
            <Text style={[styles.metaText, { color: colors.subtext }]}>
              {new Date(run.started_at).toLocaleString()}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <IconSymbol name="timer" size={14} color={colors.subtext} />
            <Text style={[styles.metaText, { color: colors.subtext }]}>{duration}</Text>
          </View>
        </View>

        {run.error_message && (
          <Text style={[styles.errorText, { color: Colors.red[500] }]} numberOfLines={2}>
            Error: {run.error_message}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'AI Agents',
            headerBackTitle: 'Admin',
          }}
        />
        <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={Colors.magenta[500]} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'AI Agents',
          headerBackTitle: 'Admin',
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadRuns(true)}
            tintColor={Colors.magenta[500]}
          />
        }
      >
        {/* Stats Summary */}
        <View style={styles.statsContainer}>
          <View style={[styles.statBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{extractionRuns.length}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>Extraction Runs</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{discoveryRuns.length}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>Discovery Runs</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{runs.length}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>Total Runs</Text>
          </View>
        </View>

        {/* View Mode Switcher */}
        <View style={styles.switcherContainer}>
          <TouchableOpacity
            style={[
              styles.switcherButton,
              viewMode === 'chronological' && styles.switcherButtonActive,
              { backgroundColor: viewMode === 'chronological' ? Colors.magenta[500] : colors.card },
            ]}
            onPress={() => setViewMode('chronological')}
          >
            <Text
              style={[
                styles.switcherText,
                { color: viewMode === 'chronological' ? 'white' : colors.text },
              ]}
            >
              Chronological
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.switcherButton,
              viewMode === 'grouped' && styles.switcherButtonActive,
              { backgroundColor: viewMode === 'grouped' ? Colors.magenta[500] : colors.card },
            ]}
            onPress={() => setViewMode('grouped')}
          >
            <Text
              style={[styles.switcherText, { color: viewMode === 'grouped' ? 'white' : colors.text }]}
            >
              Grouped
            </Text>
          </TouchableOpacity>
        </View>

        {/* Runs List */}
        <View style={styles.runsContainer}>
          {viewMode === 'chronological' ? (
            <>
              {runs.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.subtext }]}>No agent runs yet</Text>
              ) : (
                runs.map(renderRun)
              )}
            </>
          ) : (
            <>
              {/* Extraction Runs */}
              <View style={styles.group}>
                <View style={styles.groupHeader}>
                  <IconSymbol name="wand.and.stars" size={20} color={Colors.magenta[500]} />
                  <Text style={[styles.groupTitle, { color: colors.text }]}>
                    Extraction Agent ({extractionRuns.length})
                  </Text>
                </View>
                {extractionRuns.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.subtext }]}>No extraction runs</Text>
                ) : (
                  extractionRuns.map(renderRun)
                )}
              </View>

              {/* Discovery Runs */}
              <View style={styles.group}>
                <View style={styles.groupHeader}>
                  <IconSymbol name="magnifyingglass.circle.fill" size={20} color={Colors.magenta[500]} />
                  <Text style={[styles.groupTitle, { color: colors.text }]}>
                    Discovery Agent ({discoveryRuns.length})
                  </Text>
                </View>
                {discoveryRuns.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.subtext }]}>No discovery runs</Text>
                ) : (
                  discoveryRuns.map(renderRun)
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  statBox: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  statValue: {
    fontSize: Typography.xl,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: Typography.xs,
    marginTop: Spacing.xxs,
    textAlign: 'center',
  },
  switcherContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  switcherButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  switcherButtonActive: {
    // Active state handled by backgroundColor
  },
  switcherText: {
    fontSize: Typography.md,
    fontWeight: '600',
  },
  runsContainer: {
    padding: Spacing.lg,
    paddingTop: 0,
  },
  group: {
    marginBottom: Spacing.xl,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  groupTitle: {
    fontSize: Typography.lg,
    fontWeight: '600',
  },
  runCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  runHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  runTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  runType: {
    fontSize: Typography.md,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: Typography.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  runSummary: {
    fontSize: Typography.sm,
    marginBottom: Spacing.sm,
  },
  runMeta: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  metaText: {
    fontSize: Typography.xs,
  },
  errorText: {
    fontSize: Typography.xs,
    marginTop: Spacing.sm,
  },
  emptyText: {
    fontSize: Typography.sm,
    textAlign: 'center',
    padding: Spacing.lg,
  },
});
