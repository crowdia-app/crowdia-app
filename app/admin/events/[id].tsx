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
import { AdminDetailView, BooleanBadge, type DetailSection } from '@/components/admin/AdminDetailView';
import { AdminFormModal, type FormField } from '@/components/admin/AdminFormModal';

export default function EventDetailScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userProfile } = useAuthStore();

  const [event, setEvent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [organizerOptions, setOrganizerOptions] = useState<{ label: string; value: string }[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<{ label: string; value: string }[]>([]);
  const [locationOptions, setLocationOptions] = useState<{ label: string; value: string }[]>([]);

  const loadData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);

    const data = await fetchEntityById(
      'events',
      id,
      '*, category:categories(name), location:locations(name, address), organizer:organizers!events_organizer_id_fkey(organization_name)'
    );
    setEvent(data);
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    fetchSelectOptions('organizers', 'organization_name').then(setOrganizerOptions);
    fetchSelectOptions('categories', 'name').then(setCategoryOptions);
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
    const d = new Date(val);
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const sections: DetailSection[] = event
    ? [
        {
          title: 'Event Info',
          fields: [
            { label: 'Title', value: event.title ?? '-' },
            { label: 'Description', value: event.description ?? '-' },
            { label: 'Cover Image', value: event.cover_image_url ?? '-' },
            { label: 'Event URL', value: event.event_url ?? '-' },
            { label: 'Ticket URL', value: event.external_ticket_url ?? '-' },
          ],
        },
        {
          title: 'Schedule',
          fields: [
            { label: 'Start', value: formatDate(event.event_start_time) },
            { label: 'End', value: formatDate(event.event_end_time) },
          ],
        },
        {
          title: 'Classification',
          fields: [
            { label: 'Category', value: event.category?.name ?? '-' },
            { label: 'Source', value: event.source ?? '-' },
            { label: 'Confidence', value: event.confidence_score?.toString() ?? '-' },
            { label: 'Published', value: <BooleanBadge value={!!event.is_published} /> },
            { label: 'Featured', value: <BooleanBadge value={!!event.is_featured} /> },
          ],
        },
        {
          title: 'Relationships',
          fields: [
            { label: 'Organizer', value: event.organizer?.organization_name ?? '-' },
            {
              label: 'Location',
              value: event.location
                ? `${event.location.name}${event.location.address ? ' - ' + event.location.address : ''}`
                : '-',
            },
          ],
        },
        {
          title: 'Timestamps',
          fields: [
            { label: 'Created', value: formatDate(event.created_at) },
            { label: 'Updated', value: formatDate(event.updated_at) },
          ],
        },
      ]
    : [];

  const formFields: FormField[] = [
    { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Event title' },
    { key: 'description', label: 'Description', type: 'textarea', required: true, placeholder: 'Event description...' },
    { key: 'cover_image_url', label: 'Cover Image URL', type: 'text', required: true, placeholder: 'https://...' },
    { key: 'event_start_time', label: 'Start Time', type: 'text', required: true, placeholder: '2026-03-15T19:00:00' },
    { key: 'event_end_time', label: 'End Time', type: 'text', required: true, placeholder: '2026-03-15T23:00:00' },
    { key: 'external_ticket_url', label: 'Ticket URL', type: 'text', placeholder: 'https://...' },
    { key: 'is_published', label: 'Published', type: 'boolean' },
    { key: 'is_featured', label: 'Featured', type: 'boolean' },
    { key: 'organizer_id', label: 'Organizer', type: 'select', options: organizerOptions },
    { key: 'category_id', label: 'Category', type: 'select', options: categoryOptions },
    { key: 'location_id', label: 'Location', type: 'select', options: locationOptions },
  ];

  const handleSubmit = async (values: Record<string, any>) => {
    if (!id) return;
    await updateEntity('events', id, values);
    loadData();
  };

  const handleDelete = () => {
    Alert.alert('Delete Event', 'Are you sure you want to delete this event?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          await deleteEntity('events', id);
          router.back();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: event?.title ?? 'Loading...', headerBackTitle: 'Events' }} />

      <AdminDetailView
        title={event?.title ?? 'Event'}
        subtitle={event?.category?.name ?? undefined}
        sections={sections}
        isLoading={isLoading}
        onEdit={() => setShowModal(true)}
        onDelete={handleDelete}
      />

      <AdminFormModal
        visible={showModal}
        title="Edit Event"
        fields={formFields}
        initialValues={event || {}}
        onSubmit={handleSubmit}
        onClose={() => setShowModal(false)}
        onDelete={handleDelete}
      />
    </>
  );
}
