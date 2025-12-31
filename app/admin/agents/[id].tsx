import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/theme';
import { fetchAgentRunWithLogs, type AgentRunWithLogs } from '@/services/admin';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { AgentLog } from '@/types/database';

type LogFilter = 'all' | AgentLog['level'];

export default function AgentRunDetail() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { id } = useLocalSearchParams<{ id: string }>();

  const [runData, setRunData] = useState<AgentRunWithLogs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [logFilter, setLogFilter] = useState<LogFilter>('all');

  const loadRun = async (isRefresh = false) => {
    if (!id) return;

    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    const data = await fetchAgentRunWithLogs(id);
    setRunData(data);

    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadRun();
  }, [id]);

  if (isLoading || !runData) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Agent Run',
            headerBackTitle: 'Agents',
          }}
        />
        <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={Colors.magenta[500]} />
        </View>
      </>
    );
  }

  const getStatusColor = (status: AgentRunWithLogs['status']) => {
    switch (status) {
      case 'completed':
        return { bg: Colors.green[100], text: Colors.green[700] };
      case 'failed':
        return { bg: Colors.red[100], text: Colors.red[700] };
      case 'running':
        return { bg: Colors.yellow[100], text: Colors.yellow[700] };
    }
  };

  const getLogLevelColor = (level: AgentLog['level']) => {
    switch (level) {
      case 'error':
        return Colors.red[500];
      case 'warn':
        return Colors.yellow[600];
      case 'success':
        return Colors.green[600];
      case 'info':
        return Colors.blue[500];
      case 'debug':
        return Colors.charcoal[400];
    }
  };

  const statusColors = getStatusColor(runData.status);
  const duration = runData.duration_seconds
    ? `${Math.floor(runData.duration_seconds / 60)}m ${runData.duration_seconds % 60}s`
    : 'In progress';

  const filteredLogs = logFilter === 'all'
    ? runData.logs
    : runData.logs.filter(log => log.level === logFilter);

  const logCounts = {
    all: runData.logs.length,
    error: runData.logs.filter(l => l.level === 'error').length,
    warn: runData.logs.filter(l => l.level === 'warn').length,
    info: runData.logs.filter(l => l.level === 'info').length,
    success: runData.logs.filter(l => l.level === 'success').length,
    debug: runData.logs.filter(l => l.level === 'debug').length,
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: `${runData.agent_type === 'extraction' ? 'Extraction' : 'Discovery'} Run`,
          headerBackTitle: 'Agents',
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadRun(true)}
            tintColor={Colors.magenta[500]}
          />
        }
      >
        {/* Breadcrumb */}
        <View style={styles.breadcrumb}>
          <Text style={[styles.breadcrumbText, { color: colors.subtext }]}>Admin</Text>
          <IconSymbol name="chevron.right" size={12} color={colors.subtext} />
          <Text style={[styles.breadcrumbText, { color: colors.subtext }]}>Agents</Text>
          <IconSymbol name="chevron.right" size={12} color={colors.subtext} />
          <Text style={[styles.breadcrumbText, { color: Colors.magenta[500] }]}>Run Details</Text>
        </View>

        {/* Run Info */}
        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <View style={styles.infoHeader}>
            <IconSymbol
              name={runData.agent_type === 'extraction' ? 'wand.and.stars' : 'magnifyingglass.circle.fill'}
              size={32}
              color={Colors.magenta[500]}
            />
            <View style={styles.infoHeaderText}>
              <Text style={[styles.infoTitle, { color: colors.text }]}>
                {runData.agent_type === 'extraction' ? 'Extraction' : 'Discovery'} Agent
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                <Text style={[styles.statusText, { color: statusColors.text }]}>{runData.status}</Text>
              </View>
            </View>
          </View>

          {runData.summary && (
            <Text style={[styles.summary, { color: colors.text }]}>{runData.summary}</Text>
          )}

          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={[styles.metaLabel, { color: colors.subtext }]}>Started</Text>
              <Text style={[styles.metaValue, { color: colors.text }]}>
                {new Date(runData.started_at).toLocaleString()}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={[styles.metaLabel, { color: colors.subtext }]}>Duration</Text>
              <Text style={[styles.metaValue, { color: colors.text }]}>{duration}</Text>
            </View>
          </View>

          {runData.error_message && (
            <View style={[styles.errorBox, { backgroundColor: Colors.red[50] }]}>
              <IconSymbol name="exclamationmark.triangle.fill" size={16} color={Colors.red[500]} />
              <Text style={[styles.errorMessage, { color: Colors.red[700] }]}>
                {runData.error_message}
              </Text>
            </View>
          )}
        </View>

        {/* Stats */}
        {runData.stats && Object.keys(runData.stats).length > 0 && (
          <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.statsTitle, { color: colors.text }]}>Statistics</Text>
            <View style={styles.statsGrid}>
              {Object.entries(runData.stats).map(([key, value]) => (
                <View key={key} style={styles.statItem}>
                  <Text style={[styles.statValue, { color: Colors.magenta[500] }]}>
                    {typeof value === 'number' ? value.toLocaleString() : String(value)}
                  </Text>
                  <Text style={[styles.statKey, { color: colors.subtext }]}>{key}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Log Filters */}
        <View style={styles.filtersContainer}>
          <Text style={[styles.filtersTitle, { color: colors.text }]}>Logs</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
            <FilterButton
              label={`All (${logCounts.all})`}
              active={logFilter === 'all'}
              onPress={() => setLogFilter('all')}
              color={Colors.charcoal[600]}
            />
            {logCounts.error > 0 && (
              <FilterButton
                label={`Errors (${logCounts.error})`}
                active={logFilter === 'error'}
                onPress={() => setLogFilter('error')}
                color={Colors.red[500]}
              />
            )}
            {logCounts.warn > 0 && (
              <FilterButton
                label={`Warnings (${logCounts.warn})`}
                active={logFilter === 'warn'}
                onPress={() => setLogFilter('warn')}
                color={Colors.yellow[600]}
              />
            )}
            {logCounts.success > 0 && (
              <FilterButton
                label={`Success (${logCounts.success})`}
                active={logFilter === 'success'}
                onPress={() => setLogFilter('success')}
                color={Colors.green[600]}
              />
            )}
            {logCounts.info > 0 && (
              <FilterButton
                label={`Info (${logCounts.info})`}
                active={logFilter === 'info'}
                onPress={() => setLogFilter('info')}
                color={Colors.blue[500]}
              />
            )}
            {logCounts.debug > 0 && (
              <FilterButton
                label={`Debug (${logCounts.debug})`}
                active={logFilter === 'debug'}
                onPress={() => setLogFilter('debug')}
                color={Colors.charcoal[400]}
              />
            )}
          </ScrollView>
        </View>

        {/* Logs */}
        <View style={styles.logsContainer}>
          {filteredLogs.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.subtext }]}>No logs found</Text>
          ) : (
            filteredLogs.map((log) => (
              <View key={log.id} style={[styles.logEntry, { backgroundColor: colors.card }]}>
                <View style={styles.logHeader}>
                  <View style={[styles.logLevel, { backgroundColor: getLogLevelColor(log.level) + '20' }]}>
                    <Text style={[styles.logLevelText, { color: getLogLevelColor(log.level) }]}>
                      {log.level.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.logTime, { color: colors.subtext }]}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
                <Text style={[styles.logMessage, { color: colors.text }]}>{log.message}</Text>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <View style={[styles.logMetadata, { backgroundColor: colors.background }]}>
                    <Text style={[styles.logMetadataText, { color: colors.subtext }]}>
                      {JSON.stringify(log.metadata, null, 2)}
                    </Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </>
  );
}

interface FilterButtonProps {
  label: string;
  active: boolean;
  onPress: () => void;
  color: string;
}

function FilterButton({ label, active, onPress, color }: FilterButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.filterButton,
        active && styles.filterButtonActive,
        { backgroundColor: active ? color : Colors.charcoal[100], borderColor: color },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.filterButtonText, { color: active ? 'white' : color }]}>{label}</Text>
    </TouchableOpacity>
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
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  breadcrumbText: {
    fontSize: Typography.sm,
    fontWeight: '500',
  },
  infoCard: {
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  infoHeader: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  infoHeaderText: {
    flex: 1,
  },
  infoTitle: {
    fontSize: Typography.xl,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: Typography.sm,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  summary: {
    fontSize: Typography.md,
    marginBottom: Spacing.md,
  },
  metaGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: Typography.xs,
    marginBottom: Spacing.xxs,
  },
  metaValue: {
    fontSize: Typography.sm,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  errorMessage: {
    flex: 1,
    fontSize: Typography.sm,
  },
  statsCard: {
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  statsTitle: {
    fontSize: Typography.lg,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  statItem: {
    minWidth: '30%',
  },
  statValue: {
    fontSize: Typography.xl,
    fontWeight: '700',
  },
  statKey: {
    fontSize: Typography.xs,
    marginTop: Spacing.xxs,
  },
  filtersContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  filtersTitle: {
    fontSize: Typography.lg,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  filters: {
    flexDirection: 'row',
  },
  filterButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
    borderWidth: 1,
  },
  filterButtonActive: {
    // Active state handled by backgroundColor
  },
  filterButtonText: {
    fontSize: Typography.sm,
    fontWeight: '600',
  },
  logsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  logEntry: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  logLevel: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.xs,
  },
  logLevelText: {
    fontSize: Typography.xxs,
    fontWeight: '700',
  },
  logTime: {
    fontSize: Typography.xs,
  },
  logMessage: {
    fontSize: Typography.sm,
    lineHeight: 20,
  },
  logMetadata: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  logMetadataText: {
    fontSize: Typography.xs,
    fontFamily: 'monospace',
  },
  emptyText: {
    fontSize: Typography.sm,
    textAlign: 'center',
    padding: Spacing.lg,
  },
});
