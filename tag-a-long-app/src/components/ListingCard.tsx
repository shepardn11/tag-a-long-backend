// Listing Card Component - Display activity listing
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ActivityListing } from '../types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ListingCardProps {
  listing: ActivityListing;
  onPress?: () => void;
  pendingRequestCount?: number;
}

export default function ListingCard({ listing, onPress, pendingRequestCount }: ListingCardProps) {

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: keyof typeof Ionicons.glyphMap } = {
      sports: 'football',
      food: 'restaurant',
      entertainment: 'film',
      outdoor: 'leaf',
      fitness: 'barbell',
      social: 'people',
      music: 'musical-notes',
      gaming: 'game-controller',
      travel: 'car',
      arts: 'color-palette',
      nightlife: 'moon',
      wellness: 'heart',
      volunteering: 'hand-left',
      learning: 'book',
      pets: 'paw',
      dating: 'heart-circle',
      other: 'apps',
    };
    return icons[category] || 'apps';
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      sports: '#10b981',
      food: '#f59e0b',
      entertainment: '#8b5cf6',
      outdoor: '#22c55e',
      fitness: '#ef4444',
      social: '#3b82f6',
      music: '#ec4899',
      gaming: '#6366f1',
      travel: '#0ea5e9',
      arts: '#f97316',
      nightlife: '#7c3aed',
      wellness: '#14b8a6',
      volunteering: '#84cc16',
      learning: '#eab308',
      pets: '#d97706',
      dating: '#f43f5e',
      other: '#6b7280',
    };
    return colors[category] || '#6b7280';
  };

  const getCategoryLabel = (category: string) => {
    const labels: { [key: string]: string } = {
      sports: 'Sports', food: 'Food', entertainment: 'Entertainment',
      outdoor: 'Outdoors', fitness: 'Fitness', social: 'Social',
      music: 'Music', gaming: 'Gaming', travel: 'Travel',
      arts: 'Arts', nightlife: 'Nightlife', wellness: 'Wellness',
      volunteering: 'Volunteering', learning: 'Learning', pets: 'Pets', dating: 'Dating', other: 'Other',
    };
    return labels[category] || category;
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.95}
    >

      {/* Large Featured Image - Use photo_url, fall back to category placeholder */}
      {(listing.photo_url || listing.profile_photo_url) ? (
        <Image
          source={{ uri: listing.photo_url || listing.profile_photo_url }}
          style={styles.featuredImage}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.featuredImage, { backgroundColor: getCategoryColor(listing.category) }]}>
          <View style={styles.categoryPlaceholder}>
            <Ionicons name={getCategoryIcon(listing.category)} size={110} color="rgba(255,255,255,0.25)" />
          </View>
        </View>
      )}

      {/* Category Badge - Top Right */}
      <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(listing.category) }]}>
        <Ionicons
          name={getCategoryIcon(listing.category)}
          size={14}
          color="#fff"
        />
        <Text style={styles.categoryText}>
          {getCategoryLabel(listing.category)}
        </Text>
      </View>

      {/* Request Badge - Top Left */}
      {pendingRequestCount && pendingRequestCount > 0 && (
        <View style={styles.requestBadge}>
          <Ionicons name="notifications" size={16} color="#fff" />
          <Text style={styles.requestBadgeText}>{String(pendingRequestCount)}</Text>
        </View>
      )}

      {/* Content Overlay - Bottom */}
      <View style={styles.contentOverlay}>
        <View style={[styles.infoItem, styles.titleBubble]}>
          <Text style={styles.title} numberOfLines={2}>{listing.title}</Text>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Ionicons name="calendar" size={18} color="#fff" />
            <Text style={styles.infoText} numberOfLines={1}>
              {formatDate(listing.date)}
            </Text>
          </View>

          {listing.time && (
            <View style={styles.infoItem}>
              <Ionicons name="time" size={18} color="#fff" />
              <Text style={styles.infoText} numberOfLines={1}>
                {formatTime(listing.time)}
              </Text>
            </View>
          )}

          <View style={styles.infoItem}>
            <Ionicons name="location" size={18} color="#fff" />
            <Text style={styles.infoText} numberOfLines={1}>
              {listing.location}
            </Text>
          </View>
        </View>

        <Text style={styles.userName}>{listing.display_name || listing.username}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#000',
    marginBottom: 6,
    minHeight: SCREEN_HEIGHT * 0.69,
    overflow: 'hidden',
    position: 'relative',
  },
  featuredImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  categoryPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 2,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 5,
  },
  requestBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 2,
  },
  requestBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 4,
  },
  contentOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    justifyContent: 'center',
    zIndex: 2,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
    gap: 6,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  titleBubble: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  infoItemFull: {
    flex: 1,
    minWidth: '100%',
  },
  infoText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 6,
  },
  userName: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
});
