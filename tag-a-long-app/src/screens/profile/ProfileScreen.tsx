// Profile Screen - User profile and settings
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
import LightboxModal from '../../components/LightboxModal';
import { useAuthStore } from '../../store/authStore';
import { profileAPI, safetyAPI } from '../../api/endpoints';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '../../utils/imageUpload';
import apiClient from '../../api/client';

export default function ProfileScreen() {
  const { user, logout, setUser, updateUser } = useAuthStore();
  const [editVisible, setEditVisible] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editGallery, setEditGallery] = useState<(string | null)[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [blockedVisible, setBlockedVisible] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<Array<{ id: string; display_name: string; username: string; profile_photo_url?: string }>>([]);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const refreshProfile = async () => {
        try {
          const freshUser = await profileAPI.getMyProfile();
          setUser(freshUser);
        } catch (error) {
          console.error('Error refreshing profile:', error);
        }
      };
      refreshProfile();
    }, [setUser])
  );

  const openEdit = () => {
    setEditBio(user?.bio || '');
    setEditCity(user?.city || '');
    const gallery = user?.photo_gallery || [];
    // Pad to 5 slots
    const padded: (string | null)[] = [...gallery];
    while (padded.length < 5) padded.push(null);
    setEditGallery(padded);
    setEditVisible(true);
  };

  const pickImage = async (): Promise<string | null> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow photo access in Settings.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return null;
    return result.assets[0].uri;
  };

  const handleEditProfilePhoto = async () => {
    if (!user) return;
    const uri = await pickImage();
    if (!uri) return;
    try {
      setUploadingProfile(true);
      const publicUrl = await uploadImage(uri, user.id);
      const updatedUser = await profileAPI.uploadPhoto(publicUrl);
      updateUser(updatedUser);
      Alert.alert('Updated', 'Profile photo updated!');
    } catch (e) {
      Alert.alert('Error', 'Could not update profile photo.');
    } finally {
      setUploadingProfile(false);
    }
  };

  const handleEditGalleryPhoto = async (index: number) => {
    if (!user) return;
    const uri = await pickImage();
    if (!uri) return;
    try {
      setUploadingIndex(index);
      const publicUrl = await uploadImage(uri, user.id);

      // Remove old photo at this index from backend first
      const existing = editGallery[index];
      if (existing) {
        await apiClient.getInstance().delete('/profile/gallery', { data: { photo_url: existing } });
      }

      // Add new photo
      const response = await apiClient.getInstance().post('/profile/gallery', { photo_url: publicUrl });
      const newGallery = [...editGallery];
      newGallery[index] = publicUrl;
      setEditGallery(newGallery);
      if (user) updateUser({ ...user, photo_gallery: response.data.data.photo_gallery });
    } catch (e) {
      Alert.alert('Error', 'Could not update photo.');
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleRemoveGalleryPhoto = async (index: number) => {
    const photoUrl = editGallery[index];
    if (!photoUrl) return;
    try {
      await apiClient.getInstance().delete('/profile/gallery', { data: { photo_url: photoUrl } });
      const newGallery = [...editGallery];
      newGallery[index] = null;
      setEditGallery(newGallery);
      if (user) updateUser({ ...user, photo_gallery: (user.photo_gallery || []).filter(u => u !== photoUrl) });
    } catch (e) {
      Alert.alert('Error', 'Could not remove photo.');
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const updatedUser = await profileAPI.updateProfile({ bio: editBio.trim(), city: editCity.trim() });
      updateUser(updatedUser);
      setEditVisible(false);
    } catch (e) {
      Alert.alert('Error', 'Could not save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const openBlockedUsers = async () => {
    try {
      const users = await safetyAPI.getBlockedUsers();
      setBlockedUsers(users);
      setEditVisible(false);
      setTimeout(() => setBlockedVisible(true), 400);
    } catch {
      Alert.alert('Error', 'Could not load blocked users.');
    }
  };

  const handleUnblock = (userId: string, displayName: string) => {
    Alert.alert(`Unblock ${displayName}?`, '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          try {
            await safetyAPI.unblockUser(userId);
            setBlockedUsers(prev => prev.filter(u => u.id !== userId));
          } catch {
            Alert.alert('Error', 'Could not unblock user.');
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    setEditVisible(false);
    setDeletePassword('');
    setTimeout(() => setDeleteVisible(true), 400);
  };

  const confirmDeleteAccount = async () => {
    if (!deletePassword) {
      Alert.alert('Error', 'Please enter your password.');
      return;
    }
    try {
      setIsDeleting(true);
      await apiClient.getInstance().delete('/auth/account', { data: { password: deletePassword } });
      setDeleteVisible(false);
      await logout();
    } catch (e: any) {
      const msg = e.response?.data?.error?.message || 'Could not delete account.';
      Alert.alert('Error', msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <TouchableOpacity style={styles.editIcon} onPress={openEdit}>
          <Ionicons name="pencil-outline" size={22} color="#E8572A" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {user && (
          <>
            <View style={styles.heroSection}>
              <TouchableOpacity
                style={styles.photoContainer}
                onPress={() => user.profile_photo_url && setLightboxPhoto(user.profile_photo_url)}
                activeOpacity={0.85}
              >
                {user.profile_photo_url ? (
                  <Image source={{ uri: user.profile_photo_url }} style={styles.profilePhoto} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="person" size={52} color="#ccc" />
                  </View>
                )}
              </TouchableOpacity>

              <Text style={styles.displayName}>{user.display_name || user.username}</Text>

              <View style={styles.metaRow}>
                {user.city && (
                  <View style={styles.metaItem}>
                    <Ionicons name="location-outline" size={14} color="#888" />
                    <Text style={styles.metaText}>{user.city}</Text>
                  </View>
                )}
                {user.instagram_handle && (
                  <View style={styles.metaItem}>
                    <Ionicons name="logo-instagram" size={14} color="#888" />
                    <Text style={styles.metaText}>@{user.instagram_handle}</Text>
                  </View>
                )}
              </View>

              {user.bio && <Text style={styles.bio}>{user.bio}</Text>}
            </View>

            <View style={styles.divider} />

            {user.photo_gallery && user.photo_gallery.length > 0 && (
              <View style={styles.gallerySection}>
                <Text style={styles.galleryTitle}>Photos</Text>
                <View style={styles.galleryGrid}>
                  {user.photo_gallery.map((photoUrl: string, index: number) => (
                    <TouchableOpacity key={index} style={styles.galleryPhotoContainer} onPress={() => setLightboxPhoto(photoUrl)} activeOpacity={0.85}>
                      <Image source={{ uri: photoUrl }} style={styles.galleryPhoto} contentFit="cover" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#888" />
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditVisible(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator size="small" color="#E8572A" />
                ) : (
                  <Text style={styles.modalSave}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Profile Photo */}
              <Text style={styles.modalSectionTitle}>Profile Photo</Text>
              <TouchableOpacity style={styles.profilePhotoEdit} onPress={handleEditProfilePhoto} disabled={uploadingProfile}>
                {uploadingProfile ? (
                  <ActivityIndicator color="#E8572A" />
                ) : user?.profile_photo_url ? (
                  <>
                    <Image source={{ uri: user.profile_photo_url }} style={styles.editProfilePhoto} />
                    <View style={styles.editPhotoOverlay}>
                      <Ionicons name="camera" size={22} color="#fff" />
                    </View>
                  </>
                ) : (
                  <View style={styles.editProfilePhotoPlaceholder}>
                    <Ionicons name="camera-outline" size={32} color="#E8572A" />
                    <Text style={styles.editPhotoPlaceholderText}>Add Photo</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Bio */}
              <Text style={styles.modalSectionTitle}>Bio</Text>
              <TextInput
                style={styles.bioInput}
                value={editBio}
                onChangeText={setEditBio}
                placeholder="Tell others about yourself"
                multiline
                numberOfLines={3}
                maxLength={150}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{editBio.length}/150</Text>

              {/* City */}
              <Text style={styles.modalSectionTitle}>City</Text>
              <TextInput
                style={styles.cityInput}
                value={editCity}
                onChangeText={setEditCity}
                placeholder="Your city"
                maxLength={100}
              />

              {/* Gallery */}
              <Text style={styles.modalSectionTitle}>Photo Gallery</Text>
              <View style={styles.editGalleryGrid}>
                {editGallery.map((photo, index) => (
                  <View key={index} style={styles.editGalleryBox}>
                    {uploadingIndex === index ? (
                      <View style={styles.editGalleryPlaceholder}>
                        <ActivityIndicator color="#E8572A" />
                      </View>
                    ) : photo ? (
                      <>
                        <Image source={{ uri: photo }} style={styles.editGalleryImage} />
                        <TouchableOpacity style={styles.removePhotoBtn} onPress={() => handleRemoveGalleryPhoto(index)}>
                          <Ionicons name="close-circle" size={22} color="#ef4444" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.editGalleryOverlay} onPress={() => handleEditGalleryPhoto(index)}>
                          <Ionicons name="camera" size={18} color="#fff" />
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity style={styles.editGalleryPlaceholder} onPress={() => handleEditGalleryPhoto(index)}>
                        <Ionicons name="add" size={28} color="#E8572A" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>

              {/* Notification Settings */}
              <TouchableOpacity style={styles.blockedUsersButton} onPress={() => Linking.openSettings()}>
                <Ionicons name="notifications-outline" size={16} color="#aaa" />
                <Text style={styles.blockedUsersText}>Notification Settings</Text>
              </TouchableOpacity>

              {/* Delete Account */}
              <TouchableOpacity style={styles.deleteAccountButton} onPress={handleDeleteAccount}>
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                <Text style={styles.deleteAccountText}>Delete Account</Text>
              </TouchableOpacity>

              {/* Blocked Users */}
              <TouchableOpacity style={styles.blockedUsersButton} onPress={openBlockedUsers}>
                <Ionicons name="ban-outline" size={16} color="#aaa" />
                <Text style={styles.blockedUsersText}>Blocked Users</Text>
              </TouchableOpacity>

              {/* Legal Links */}
              <View style={styles.legalRow}>
                <TouchableOpacity onPress={() => Linking.openURL('https://maddening-sodium-7eb.notion.site/Tag-A-Long-Privacy-Policy-35843955dac980749da8ef205ab7a8d6')}>
                  <Text style={styles.legalLink}>Privacy Policy</Text>
                </TouchableOpacity>
                <Text style={styles.legalDot}>{'�'}</Text>
                <TouchableOpacity onPress={() => Linking.openURL('https://maddening-sodium-7eb.notion.site/Tag-A-Long-Terms-of-Service-35843955dac98002853bcc3efa059da6')}>
                  <Text style={styles.legalLink}>Terms of Service</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Delete Account Modal */}
      <Modal visible={deleteVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setDeleteVisible(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Delete Account</Text>
              <View style={{ width: 60 }} />
            </View>
            <View style={{ padding: 24 }}>
              <Ionicons name="warning-outline" size={48} color="#ef4444" style={{ alignSelf: 'center', marginBottom: 16 }} />
              <Text style={styles.deleteWarningTitle}>This cannot be undone</Text>
              <Text style={styles.deleteWarningText}>
                Deleting your account will permanently remove your profile, listings, messages, and all other data.
              </Text>
              <Text style={[styles.modalSectionTitle, { marginTop: 24 }]}>Enter your password to confirm</Text>
              <TextInput
                style={styles.cityInput}
                value={deletePassword}
                onChangeText={setDeletePassword}
                placeholder="Password"
                secureTextEntry
                autoComplete="off"
                textContentType="none"
              />
              <TouchableOpacity
                style={[styles.deleteConfirmButton, isDeleting && styles.buttonDisabled]}
                onPress={confirmDeleteAccount}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.deleteConfirmText}>Permanently Delete Account</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <LightboxModal uri={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />

      {/* Blocked Users Modal */}
      <Modal visible={blockedVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.blockedHeader}>
            <Text style={styles.blockedTitle}>Blocked Users</Text>
            <TouchableOpacity onPress={() => setBlockedVisible(false)}>
              <Ionicons name="close" size={26} color="#333" />
            </TouchableOpacity>
          </View>
          {blockedUsers.length === 0 ? (
            <View style={styles.blockedEmpty}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#ccc" />
              <Text style={styles.blockedEmptyText}>No blocked users</Text>
            </View>
          ) : (
            <ScrollView>
              {blockedUsers.map(u => (
                <View key={u.id} style={styles.blockedRow}>
                  {u.profile_photo_url ? (
                    <Image source={{ uri: u.profile_photo_url }} style={styles.blockedAvatar} />
                  ) : (
                    <View style={[styles.blockedAvatar, styles.blockedAvatarPlaceholder]}>
                      <Ionicons name="person" size={20} color="#999" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.blockedName}>{u.display_name}</Text>
                    <Text style={styles.blockedUsername}>@{u.username}</Text>
                  </View>
                  <TouchableOpacity style={styles.unblockButton} onPress={() => handleUnblock(u.id, u.display_name)}>
                    <Text style={styles.unblockText}>Unblock</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: { fontSize: 22, fontFamily: 'Lora_600SemiBold_Italic', color: '#E8572A' },
  editIcon: { padding: 4 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  heroSection: { alignItems: 'center', paddingTop: 32, paddingHorizontal: 24, paddingBottom: 28 },
  photoContainer: {
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  profilePhoto: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: '#E8572A' },
  photoPlaceholder: {
    width: 110, height: 110, borderRadius: 55, backgroundColor: '#f5f5f5',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#e0e0e0',
  },
  displayName: { fontSize: 32, fontWeight: '700', color: '#1a1a1a', marginBottom: 4, letterSpacing: -0.5 },
  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: '#888' },
  bio: { fontSize: 15, color: '#444', textAlign: 'center', lineHeight: 22, maxWidth: 300 },
  divider: { height: 1, backgroundColor: '#f0f0f0' },
  gallerySection: { paddingTop: 24 },
  galleryTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 14, letterSpacing: 0.2, paddingHorizontal: 20 },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  galleryPhotoContainer: { width: '50%', aspectRatio: 1, overflow: 'hidden', backgroundColor: '#f5f5f5', padding: 1 },
  galleryPhoto: { width: '100%', height: '100%' },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 20, marginTop: 36, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#fafafa',
  },
  logoutButtonText: { color: '#888', fontSize: 15, fontWeight: '500' },
  deleteAccountButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 32, paddingVertical: 12,
  },
  deleteAccountText: { color: '#ef4444', fontSize: 14, fontWeight: '500' },
  blockedUsersButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 16, marginBottom: 8, paddingVertical: 10,
  },
  blockedUsersText: { color: '#aaa', fontSize: 13 },
  legalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginBottom: 40, paddingVertical: 4,
  },
  legalLink: { color: '#aaa', fontSize: 12 },
  legalDot: { color: '#ccc', fontSize: 12 },
  blockedHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#e0e0e0',
  },
  blockedTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  blockedEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  blockedEmptyText: { fontSize: 16, color: '#aaa' },
  blockedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  blockedAvatar: { width: 44, height: 44, borderRadius: 22 },
  blockedAvatarPlaceholder: { backgroundColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center' },
  blockedName: { fontSize: 15, fontWeight: '600', color: '#333' },
  blockedUsername: { fontSize: 13, color: '#888' },
  unblockButton: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 16, borderWidth: 1, borderColor: '#ddd',
  },
  unblockText: { fontSize: 13, color: '#555', fontWeight: '500' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: '#1a1a1a' },
  modalCancel: { fontSize: 16, color: '#888' },
  modalSave: { fontSize: 16, fontWeight: '600', color: '#E8572A' },
  modalContent: { padding: 20, paddingBottom: 40 },
  modalSectionTitle: { fontSize: 15, fontWeight: '600', color: '#333', marginTop: 24, marginBottom: 12 },

  profilePhotoEdit: {
    width: 110, height: 110, borderRadius: 55, alignSelf: 'center',
    overflow: 'hidden', backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#E8572A',
  },
  editProfilePhoto: { width: '100%', height: '100%' },
  editPhotoOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 36,
    backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center',
  },
  editProfilePhotoPlaceholder: { alignItems: 'center', gap: 4 },
  editPhotoPlaceholderText: { fontSize: 12, color: '#E8572A', fontWeight: '500' },

  bioInput: {
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 12,
    fontSize: 15, color: '#333', minHeight: 90, backgroundColor: '#fafafa',
  },
  charCount: { fontSize: 12, color: '#aaa', textAlign: 'right', marginTop: 4 },
  cityInput: {
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 12,
    fontSize: 15, color: '#333', backgroundColor: '#fafafa',
  },

  editGalleryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  editGalleryBox: { width: '48%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: '#f5f5f5' },
  editGalleryImage: { width: '100%', height: '100%' },
  editGalleryPlaceholder: {
    width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, borderStyle: 'dashed',
  },
  editGalleryOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 32,
    backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
  },
  removePhotoBtn: { position: 'absolute', top: 6, right: 6, zIndex: 2 },
  buttonDisabled: { opacity: 0.6 },
  deleteWarningTitle: { fontSize: 20, fontWeight: '700', color: '#ef4444', textAlign: 'center', marginBottom: 10 },
  deleteWarningText: { fontSize: 15, color: '#555', textAlign: 'center', lineHeight: 22 },
  deleteConfirmButton: {
    backgroundColor: '#ef4444', borderRadius: 10, padding: 16,
    alignItems: 'center', marginTop: 24,
  },
  deleteConfirmText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
