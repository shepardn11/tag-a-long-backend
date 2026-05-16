// App Navigator - Main navigation structure with bottom tabs
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList, MainTabParamList } from '../types';
import { useAuthStore } from '../store/authStore';
import { navigationRef } from './navigationRef';

const TAB_ORDER = ['Home', 'Search', 'Messages', 'MyActivities', 'Profile'] as const;
import { ActivityIndicator, View, PanResponder, Animated, Easing } from 'react-native';

// Navigators
import AuthNavigator from './AuthNavigator';

// Import main screens (we'll create these)
import FeedScreen from '../screens/home/FeedScreen';
import CreateListingScreen from '../screens/home/CreateListingScreen';
import ActivityDetailScreen from '../screens/home/ActivityDetailScreen';
import SearchScreen from '../screens/search/SearchScreen';
import UserProfileScreen from '../screens/user/UserProfileScreen';
import MessagesScreen from '../screens/messages/MessagesScreen';
import ChatScreen from '../screens/messages/ChatScreen';
import MyActivitiesScreen from '../screens/activities/MyActivitiesScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import { HomeStackParamList, SearchStackParamList, ActivitiesStackParamList, MessagesStackParamList } from '../types';
import { registerTabRefresh } from '../utils/tabRefresh';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const SearchStack = createNativeStackNavigator<SearchStackParamList>();
const MessagesStack = createNativeStackNavigator<MessagesStackParamList>();
const ActivitiesStack = createNativeStackNavigator<ActivitiesStackParamList>();

// Home Stack Navigator
function HomeNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Feed" component={FeedScreen} />
      <HomeStack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
      <HomeStack.Screen name="CreateActivity" component={CreateListingScreen} />
      <HomeStack.Screen name="UserProfile" component={UserProfileScreen} />
    </HomeStack.Navigator>
  );
}

// Search Stack Navigator
function SearchNavigator() {
  return (
    <SearchStack.Navigator screenOptions={{ headerShown: false }}>
      <SearchStack.Screen name="SearchMain" component={SearchScreen} />
      <SearchStack.Screen name="UserProfile" component={UserProfileScreen} />
      <SearchStack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
    </SearchStack.Navigator>
  );
}

// Messages Stack Navigator
function MessagesNavigator() {
  return (
    <MessagesStack.Navigator screenOptions={{ headerShown: false }}>
      <MessagesStack.Screen name="MessagesList" component={MessagesScreen} />
      <MessagesStack.Screen name="Chat" component={ChatScreen} />
    </MessagesStack.Navigator>
  );
}

// Activities Stack Navigator
function ActivitiesNavigator() {
  return (
    <ActivitiesStack.Navigator screenOptions={{ headerShown: false }}>
      <ActivitiesStack.Screen name="MyActivitiesMain" component={MyActivitiesScreen} />
      <ActivitiesStack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
      <ActivitiesStack.Screen name="CreateActivity" component={CreateListingScreen} />
      <ActivitiesStack.Screen name="UserProfile" component={UserProfileScreen} />
    </ActivitiesStack.Navigator>
  );
}

// Bottom Tab Navigator
function MainTabs() {
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = React.useState(0);
  const currentTabIndex = React.useRef(0);
  const swipeX = React.useRef(new Animated.Value(0)).current;

  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > Math.abs(g.dy) * 1.5 && Math.abs(g.dx) > 15,
      onPanResponderMove: (_, g) => {
        swipeX.setValue(g.dx * 0.15);
      },
      onPanResponderRelease: (_, g) => {
        const isLeft = g.dx < -50 || (g.vx < -0.5 && g.dx < -10);
        const isRight = g.dx > 50 || (g.vx > 0.5 && g.dx > 10);
        if (isLeft && currentTabIndex.current < TAB_ORDER.length - 1) {
          navigationRef.current?.navigate(TAB_ORDER[currentTabIndex.current + 1] as never);
          swipeX.setValue(20);
        } else if (isRight && currentTabIndex.current > 0) {
          navigationRef.current?.navigate(TAB_ORDER[currentTabIndex.current - 1] as never);
          swipeX.setValue(-20);
        }
        Animated.timing(swipeX, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      },
    })
  ).current;

  // Fetch unread message count
  const fetchUnreadCount = async () => {
    try {
      const { messageAPI } = await import('../api/endpoints');
      const conversations = await messageAPI.getConversations();
      const totalUnread = conversations.reduce(
        (sum: number, conv: any) => sum + conv.unread_count,
        0
      );
      setUnreadCount(totalUnread);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  // Fetch pending request count via unread request_received notifications
  const fetchPendingRequests = async () => {
    try {
      const { notificationAPI } = await import('../api/endpoints');
      const result = await notificationAPI.getAll(true) as any;
      const notifs: any[] = result.notifications ?? result ?? [];
      const count = notifs.filter((n: any) => n.type === 'request_received').length;
      setPendingRequestsCount(count);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    }
  };

  // Fetch counts on mount and periodically
  React.useEffect(() => {
    fetchUnreadCount();
    fetchPendingRequests();
    registerTabRefresh(() => {
      fetchUnreadCount();
      fetchPendingRequests();
    });
    const interval = setInterval(() => {
      fetchUnreadCount();
      fetchPendingRequests();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
    <Animated.View style={{ flex: 1, transform: [{ translateX: swipeX }] }}>
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Search') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'Messages') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'MyActivities') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={24} color={color} />;
        },
        tabBarActiveTintColor: '#E8572A',
        tabBarInactiveTintColor: 'gray',
        tabBarShowLabel: false,
        tabBarStyle: {
          paddingBottom: 8,
          paddingTop: 8,
          paddingHorizontal: 20,
          height: 68,
          backgroundColor: '#fff',
          borderTopWidth: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.07,
          shadowRadius: 10,
          elevation: 12,
        },
        tabBarItemStyle: {
          marginHorizontal: 4,
        },
        headerShown: false,
      })}
      screenListeners={{
        state: (e: any) => {
          currentTabIndex.current = e.data?.state?.index ?? 0;
          fetchUnreadCount();
          fetchPendingRequests();
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeNavigator}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="Search"
        component={SearchNavigator}
        options={{ tabBarLabel: 'Search' }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesNavigator}
        options={{
          tabBarLabel: 'Messages',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#ff3b30',
            color: '#fff',
            fontSize: 11,
            fontWeight: '600',
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            marginTop: 2,
          },
        }}
      />
      <Tab.Screen
        name="MyActivities"
        component={ActivitiesNavigator}
        options={{
          tabBarLabel: 'Activities',
          tabBarBadge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#ff3b30',
            color: '#fff',
            fontSize: 11,
            fontWeight: '600',
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            marginTop: 2,
          },
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
    </Animated.View>
    </View>
  );
}

// Root Navigator
export default function AppNavigator() {
  const { isAuthenticated, isLoading, loadUser } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#E8572A" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <RootStack.Screen name="Main" component={MainTabs} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
