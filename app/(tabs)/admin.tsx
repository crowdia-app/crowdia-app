import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Clipboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/theme';
import { fetchDashboardStats, type DashboardStats } from '@/services/admin';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuthStore } from '@/stores/authStore';

export default function AdminDashboard() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { userProfile } = useAuthStore();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadStats = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    const data = await fetchDashboardStats();
    setStats(data);

    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadStats();
  }, []);

  // Redirect if not admin
  if (!userProfile?.is_admin) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>
          You do not have permission to access this page.
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={Colors.magenta[500]} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={() => loadStats(true)} tintColor={Colors.magenta[500]} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Admin Dashboard</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>System Overview</Text>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          title="Users"
          value={stats?.totalUsers || 0}
          icon="person.fill"
          color={Colors.magenta[500]}
          backgroundColor={colors.card}
          textColor={colors.text}
        />
        <StatCard
          title="Events"
          value={stats?.totalEvents || 0}
          subtitle={`${stats?.publishedEvents || 0} published`}
          icon="calendar"
          color={Colors.magenta[400]}
          backgroundColor={colors.card}
          textColor={colors.text}
        />
        <StatCard
          title="Organizers"
          value={stats?.totalOrganizers || 0}
          subtitle={`${stats?.verifiedOrganizers || 0} verified`}
          icon="building.2.fill"
          color={Colors.magenta[600]}
          backgroundColor={colors.card}
          textColor={colors.text}
        />
        <StatCard
          title="Locations"
          value={stats?.totalLocations || 0}
          icon="map.fill"
          color={Colors.magenta[700]}
          backgroundColor={colors.card}
          textColor={colors.text}
        />
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.card }]}
          onPress={() => router.push('/admin/agents')}
        >
          <View style={styles.actionCardIcon}>
            <IconSymbol name="cpu" size={24} color={Colors.magenta[500]} />
          </View>
          <View style={styles.actionCardContent}>
            <Text style={[styles.actionCardTitle, { color: colors.text }]}>AI Agents</Text>
            <Text style={[styles.actionCardSubtitle, { color: colors.subtext }]}>
              View agent runs and logs
            </Text>
          </View>
          <IconSymbol name="chevron.right" size={20} color={colors.subtext} />
        </TouchableOpacity>

        {stats && stats.unpublishedEvents > 0 && (
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.card }]}
            onPress={() => {
              // TODO: Navigate to unpublished events
            }}
          >
            <View style={styles.actionCardIcon}>
              <IconSymbol name="exclamationmark.triangle.fill" size={24} color={Colors.yellow[500]} />
            </View>
            <View style={styles.actionCardContent}>
              <Text style={[styles.actionCardTitle, { color: colors.text }]}>Pending Events</Text>
              <Text style={[styles.actionCardSubtitle, { color: colors.subtext }]}>
                {stats.unpublishedEvents} events awaiting review
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color={colors.subtext} />
          </TouchableOpacity>
        )}
      </View>

      {/* Run Agents */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Run Agents Manually</Text>
        <Text style={[styles.helpText, { color: colors.subtext }]}>
          Agents run automatically via cron, but you can also trigger them manually via CLI:
        </Text>

        <View style={[styles.commandCard, { backgroundColor: colors.card }]}>
          <View style={styles.commandHeader}>
            <IconSymbol name="wand.and.stars" size={20} color={Colors.magenta[500]} />
            <Text style={[styles.commandTitle, { color: colors.text }]}>Extraction Agent</Text>
          </View>
          <View style={[styles.commandBox, { backgroundColor: colors.background }]}>
            <Text style={[styles.commandText, { color: colors.text }]}>npm run agents:extract</Text>
          </View>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={() => {
              Clipboard.setString('npm run agents:extract');
              Alert.alert('Copied!', 'Command copied to clipboard');
            }}
          >
            <IconSymbol name="doc.on.doc" size={16} color={Colors.magenta[500]} />
            <Text style={[styles.copyButtonText, { color: Colors.magenta[500] }]}>Copy Command</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.commandCard, { backgroundColor: colors.card }]}>
          <View style={styles.commandHeader}>
            <IconSymbol name="magnifyingglass.circle.fill" size={20} color={Colors.magenta[500]} />
            <Text style={[styles.commandTitle, { color: colors.text }]}>Discovery Agent</Text>
          </View>
          <View style={[styles.commandBox, { backgroundColor: colors.background }]}>
            <Text style={[styles.commandText, { color: colors.text }]}>npm run agents:discover</Text>
          </View>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={() => {
              Clipboard.setString('npm run agents:discover');
              Alert.alert('Copied!', 'Command copied to clipboard');
            }}
          >
            <IconSymbol name="doc.on.doc" size={16} color={Colors.magenta[500]} />
            <Text style={[styles.copyButtonText, { color: Colors.magenta[500] }]}>Copy Command</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.commandCard, { backgroundColor: colors.card }]}>
          <View style={styles.commandHeader}>
            <IconSymbol name="bolt.fill" size={20} color={Colors.magenta[500]} />
            <Text style={[styles.commandTitle, { color: colors.text }]}>Run Both Agents</Text>
          </View>
          <View style={[styles.commandBox, { backgroundColor: colors.background }]}>
            <Text style={[styles.commandText, { color: colors.text }]}>npm run agents:both</Text>
          </View>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={() => {
              Clipboard.setString('npm run agents:both');
              Alert.alert('Copied!', 'Command copied to clipboard');
            }}
          >
            <IconSymbol name="doc.on.doc" size={16} color={Colors.magenta[500]} />
            <Text style={[styles.copyButtonText, { color: Colors.magenta[500] }]}>Copy Command</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Agent Activity */}
      {stats && stats.recentAgentRuns.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Agent Activity</Text>

          {stats.recentAgentRuns.map((run) => (
            <TouchableOpacity
              key={run.id}
              style={[styles.agentRunCard, { backgroundColor: colors.card }]}
              onPress={() => router.push(`/admin/agents/${run.id}`)}
            >
              <View style={styles.agentRunHeader}>
                <Text style={[styles.agentRunType, { color: colors.text }]}>
                  {run.agent_type === 'extraction' ? 'Extraction' : 'Discovery'} Agent
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        run.status === 'completed'
                          ? Colors.green[100]
                          : run.status === 'failed'
                          ? Colors.red[100]
                          : Colors.yellow[100],
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color:
                          run.status === 'completed'
                            ? Colors.green[700]
                            : run.status === 'failed'
                            ? Colors.red[700]
                            : Colors.yellow[700],
                      },
                    ]}
                  >
                    {run.status}
                  </Text>
                </View>
              </View>
              {run.summary && (
                <Text style={[styles.agentRunSummary, { color: colors.subtext }]} numberOfLines={2}>
                  {run.summary}
                </Text>
              )}
              <Text style={[styles.agentRunTime, { color: colors.subtext }]}>
                {new Date(run.started_at).toLocaleString()}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={() => router.push('/admin/agents')}
          >
            <Text style={[styles.viewAllText, { color: Colors.magenta[500] }]}>View All Runs →</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  subtitle?: string;
  icon: string;
  color: string;
  backgroundColor: string;
  textColor: string;
}

function StatCard({ title, value, subtitle, icon, color, backgroundColor, textColor }: StatCardProps) {
  return (
    <View style={[styles.statCard, { backgroundColor }]}>
      <IconSymbol name={icon} size={24} color={color} />
      <Text style={[styles.statValue, { color: textColor }]}>{value.toLocaleString()}</Text>
      <Text style={[styles.statTitle, { color: textColor }]}>{title}</Text>
      {subtitle && <Text style={[styles.statSubtitle, { color: Colors.charcoal[400] }]}>{subtitle}</Text>}
    </View>
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
  header: {
    padding: Spacing.lg,
    paddingTop: Spacing.xxxl,
  },
  title: {
    fontSize: Typography.xxl,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: Typography.md,
    marginTop: Spacing.xs,
  },
  errorText: {
    fontSize: Typography.md,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  statValue: {
    fontSize: Typography.xxl,
    fontWeight: '700',
    marginTop: Spacing.sm,
  },
  statTitle: {
    fontSize: Typography.sm,
    marginTop: Spacing.xs,
  },
  statSubtitle: {
    fontSize: Typography.xs,
    marginTop: Spacing.xxs,
  },
  section: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  actionCardIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.magenta[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  actionCardContent: {
    flex: 1,
  },
  actionCardTitle: {
    fontSize: Typography.md,
    fontWeight: '600',
  },
  actionCardSubtitle: {
    fontSize: Typography.sm,
    marginTop: Spacing.xxs,
  },
  agentRunCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  agentRunHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  agentRunType: {
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
  agentRunSummary: {
    fontSize: Typography.sm,
    marginBottom: Spacing.xs,
  },
  agentRunTime: {
    fontSize: Typography.xs,
  },
  viewAllButton: {
    alignItems: 'center',
    padding: Spacing.md,
  },
  viewAllText: {
    fontSize: Typography.md,
    fontWeight: '600',
  },
  helpText: {
    fontSize: Typography.sm,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  commandCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  commandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  commandTitle: {
    fontSize: Typography.md,
    fontWeight: '600',
  },
  commandBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  commandText: {
    fontSize: Typography.sm,
    fontFamily: 'monospace',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  copyButtonText: {
    fontSize: Typography.sm,
    fontWeight: '600',
  },
});
