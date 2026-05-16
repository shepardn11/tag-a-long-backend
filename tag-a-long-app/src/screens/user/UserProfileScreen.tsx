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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero: photo left, info right */}
        <View style={styles.heroSection}>
          <TouchableOpacity
            style={styles.photoContainer}
            activeOpacity={user.profile_photo_url ? 0.85 : 1}
            onPress={() => user.profile_photo_url && setLightboxPhoto(user.profile_photo_url)}
          >
            {user.profile_photo_url ? (
              <Image source={{ uri: user.profile_photo_url }} style={styles.profilePhoto} />
            ) : (
              <View style={styles.profilePhotoPlaceholder}>
                <Ionicons name="person" size={40} color="#ccc" />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName}>{user.display_name}</Text>
            </View>
            <Text style={styles.username}>@{user.username}</Text>
            <View style={styles.metaRow}>
              {user.city && (
                <View style={styles.metaItem}>
                  <Ionicons name="location-outline" size={13} color="#888" />
                  <Text style={styles.metaText}>{user.city}</Text>
                </View>
              )}
            </View>
            {user.bio && <Text style={styles.bio}>{user.bio}</Text>}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Photo Gallery */}
        {user.photo_gallery && user.photo_gallery.length > 0 && (
          <View style={styles.gallerySection}>
            <View style={styles.galleryGrid}>
              {user.photo_gallery.map((photo, index) => (
                <TouchableOpacity key={index} activeOpacity={0.85} style={styles.galleryPhotoContainer} onPress={() => setLightboxPhoto(photo)}>
                  <Image source={{ uri: photo }} style={styles.galleryPhoto} contentFit="cover" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Message Button */}
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
  heroSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#fff',
  },
  photoContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  profilePhoto: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2.5,
    borderColor: '#E8572A',
  },
  profilePhotoPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  profileInfo: {
    flex: 1,
    paddingLeft: 16,
    paddingTop: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },
  username: {
    fontSize: 14,
    color: '#888',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#888',
  },
  bio: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  gallerySection: {
    paddingTop: 6,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  galleryPhotoContainer: {
    width: '50%',
    aspectRatio: 1,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    padding: 1,
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
