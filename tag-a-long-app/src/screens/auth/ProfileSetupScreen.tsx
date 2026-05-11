// Profile Setup Screen - Complete profile after signup
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,

  Linking,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { profileAPI } from '../../api/endpoints';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import apiClient from '../../api/client';
import { uploadImage } from '../../utils/imageUpload';

type ProfileSetupScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'ProfileSetup'
>;

interface Props {
  navigation: ProfileSetupScreenNavigationProp;
}

export default function ProfileSetupScreen({ navigation }: Props) {
  const { user, updateUser, setIsAuthenticated, setProfileSetupComplete } = useAuthStore();
  const [bio, setBio] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [galleryPhotos, setGalleryPhotos] = useState<(string | null)[]>([null, null, null, null, null]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadingGalleryIndex, setUploadingGalleryIndex] = useState<number | null>(null);

  const handleAddPhoto = async () => {
    try {
      // Check current permission status first
      const { status: existingStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();

      let finalStatus = existingStatus;

      // Request permission if not already granted
      if (existingStatus !== 'granted') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photos in Settings to upload a profile picture.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }

      // Open image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploadingPhoto(true);
        const imageUri = result.assets[0].uri;

        if (!user || !user.id) {
          console.error('DEBUG ProfileSetup: User is null or missing ID!');
          Alert.alert('Error', 'User not found - cannot upload photo');
          throw new Error('User not found - cannot upload photo');
        }


        // Upload to Supabase Storage
        const publicUrl = await uploadImage(imageUri, user.id);

        // Update profile via backend API using the photo endpoint
        const updatedUser = await profileAPI.uploadPhoto(publicUrl);

        // Update local state
        setProfilePhoto(publicUrl);
        updateUser(updatedUser);

        Alert.alert('Success', 'Profile photo uploaded!');
      }
    } catch (error: any) {
      console.error('DEBUG ProfileSetup: Photo upload error:', error);
      console.error('DEBUG ProfileSetup: Error details:', error.response?.data);
      Alert.alert('Upload Failed', error.message || 'Could not upload photo. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setProfilePhoto(null);
  };

  const handleAddGalleryPhoto = async (index: number) => {
    try {
      // Check current permission status first
      const { status: existingStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();

      let finalStatus = existingStatus;

      // Request permission if not already granted
      if (existingStatus !== 'granted') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photos in Settings to upload gallery photos.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }

      // Open image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0] && user) {
        setUploadingGalleryIndex(index);
        const imageUri = result.assets[0].uri;

        // Upload to Supabase Storage
        const publicUrl = await uploadImage(imageUri, user.id);

        // Update profile via backend API using the gallery endpoint
        const response = await apiClient.getInstance().post('/profile/gallery', {
          photo_url: publicUrl,
        });

        if (!response.data.success) {
          throw new Error('Failed to add photo to gallery');
        }


        // Update local state with the uploaded photo URL
        const newGalleryPhotos = [...galleryPhotos];
        newGalleryPhotos[index] = publicUrl;
        setGalleryPhotos(newGalleryPhotos);

        // Update user store with new gallery
        if (user) {
          updateUser({ ...user, photo_gallery: response.data.data.photo_gallery });
        }

        Alert.alert('Success', 'Photo added to gallery!');
      }
    } catch (error: any) {
      console.error('DEBUG ProfileSetup: Gallery photo upload error:', error);
      console.error('DEBUG ProfileSetup: Error details:', error.response?.data);
      Alert.alert('Upload Failed', error.message || 'Could not upload photo. Please try again.');
    } finally {
      setUploadingGalleryIndex(null);
    }
  };

  const handleRemoveGalleryPhoto = async (index: number) => {
    const photoUrl = galleryPhotos[index];
    const newGalleryPhotos = [...galleryPhotos];
    newGalleryPhotos[index] = null;
    setGalleryPhotos(newGalleryPhotos);

    if (photoUrl) {
      try {
        await apiClient.getInstance().delete('/profile/gallery', { data: { photo_url: photoUrl } });
        if (user) {
          updateUser({ ...user, photo_gallery: (user.photo_gallery || []).filter(u => u !== photoUrl) });
        }
      } catch (error) {
        console.error('Failed to remove gallery photo from backend:', error);
      }
    }
  };

  const handleComplete = async () => {
    if (!profilePhoto) {
      Alert.alert('Profile Photo Required', 'Please add a profile photo to continue.');
      return;
    }

    const hasGalleryPhoto = galleryPhotos.some(p => p !== null);
    if (!hasGalleryPhoto) {
      Alert.alert('Gallery Photo Required', 'Please add at least one gallery photo to continue.');
      return;
    }

    try {
      setIsLoading(true);

      // Update profile with bio and instagram if provided
      const updates: any = {};

      if (bio.trim()) {
        updates.bio = bio.trim();
      }

      if (instagramHandle.trim()) {
        updates.instagram_handle = instagramHandle.trim();
      }


      // Only update if there's something to update
      if (Object.keys(updates).length > 0) {
        const updatedUser = await profileAPI.updateProfile(updates);
        updateUser(updatedUser);
      }

      // Complete profile setup immediately - user can access app right away
      completeSetup();

    } catch (error: any) {
      console.error('DEBUG: Error in handleComplete:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error?.message || error.message || 'Could not update profile'
      );
      setIsLoading(false);
    }
  };

  const completeSetup = async () => {
    try {
      await Notifications.requestPermissionsAsync();
    } catch (_) {}
    setProfileSetupComplete(true);
    setIsAuthenticated(true);
    setIsLoading(false);
  };

  const handleSkip = () => {
    completeSetup();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Complete Your Profile</Text>
            <Text style={styles.subtitle}>
              Add photos and tell us about yourself
            </Text>
          </View>

          {/* Profile Photo Section */}
          <View style={styles.photosSection}>
            <Text style={styles.sectionTitle}>Profile Photo</Text>
            <View style={styles.photoContainer}>
              <TouchableOpacity
                style={styles.largePhotoBox}
                onPress={handleAddPhoto}
                disabled={isLoading || isUploadingPhoto}
              >
                {(() => {
                  if (isUploadingPhoto) {
                    return <ActivityIndicator size="large" color="#E8572A" />;
                  } else if (profilePhoto) {
                    return (
                      <View style={{ width: '100%', height: '100%' }}>
                        <Image
                          source={{ uri: profilePhoto }}
                          style={styles.largePhotoImage}
                        />
                        <TouchableOpacity
                          style={styles.removePhotoButton}
                          onPress={handleRemovePhoto}
                        >
                          <Ionicons name="close-circle" size={32} color="#ff4444" />
                        </TouchableOpacity>
                      </View>
                    );
                  } else {
                    return (
                      <View style={styles.photoPlaceholder}>
                        <Ionicons name="camera" size={48} color="#999" />
                        <Text style={styles.photoPlaceholderText}>Tap to add photo</Text>
                      </View>
                    );
                  }
                })()}
              </TouchableOpacity>
            </View>
          </View>

          {/* Photo Gallery Section */}
          <View style={styles.photosSection}>
            <Text style={styles.sectionTitle}>Photo Gallery (up to 5 photos)</Text>
            <View style={styles.galleryGrid}>
              {galleryPhotos.map((photo, index) => {
                return (
                  <TouchableOpacity
                    key={index}
                    style={styles.galleryPhotoBox}
                    onPress={() => handleAddGalleryPhoto(index)}
                    disabled={isLoading || uploadingGalleryIndex !== null}
                  >
                    {uploadingGalleryIndex === index ? (
                      <ActivityIndicator size="small" color="#E8572A" />
                    ) : photo ? (
                      <View style={{ width: '100%', height: '100%' }}>
                        <Image
                          source={{ uri: photo }}
                          style={styles.galleryPhotoImage}
                        />
                        <TouchableOpacity
                          style={styles.removeGalleryPhotoButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleRemoveGalleryPhoto(index);
                          }}
                        >
                          <Ionicons name="close-circle" size={24} color="#ff4444" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.galleryPhotoPlaceholder}>
                        <Ionicons name="add" size={32} color="#999" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Bio (Optional)</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              placeholder="Tell others about yourself"
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={3}
              maxLength={150}
              textAlignVertical="top"
              editable={!isLoading}
            />
            <Text style={styles.characterCount}>{bio.length}/150</Text>

            <TouchableOpacity
              style={[styles.completeButton, isLoading && styles.buttonDisabled]}
              onPress={handleComplete}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.completeButtonText}>Complete Profile</Text>
              )}
            </TouchableOpacity>

          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 90,
    paddingBottom: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 25,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#E8572A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  photosSection: {
    marginBottom: 25,
  },
  photoContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  largePhotoBox: {
    width: 150,
    height: 150,
    borderRadius: 75,
    overflow: 'hidden',
  },
  largePhotoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    borderRadius: 75,
  },
  photoPlaceholderText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  galleryPhotoBox: {
    width: '48%',
    aspectRatio: 1,
    marginBottom: 10,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  galleryPhotoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  galleryPhotoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    borderRadius: 10,
  },
  removeGalleryPhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  bioInput: {
    height: 90,
    paddingTop: 15,
    marginBottom: 5,
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginBottom: 15,
  },
  completeButton: {
    backgroundColor: '#E8572A',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 5,
  },
  skipButtonText: {
    color: '#666',
    fontSize: 14,
  },
});
