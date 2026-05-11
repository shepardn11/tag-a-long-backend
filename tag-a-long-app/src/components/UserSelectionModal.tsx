import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { profileAPI } from '../api/endpoints';

interface User {
  id: string;
  username: string;
  display_name: string;
  profile_photo_url?: string;
}

interface UserSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectUsers: (users: User[]) => void;
  selectedUsers: User[];
}

export default function UserSelectionModal({
  visible,
  onClose,
  onSelectUsers,
  selectedUsers,
}: UserSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [tempSelectedUsers, setTempSelectedUsers] = useState<User[]>(selectedUsers);

  useEffect(() => {
    if (visible) {
      setTempSelectedUsers(selectedUsers);
      if (searchQuery.length >= 2) {
        searchUsers();
      }
    }
  }, [visible, searchQuery]);

  const searchUsers = async () => {
    if (searchQuery.length < 2) {
      setUsers([]);
      return;
    }

    setLoading(true);
    try {
      const results = await profileAPI.searchUsers(searchQuery);
      setUsers(results);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (user: User) => {
    const isSelected = tempSelectedUsers.some(u => u.id === user.id);
    if (isSelected) {
      setTempSelectedUsers(tempSelectedUsers.filter(u => u.id !== user.id));
    } else {
      setTempSelectedUsers([...tempSelectedUsers, user]);
    }
  };

  const handleDone = () => {
    onSelectUsers(tempSelectedUsers);
    onClose();
  };

  const handleCancel = () => {
    setTempSelectedUsers(selectedUsers);
    setSearchQuery('');
    setUsers([]);
    onClose();
  };

  const renderUserItem = ({ item }: { item: User }) => {
    const isSelected = tempSelectedUsers.some(u => u.id === item.id);

    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => toggleUser(item)}
      >
        {item.profile_photo_url ? (
          <Image
            source={{ uri: item.profile_photo_url }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={24} color="#999" />
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={styles.displayName}>{item.display_name}</Text>
          <Text style={styles.username}>@{item.username}</Text>
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Ionicons name="checkmark" size={18} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSelectedUser = ({ item }: { item: User }) => (
    <View style={styles.selectedUserChip}>
      {item.profile_photo_url ? (
        <Image
          source={{ uri: item.profile_photo_url }}
          style={styles.chipAvatar}
        />
      ) : (
        <View style={styles.chipAvatarPlaceholder}>
          <Ionicons name="person" size={12} color="#999" />
        </View>
      )}
      <Text style={styles.chipText}>{item.display_name}</Text>
      <TouchableOpacity onPress={() => toggleUser(item)}>
        <Ionicons name="close-circle" size={18} color="#999" />
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel}>
            <Ionicons name="close" size={28} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tag Friends</Text>
          <TouchableOpacity onPress={handleDone}>
            <Text style={styles.doneButton}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Selected Users */}
        {tempSelectedUsers.length > 0 && (
          <View style={styles.selectedSection}>
            <FlatList
              horizontal
              data={tempSelectedUsers}
              renderItem={renderSelectedUser}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectedList}
            />
          </View>
        )}

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users by name or username..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        {/* User List */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        ) : searchQuery.length < 2 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="search" size={48} color="#ddd" />
            <Text style={styles.emptyText}>Search for users to tag</Text>
            <Text style={styles.emptySubtext}>Type at least 2 characters</Text>
          </View>
        ) : users.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="people-outline" size={48} color="#ddd" />
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        ) : (
          <FlatList
            data={users}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
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
  },
  doneButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  selectedSection: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 12,
  },
  selectedList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  selectedUserChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
  },
  chipAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  chipAvatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    margin: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: '#666',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 4,
  },
});
