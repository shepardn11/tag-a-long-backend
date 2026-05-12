// Chat Screen - Individual conversation
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,

  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { messageAPI, safetyAPI } from '../../api/endpoints';
import { useAuthStore } from '../../store/authStore';
import { refreshTabCounts } from '../../utils/tabRefresh';

const ACTIVITY_SHARE_PREFIX = '[activity_share]';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender: {
    id: string;
    username: string;
    display_name: string;
    profile_photo_url?: string;
  };
}

export default function ChatScreen({ route, navigation }: any) {
  const { conversationId, otherUser } = route.params;
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const handleMenuPress = () => {
    Alert.alert(otherUser.display_name, undefined, [
      {
        text: 'Report',
        onPress: handleReportUser,
      },
      {
        text: 'Block',
        style: 'destructive',
        onPress: confirmBlockUser,
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const confirmBlockUser = () => {
    Alert.alert(
      `Block ${otherUser.display_name}?`,
      "They won't be able to message you and their conversations will be hidden. You can unblock them from your profile settings.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await safetyAPI.blockUser(otherUser.id);
              Alert.alert('Blocked', `${otherUser.display_name} has been blocked.`);
              navigation.navigate('MessagesList');
            } catch {
              Alert.alert('Error', 'Could not block user. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleReportUser = () => {
    const REASONS: { label: string; value: string }[] = [
      { label: 'Harassment', value: 'harassment' },
      { label: 'Spam', value: 'spam' },
      { label: 'Inappropriate content', value: 'inappropriate_content' },
      { label: 'Fake account', value: 'fake_account' },
      { label: 'Other', value: 'other' },
    ];

    Alert.alert(
      'Report User',
      'Why are you reporting this user?',
      [
        ...REASONS.map(r => ({
          text: r.label,
          onPress: async () => {
            try {
              await safetyAPI.reportUser(otherUser.id, r.value);
              Alert.alert('Reported', 'Thank you for your report. We will review it shortly.');
            } catch {
              Alert.alert('Error', 'Could not submit report. Please try again.');
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(() => {
      messageAPI.getMessages(conversationId).then(data => {
        setMessages(data);
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [conversationId]);

  const fetchMessages = async () => {
    try {
      const data = await messageAPI.getMessages(conversationId);
      setMessages(data);
      setLoading(false);
      refreshTabCounts();
    } catch (error) {
      console.error('Error fetching messages:', error);
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const newMessage = await messageAPI.sendMessage(conversationId, messageText);
      setMessages([...messages, newMessage]);

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      setInputText(messageText); // Restore text on error
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatActivityDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const formatActivityTime = (t?: string) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hr = parseInt(h);
    return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
  };

  const renderActivityCard = (item: Message, isMyMessage: boolean) => {
    try {
      const activity = JSON.parse(item.content.slice(ACTIVITY_SHARE_PREFIX.length));
      return (
        <TouchableOpacity
          style={[styles.activityCard, isMyMessage ? styles.myActivityCard : styles.otherActivityCard]}
          activeOpacity={0.85}
          onPress={() => {
            navigation.getParent()?.navigate('Home', {
              screen: 'ActivityDetail',
              params: { activityId: activity.id },
            });
          }}
        >
          {activity.photo_url ? (
            <Image source={{ uri: activity.photo_url }} style={styles.activityCardImage} contentFit="cover" />
          ) : (
            <View style={[styles.activityCardImage, styles.activityCardImagePlaceholder]}>
              <Ionicons name="image-outline" size={32} color="#ccc" />
            </View>
          )}
          <View style={styles.activityCardBody}>
            <Text style={styles.activityCardTitle} numberOfLines={2}>{activity.title}</Text>
            <Text style={styles.activityCardMeta}>
              📅 {formatActivityDate(activity.date)}{activity.time ? '  ·  ' + formatActivityTime(activity.time) : ''}
            </Text>
            <Text style={styles.activityCardMeta} numberOfLines={1}>📍 {activity.location}</Text>
            <Text style={styles.activityCardCta}>View Activity →</Text>
          </View>
          <Text style={[styles.messageTime, isMyMessage ? styles.myMessageTime : styles.otherMessageTime, { paddingHorizontal: 10, paddingBottom: 6 }]}>
            {formatTime(item.created_at)}
          </Text>
        </TouchableOpacity>
      );
    } catch {
      return null;
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMyMessage = item.sender_id === user?.id;
    const showAvatar =
      index === messages.length - 1 ||
      messages[index + 1]?.sender_id !== item.sender_id;
    const isActivityShare = item.content.startsWith(ACTIVITY_SHARE_PREFIX);

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer,
        ]}
      >
        {!isMyMessage && showAvatar && (
          <View style={styles.avatarContainer}>
            {otherUser.profile_photo_url ? (
              <Image
                source={{ uri: otherUser.profile_photo_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={16} color="#999" />
              </View>
            )}
          </View>
        )}
        {!isMyMessage && !showAvatar && <View style={styles.avatarSpacer} />}

        {isActivityShare ? (
          renderActivityCard(item, isMyMessage)
        ) : (
          <View
            style={[
              styles.messageBubble,
              isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isMyMessage ? styles.myMessageText : styles.otherMessageText,
                item.content.startsWith('You have been accepted to tag along') && styles.acceptanceMessageText,
              ]}
            >
              {item.content}
            </Text>
            <Text
              style={[
                styles.messageTime,
                isMyMessage ? styles.myMessageTime : styles.otherMessageTime,
              ]}
            >
              {formatTime(item.created_at)}
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E8572A" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              // Navigate to MessagesList instead of goBack to ensure we stay in Messages tab
              if (navigation.canGoBack()) {
                navigation.navigate('MessagesList');
              }
            }}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={28} color="#000" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{otherUser.display_name}</Text>
            <Text style={styles.headerSubtitle}>@{otherUser.username}</Text>
          </View>
          <TouchableOpacity onPress={handleMenuPress} style={styles.blockButton}>
            <Ionicons name="ellipsis-vertical" size={22} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          inverted={false}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-ellipses-outline" size={48} color="#ddd" />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start the conversation!</Text>
            </View>
          }
        />

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  blockButton: {
    padding: 8,
    width: 40,
    alignItems: 'center',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginRight: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSpacer: {
    width: 40,
  },
  messageBubble: {
    maxWidth: '70%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  myMessageBubble: {
    backgroundColor: '#E8572A',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  acceptanceMessageText: {
    fontWeight: 'bold',
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#000',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  myMessageTime: {
    color: '#fff',
    opacity: 0.8,
    textAlign: 'right',
  },
  otherMessageTime: {
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 4,
  },
  activityCard: {
    width: 240,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
  },
  myActivityCard: {
    backgroundColor: '#fff',
    borderColor: '#E8572A44',
  },
  otherActivityCard: {
    backgroundColor: '#fff',
    borderColor: '#e0e0e0',
  },
  activityCardImage: {
    width: '100%',
    height: 130,
  },
  activityCardImagePlaceholder: {
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityCardBody: {
    padding: 10,
    gap: 3,
  },
  activityCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  activityCardMeta: {
    fontSize: 12,
    color: '#555',
    lineHeight: 18,
  },
  activityCardCta: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E8572A',
    marginTop: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 10,
    fontSize: 15,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8572A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
