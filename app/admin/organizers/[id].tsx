import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert, TouchableOpacity, TextInput, ActivityIndicator, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Magenta } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';
import { fetchEntityById, updateEntity, deleteEntity, syncOrganizerSources } from '@/services/admin-entities';
import { AdminDetailView, BooleanBadge, type DetailSection } from '@/components/admin/AdminDetailView';
import { AdminFormModal, type FormField } from '@/components/admin/AdminFormModal';
import {
  fetchOrganizerTeamMembers,
  addOrganizerTeamMember,
  removeOrganizerTeamMember,
  searchUsersByUsername,
  type OrganizerTeamMember,
} from '@/services/admin-rbac';

const formFields: FormField[] = [
  { key: 'organization_name', label: 'Organization Name', type: 'text', required: true },
  { key: 'logo_url', label: 'Logo URL', type: 'text' },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'instagram_handle', label: 'Instagram Handle', type: 'text' },
  { key: 'website_url', label: 'Website URL', type: 'text' },
  { key: 'address', label: 'Address', type: 'text' },
  { key: 'is_verified', label: 'Verified', type: 'boolean' },
];

export default function OrganizerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { userProfile } = useAuthStore();

  const [item, setItem] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  const [teamMembers, setTeamMembers] = useState<OrganizerTeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<{ id: string; username: string | null; display_name: string | null }[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [addingRole, setAddingRole] = useState<'manager' | 'member'>('manager');

  const isSuperAdmin = !!(userProfile as any)?.is_super_admin;

  const loadData = async () => {
    setIsLoading(true);
    const result = await fetchEntityById('organizers', id!);
    setItem(result);
    setIsLoading(false);
  };

  const loadTeamMembers = useCallback(async () => {
    if (!id) return;
    setTeamLoading(true);
    try {
      const members = await fetchOrganizerTeamMembers(id);
      setTeamMembers(members);
    } catch {
      // ignore
    } finally {
      setTeamLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadData();
      if (userProfile?.is_admin) loadTeamMembers();
    }
  }, [id]);

  const handleUserSearch = async (q: string) => {
    setUserQuery(q);
    if (q.length < 2) {
      setUserResults([]);
      return;
    }
    setUserSearchLoading(true);
    try {
      const results = await searchUsersByUsername(q);
      setUserResults(results);
    } finally {
      setUserSearchLoading(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!id || !userProfile?.id) return;
    try {
      await addOrganizerTeamMember(id, userId, addingRole, userProfile.id);
      setUserQuery('');
      setUserResults([]);
      loadTeamMembers();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeOrganizerTeamMember(memberId);
      loadTeamMembers();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to remove member');
    }
  };

  if (!userProfile?.is_admin) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Stack.Screen options={{ title: 'Organizer' }} />
        <Text style={{ color: colors.text }}>Access denied</Text>
      </View>
    );
  }

  const formatDate = (val: string | null) =>
    val ? new Date(val).toLocaleString() : '-';

  const sections: DetailSection[] = item
    ? [
        {
          title: 'Organization',
          fields: [
            { label: 'Name', value: item.organization_name || '-' },
            { label: 'Description', value: item.description || '-' },
            { label: 'Email', value: item.email || '-' },
            { label: 'Phone', value: item.phone || '-' },
            { label: 'Instagram', value: item.instagram_handle || '-' },
            { label: 'Website', value: item.website_url || '-' },
            { label: 'Address', value: item.address || '-' },
            { label: 'Logo URL', value: item.logo_url || '-' },
          ],
        },
        {
          title: 'Verification',
          fields: [
            { label: 'Verified', value: <BooleanBadge value={!!item.is_verified} /> },
            { label: 'Verified At', value: formatDate(item.verified_at) },
            { label: 'Verified By', value: item.verified_by || '-' },
          ],
        },
        {
          title: 'Timestamps',
          fields: [
            { label: 'Created', value: formatDate(item.created_at) },
          ],
        },
      ]
    : [];

  const handleEdit = async (values: Record<string, any>) => {
    await updateEntity('organizers', id!, values);
    await syncOrganizerSources(id!, values);
    setModalVisible(false);
    loadData();
  };

  const handleDelete = async () => {
    try {
      await deleteEntity('organizers', id!);
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to delete');
    }
  };

  return (
    <>
      <AdminDetailView
        title={item?.organization_name || 'Organizer'}
        subtitle={item?.email}
        sections={sections}
        isLoading={isLoading}
        onEdit={() => setModalVisible(true)}
        onDelete={handleDelete}
        actions={item ? [{ label: 'View Public Profile', icon: 'eye', onPress: () => router.push(`/organizer/${id}`) }] : undefined}
        footer={
          isSuperAdmin && item ? (
            <TeamMembersPanel
              members={teamMembers}
              loading={teamLoading}
              userQuery={userQuery}
              userResults={userResults}
              userSearchLoading={userSearchLoading}
              addingRole={addingRole}
              colors={colors}
              onSearch={handleUserSearch}
              onSetRole={setAddingRole}
              onAdd={handleAddMember}
              onRemove={handleRemoveMember}
            />
          ) : undefined
        }
      />
      <AdminFormModal
        visible={modalVisible}
        title="Edit Organizer"
        fields={formFields}
        initialValues={item || {}}
        onSubmit={handleEdit}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}

interface TeamMembersPanelProps {
  members: OrganizerTeamMember[];
  loading: boolean;
  userQuery: string;
  userResults: { id: string; username: string | null; display_name: string | null }[];
  userSearchLoading: boolean;
  addingRole: 'manager' | 'member';
  colors: any;
  onSearch: (q: string) => void;
  onSetRole: (role: 'manager' | 'member') => void;
  onAdd: (userId: string) => void;
  onRemove: (memberId: string) => void;
}

function TeamMembersPanel({
  members, loading, userQuery, userResults, userSearchLoading,
  addingRole, colors, onSearch, onSetRole, onAdd, onRemove,
}: TeamMembersPanelProps) {
  return (
    <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
        Team Members
      </Text>

      {loading ? (
        <ActivityIndicator color={Magenta[500]} />
      ) : members.length === 0 ? (
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
          No team members yet.
        </Text>
      ) : (
        members.map((m) => (
          <View
            key={m.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: colors.card,
              borderRadius: 8,
              padding: 10,
              marginBottom: 8,
            }}
          >
            <View>
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>
                {(m.user as any)?.username || (m.user as any)?.display_name || m.user_id}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{m.role}</Text>
            </View>
            <TouchableOpacity
              onPress={() => onRemove(m.id)}
              style={{
                backgroundColor: '#e53e3e22',
                borderRadius: 6,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text style={{ color: '#e53e3e', fontSize: 12 }}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13, marginTop: 8, marginBottom: 6 }}>
        Add member
      </Text>

      <View style={{ flexDirection: 'row', marginBottom: 8, gap: 8 }}>
        {(['manager', 'member'] as const).map((r) => (
          <TouchableOpacity
            key={r}
            onPress={() => onSetRole(r)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 6,
              backgroundColor: addingRole === r ? Magenta[500] : colors.card,
            }}
          >
            <Text style={{ color: addingRole === r ? '#fff' : colors.textSecondary, fontSize: 12 }}>
              {r}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        placeholder="Search by username..."
        placeholderTextColor={colors.textSecondary}
        value={userQuery}
        onChangeText={onSearch}
        style={{
          backgroundColor: colors.card,
          color: colors.text,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          fontSize: 13,
          marginBottom: 4,
        }}
      />

      {userSearchLoading && <ActivityIndicator color={Magenta[500]} size="small" style={{ marginVertical: 4 }} />}

      {userResults.map((u) => (
        <TouchableOpacity
          key={u.id}
          onPress={() => onAdd(u.id)}
          style={{
            backgroundColor: colors.card,
            borderRadius: 8,
            padding: 10,
            marginBottom: 4,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 13 }}>
            {u.username || u.display_name || u.id}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Tap to add as {addingRole}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
