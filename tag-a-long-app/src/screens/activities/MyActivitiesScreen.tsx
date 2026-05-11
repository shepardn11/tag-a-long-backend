// My Activities Screen - User's created activities and requests
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ActivityListing, ActivitiesStackParamList } from '../../types';
import { listingAPI } from '../../api/endpoints';
import ListingCard from '../../components/ListingCard';


type MyActivitiesScreenNavigationProp = NativeStackNavigationProp<ActivitiesStackParamList, 'MyActivitiesMain'>;

export default function MyActivitiesScreen() {
  const navigation = useNavigation<MyActivitiesScreenNavigationProp>();
  const [listings, setListings] = useState<ActivityListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFocused = useIsFocused();

  const fetchMyListings = async () => {
    try {
      setError(null);
      const data = await listingAPI.getMyListings();
      setListings(data);
    } catch (err: any) {
      console.error('Fetch my listings error:', err);
      setError(err.response?.data?.error?.message || 'Could not load your activities');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchMyListings();
    }
  }, [isFocused]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchMyListings();
  }, []);

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="calendar-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Activities Yet</Text>
      <Text style={styles.emptySubtitle}>Activities you create will appear here</Text>
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => navigation.navigate('CreateActivity')}
      >
        <Ionicons name="add-circle" size={48} color="#E8572A" />
      </TouchableOpacity>
    </View>
  );

  const renderError = () => (
    <View style={styles.errorState}>
      <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
      <Text style={styles.errorTitle}>Oops!</Text>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={fetchMyListings}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Activities</Text>
        <TouchableOpacity style={styles.headerCreateButton} onPress={() => navigation.navigate('CreateActivity')}>
          <Ionicons name="add-circle-sharp" size={28} color="#E8572A" />
        </TouchableOpacity>
      </View>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E8572A" />
          <Text style={styles.loadingText}>Loading your activities...</Text>
        </View>
      ) : error ? (
        renderError()
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const pendingCount = (item as any).requests?.filter((r: any) => r.status === 'pending').length || 0;
            return (
              <ListingCard
                listing={item}
                onPress={() => navigation.navigate('ActivityDetail', { activityId: item.id })}
                pendingRequestCount={pendingCount}
              />
            );
          }}
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  headerCreateButton: {
    position: 'absolute',
    right: 20,
    bottom: 12,
    padding: 5,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Lora_600SemiBold_Italic',
    color: '#E8572A',
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
    color: '#E8572A',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  createButton: {
    marginTop: 20,
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
    color: '#E8572A',
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
