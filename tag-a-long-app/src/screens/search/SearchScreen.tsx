// Search Screen - Search for activities and users
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SearchStackParamList, User, ActivityListing } from '../../types';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { profileAPI, listingAPI } from '../../api/endpoints';

type SearchScreenNavigationProp = NativeStackNavigationProp<SearchStackParamList, 'SearchMain'>;

interface Props {
  navigation: SearchScreenNavigationProp;
}

type Tab = 'activities' | 'people';

export default function SearchScreen({ navigation }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('activities');
  const [activityResults, setActivityResults] = useState<ActivityListing[]>([]);
  const [peopleResults, setPeopleResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setActivityResults([]);
      setPeopleResults([]);
      setHasSearched(false);
      return;
    }

    try {
      setIsSearching(true);
      const [activities, people] = await Promise.all([
        listingAPI.search(query),
        profileAPI.searchUsers(query),
      ]);
      setActivityResults(activities);
      setPeopleResults(people);
      setHasSearched(true);
    } catch (error) {
      setActivityResults([]);
      setPeopleResults([]);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleChangeText = (text: string) => {
    setSearchQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(text), 400);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setActivityResults([]);
    setPeopleResults([]);
    setHasSearched(false);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const renderActivityCard = ({ item }: { item: ActivityListing }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ActivityDetail', { activityId: item.id })}
    >
      <View style={styles.cardContent}>
        {item.photo_url ? (
          <Image source={{ uri: item.photo_url }} style={styles.activityImage} contentFit="cover" />
        ) : (
          <View style={[styles.activityImage, styles.imagePlaceholder]}>
            <Ionicons name="image-outline" size={28} color="#ccc" />
          </View>
        )}
        <View style={styles.activityInfo}>
          <Text style={styles.activityTitle} numberOfLines={1}>{item.title}</Text>
          {item.category && (
            <Text style={styles.activityCategory}>{item.category}</Text>
          )}
          {item.location && (
            <View style={styles.rowInfo}>
              <Ionicons name="location-outline" size={13} color="#999" />
              <Text style={styles.infoText} numberOfLines={1}>{item.location}</Text>
            </View>
          )}
          {item.date && (
            <View style={styles.rowInfo}>
              <Ionicons name="calendar-outline" size={13} color="#999" />
              <Text style={styles.infoText}>{formatDate(item.date)}</Text>
            </View>
          )}
          {item.user && (
            <Text style={styles.postedBy}>by {item.user.display_name}</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color="#ccc" />
      </View>
    </TouchableOpacity>
  );

  const renderUserCard = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('UserProfile', { user: item })}
    >
      <View style={styles.cardContent}>
        {item.profile_photo_url ? (
          <Image source={{ uri: item.profile_photo_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={28} color="#999" />
          </View>
        )}
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.displayName}>{item.display_name}</Text>
            {item.is_premium && <Ionicons name="checkmark-circle" size={15} color="#E8572A" />}
          </View>
          <Text style={styles.username}>@{item.username}</Text>
          {item.city && (
            <View style={styles.rowInfo}>
              <Ionicons name="location-outline" size={13} color="#999" />
              <Text style={styles.infoText}>{item.city}</Text>
            </View>
          )}
          {item.bio && <Text style={styles.bio} numberOfLines={1}>{item.bio}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={18} color="#ccc" />
      </View>
    </TouchableOpacity>
  );

  const currentResults = activeTab === 'activities' ? activityResults : peopleResults;
  const currentCount = currentResults.length;

  const renderEmpty = () => {
    if (!hasSearched) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={60} color="#ccc" />
          <Text style={styles.emptyTitle}>
            {activeTab === 'activities' ? 'Search Activities' : 'Search People'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {activeTab === 'activities'
              ? 'Try "pickleball", "hiking", "coffee"...'
              : 'Search by name or username'}
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Ionicons name="sad-outline" size={60} color="#ccc" />
        <Text style={styles.emptyTitle}>No Results</Text>
        <Text style={styles.emptySubtitle}>Try a different keyword</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder={activeTab === 'activities' ? 'Search activities...' : 'Search by name or username...'}
            value={searchQuery}
            onChangeText={handleChangeText}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'activities' && styles.tabActive]}
          onPress={() => setActiveTab('activities')}
        >
          <Text style={[styles.tabText, activeTab === 'activities' && styles.tabTextActive]}>
            Activities {hasSearched && activityResults.length > 0 ? `(${activityResults.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'people' && styles.tabActive]}
          onPress={() => setActiveTab('people')}
        >
          <Text style={[styles.tabText, activeTab === 'people' && styles.tabTextActive]}>
            People {hasSearched && peopleResults.length > 0 ? `(${peopleResults.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {isSearching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E8572A" />
        </View>
      ) : (
        <FlatList
          data={currentResults as any[]}
          keyExtractor={(item) => item.id}
          renderItem={activeTab === 'activities' ? renderActivityCard : renderUserCard}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 22, fontFamily: 'Lora_600SemiBold_Italic', color: '#E8572A' },
  searchContainer: { padding: 16, backgroundColor: '#fff' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 16, marginLeft: 8, color: '#333' },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#E8572A' },
  tabText: { fontSize: 15, color: '#999', fontWeight: '500' },
  tabTextActive: { color: '#E8572A', fontWeight: '600' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, flexGrow: 1 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  cardContent: { flexDirection: 'row', alignItems: 'center' },
  activityImage: { width: 64, height: 64, borderRadius: 10 },
  imagePlaceholder: {
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityInfo: { flex: 1, marginLeft: 12 },
  activityTitle: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 2 },
  activityCategory: {
    fontSize: 12,
    color: '#E8572A',
    fontWeight: '500',
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  rowInfo: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  infoText: { fontSize: 12, color: '#666', marginLeft: 4, flex: 1 },
  postedBy: { fontSize: 12, color: '#999', marginTop: 4 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  displayName: { fontSize: 15, fontWeight: '600', color: '#333' },
  username: { fontSize: 13, color: '#666', marginTop: 2 },
  bio: { fontSize: 12, color: '#666', marginTop: 3 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#999', marginTop: 8, textAlign: 'center' },
});
