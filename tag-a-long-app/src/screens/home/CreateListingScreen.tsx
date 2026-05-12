// Create Listing Screen - Create new activity post
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,

  Modal,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { HomeStackParamList } from '../../types';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import apiClient from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { uploadImage } from '../../utils/imageUpload';
import UserSelectionModal from '../../components/UserSelectionModal';

type CreateListingScreenNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  'CreateActivity'
>;

interface Props {
  navigation: CreateListingScreenNavigationProp;
}

interface User {
  id: string;
  username: string;
  display_name: string;
  profile_photo_url?: string;
}

export default function CreateListingScreen({ navigation }: Props) {
  const { user } = useAuthStore();

  // Initialize with tomorrow's date to avoid past date issues
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
    return tomorrow;
  };

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(getTomorrowDate());
  const [time, setTime] = useState(() => {
    const defaultTime = new Date();
    defaultTime.setHours(12, 0, 0, 0);
    return defaultTime;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState(getTomorrowDate());
  const [tempTime, setTempTime] = useState(() => {
    const defaultTime = new Date();
    defaultTime.setHours(12, 0, 0, 0);
    return defaultTime;
  });
  const [maxParticipants, setMaxParticipants] = useState('');
  const [taggedUsers, setTaggedUsers] = useState<User[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null); // Photo for the activity
  const [isLoading, setIsLoading] = useState(false);

  // Image Picker Functions
  const pickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'We need camera roll permissions to add photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Could not select image');
    }
  };

  const takePhoto = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'We need camera permissions to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Could not take photo');
    }
  };

  const removePhoto = () => {
    setPhotoUri(null);
  };

  // Categories for activity listings
  const categories = [
    { value: 'sports', label: 'Sports', icon: 'football' },
    { value: 'food', label: 'Food & Dining', icon: 'restaurant' },
    { value: 'entertainment', label: 'Entertainment', icon: 'film' },
    { value: 'outdoor', label: 'Outdoors', icon: 'leaf' },
    { value: 'fitness', label: 'Fitness', icon: 'barbell' },
    { value: 'social', label: 'Social', icon: 'people' },
    { value: 'music', label: 'Music', icon: 'musical-notes' },
    { value: 'gaming', label: 'Gaming', icon: 'game-controller' },
    { value: 'travel', label: 'Travel', icon: 'car' },
    { value: 'arts', label: 'Arts & Culture', icon: 'color-palette' },
    { value: 'nightlife', label: 'Nightlife', icon: 'moon' },
    { value: 'wellness', label: 'Wellness', icon: 'heart' },
    { value: 'volunteering', label: 'Volunteering', icon: 'hand-left' },
    { value: 'learning', label: 'Learning', icon: 'book' },
    { value: 'pets', label: 'Pets', icon: 'paw' },
    { value: 'dating', label: 'Dating', icon: 'heart-circle' },
    { value: 'other', label: 'Other', icon: 'apps' },
  ];

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      if (event.type === 'dismissed') {
        setShowDatePicker(false);
        return;
      }
      setShowDatePicker(false);
      if (selectedDate) setDate(selectedDate);
    } else {
      // inline display: fires once on tap, update both temp and committed date
      if (selectedDate) {
        setTempDate(selectedDate);
        setDate(selectedDate);
      }
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      // On Android, event.type can be 'set', 'dismissed', or 'neutralButtonPressed'
      if (event.type === 'dismissed') {
        setShowTimePicker(false);
        return;
      }

      setShowTimePicker(false);
      if (selectedTime) {
        setTime(selectedTime);
      }
    } else {
      // On iOS, update temp time as user scrolls
      if (selectedTime) {
        setTempTime(selectedTime);
      }
    }
  };

  const confirmDate = () => {
    setDate(tempDate);
    setShowDatePicker(false);
  };

  const confirmTime = () => {
    setTime(tempTime);
    setShowTimePicker(false);
  };

  const cancelDatePicker = () => {
    setTempDate(date);
    setShowDatePicker(false);
  };

  const cancelTimePicker = () => {
    setTempTime(time);
    setShowTimePicker(false);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (time: Date) => {
    return time.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Helper functions for date quick select
  const isToday = (checkDate: Date) => {
    const today = new Date();
    return checkDate.toDateString() === today.toDateString();
  };

  const isTomorrow = (checkDate: Date) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return checkDate.toDateString() === tomorrow.toDateString();
  };

  const isThisWeekend = (checkDate: Date) => {
    const nextSat = getNextSaturday();
    const nextSun = new Date(nextSat);
    nextSun.setDate(nextSat.getDate() + 1);
    return checkDate.toDateString() === nextSat.toDateString() ||
           checkDate.toDateString() === nextSun.toDateString();
  };

  const getNextSaturday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    let daysUntilSaturday;

    if (dayOfWeek === 6) {
      // Today is Saturday, get next Saturday
      daysUntilSaturday = 7;
    } else if (dayOfWeek === 0) {
      // Today is Sunday, get next Saturday (6 days)
      daysUntilSaturday = 6;
    } else {
      // Any other day
      daysUntilSaturday = 6 - dayOfWeek;
    }

    const saturday = new Date(today);
    saturday.setDate(today.getDate() + daysUntilSaturday);
    return saturday;
  };

  const handleCreateListing = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for your activity');
      return;
    }

    if (title.length < 3) {
      Alert.alert('Error', 'Title must be at least 3 characters');
      return;
    }

    if (!category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    if (!location.trim()) {
      Alert.alert('Error', 'Please enter a location');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }

    if (description.trim().length < 10) {
      Alert.alert('Error', 'Description must be at least 10 characters long');
      return;
    }

    try {
      setIsLoading(true);

      // Format date and time for API
      // Combine date and time into a single Date object for the 'date' field
      const combinedDateTime = new Date(date);
      combinedDateTime.setHours(time.getHours(), time.getMinutes(), 0, 0);

      // Validate that the combined date-time is in the future
      if (combinedDateTime <= new Date()) {
        Alert.alert('Error', 'Please select a date and time in the future');
        setIsLoading(false);
        return;
      }

      // Upload photo if one was selected, otherwise leave null (category image shown)
      let uploadedPhotoUrl: string | null = null;

      if (photoUri && user?.id) {
        try {
          uploadedPhotoUrl = await uploadImage(photoUri, user.id, 'listing-photos');
        } catch (uploadError) {
          console.error('Photo upload failed:', uploadError);
          Alert.alert(
            'Photo Upload Failed',
            'Could not upload photo. A category image will be used instead.',
            [{ text: 'OK' }]
          );
        }
      }

      // Format time properly as HH:mm
      const hours = time.getHours().toString().padStart(2, '0');
      const minutes = time.getMinutes().toString().padStart(2, '0');
      const activityTime = `${hours}:${minutes}`; // HH:mm

      // Use creator's current GPS position for accurate radius-based feed filtering
      let latitude: number | null = null;
      let longitude: number | null = null;
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        }
      } catch {
        // GPS unavailable � listing still saves, just won't appear in radius feed
      }

      const listingData: any = {
        title: title.trim(),
        description: description.trim(),
        category,
        location: location.trim(),
        date: combinedDateTime.toISOString(),
        time: activityTime,
        photo_url: uploadedPhotoUrl,
        ...(latitude !== null && { latitude, longitude }),
      };

      // Only add max_participants if it's a valid number
      if (maxParticipants && !isNaN(parseInt(maxParticipants))) {
        listingData.max_participants = parseInt(maxParticipants);
      }

      // Add tagged users if any
      if (taggedUsers.length > 0) {
        listingData.tagged_users = taggedUsers.map(u => u.id);
      }


      const response = await apiClient.getInstance().post('/listings', listingData);

      if (response.data.success) {
        // Navigate back to feed immediately
        navigation.goBack();

        // Show success message after navigating
        setTimeout(() => {
          Alert.alert('Success', 'Your activity has been posted!');
        }, 100);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message ||
                       error.response?.data?.message ||
                       error.message ||
                       'Could not create activity post';
      Alert.alert('Error', errorMsg);
    } finally {
      setIsLoading(false);
    }
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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Activity</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          {/* Title Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="What are you doing?"
              value={title}
              onChangeText={setTitle}
              maxLength={200}
              editable={!isLoading}
            />
            <Text style={styles.charCount}>{title.length}/200</Text>
          </View>

          {/* Category Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category *</Text>
            <View style={styles.categoryGrid}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  style={[
                    styles.categoryButton,
                    category === cat.value && styles.categoryButtonActive,
                  ]}
                  onPress={() => setCategory(cat.value)}
                  disabled={isLoading}
                >
                  <Text style={styles.categoryLabel}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Photo Upload */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Activity Photo (Optional)</Text>
            <Text style={styles.sublabel}>
              Optional — a category image will be used if none selected
            </Text>

            {photoUri ? (
              <View style={styles.photoPreview}>
                <Image source={{ uri: photoUri }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.removePhotoButton}
                  onPress={removePhoto}
                  disabled={isLoading}
                >
                  <Ionicons name="close-circle" size={28} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoButtons}>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={takePhoto}
                  disabled={isLoading}
                >
                  <Ionicons name="camera" size={24} color="#E8572A" />
                  <Text style={styles.photoButtonText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={pickImage}
                  disabled={isLoading}
                >
                  <Ionicons name="images" size={24} color="#E8572A" />
                  <Text style={styles.photoButtonText}>Choose from Library</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Location Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location *</Text>
            <TextInput
              style={styles.input}
              placeholder="Where will this take place?"
              value={location}
              onChangeText={setLocation}
              editable={!isLoading}
              autoComplete="off"
              autoCorrect={true}
            />
          </View>

          {/* Date and Time - Simple 2 Button Approach */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>When is this happening? *</Text>

            <View style={styles.dateTimeRow}>
              {/* Date Button/Picker */}
              {Platform.OS === 'web' ? (
                <View style={styles.dateTimeButton}>
                  <Ionicons name="calendar-outline" size={24} color="#E8572A" />
                  <View style={styles.buttonTextContainer}>
                    <Text style={styles.buttonLabel}>Date</Text>
                    <input
                      type="date"
                      style={{
                        fontSize: 15,
                        fontWeight: '600',
                        color: '#333',
                        border: 'none',
                        outline: 'none',
                        backgroundColor: 'transparent',
                        fontFamily: 'system-ui',
                        cursor: 'pointer',
                      }}
                      value={date.toISOString().split('T')[0]}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => {
                        if (e.target.value) {
                          const newDate = new Date(e.target.value);
                          newDate.setHours(12, 0, 0, 0);
                          if (!isNaN(newDate.getTime())) {
                            setDate(newDate);
                          }
                        }
                      }}
                      disabled={isLoading}
                    />
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => {
                    setTempDate(date);
                    setShowDatePicker(true);
                  }}
                  disabled={isLoading}
                >
                  <Ionicons name="calendar-outline" size={24} color="#E8572A" />
                  <View style={styles.buttonTextContainer}>
                    <Text style={styles.buttonLabel}>Date</Text>
                    <Text style={styles.buttonValue}>{formatDate(date)}</Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Time Button/Picker */}
              {Platform.OS === 'web' ? (
                <View style={styles.dateTimeButton}>
                  <Ionicons name="time-outline" size={24} color="#E8572A" />
                  <View style={styles.buttonTextContainer}>
                    <Text style={styles.buttonLabel}>Time</Text>
                    <input
                      type="time"
                      style={{
                        fontSize: 15,
                        fontWeight: '600',
                        color: '#333',
                        border: 'none',
                        outline: 'none',
                        backgroundColor: 'transparent',
                        fontFamily: 'system-ui',
                        cursor: 'pointer',
                      }}
                      value={time.toTimeString().slice(0, 5)}
                      onChange={(e) => {
                        if (e.target.value) {
                          const [hours, minutes] = e.target.value.split(':');
                          if (hours && minutes) {
                            const newTime = new Date();
                            newTime.setHours(parseInt(hours, 10), parseInt(minutes, 10));
                            if (!isNaN(newTime.getTime())) {
                              setTime(newTime);
                            }
                          }
                        }
                      }}
                      disabled={isLoading}
                    />
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => {
                    setTempTime(time);
                    setShowTimePicker(true);
                  }}
                  disabled={isLoading}
                >
                  <Ionicons name="time-outline" size={24} color="#E8572A" />
                  <View style={styles.buttonTextContainer}>
                    <Text style={styles.buttonLabel}>Time</Text>
                    <Text style={styles.buttonValue}>{formatTime(time)}</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Date Picker - iOS Modal with buttons */}
          {Platform.OS === 'ios' && showDatePicker && (
            <Modal
              transparent={true}
              animationType="slide"
              visible={showDatePicker}
              onRequestClose={confirmDate}
            >
              <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={confirmDate}>
                <View style={styles.pickerContainer} onStartShouldSetResponder={() => true}>
                  <DateTimePicker
                    value={tempDate}
                    mode="date"
                    display="inline"
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                    accentColor="#E8572A"
                  />
                  <View style={styles.pickerFooter}>
                    <TouchableOpacity onPress={confirmDate}>
                      <Text style={[styles.pickerButton, styles.pickerButtonDone]}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </Modal>
          )}

          {/* Time Picker - iOS Modal with buttons */}
          {Platform.OS === 'ios' && showTimePicker && (
            <Modal
              transparent={true}
              animationType="slide"
              visible={showTimePicker}
              onRequestClose={confirmTime}
            >
              <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={confirmTime}>
                <View style={styles.pickerContainer} onStartShouldSetResponder={() => true}>
                  <DateTimePicker
                    value={tempTime}
                    mode="time"
                    display="spinner"
                    onChange={handleTimeChange}
                    style={styles.picker}
                  />
                  <View style={styles.pickerFooter}>
                    <TouchableOpacity onPress={confirmTime}>
                      <Text style={[styles.pickerButton, styles.pickerButtonDone]}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </Modal>
          )}

          {/* Date Picker - Android */}
          {Platform.OS === 'android' && showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="spinner"
              onChange={handleDateChange}
              minimumDate={new Date()}
            />
          )}

          {/* Time Picker - Android */}
          {Platform.OS === 'android' && showTimePicker && (
            <DateTimePicker
              value={time}
              mode="time"
              display="spinner"
              onChange={handleTimeChange}
            />
          )}

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description *</Text>
            <Text style={styles.sublabel}>
              Tell people what you're doing and who you're looking for (minimum 10 characters)
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="E.g., Looking for someone to join me for a game of tennis. Intermediate level preferred."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
              editable={!isLoading}
            />
            <View style={styles.charCountContainer}>
              <Text style={[
                styles.charCount,
                description.length > 0 && description.length < 10 && styles.charCountWarning
              ]}>
                {description.length < 10 ? `${description.length}/10 minimum` : `${description.length}/500`}
              </Text>
            </View>
          </View>

          {/* Max Participants (Optional) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Max Participants (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="How many people can join?"
              value={maxParticipants}
              onChangeText={setMaxParticipants}
              keyboardType="number-pad"
              editable={!isLoading}
            />
          </View>

          {/* Tagged Users */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tag Friends (Optional)</Text>
            <TouchableOpacity
              style={styles.tagButton}
              onPress={() => setShowUserModal(true)}
              disabled={isLoading}
            >
              <Ionicons name="person-add-outline" size={20} color="#007AFF" />
              <Text style={[styles.tagButtonText, { color: '#007AFF' }]}>Tag people joining you</Text>
            </TouchableOpacity>
            {taggedUsers.length > 0 && (
              <View style={styles.taggedUsersContainer}>
                {taggedUsers.map((user) => (
                  <View key={user.id} style={styles.taggedUserChip}>
                    {user.profile_photo_url ? (
                      <Image
                        source={{ uri: user.profile_photo_url }}
                        style={styles.taggedUserAvatar}
                      />
                    ) : (
                      <View style={styles.taggedUserAvatarPlaceholder}>
                        <Ionicons name="person" size={12} color="#999" />
                      </View>
                    )}
                    <Text style={styles.taggedUserName}>{user.display_name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Create Button */}
          <TouchableOpacity
            style={[styles.createButton, isLoading && styles.buttonDisabled]}
            onPress={handleCreateListing}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={24} color="#fff" />
                <Text style={styles.createButtonText}>Post Activity</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* User Selection Modal */}
      <UserSelectionModal
        visible={showUserModal}
        onClose={() => setShowUserModal(false)}
        onSelectUsers={setTaggedUsers}
        selectedUsers={taggedUsers}
      />
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 55,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sublabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    height: 100,
    paddingTop: 15,
  },
  charCountContainer: {
    marginTop: 5,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },
  charCountWarning: {
    color: '#ef4444',
    fontWeight: '600',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 10,
    marginBottom: 10,
  },
  categoryButtonActive: {
    backgroundColor: '#E8572A',
    borderColor: '#E8572A',
  },
  categoryLabel: {
    fontSize: 14,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  buttonTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  buttonLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
    fontWeight: '500',
  },
  buttonValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
  },
  tagButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagButtonText: {
    fontSize: 16,
    color: '#999',
    marginLeft: 10,
  },
  comingSoon: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 5,
  },
  createButton: {
    backgroundColor: '#E8572A',
    borderRadius: 10,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0ff',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8572A',
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E8572A',
    marginLeft: 8,
  },
  photoPreview: {
    position: 'relative',
    marginTop: 10,
  },
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    resizeMode: 'contain',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 14,
  },
  taggedUsersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 8,
  },
  taggedUserChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0ff',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  taggedUserAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  taggedUserAvatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taggedUserName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E8572A',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    paddingHorizontal: 8,
  },
  pickerFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  pickerButton: {
    fontSize: 17,
    color: '#E8572A',
  },
  pickerButtonDone: {
    fontWeight: '600',
  },
  picker: {
    height: 200,
  },
});
