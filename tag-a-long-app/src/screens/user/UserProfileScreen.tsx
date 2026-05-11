// User Profile Screen - View another user's profile
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,

  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { SearchStackParamList, HomeStackParamList, ActivitiesStackParamList, User } from '../../types';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { profileAPI, messageAPI } from '../../api/endpoints';
import LightboxModal from '../../components/LightboxModal';

type UserProfileScreenNavigationProp = NativeStackNavigationProp<
  SearchStackParamList | HomeStackParamList | ActivitiesStackParamList,
  'UserProfile'
>;

type UserProfileScreenRouteProp = RouteProp<SearchStackParamList | HomeStackParamList | ActivitiesStackParamList, 'UserProfile'>;

interface Props {
  navigation: UserProfileScreenNavigationProp;
  route: UserProfileScreenRouteProp;
}

export default function UserProfileScreen({ navigation, route }: Props) {
  const routeParams = route.params as { user?: User; userId?: string };
  const [user, setUser] = useState<User | null>(routeParams.user || null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStartingConversation, setIsStartingConversation] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  useEffect(() => {
    // If we have a user object, use it directly
    if (routeParams.user) {
      setUser(routeParams.user);
      setIsLoading(false);
    }
    // If we have a userId but no user object, fetch the user
    else if (routeParams.userId) {
      fetchUserProfile(routeParams.userId);
    } else {
      console.error('No user or userId provided');
      setError('No user information provided');
      setIsLoading(false);
    }
  }, [route.params]);

  const fetchUserProfile = async (userId?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const id = userId || routeParams.user?.id || routeParams.userId;
      if (!id) {
        throw new Error('No user ID provided');
      }
      const userData = await profileAPI.getUserById(id);
      setUser(userData);
    } catch (err: any) {
      console.error('Fetch user profile error:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.error?.message || 'Could not load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleSendMessage = async () => {
    if (!user) return;

    try {
      setIsStartingConversation(true);

      // Get or create conversation with this user
      const conversation = await messageAPI.getOrCreateConversation(user.id);

      // Navigate to the main navigator's Messages tab, then to Chat
      // @ts-ignore - navigation types might not include this
      navigation.navigate('Main', {
        screen: 'Messages',
        params: {
          screen: 'Chat',
          params: {
            conversationId: conversation.id,
            otherUser: {
              id: user.id,
              username: user.username,
              display_name: user.display_name,
              profile_photo_url: user.profile_photo_url,
            },
          },
        },
      });
    } catch (error) {
      console.error('Error starting conversation:', error);
      Alert.alert('Error', 'Could not start conversation. Please try again.');
    } finally {
      setIsStartingConversation(false);
    }
  };

  if (isLoading || !user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E8572A" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text style={styles.errorTitle}>Oops!</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchUserProfile()}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Photo */}
        <View style={styles.photoSection}>
          {user.profile_photo_url ? (
            <TouchableOpacity activeOpacity={1} onPress={() => setLightboxPhoto(user.profile_photo_url!)}>
              <Image
                source={{ uri: user.profile_photo_url }}
                style={styles.profilePhoto}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.profilePhotoPlaceholder}>
              <Ionicons name="person" size={64} color="#999" />
            </View>
          )}

          {/* Name and Username */}
          <View style={styles.nameSection}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName}>{user.display_name}</Text>
              {user.is_premium && (
                <Ionicons name="checkmark-circle" size={24} color="#E8572A" />
              )}
            </View>
            <Text style={styles.username}>@{user.username}</Text>
          </View>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          {/* Location */}
          {user.city && (
            <View style={styles.infoRow}>
              <Ionicons name="location" size={20} color="#E8572A" />
              <Text style={styles.infoText}>{user.city}</Text>
            </View>
          )}

          {/* Join Date */}
          {user.created_at && (
            <View style={styles.infoRow}>
              <Ionicons name="calendar" size={20} color="#E8572A" />
              <Text style={styles.infoText}>
                Joined {new Date(user.created_at).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            </View>
          )}

          {/* Instagram */}
          {user.instagram_handle && (
            <View style={styles.infoRow}>
              <Ionicons name="logo-instagram" size={20} color="#E8572A" />
              <Text style={styles.infoText}>@{user.instagram_handle}</Text>
            </View>
          )}
        </View>

        {/* Bio */}
        {user.bio && (
          <View style={styles.bioSection}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>{user.bio}</Text>
          </View>
        )}

        {/* Photo Gallery */}
        {user.photo_gallery && user.photo_gallery.length > 0 && (
          <View style={styles.gallerySection}>
            <Text style={[styles.sectionTitle, { paddingHorizontal: 20 }]}>Photos</Text>
            <View style={styles.galleryGrid}>
              {user.photo_gallery.map((photo, index) => (
                <TouchableOpacity key={index} activeOpacity={1} style={styles.galleryPhotoContainer} onPress={() => setLightboxPhoto(photo)}>
                  <Image
                    source={{ uri: photo }}
                    style={styles.galleryPhoto}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.messageButton}
            onPress={handleSendMessage}
            disabled={isStartingConversation}
          >
            {isStartingConversation ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="chatbubble" size={20} color="#fff" />
                <Text style={styles.messageButtonText}>Send Message</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      <LightboxModal uri={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#E8572A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  photoSection: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#fff',
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profilePhotoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameSection: {
    alignItems: 'center',
    marginTop: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  username: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  infoSection: {
    backgroundColor: '#fff',
    marginTop: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  bioSection: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  bioText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  gallerySection: {
    backgroundColor: '#fff',
    marginTop: 12,
    paddingTop: 20,
  },
  galleryGrid: {
    flexDirection: 'column',
    gap: 12,
  },
  galleryPhotoContainer: {
    width: '100%',
    aspectRatio: 1,
    overflow: 'hidden',
  },
  galleryPhoto: {
    width: '100%',
    height: '100%',
  },
  actionSection: {
    padding: 20,
    marginBottom: 20,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8572A',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  messageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
