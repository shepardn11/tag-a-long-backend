import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { profileAPI, messageAPI } from '../api/endpoints';
import { ActivityListing } from '../types';

interface User {
  id: string;
  username: string;
  display_name: string;
  profile_photo_url?: string;
}

interface Props {
  visible: boolean;
  listing: ActivityListing | null;
  onClose: () => void;
}

export default function ShareActivityModal({ visible, listing, onClose }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const searchUsers = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setUsers([]);
      return;
    }
    setSearching(true);
    try {
      const results = await profileAPI.searchUsers(query);
      setUsers(results);
    } catch {
      setUsers([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSend = async () => {
    if (!selectedUser || !listing) return;
    setSending(true);
    try {
      const activityData = {
        id: listing.id,
        title: listing.title,
        date: listing.date,
        time: listing.time,
        location: listing.location,
        photo_url: listing.photo_url || listing.profile_photo_url,
        description: listing.description,
        display_name: listing.display_name || listing.username,
      };
      const message = `[activity_share]${JSON.stringify(activityData)}`;
      const conversation = await messageAPI.getOrCreateConversation(selectedUser.id);
      await messageAPI.sendMessage(conversation.id, message);
      setSent(true);
      setTimeout(() => {
        handleClose();
      }, 1200);
    } catch {
      Alert.alert('Error', 'Could not send the activity. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setUsers([]);
    setSelectedUser(null);
    setSent(false);
    onClose();
  };

  const renderUserItem = ({ item }: { item: User }) => {
    const isSelected = selectedUser?.id === item.id;
    return (
      <TouchableOpacity
        style={[styles.userItem, isSelected && styles.userItemSelected]}
        onPress={() => setSelectedUser(isSelected ? null : item)}
      >
        {item.profile_photo_url ? (
          <Image source={{ uri: item.profile_photo_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={22} color="#999" />
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={styles.displayName}>{item.display_name}</Text>
          <Text style={styles.username}>@{item.username}</Text>
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color="#E8572A" />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={26} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Share Activity</Text>
          <TouchableOpacity
            onPress={handleSend}
            disabled={!selectedUser || sending || sent}
            style={[styles.sendButton, (!selectedUser || sent) && styles.sendButtonDisabled]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.sendButtonText}>{sent ? 'Sent!' : 'Send'}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Activity Preview */}
        {listing && (
          <View style={styles.previewCard}>
            {(listing.photo_url || listing.profile_photo_url) && (
              <Image
                source={{ uri: listing.photo_url || listing.profile_photo_url }}
                style={styles.previewImage}
                contentFit="cover"
              />
            )}
            <View style={styles.previewInfo}>
              <Text style={styles.previewTitle} numberOfLines={1}>{listing.title}</Text>
              <Text style={styles.previewMeta} numberOfLines={1}>📍 {listing.location}</Text>
            </View>
          </View>
        )}

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor="#bbb"
            value={searchQuery}
            onChangeText={searchUsers}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => searchUsers('')}>
              <Ionicons name="close-circle" size={18} color="#bbb" />
            </TouchableOpacity>
          )}
        </View>

        {/* Selected user chip */}
        {selectedUser && (
          <View style={styles.selectedChip}>
            <Text style={styles.selectedChipText}>To: {selectedUser.display_name}</Text>
            <TouchableOpacity onPress={() => setSelectedUser(null)}>
              <Ionicons name="close-circle" size={18} color="#999" />
            </TouchableOpacity>
          </View>
        )}

        {/* User list */}
        {searching ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#E8572A" />
          </View>
        ) : searchQuery.length < 2 ? (
          <View style={styles.center}>
            <Ionicons name="search" size={48} color="#e0e0e0" />
            <Text style={styles.emptyText}>Search for someone to send this to</Text>
          </View>
        ) : users.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="people-outline" size={48} color="#e0e0e0" />
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        ) : (
          <FlatList
            data={users}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  sendButton: {
    backgroundColor: '#E8572A',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden',
    backgroundColor: '#fafafa',
  },
  previewImage: {
    width: 56,
    height: 56,
  },
  previewInfo: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  previewMeta: {
    fontSize: 12,
    color: '#888',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3ef',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E8572A44',
  },
  selectedChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E8572A',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    gap: 12,
  },
  userItemSelected: {
    backgroundColor: '#fff8f6',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  username: {
    fontSize: 13,
    color: '#888',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 15,
    color: '#bbb',
    marginTop: 12,
    textAlign: 'center',
  },
});
