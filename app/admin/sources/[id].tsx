import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Text } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';
import {
  fetchEntityById,
  updateEntity,
  deleteEntity,
  fetchSelectOptions,
} from '@/services/admin-entities';
import { AdminDetailView, StatusBadge, BooleanBadge, type DetailSection } from '@/components/admin/AdminDetailView';
import { AdminFormModal, type FormField } from '@/components/admin/AdminFormModal';

const TYPE_COLORS: Record<string, { color: string; bgColor: string }> = {
  website: { color: Colors.blue[700], bgColor: Colors.blue[100] },
  instagram: { color: Colors.magenta[500], bgColor: Colors.magenta[100] },
  facebook: { color: Colors.blue[700], bgColor: Colors.blue[100] },
  ra: { color: Colors.yellow[700], bgColor: Colors.yellow[100] },
  aggregator: { color: Colors.green[700], bgColor: Colors.green[100] },
  other: { color: Colors.red[700], bgColor: Colors.red[100] },
};

const SOURCE_TYPES = ['website', 'instagram', 'facebook', 'ra', 'aggregator', 'other'];

export default function SourceDetailScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userProfile } = useAuthStore();

  const [source, setSource] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [organizerName, setOrganizerName] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [organizerOptions, setOrganizerOptions] = useState<{ label: string; value: string }[]>([]);
  const [locationOptions, setLocationOptions] = useState<{ label: string; value: string }[]>([]);

  const loadData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);

    const data = await fetchEntityById('event_sources', id);
    setSource(data);

    if (data?.organizer_id) {
      const org = await fetchEntityById('organizers', data.organizer_id, 'id, organization_name');
      setOrganizerName(org?.organization_name ?? null);
    } else {
      setOrganizerName(null);
    }

    if (data?.location_id) {
      const loc = await fetchEntityById('locations', data.location_id, 'id, name');
      setLocationName(loc?.name ?? null);
    } else {
      setLocationName(null);
    }

    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    fetchSelectOptions('organizers', 'organization_name').then(setOrganizerOptions);
    fetchSelectOptions('locations', 'name').then(setLocationOptions);
  }, []);

  if (!userProfile?.is_admin) {
    return (
      <>
        <Stack.Screen options={{ title: 'Access Denied' }} />
        <Text style={{ color: colors.text, padding: 20 }}>Admin access required.</Text>
      </>
    );
  }

  const formatDate = (val: string | null | undefined) => {
    if (!val) return '-';
    return new Date(val).toLocaleString();
  };

  const typeColors = TYPE_COLORS[source?.type] || TYPE_COLORS.other;

  const sections: DetailSection[] = source
    ? [
        {
          title: 'Source Info',
          fields: [
            { label: 'URL', value: source.url ?? '-' },
            {
              label: 'Type',
              value: <StatusBadge status={source.type ?? '-'} color={typeColors.color} bgColor={typeColors.bgColor} />,
            },
            { label: 'Instagram', value: source.instagram_handle ?? '-' },
            { label: 'Enabled', value: <BooleanBadge value={!!source.enabled} /> },
            { label: 'Aggregator', value: <BooleanBadge value={!!source.is_aggregator} /> },
          ],
        },
        {
          title: 'Scraping',
          fields: [
            { label: 'Reliability', value: source.reliability_score?.toString() ?? '-' },
            { label: 'Frequency', value: source.scrape_frequency ?? '-' },
            { label: 'Last Scraped', value: formatDate(source.last_scraped_at) },
          ],
        },
        {
          title: 'Discovery',
          fields: [
            { label: 'Auto Discovered', value: <BooleanBadge value={!!source.auto_discovered} /> },
            { label: 'Method', value: source.discovered_via_method ?? '-' },
            { label: 'Via Source ID', value: source.discovered_via_source_id ?? '-' },
            { label: 'Discovered At', value: formatDate(source.discovered_at) },
          ],
        },
        {
          title: 'Relationships',
          fields: [
            { label: 'Organizer', value: organizerName ?? '-' },
            { label: 'Location', value: locationName ?? '-' },
          ],
        },
        {
          title: 'Timestamps',
          fields: [
            { label: 'Created', value: formatDate(source.created_at) },
            { label: 'Updated', value: formatDate(source.updated_at) },
          ],
        },
      ]
    : [];

  const formFields: FormField[] = [
    { key: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://...' },
    {
      key: 'type',
      label: 'Type',
      type: 'select',
      required: true,
      options: SOURCE_TYPES.map((t) => ({ label: t, value: t })),
    },
    { key: 'instagram_handle', label: 'Instagram Handle', type: 'text', placeholder: '@handle' },
    { key: 'enabled', label: 'Enabled', type: 'boolean' },
    { key: 'is_aggregator', label: 'Is Aggregator', type: 'boolean' },
    { key: 'reliability_score', label: 'Reliability Score', type: 'number', placeholder: '0-100' },
    { key: 'organizer_id', label: 'Organizer', type: 'select', options: organizerOptions },
    { key: 'location_id', label: 'Location', type: 'select', options: locationOptions },
  ];

  const handleSubmit = async (values: Record<string, any>) => {
    if (!id) return;
    await updateEntity('event_sources', id, values);
    loadData();
  };

  const handleDelete = () => {
    Alert.alert('Delete Source', 'Are you sure you want to delete this event source?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          await deleteEntity('event_sources', id);
          router.back();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: source?.url ? 'Source Detail' : 'Loading...', headerBackTitle: 'Sources' }} />

      <AdminDetailView
        title={source?.url ?? 'Event Source'}
        subtitle={source?.type ?? undefined}
        sections={sections}
        isLoading={isLoading}
        onEdit={() => setShowModal(true)}
        onDelete={handleDelete}
      />

      <AdminFormModal
        visible={showModal}
        title="Edit Source"
        fields={formFields}
        initialValues={source || {}}
        onSubmit={handleSubmit}
        onClose={() => setShowModal(false)}
        onDelete={handleDelete}
      />
    </>
  );
}
