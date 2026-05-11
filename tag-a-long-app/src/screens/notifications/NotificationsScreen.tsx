import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { notificationAPI } from '../../api/endpoints';
import { navigationRef } from '../../navigation/navigationRef';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: string;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICON: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  request_received: { name: 'person-add', color: '#E8572A' },
  request_accepted: { name: 'checkmark-circle', color: '#34c759' },
  request_rejected: { name: 'close-circle', color: '#ff3b30' },
};

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen({ navigation }: any) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await notificationAPI.getAll() as any;
      setNotifications(result.notifications ?? result);
    } catch {
      // ignore — list stays as-is
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchNotifications(); }, []));

  const handleMarkAllRead = async () => {
    await notificationAPI.markAllAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleTap = async (item: Notification) => {
    if (!item.is_read) {
      await notificationAPI.markAsRead(item.id);
      setNotifications(prev =>
        prev.map(n => n.id === item.id ? { ...n, is_read: true } : n)
      );
    }

    try {
      const data = item.data ? JSON.parse(item.data) : null;
      if (!data) return;

      if (item.type === 'request_received' && data.listing_id) {
        navigation.navigate('ActivityDetail', { activityId: data.listing_id });
      } else if (item.type === 'request_accepted' && data.conversation_id) {
        navigationRef.navigate('Main' as never, {
          screen: 'Messages',
          params: {
            screen: 'Chat',
            params: {
              conversationId: data.conversation_id,
              otherUser: {
                id: data.other_user_id,
                username: data.other_user_username,
                display_name: data.other_user_display_name,
                profile_photo_url: data.other_user_photo,
              },
            },
          },
        } as never);
      }
    } catch (_) {}
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const icon = TYPE_ICON[item.type] ?? { name: 'notifications' as const, color: '#999' };
    return (
      <TouchableOpacity
        style={[styles.row, !item.is_read && styles.rowUnread]}
        onPress={() => handleTap(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrap, { backgroundColor: icon.color + '18' }]}>
          <Ionicons name={icon.name} size={22} color={icon.color} />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.title, !item.is_read && styles.titleUnread]}>{item.title}</Text>
          <Text style={styles.body}>{item.body}</Text>
          <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
        </View>
        {!item.is_read && <View style={styles.dot} />}
      </TouchableOpacity>
    );
  };

  const hasUnread = notifications.some(n => !n.is_read);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="chevron-back" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {hasUnread ? (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAll}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 90 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#E8572A" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchNotifications(true); }}
              tintColor="#E8572A"
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="notifications-off-outline" size={52} color="#ddd" />
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          }
          contentContainerStyle={notifications.length === 0 ? { flex: 1 } : undefined}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  back: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  markAll: { paddingHorizontal: 12, paddingVertical: 6 },
  markAllText: { fontSize: 14, color: '#E8572A', fontWeight: '500' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f8f8',
    gap: 12,
  },
  rowUnread: { backgroundColor: '#fffdf5' },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  title: { fontSize: 15, color: '#333', marginBottom: 2 },
  titleUnread: { fontWeight: '600', color: '#000' },
  body: { fontSize: 13, color: '#666', lineHeight: 18 },
  time: { fontSize: 12, color: '#aaa', marginTop: 4 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E8572A',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#aaa', marginTop: 12 },
});
