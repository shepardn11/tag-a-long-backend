// Feed Screen - Home feed with activity listings
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  PanResponder,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HomeStackParamList, ActivityListing } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { listingAPI, notificationAPI } from '../../api/endpoints';
import ListingCard from '../../components/ListingCard';
import { useAuthStore } from '../../store/authStore';
import { registerBellRefresh } from '../../utils/tabRefresh';
import DateTimePicker from '@react-native-community/datetimepicker';

const HEADER_HEIGHT = 72;

type FeedScreenNavigationProp = NativeStackNavigationProp<HomeStackParamList, 'Feed'>;

interface Props {
  navigation: FeedScreenNavigationProp;
}

const RADIUS_OPTIONS = [10, 25, 50, 100];

const DAY_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'this_week', label: 'This week' },
];

const getDayRange = (days: string[], specificDate: Date | null) => {
  if (specificDate) {
    const start = new Date(specificDate.getFullYear(), specificDate.getMonth(), specificDate.getDate());
    const end = new Date(start); end.setDate(end.getDate() + 1);
    return { date_from: start.toISOString(), date_to: end.toISOString() };
  }
  if (days.length === 0) return {};
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(todayStart); tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfterTomorrow = new Date(tomorrow); dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
  const weekEnd = new Date(todayStart); weekEnd.setDate(weekEnd.getDate() + 7);
  const ranges = days.map(day => {
    if (day === 'today') return { from: now, to: tomorrow };
    if (day === 'tomorrow') return { from: tomorrow, to: dayAfterTomorrow };
    if (day === 'this_week') return { from: now, to: weekEnd };
    return null;
  }).filter((r): r is { from: Date; to: Date } => r !== null);
  if (ranges.length === 0) return {};
  const minFrom = ranges.reduce((min, r) => r.from < min ? r.from : min, ranges[0].from);
  const maxTo = ranges.reduce((max, r) => r.to > max ? r.to : max, ranges[0].to);
  return { date_from: minFrom.toISOString(), date_to: maxTo.toISOString() };
};
const RADIUS_KEY = 'feed_radius_miles';

const CATEGORIES = [
  { value: 'sports',        label: 'Sports',        emoji: '⚽' },
  { value: 'food',          label: 'Food & Dining',  emoji: '🍽️' },
  { value: 'entertainment', label: 'Entertainment',  emoji: '🎬' },
  { value: 'outdoor',       label: 'Outdoors',       emoji: '🏞️' },
  { value: 'fitness',       label: 'Fitness',        emoji: '💪' },
  { value: 'social',        label: 'Social',         emoji: '👥' },
  { value: 'music',         label: 'Music',          emoji: '🎵' },
  { value: 'gaming',        label: 'Gaming',         emoji: '🎮' },
  { value: 'travel',        label: 'Travel',         emoji: '🚗' },
  { value: 'arts',          label: 'Arts & Culture', emoji: '🎨' },
  { value: 'nightlife',     label: 'Nightlife',      emoji: '🌙' },
  { value: 'wellness',      label: 'Wellness',       emoji: '🧘' },
  { value: 'volunteering',  label: 'Volunteering',   emoji: '🤝' },
  { value: 'learning',      label: 'Learning',       emoji: '📚' },
  { value: 'pets',          label: 'Pets',           emoji: '🐾' },
  { value: 'dating',        label: 'Dating',         emoji: '❤️' },
  { value: 'other',         label: 'Other',          emoji: '✨' },
];

export default function FeedScreen({ navigation }: Props) {
  const [listings, setListings] = useState<ActivityListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [radius, setRadius] = useState(50);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minAge, setMinAge] = useState<number | null>(null);
  const [maxAge, setMaxAge] = useState<number | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [draftRadius, setDraftRadius] = useState(50);
  const [draftMinAge, setDraftMinAge] = useState('');
  const [draftMaxAge, setDraftMaxAge] = useState('');
  const [draftCategories, setDraftCategories] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [draftDays, setDraftDays] = useState<string[]>([]);
  const [specificDate, setSpecificDate] = useState<Date | null>(null);
  const [draftSpecificDate, setDraftSpecificDate] = useState<Date | null>(null);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const { user } = useAuthStore();
  const locationInitialized = useRef(false);
  const headerHeight = useRef(new Animated.Value(HEADER_HEIGHT)).current;
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) sheetTranslateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          Animated.timing(sheetTranslateY, { toValue: 800, duration: 200, useNativeDriver: true }).start(() => {
            setFilterVisible(false);
          });
        } else {
          Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true, overshootClamping: true }).start();
        }
      },
    })
  ).current;
  const lastScrollY = useRef(0);
  const isHeaderVisible = useRef(true);
  const isAnimating = useRef(false);

  const handleScroll = useCallback((event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const contentHeight = event.nativeEvent.contentSize.height;
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;
    const diff = currentY - lastScrollY.current;
    lastScrollY.current = currentY;

    if (isAnimating.current) return;
    // If content fits on screen even with the header visible, don't animate —
    // the bounce would create a layout-shift feedback loop causing the shake.
    if (contentHeight <= layoutHeight + HEADER_HEIGHT) return;
    if (currentY + layoutHeight >= contentHeight - 20) return;

    if (diff > 4 && isHeaderVisible.current && currentY > HEADER_HEIGHT) {
      isHeaderVisible.current = false;
      isAnimating.current = true;
      Animated.timing(headerHeight, {
        toValue: 0,
        duration: 250,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }).start(() => { isAnimating.current = false; });
    } else if (diff < -4 && !isHeaderVisible.current) {
      isHeaderVisible.current = true;
      isAnimating.current = true;
      Animated.timing(headerHeight, {
        toValue: HEADER_HEIGHT,
        duration: 250,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }).start(() => { isAnimating.current = false; });
    }
  }, []);

  const filtersActive = radius !== 50 || minAge !== null || maxAge !== null || selectedCategories.length > 0 || selectedDays.length > 0 || specificDate !== null;

  const requestLocation = async () => {
    const { status: existing } = await Location.getForegroundPermissionsAsync();
    if (existing === 'granted') {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      return;
    }

    Alert.alert(
      'Location Required',
      'Tag A Long needs your location to show you activities happening nearby.',
      [
        {
          text: 'Enable Location',
          onPress: async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
              const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
              setUserCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
            } else {
              requestLocation();
            }
          },
        },
      ],
      { cancelable: false }
    );
  };

  const loadSavedRadius = async () => {
    const saved = await AsyncStorage.getItem(RADIUS_KEY);
    if (saved) {
      const val = parseInt(saved);
      setRadius(val);
      setDraftRadius(val);
    }
  };

  useEffect(() => {
    if (!locationInitialized.current) {
      locationInitialized.current = true;
      loadSavedRadius();
      requestLocation();
    }
  }, []);

  const fetchListings = useCallback(async () => {
    // Always restore the header when fetching new data so it isn't stuck hidden
    if (!isHeaderVisible.current) {
      isHeaderVisible.current = true;
      headerHeight.setValue(HEADER_HEIGHT);
    }
    try {
      setError(null);
      const options = {
        ...(userCoords ? { lat: userCoords.lat, lng: userCoords.lng, radius } : { city: user?.city }),
        ...(minAge !== null ? { min_age: minAge } : {}),
        ...(maxAge !== null ? { max_age: maxAge } : {}),
        ...(selectedCategories.length > 0 ? { categories: selectedCategories.join(',') } : {}),
        ...getDayRange(selectedDays, specificDate),
      };
      const data = await listingAPI.getFeed(20, 0, options);
      setListings(data);
    } catch (err: any) {
      console.error('Fetch listings error:', err);
      setError(err.response?.data?.error?.message || 'Could not load activities');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userCoords, radius, user?.city, minAge, maxAge, selectedCategories, selectedDays, specificDate]);

  useEffect(() => {
    fetchListings();
  }, [radius, userCoords, minAge, maxAge, selectedCategories, selectedDays, specificDate]);

  useEffect(() => {
    if (filterVisible) {
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    }
  }, [filterVisible]);

  const refreshBell = useCallback(() => {
    notificationAPI.getUnreadCount().then(setUnreadNotifications).catch(() => {});
  }, []);

  useEffect(() => {
    registerBellRefresh(refreshBell);
  }, [refreshBell]);

  useFocusEffect(
    useCallback(() => {
      fetchListings();
      refreshBell();
    }, [fetchListings, refreshBell])
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchListings();
  }, [fetchListings]);

  const openFilter = () => {
    sheetTranslateY.setValue(700);
    setDraftRadius(radius);
    setDraftMinAge(minAge !== null ? String(minAge) : '');
    setDraftMaxAge(maxAge !== null ? String(maxAge) : '');
    setDraftCategories([...selectedCategories]);
    setDraftDays([...selectedDays]);
    setDraftSpecificDate(specificDate);
    setFilterVisible(true);
  };

  const applyFilter = async () => {
    const parsedMin = draftMinAge.trim() !== '' ? parseInt(draftMinAge) : null;
    const parsedMax = draftMaxAge.trim() !== '' ? parseInt(draftMaxAge) : null;

    if (parsedMin !== null && (isNaN(parsedMin) || parsedMin < 18 || parsedMin > 99)) {
      Alert.alert('Invalid Age', 'Minimum age must be between 18 and 99.');
      return;
    }
    if (parsedMax !== null && (isNaN(parsedMax) || parsedMax < 18 || parsedMax > 99)) {
      Alert.alert('Invalid Age', 'Maximum age must be between 18 and 99.');
      return;
    }
    if (parsedMin !== null && parsedMax !== null && parsedMin > parsedMax) {
      Alert.alert('Invalid Range', 'Minimum age cannot be greater than maximum age.');
      return;
    }

    await AsyncStorage.setItem(RADIUS_KEY, String(draftRadius));
    setRadius(draftRadius);
    setMinAge(parsedMin);
    setMaxAge(parsedMax);
    setSelectedCategories(draftCategories);
    setSelectedDays(draftDays);
    setSpecificDate(draftSpecificDate);
    setFilterVisible(false);
  };

  const clearFilter = () => {
    setDraftRadius(50);
    setDraftMinAge('');
    setDraftMaxAge('');
    setDraftCategories([]);
    setDraftDays([]);
    setDraftSpecificDate(null);
  };

  const renderHeader = () => (
    <Animated.View style={{ height: headerHeight, overflow: 'hidden' }}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.headerIcon} onPress={openFilter}>
            <Ionicons name="options-outline" size={26} color="#333" />
            {filtersActive && <View style={styles.filterDot} />}
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Tag A Long</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={26} color="#333" />
            {unreadNotifications > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.createButton} onPress={() => navigation.navigate('CreateActivity')}>
            <Ionicons name="add-circle-sharp" size={28} color="#E8572A" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  const renderFilterModal = () => (
    <Modal
      visible={filterVisible}
      transparent
      animationType="none"
      onRequestClose={() => setFilterVisible(false)}
    >
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setFilterVisible(false)} />
        <Animated.View style={[styles.modalSheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          <View {...sheetPanResponder.panHandlers}>
            <View style={styles.sheetHandle} />
          </View>

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filters</Text>
            <TouchableOpacity onPress={clearFilter}>
              <Text style={styles.clearText}>Clear all</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionLabel}>When</Text>
            <View style={styles.chipRow}>
              {DAY_OPTIONS.map(opt => {
                const active = draftDays.includes(opt.value);
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => {
                      setDraftSpecificDate(null);
                      setDraftDays(prev =>
                        active ? prev.filter(d => d !== opt.value) : [...prev, opt.value]
                      );
                    }}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.filterChip, draftSpecificDate !== null && styles.filterChipActive]}
                onPress={() => setShowDayPicker(true)}
              >
                <Ionicons name="calendar-outline" size={14} color={draftSpecificDate ? '#fff' : '#333'} />
                <Text style={[styles.filterChipText, draftSpecificDate !== null && styles.filterChipTextActive, { marginLeft: 4 }]}>
                  {draftSpecificDate
                    ? draftSpecificDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : 'Pick date'}
                </Text>
                {draftSpecificDate && (
                  <TouchableOpacity
                    onPress={() => setDraftSpecificDate(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.8)" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>

            {Platform.OS === 'android' && showDayPicker && (
              <DateTimePicker
                value={draftSpecificDate || new Date()}
                mode="date"
                display="default"
                minimumDate={new Date(new Date().setHours(0, 0, 0, 0))}
                onChange={(e, d) => {
                  setShowDayPicker(false);
                  if (e.type !== 'dismissed' && d) { setDraftSpecificDate(d); setDraftDays([]); }
                }}
              />
            )}

            <Text style={styles.sectionLabel}>Distance</Text>
            {!userCoords && (
              <TouchableOpacity style={styles.locationPrompt} onPress={requestLocation}>
                <Ionicons name="navigate-circle-outline" size={18} color="#E8572A" />
                <Text style={styles.locationPromptText}>Enable location for distance filtering</Text>
              </TouchableOpacity>
            )}
            <View style={styles.chipRow}>
              {RADIUS_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option}
                  style={[styles.filterChip, draftRadius === option && styles.filterChipActive]}
                  onPress={() => setDraftRadius(option)}
                >
                  <Text style={[styles.filterChipText, draftRadius === option && styles.filterChipTextActive]}>
                    {option} mi
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Age Range</Text>
            <View style={styles.ageInputRow}>
              <View style={styles.ageInputGroup}>
                <Text style={styles.ageInputLabel}>Min age</Text>
                <TextInput
                  style={styles.ageInput}
                  value={draftMinAge}
                  onChangeText={setDraftMinAge}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="18"
                  placeholderTextColor="#bbb"
                />
              </View>
              <View style={styles.ageDash}>
                <Text style={styles.ageDashText}>—</Text>
              </View>
              <View style={styles.ageInputGroup}>
                <Text style={styles.ageInputLabel}>Max age</Text>
                <TextInput
                  style={styles.ageInput}
                  value={draftMaxAge}
                  onChangeText={setDraftMaxAge}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="99"
                  placeholderTextColor="#bbb"
                />
              </View>
            </View>

            <Text style={styles.sectionLabel}>Categories</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map(cat => {
                const active = draftCategories.includes(cat.value);
                return (
                  <TouchableOpacity
                    key={cat.value}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => setDraftCategories(prev =>
                      active ? prev.filter(c => c !== cat.value) : [...prev, cat.value]
                    )}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.applyButton} onPress={applyFilter}>
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </TouchableOpacity>

          {Platform.OS === 'ios' && showDayPicker && (
            <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={() => setShowDayPicker(false)}>
              <View style={styles.pickerSheet} onStartShouldSetResponder={() => true}>
                <DateTimePicker
                  value={draftSpecificDate || new Date()}
                  mode="date"
                  display="inline"
                  minimumDate={new Date(new Date().setHours(0, 0, 0, 0))}
                  accentColor="#E8572A"
                  onChange={(_, d) => { if (d) { setDraftSpecificDate(d); setDraftDays([]); } }}
                />
                <View style={styles.pickerFooter}>
                  <TouchableOpacity onPress={() => setShowDayPicker(false)}>
                    <Text style={styles.pickerDone}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="calendar-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Activities Nearby</Text>
      <Text style={styles.emptySubtitle}>
        {userCoords
          ? `Nothing within ${radius} miles. Try increasing the radius.`
          : 'Be the first to create an activity!'}
      </Text>
      <TouchableOpacity
        style={styles.createFirstButton}
        onPress={() => navigation.navigate('CreateActivity')}
      >
        <Ionicons name="add-circle-outline" size={20} color="#fff" />
        <Text style={styles.createFirstButtonText}>Create Activity</Text>
      </TouchableOpacity>
    </View>
  );

  const renderError = () => (
    <View style={styles.errorState}>
      <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
      <Text style={styles.errorTitle}>Oops!</Text>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={fetchListings}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      {renderFilterModal()}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E8572A" />
          <Text style={styles.loadingText}>Loading activities...</Text>
        </View>
      ) : error && listings.length === 0 ? (
        renderError()
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              onPress={() => navigation.navigate('ActivityDetail', { activityId: item.id })}
            />
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#E8572A']}
              tintColor="#E8572A"
            />
          }
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          decelerationRate="normal"
        />
      )}
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  headerTitle: {
    flex: 1,
    fontSize: 32,
    fontFamily: 'Lora_600SemiBold_Italic',
    color: '#E8572A',
    textAlign: 'center',
  },
  headerLeft: {
    width: 80,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    width: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIcon: {
    padding: 5,
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#ff3b30',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  filterDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E8572A',
  },
  createButton: {
    padding: 5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  clearText: {
    fontSize: 14,
    color: '#E8572A',
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    marginBottom: 12,
  },
  locationPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  locationPromptText: {
    fontSize: 13,
    color: '#E8572A',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
  },
  filterChipActive: {
    backgroundColor: '#E8572A',
    borderColor: '#E8572A',
  },
  filterChipText: {
    fontSize: 14,
    color: '#333',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  ageInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginBottom: 28,
  },
  ageInputGroup: {
    flex: 1,
  },
  ageInputLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
    marginBottom: 6,
  },
  ageInput: {
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    textAlign: 'center',
    backgroundColor: '#f9fafb',
  },
  ageDash: {
    paddingBottom: 10,
  },
  ageDashText: {
    fontSize: 20,
    color: '#aaa',
    fontWeight: '300',
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 8,
    paddingBottom: 40,
  },
  pickerFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  pickerDone: {
    fontSize: 17,
    fontWeight: '600',
    color: '#E8572A',
  },
  applyButton: {
    backgroundColor: '#E8572A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
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
  listContent: {
    paddingTop: 0,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  createFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8572A',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 20,
  },
  createFirstButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  errorState: {
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
});
